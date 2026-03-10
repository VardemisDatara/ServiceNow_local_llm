import { invoke } from '@tauri-apps/api/core';
import { Channel } from '@tauri-apps/api/core';
import { aiSessionRepository } from '../storage/repositories/session';
import { conversationMessageRepository } from '../storage/repositories/message';
import { augmentWithSearch, formatSearchForContext } from './search-augmentation';
import { executeMCPTool } from '../mcp/client';
import { openaiProvider } from '../integrations/llm/openai';
import { mistralProvider } from '../integrations/llm/mistral';
import type { AISession, ConversationMessage } from '../storage/schema';
import type { ToolMessageMetadata, WebSearchMetadata, LLMProviderMetadata } from '../mcp/protocol';
import type { SearchContext } from '../integrations/search/provider';
import type { LLMContext } from '../integrations/llm/provider';
import { IPC } from '../../main/ipc';
import { useAppStore } from '../../renderer/store/index';
import { logger } from '../../utils/logger';

/**
 * T048 + T053 + T071: Chat service
 * Orchestrates message sending, Ollama streaming, MCP tool calling,
 * DB persistence, and search augmentation
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/** Event from the Rust streaming command */
export type ChatStreamEvent =
  | { type: 'token'; content: string }
  | { type: 'done'; total_duration_ms: number }
  | { type: 'error'; message: string };

/** Context for enabling MCP tool calling */
export interface MCPContext {
  profileId: string;
  servicenowUrl: string;
  ollamaEndpoint: string;
  ollamaModel: string;
}

export interface SendMessageOptions {
  sessionId: string;
  content: string;
  ollamaEndpoint: string;
  ollamaModel: string;
  onToken: (token: string) => void;
  onDone: (totalMs: number) => void;
  onError: (message: string) => void;
  persist?: boolean;
  /** When provided, MCP tool calling is enabled before the streaming response */
  mcpContext?: MCPContext;
  /** When provided, web search augmentation uses this provider instead of DuckDuckGo */
  searchContext?: SearchContext;
  /** When provided, routes the response through a cloud LLM instead of Ollama (T112) */
  llmContext?: LLMContext;
}

/**
 * Send a user message and stream the AI response.
 * Handles DB persistence, MCP tool calling, search augmentation, and streaming.
 */
export async function sendMessage(opts: SendMessageOptions): Promise<ConversationMessage | null> {
  const {
    sessionId,
    content,
    ollamaEndpoint,
    ollamaModel,
    onToken,
    onDone,
    onError,
    persist = true,
    mcpContext,
  } = opts;

  logger.info('Sending message', { sessionId, model: ollamaModel });

  // 1. Persist user message
  if (persist) {
    const seq = await conversationMessageRepository.getNextSequenceNumber(sessionId);
    await conversationMessageRepository.create({
      sessionId,
      sender: 'user',
      content,
      sequenceNumber: seq,
      metadata: null,
    });
    await aiSessionRepository.incrementMessageCount(sessionId);
  }

  // 2. Build message history for Ollama context (last 20 messages)
  const history = await conversationMessageRepository.getLatestMessages(sessionId, 20);
  const ollamaMessages: ChatMessage[] = history
    .filter((m) => m.sender === 'user' || m.sender === 'ollama')
    .map((m) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));

  // Track whether the current user message has been explicitly appended to ollamaMessages.
  // Using an explicit flag is more reliable than content-matching (which can produce false
  // positives when the user repeats an earlier message verbatim).
  let userMessageAdded = false;

  // 2b. Inject a system message listing available Now Assist tools when connected.
  // This lets the model correctly describe available tools and understand injected
  // tool results.  Done BEFORE tool calling so the model has full context.
  {
    const { nowAssistConnected: naConnected, nowAssistTools: naTools } = useAppStore.getState();
    if (naConnected && naTools.length > 0) {
      const toolList = naTools
        .map((t) => `- ${t.name}: ${t.description}`)
        .join('\n');
      ollamaMessages.unshift({
        role: 'system',
        content:
          'You are an AI assistant integrated with ServiceNow via MCP (Model Context Protocol). ' +
          'The following Now Assist tools are available. When the user asks to perform a task that ' +
          'matches a tool, the tool result is automatically injected into the conversation before ' +
          'your response.\n\n' +
          `Available Now Assist tools:\n${toolList}\n\n` +
          'When asked about available tools or capabilities, list and describe the tools above.',
      });
    }
  }

  // 3. MCP Tool Calling — detect intent, run tools, inject context as user/assistant
  // pairs BEFORE the user's current message so phi3:mini sees the data as prior context
  let nowAssistDegraded = false;
  if (mcpContext) {
    const { messages: toolContextMessages, nowAssistDegraded: degraded } = await executeMCPToolCalls(
      content,
      mcpContext,
      sessionId,
      persist,
    );
    if (toolContextMessages.length > 0) {
      ollamaMessages.push(...toolContextMessages);
    }
    nowAssistDegraded = degraded;
  }

  // 3b. Web search — run BEFORE streaming and embed results directly in the user message.
  // Small models (phi3:mini) ignore separate context pairs; prepending to the question works.
  // (augmentedUserContent reserved for future use; search injected as context pair instead)
  if (opts.searchContext) {
    try {
      const { shouldAugment, searchResults, query, provider: usedProvider, error: searchError } =
        await augmentWithSearch(content, opts.searchContext);

      if (shouldAugment) {
        // Persist the web_search card so it appears in the chat UI
        if (persist) {
          const webSearchMeta: WebSearchMetadata = {
            type: 'web_search',
            query,
            provider: usedProvider,
            results: searchResults,
            ...(searchError !== undefined ? { error: searchError } : {}),
          };
          const seq = await conversationMessageRepository.getNextSequenceNumber(sessionId);
          await conversationMessageRepository.create({
            sessionId,
            sender: 'web_search',
            content: `Web search: "${query}"`,
            sequenceNumber: seq,
            metadata: webSearchMeta,
          });
          await aiSessionRepository.incrementMessageCount(sessionId);
        }

        // Inject as a prior user/assistant exchange — the same pattern that works
        // for MCP tool results. The model sees it as something it already said.
        if (searchResults.length > 0) {
          const contextText = formatSearchForContext(searchResults, query);
          ollamaMessages.push({
            role: 'user',
            content: `What is the latest information about "${query}"?`,
          });
          ollamaMessages.push({ role: 'assistant', content: contextText });
        }
      }
    } catch (err) {
      logger.warn('Web search augmentation failed', {}, err as Error);
    }
  }

  // Add current user message after any injected search context
  if (!userMessageAdded) {
    ollamaMessages.push({ role: 'user', content });
    userMessageAdded = true;
  }

  // 4. Stream LLM response — route to cloud provider or local Ollama (T112/T118)
  let fullResponse = '';
  let streamError: string | null = null;

  const useCloudLLM = opts.llmContext && opts.llmContext.provider !== 'ollama';

  if (useCloudLLM && opts.llmContext) {
    // Cloud LLM path: fetch directly from renderer (OpenAI / Mistral)
    const { provider, profileId, model: cloudModel } = opts.llmContext;
    const cloudProvider = provider === 'openai' ? openaiProvider : mistralProvider;

    let apiKey: string;
    try {
      apiKey = await IPC.getApiKey(`llm_${provider}`, profileId);
    } catch {
      streamError = `${provider} API key not found — configure it in Settings`;
      onError(streamError);
      return null;
    }

    await cloudProvider.stream(ollamaMessages, cloudModel, apiKey, {
      onToken: (token) => {
        fullResponse += token;
        onToken(token);
      },
      onDone,
      onError: (msg) => {
        streamError = msg;
        onError(msg);
      },
    });
  } else {
    // Local Ollama path: stream via Tauri Channel (IPC to Rust backend)
    const STREAM_TIMEOUT_MS = 60_000;
    const streamPromise = new Promise<void>((resolve) => {
      const channel = new Channel<ChatStreamEvent>();

      channel.onmessage = (event) => {
        if (event.type === 'token') {
          fullResponse += event.content;
          onToken(event.content);
        } else if (event.type === 'done') {
          onDone(event.total_duration_ms);
          resolve();
        } else if (event.type === 'error') {
          streamError = event.message;
          onError(event.message);
          resolve();
        }
      };

      invoke('send_chat_message', {
        endpoint: ollamaEndpoint,
        model: ollamaModel,
        messages: ollamaMessages,
        onEvent: channel,
      }).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        streamError = msg;
        onError(msg);
        resolve();
      });
    });

    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        if (!streamError && !fullResponse) {
          streamError = 'Response timed out after 60 seconds. Ollama may be overloaded.';
          onError(streamError);
        }
        resolve();
      }, STREAM_TIMEOUT_MS);
    });

    await Promise.race([streamPromise, timeoutPromise]);
  }

  // T025: Append degradation note when a Now Assist tool was detected but skipped
  if (nowAssistDegraded && fullResponse && !streamError) {
    fullResponse += '\n\n[Now Assist unavailable for this response — answered using local model only]';
  }

  if (streamError || !fullResponse) {
    return null;
  }

  // 5. (Search was already handled pre-streaming in step 3b — results injected into context)

  // 6. Persist AI response with provider attribution (T117/T118)
  let assistantMessage: ConversationMessage | null = null;
  if (persist) {
    const aiSender: ConversationMessage['sender'] =
      opts.llmContext?.provider === 'openai' ? 'openai' :
      opts.llmContext?.provider === 'mistral' ? 'mistral' :
      'ollama';

    // Attach cloud provider metadata so Message.tsx can display correct attribution
    const llmMeta: LLMProviderMetadata | null =
      aiSender === 'openai' || aiSender === 'mistral'
        ? { type: 'llm_provider', provider: aiSender, model: opts.llmContext?.model ?? '' }
        : null;

    const seq = await conversationMessageRepository.getNextSequenceNumber(sessionId);
    assistantMessage = await conversationMessageRepository.create({
      sessionId,
      sender: aiSender,
      content: fullResponse,
      sequenceNumber: seq,
      metadata: llmMeta,
    });
    await aiSessionRepository.incrementMessageCount(sessionId);
  }

  return assistantMessage;
}

/**
 * Extract MCP tool calls from a user's natural language message using pattern detection.
 * Works with any Ollama model — no native tool-calling support required.
 *
 * T021: Also checks Zustand store for connected Now Assist tools; matches user message
 * against tool descriptions using keyword analysis. Exported for unit testing.
 */
export function detectToolCallsFromMessage(
  content: string,
): Array<{ name: string; provider?: string; arguments: Record<string, unknown> }> {
  const calls: Array<{ name: string; provider?: string; arguments: Record<string, unknown> }> = [];

  // 1. CVE identifiers → assess_vulnerability (always triggered, no keyword needed)
  const cvePattern = /\bCVE-\d{4}-\d+\b/gi;
  const cveMatches = [...new Set(content.match(cvePattern) ?? [])];
  for (const cveId of cveMatches.slice(0, 3)) {
    calls.push({ name: 'assess_vulnerability', arguments: { cve_id: cveId.toUpperCase() } });
  }

  // 2. Incident queries → query_incidents
  const hasIncidentIntent =
    /\b(list|show|get|find|query|fetch|give\s+me)\b.{0,30}\bincident/i.test(content) ||
    /\bincident.{0,30}\b(list|show|servicenow|open|active|closed)\b/i.test(content) ||
    /\bsecurity\s+incident\b/i.test(content) ||
    /\bopen\s+incident/i.test(content) ||
    /\bactive\s+incident/i.test(content);

  if (hasIncidentIntent) {
    // Determine state filter: only use 'closed' or 'all' when explicitly requested.
    // Never infer 'all' from filler words like "list me all the open incidents".
    const wantsClosed = /\bclosed\b/i.test(content);
    const wantsOpen = /\bopen\b|active/i.test(content);
    const state = wantsClosed && wantsOpen ? 'all' : wantsClosed ? 'closed' : 'open';
    calls.push({ name: 'query_incidents', arguments: { state, limit: 50 } });
  }

  // 3. Security incident detail fetch — triggered by "summarize/describe/show incident SIR…/INC…"
  // This bypasses Now Assist's incident_summarization (which can't access sn_si_incident) and
  // fetches full details directly from ServiceNow REST API so the LLM can summarise locally.
  {
    const summarizeIntent =
      /\b(summarize|summarise|describe|explain|detail|analyse|analyze|show|get|what.{0,20}about)\b.{0,30}\b(incident|sir|inc)\b/i.test(content) ||
      /\b(incident|sir|inc)\b.{0,30}\b(summarize|summarise|describe|details?|summary|overview)\b/i.test(content);

    if (summarizeIntent) {
      const refMatch = content.match(/\b(INC|SIR)\d{4,8}\b/i);
      if (refMatch) {
        calls.push({ name: 'get_incident_details', arguments: { number: refMatch[0].toUpperCase() } });
      }
    }
  }

  // 4. IOC indicators — only when security-related keywords are present
  const hasSecurityIntent =
    /\b(threat|analyze|analyse|check|malicious|suspicious|indicator|ioc|scan|investigate|look.?up|is.+safe|malware|block|blacklist|whitelist)\b/i.test(
      content,
    );

  if (hasSecurityIntent) {
    // IP addresses (IPv4)
    const ipPattern = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g;
    const ips = [...new Set(content.match(ipPattern) ?? [])];
    for (const ip of ips.slice(0, 3)) {
      calls.push({ name: 'analyze_threat_indicator', arguments: { indicator: ip, indicator_type: 'ip' } });
    }

    // File hashes: MD5 (32), SHA1 (40), SHA256 (64) hex strings
    const hashPattern = /\b([a-fA-F0-9]{64}|[a-fA-F0-9]{40}|[a-fA-F0-9]{32})\b/g;
    const hashes = [...new Set(content.match(hashPattern) ?? [])];
    for (const hash of hashes.slice(0, 2)) {
      calls.push({ name: 'analyze_threat_indicator', arguments: { indicator: hash, indicator_type: 'hash' } });
    }

    // Domain names (exclude known safe / internal domains)
    const domainPattern =
      /\b(?!localhost\b)(?!.*service-now\.com\b)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b/g;
    const domains = [...new Set(content.match(domainPattern) ?? [])].filter(
      (d) => !/^\d+\.\d+/.test(d), // skip anything that looks like an IP
    );
    for (const domain of domains.slice(0, 2)) {
      calls.push({ name: 'analyze_threat_indicator', arguments: { indicator: domain, indicator_type: 'domain' } });
    }
  }

  // T021: Now Assist tools — match discovered tools against user message.
  //
  // Rules:
  //   1. Meta-questions about available tools are answered by the system prompt —
  //      never trigger a tool call for them.
  //   2. Tools that require specific structured fields (e.g. incident `number`,
  //      change records) are only triggered when that data is present in the message.
  //   3. Tools that need multiple required fields are skipped entirely for now.
  //   4. Single-argument string tools are triggered via keyword matching and the
  //      user's content is forwarded as the required field value.
  const { nowAssistConnected, nowAssistTools } = useAppStore.getState();
  logger.info('Now Assist tool detection', {
    connected: nowAssistConnected,
    toolCount: nowAssistTools.length,
  });
  if (nowAssistConnected && nowAssistTools.length > 0) {
    // Guard: skip tool detection for meta-questions about capabilities/tools
    const isMetaCapabilityQuestion =
      /\b(what|which|list|show|tell\s+me|describe)\b.{0,50}\b(tools?|capabilities|features|can\s+you\s+do|available)\b/i.test(content) ||
      /\bwhat.{0,30}\b(now\s*assist|mcp)\b/i.test(content) ||
      /\btools?.{0,30}\b(available|supported|exist|offered)\b/i.test(content);

    if (isMetaCapabilityQuestion) {
      logger.info('Now Assist: meta-capability question detected, skipping tool detection');
    } else {
      const lowerContent = content.toLowerCase();

      // Words that appear broadly in tool descriptions but carry no intent signal
      const GENERIC = new Set([
        'servicenow', 'service', 'their', 'which', 'these', 'those',
        'tools', 'available', 'assist', 'query', 'input', 'using',
        'given', 'based', 'provide', 'return', 'information', 'analysis',
      ]);

      for (const tool of nowAssistTools) {
        const required: string[] = tool.inputSchema?.required ?? [];
        const props = tool.inputSchema?.properties ?? {};

        // Skip tools that need more than one required field — can't auto-populate them
        if (required.length > 1) {
          logger.info('Now Assist: skipping multi-field tool', { tool: tool.name, required });
          continue;
        }

        // Build arguments based on the tool's schema
        let toolArgs: Record<string, unknown> | null = null;

        if (required.length === 1) {
          const fieldName = required[0] as string;
          const fieldType = (props[fieldName] as { type?: string } | undefined)?.type ?? 'string';

          if (fieldName === 'number') {
            // Only trigger if an incident / change / problem / task number is in the message
            const refMatch = content.match(/\b(INC|SIR|CHG|PRB|RITM|TASK|SCTASK)\d{4,8}\b/i);
            if (!refMatch) {
              logger.info('Now Assist: skipping number-field tool (no record number in message)', { tool: tool.name });
              continue; // Can't call without a record number
            }
            toolArgs = { number: refMatch[0].toUpperCase() };
          } else if (fieldType === 'string') {
            // Single-string-field tools: forward user's message as the field value
            toolArgs = { [fieldName]: content };
          } else {
            // Non-string single-field tools need structured data we can't infer
            logger.info('Now Assist: skipping non-string single-field tool', { tool: tool.name, fieldName, fieldType });
            continue;
          }
        } else {
          // No required fields — build args based on what the tool's properties support
          if ('number' in props) {
            // Tool accepts an optional record number — only trigger when one is in the message
            const refMatch = content.match(/\b(INC|SIR|CHG|PRB|RITM|TASK|SCTASK|CS)\d{4,8}\b/i);
            if (!refMatch) {
              logger.info('Now Assist: skipping optional-number tool (no record number in message)', { tool: tool.name });
              continue;
            }
            const recordNumber = refMatch[0].toUpperCase();
            const prefix = (refMatch[1] ?? '').toUpperCase();
            const toolNameLower = tool.name.toLowerCase();
            // Guard: only invoke tools whose name suggests they handle this record type.
            // Prevents e.g. case_summarization firing on SIR/INC numbers.
            if ((prefix === 'SIR' || prefix === 'INC') && !toolNameLower.includes('incident')) continue;
            if (prefix === 'CS' && !toolNameLower.includes('case')) continue;
            if (prefix === 'CHG' && !toolNameLower.includes('change')) continue;
            // incident_summarization queries the `incident` table only — it cannot access
            // sn_si_incident (SIR records). Our get_incident_details tool handles SIR numbers
            // directly via REST API, so skip Now Assist for them.
            if (tool.name === 'incident_summarization' && prefix === 'SIR') continue;
            toolArgs = { number: recordNumber };
          } else if ('input' in props) {
            toolArgs = { input: content };
          } else if ('query' in props) {
            toolArgs = { query: content };
          } else {
            logger.info('Now Assist: skipping tool with no known optional field', { tool: tool.name });
            continue;
          }
        }

        // Keyword-match tool description against user message before triggering
        const keywords = tool.description
          .toLowerCase()
          .split(/\W+/)
          .filter((w) => w.length >= 5 && !GENERIC.has(w));
        const matched = keywords.some((kw) => lowerContent.includes(kw));
        logger.info('Now Assist: keyword match result', {
          tool: tool.name,
          matched,
          keywords: keywords.slice(0, 10),
          toolArgs,
        });
        if (matched) {
          calls.push({ name: tool.name, provider: 'now_assist', arguments: toolArgs });
        }
      }
    }
  }

  return calls;
}

/**
 * Build a natural-language context question for a given tool call so phi3:mini
 * receives the tool result as recognisable prior context.
 */
function buildContextQuestion(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case 'query_incidents': {
      const state = (args['state'] as string) ?? 'open';
      return `What are the current ${state} security incidents in ServiceNow?`;
    }
    case 'assess_vulnerability': {
      const cve = (args['cve_id'] as string) ?? 'the CVE';
      return `What does ServiceNow know about vulnerability ${cve}?`;
    }
    case 'analyze_threat_indicator': {
      const indicator = (args['indicator'] as string) ?? 'the indicator';
      const type = (args['indicator_type'] as string) ?? 'indicator';
      return `Is the ${type} "${indicator}" a known threat in ServiceNow?`;
    }
    case 'get_incident_details': {
      const num = (args['number'] as string) ?? 'the incident';
      return `What are the full details of incident ${num} in ServiceNow?`;
    }
    default:
      return `What does ServiceNow say about "${toolName.replace(/_/g, ' ')}"?`;
  }
}

/**
 * T071: Detect tool calls from the user's message using pattern matching,
 * execute them, and return extra ChatMessage entries to inject into Ollama context.
 *
 * Uses keyword/regex detection instead of Ollama native tool calling because
 * small models (phi3:mini, etc.) don't support Ollama's tool_calls format.
 * The tool results are also persisted as visible messages for attribution display.
 */
async function executeMCPToolCalls(
  userContent: string,
  ctx: MCPContext,
  sessionId: string,
  persist: boolean,
): Promise<{ messages: ChatMessage[]; nowAssistDegraded: boolean }> {
  const detectedCalls = detectToolCallsFromMessage(userContent);
  if (detectedCalls.length === 0) return { messages: [], nowAssistDegraded: false };

  logger.info('MCP tool calls detected from message', {
    count: detectedCalls.length,
    tools: detectedCalls.map((c) => c.name),
  });

  const extraMessages: ChatMessage[] = [];
  let nowAssistDegraded = false;

  for (const { name, provider, arguments: argsObj } of detectedCalls) {
    // T025: Graceful degradation — skip Now Assist tool if client is disconnected
    if (provider === 'now_assist') {
      const { nowAssistConnected: connected } = useAppStore.getState();
      if (!connected) {
        logger.warn('Now Assist tool skipped — client not connected', { toolName: name });
        nowAssistDegraded = true;
        continue;
      }
    }

    const toolResult = await executeMCPTool(
      name,
      argsObj,
      ctx.servicenowUrl,
      ctx.profileId,
      provider,
    );

    // Format result as human-readable text (not raw JSON) so phi3:mini uses it
    const resultText = toolResult.success && toolResult.result
      ? formatToolResult(name, toolResult.result, argsObj)
      : `ServiceNow query failed: ${toolResult.error ?? 'Unknown error'}`;

    // Inject as a user→assistant pair BEFORE the user's message so phi3:mini
    // sees it as already-established context it can reference.
    // Use a context-aware question so the model understands what the data is.
    const contextQuestion = buildContextQuestion(name, argsObj);
    extraMessages.push({ role: 'user', content: contextQuestion });
    extraMessages.push({
      role: 'assistant',
      content: `I retrieved this real-time data from ServiceNow:\n\n${resultText}`,
    });

    // The display text shown in the UI / persisted to DB uses the formatted result
    const displayText = `Tool "${name}" result:\n${resultText}`;

    // T072: Persist tool result as a visible message for attribution display
    if (persist) {
      const metadata: ToolMessageMetadata = {
        type: 'tool_result',
        toolName: name,
        latencyMs: toolResult.latency_ms,
        success: toolResult.success,
      };
      const seq = await conversationMessageRepository.getNextSequenceNumber(sessionId);
      await conversationMessageRepository.create({
        sessionId,
        sender: 'servicenow_now_assist',
        content: displayText,
        sequenceNumber: seq,
        metadata: metadata,
      });
      await aiSessionRepository.incrementMessageCount(sessionId);
    }
  }

  return { messages: extraMessages, nowAssistDegraded };
}

/**
 * Format a tool result as human-readable text for LLM context.
 * Small models (phi3:mini) respond better to natural language than raw JSON.
 *
 * T023: Exported for unit testing; handles `provider === 'now_assist'` by returning
 * the raw content string directly (it's already human-readable from Now Assist).
 */
export function formatToolResult(
  toolName: string,
  result: Record<string, unknown>,
  args?: Record<string, unknown>,
): string {
  // T023: Now Assist results are already human-readable — return content directly
  if (result['provider'] === 'now_assist') {
    return String(result['content'] ?? '');
  }

  if (toolName === 'get_incident_details') {
    const num = result['number'] ?? 'N/A';
    const table = result['table'] ?? '';
    const tableLabel = String(table) === 'sn_si_incident' ? 'Security Incident' : 'Incident';
    const field = (key: string) => {
      const v = String(result[key] ?? '').trim();
      return v && v !== 'null' && v !== 'undefined' ? v : null;
    };
    const lines: string[] = [
      `${tableLabel}: ${num}`,
      `Title: ${field('short_description') ?? 'N/A'}`,
      `State: ${field('state') ?? 'N/A'} | Priority: ${field('priority') ?? 'N/A'} | Severity: ${field('severity') ?? 'N/A'}`,
      `Category: ${field('category') ?? 'N/A'} | Impact: ${field('impact') ?? 'N/A'} | Urgency: ${field('urgency') ?? 'N/A'}`,
      `Assigned to: ${field('assigned_to') ?? 'N/A'} | Caller: ${field('caller_id') ?? 'N/A'}`,
      `Opened: ${field('opened_at') ?? 'N/A'} | Resolved: ${field('resolved_at') ?? 'not yet'}`,
    ];
    if (field('description')) lines.push(`\nDescription:\n${field('description')}`);
    if (field('work_notes')) lines.push(`\nWork Notes:\n${field('work_notes')}`);
    if (field('close_notes')) lines.push(`\nClose Notes:\n${field('close_notes')}`);
    if (field('comments')) lines.push(`\nComments:\n${field('comments')}`);
    return lines.join('\n');
  }

  if (toolName === 'analyze_threat_indicator') {
    const found = result['found'] as boolean;
    const indicator = result['indicator'] as string;
    const type = result['indicator_type'] as string;
    if (!found) {
      return `${type} indicator "${indicator}": NOT found in ServiceNow Threat Intelligence. No known threat records exist for this indicator.`;
    }
    return (
      `${type} indicator "${indicator}" IS in ServiceNow Threat Intelligence:\n` +
      `- Risk score: ${result['risk_score'] ?? 'N/A'}\n` +
      `- Threat type: ${result['threat_type'] ?? 'N/A'}\n` +
      `- First seen: ${result['first_seen'] ?? 'N/A'}\n` +
      `- Last seen: ${result['last_seen'] ?? 'N/A'}\n` +
      `- Total records: ${result['total_records'] ?? 1}`
    );
  }
  if (toolName === 'assess_vulnerability') {
    const found = result['found'] as boolean;
    const cve = result['cve_id'] as string;
    if (!found) {
      return `${cve}: NOT found in ServiceNow Vulnerability Management. No vulnerability records exist for this CVE.`;
    }
    return (
      `${cve} IS in ServiceNow Vulnerability Management:\n` +
      `- CVSS score: ${result['cvss_score'] ?? 'N/A'}\n` +
      `- Severity: ${result['severity'] ?? 'N/A'}\n` +
      `- State: ${result['state'] ?? 'N/A'}\n` +
      `- Category: ${result['category'] ?? 'N/A'}\n` +
      `- Affected items: ${result['affected_items'] ?? 'N/A'}\n` +
      `- First found: ${result['first_found'] ?? 'N/A'}`
    );
  }
  if (toolName === 'query_incidents') {
    const rawIncidents = result['incidents'] as Array<Record<string, unknown>>;
    const table = result['table'] as string;
    if (!rawIncidents || rawIncidents.length === 0) {
      return `No incidents found in ServiceNow (table: ${table}).`;
    }

    // Filter client-side — the Rust layer may not be reliable across all ServiceNow instances.
    const requestedState = (args?.['state'] as string) ?? 'open';
    const incidents =
      requestedState === 'all'
        ? rawIncidents
        : rawIncidents.filter((inc) => {
            const stateLabel = String(inc['state'] ?? '').toLowerCase();
            return requestedState === 'open'
              ? !stateLabel.includes('closed')
              : stateLabel.includes('closed');
          });

    if (incidents.length === 0) {
      return `No ${requestedState} incidents found in ServiceNow (table: ${table}).`;
    }

    const lines = incidents.map((inc, i) => {
      const num = inc['number'] ?? 'N/A';
      const desc = inc['short_description'] ?? 'No description';
      const state = inc['state'] ?? 'Unknown';
      const priority = inc['priority'] ?? 'N/A';
      return `${i + 1}. [${num}] ${desc} — State: ${state}, Priority: ${priority}`;
    });
    return (
      `Found ${incidents.length} ${requestedState} incident(s) in ServiceNow (table: ${table}):\n` +
      lines.join('\n')
    );
  }
  return JSON.stringify(result, null, 2);
}

/**
 * Create a new chat session for a given config profile
 */
export async function createSession(
  configId: string,
  title = 'New Conversation',
  timeoutHours = 24
): Promise<AISession> {
  const expiresAt = new Date(Date.now() + timeoutHours * 60 * 60 * 1000);
  return aiSessionRepository.create({
    configId,
    title,
    aiProvider: 'ollama',
    isSaved: false,
    expiresAt,
    messageCount: 0,
  });
}

/**
 * Save a conversation (persists it beyond session timeout)
 */
export async function saveConversation(sessionId: string, title?: string): Promise<AISession> {
  return aiSessionRepository.save(sessionId, title);
}
