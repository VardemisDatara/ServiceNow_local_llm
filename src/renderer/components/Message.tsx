import type { ConversationMessage } from '../../core/storage/schema';
import type { ToolMessageMetadata, WebSearchMetadata, LLMProviderMetadata } from '../../core/mcp/protocol';

/**
 * T046 + T072: Individual message bubble component
 * Handles regular messages and MCP tool result attribution
 */

interface MessageProps {
  message: ConversationMessage;
  isStreaming?: boolean | undefined;
}

const SENDER_LABELS: Record<string, string> = {
  user: 'You',
  ollama: 'Ollama',
  openai: 'OpenAI',
  mistral: 'Mistral',
  servicenow_now_assist: 'Now Assist',
  system: 'System',
  web_search: 'Web Search',
};

const SENDER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  user: { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' },
  ollama: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
  openai: { bg: '#f0fdf4', text: '#15803d', border: '#86efac' },
  mistral: { bg: '#fdf4ff', text: '#7e22ce', border: '#d8b4fe' },
  servicenow_now_assist: { bg: '#faf5ff', text: '#6b21a8', border: '#e9d5ff' },
  system: { bg: '#f9fafb', text: '#374151', border: '#e5e7eb' },
  web_search: { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
  tool_result: { bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd' },
};

/** Parse tool message metadata safely */
function parseMetadata(raw: unknown): ToolMessageMetadata | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (m['type'] === 'tool_result' || m['type'] === 'tool_call') {
    return m as unknown as ToolMessageMetadata;
  }
  return null;
}

/** Parse web search metadata safely */
function parseWebSearchMetadata(raw: unknown): WebSearchMetadata | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (m['type'] === 'web_search') return m as unknown as WebSearchMetadata;
  return null;
}

/** Parse LLM provider metadata safely (T117) */
function parseLLMProviderMetadata(raw: unknown): LLMProviderMetadata | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (m['type'] === 'llm_provider') return m as unknown as LLMProviderMetadata;
  return null;
}

const PROVIDER_LABELS: Record<string, string> = {
  duckduckgo: 'DuckDuckGo',
  perplexity: 'Perplexity',
  google: 'Google',
};

/** Rendered card for web_search messages */
function WebSearchCard({ meta }: { meta: WebSearchMetadata }) {
  const providerLabel = PROVIDER_LABELS[meta.provider] ?? meta.provider;
  const hasResults = meta.results.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>🔍 "{meta.query}"</span>
        <span
          style={{
            fontSize: '0.65rem',
            fontWeight: 600,
            backgroundColor: '#fed7aa',
            color: '#9a3412',
            padding: '1px 6px',
            borderRadius: '9999px',
          }}
        >
          {providerLabel}
        </span>
        {!hasResults && (
          <span style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 600 }}>
            ✗ no results
          </span>
        )}
      </div>

      {/* Error message when provider failed */}
      {meta.error && (
        <div style={{ fontSize: '0.72rem', color: '#dc2626', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', padding: '4px 8px' }}>
          {meta.error}
        </div>
      )}

      {hasResults ? meta.results.map((r, i) => (
        <div
          key={i}
          style={{
            padding: '6px 8px',
            backgroundColor: '#ffffff',
            border: '1px solid #fed7aa',
            borderRadius: '6px',
            fontSize: '0.78rem',
          }}
        >
          <div style={{ fontWeight: 600, color: '#111827', marginBottom: '2px' }}>
            [{i + 1}] {r.title}
          </div>
          <div style={{ color: '#4b5563', marginBottom: '4px', lineHeight: '1.4' }}>
            {r.snippet.slice(0, 140)}{r.snippet.length > 140 ? '…' : ''}
          </div>
          {r.url && (
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#ea580c', fontSize: '0.72rem', wordBreak: 'break-all' }}
            >
              ↗ {r.url}
            </a>
          )}
        </div>
      )) : (
        <div style={{ fontSize: '0.75rem', color: '#6b7280', fontStyle: 'italic' }}>
          No results found — knowledge gap could not be augmented.
        </div>
      )}
    </div>
  );
}

export function Message({ message, isStreaming = false }: MessageProps) {
  const isUser = message.sender === 'user';
  const isNowAssist = message.sender === 'servicenow_now_assist';
  const meta = parseMetadata(message.metadata);
  const webMeta = parseWebSearchMetadata(message.metadata);
  const llmMeta = parseLLMProviderMetadata(message.metadata);

  // Tool result messages get special rendering
  const isToolResult = meta?.type === 'tool_result';
  const isWebSearch = message.sender === 'web_search' && webMeta !== null;
  const colorKey = isToolResult ? 'tool_result' : message.sender;
  const colors = SENDER_COLORS[colorKey] ?? { bg: '#f9fafb', text: '#374151', border: '#e5e7eb' };

  let label = SENDER_LABELS[message.sender] ?? message.sender;
  if (isToolResult && meta?.toolName) {
    label = `MCP Tool: ${meta.toolName}`;
  }
  if (isWebSearch) {
    label = 'Web Search';
  }
  // T117: show model name for cloud LLM responses
  if (llmMeta && (message.sender === 'openai' || message.sender === 'mistral')) {
    const providerLabel = message.sender === 'openai' ? 'OpenAI' : 'Mistral';
    label = llmMeta.model ? `${providerLabel} (${llmMeta.model})` : providerLabel;
  }

  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: '12px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '4px',
          flexDirection: isUser ? 'row-reverse' : 'row',
        }}
      >
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: colors.text }}>{label}</span>
        <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{time}</span>
        {isToolResult && meta?.latencyMs !== undefined && (
          <span style={{ fontSize: '0.65rem', color: '#9ca3af', fontStyle: 'italic' }}>
            {meta.latencyMs}ms
          </span>
        )}
        {isToolResult && meta?.success === false && (
          <span style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 600 }}>
            ✗ failed
          </span>
        )}
      </div>

      <div
        style={{
          maxWidth: isWebSearch ? '90%' : '80%',
          padding: (isToolResult || isWebSearch) ? '8px 12px' : '10px 14px',
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          backgroundColor: colors.bg,
          border: `1px solid ${colors.border}`,
          color: '#111827',
          fontSize: isToolResult ? '0.8rem' : '0.9rem',
          lineHeight: '1.6',
          whiteSpace: isWebSearch ? 'normal' : 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: isToolResult ? 'monospace' : 'inherit',
          opacity: (isToolResult || isWebSearch) ? 0.9 : 1,
        }}
        aria-label={`${label}: ${message.content}`}
      >
        {/* T024: Now Assist ✦ attribution badge */}
        {isNowAssist && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: '0.65rem',
              fontWeight: 700,
              backgroundColor: '#e9d5ff',
              color: '#6b21a8',
              padding: '1px 7px',
              borderRadius: 9999,
              marginBottom: 6,
              letterSpacing: '0.02em',
            }}
          >
            Now Assist ✦
          </span>
        )}
        {isWebSearch && webMeta ? (
          <WebSearchCard meta={webMeta} />
        ) : (
          message.content
        )}
        {isStreaming && (
          <span
            style={{
              display: 'inline-block',
              width: '2px',
              height: '1em',
              backgroundColor: '#10b981',
              marginLeft: '2px',
              animation: 'blink 0.7s infinite',
              verticalAlign: 'text-bottom',
            }}
          />
        )}
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default Message;
