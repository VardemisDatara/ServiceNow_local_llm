/**
 * T063: MCP Client
 * TypeScript client for invoking Rust MCP commands (tool check + tool execution)
 */

import { invoke } from '@tauri-apps/api/core';
import type { OllamaToolDefinition, OllamaToolCheckResult, MCPToolResult, McpChatMessage } from './protocol';
import { classifyMCPError, handleMCPError } from './error-handler';
import { withRetry } from './retry';
import { nowAssistMCPClient } from '../services/now-assist-mcp-client';
import { useAppStore } from '../../renderer/store/index';
import { logger } from '../../utils/logger';

/**
 * Ask Ollama (via Rust) whether it wants to call any tools.
 * Returns tool_calls if Ollama detected tool use intent, or null if not.
 */
export async function checkOllamaToolCalls(
  endpoint: string,
  model: string,
  messages: McpChatMessage[],
  tools: OllamaToolDefinition[],
): Promise<OllamaToolCheckResult> {
  logger.info('Checking Ollama for tool calls', { model, toolCount: tools.length });

  try {
    const result = await invoke<OllamaToolCheckResult>('check_ollama_tool_calls', {
      endpoint,
      model,
      messages,
      tools,
    });
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn('check_ollama_tool_calls failed (falling back to no tools)', {}, new Error(msg));
    // Graceful fallback: if tool check fails, proceed without tool calling
    return { tool_calls: null, content: null };
  }
}

/**
 * Execute a single MCP tool against ServiceNow.
 * T022: Routes Now Assist tool calls through NowAssistMCPClient; all others via Rust.
 * Retries on transient failures (network, timeout).
 */
export async function executeMCPTool(
  toolName: string,
  arguments_: Record<string, unknown>,
  servicenowUrl: string,
  profileId: string,
  provider?: string,
): Promise<MCPToolResult> {
  // T022: Now Assist tools go through NowAssistMCPClient, not the Rust MCP server
  if (provider === 'now_assist') {
    logger.info('Routing MCP tool to Now Assist', { toolName });
    try {
      const naResult = await nowAssistMCPClient.callTool({ name: toolName, arguments: arguments_ });
      return {
        tool_name: toolName,
        success: !naResult.isError,
        result: { content: naResult.content, provider: 'now_assist' },
        error: naResult.isError ? naResult.content : null,
        latency_ms: naResult.latencyMs,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn('Now Assist tool call failed', { toolName }, err instanceof Error ? err : new Error(msg));
      // If the singleton was reset by Vite HMR, its internal state is lost.
      // Sync the Zustand store so future messages don't keep trying to call tools.
      if (msg.includes('NOT_CONNECTED') || msg.includes('Not connected')) {
        logger.warn('Now Assist singleton is disconnected — syncing Zustand store');
        const store = useAppStore.getState();
        store.setNowAssistConnected(false);
        store.setNowAssistTools([]);
      }
      return {
        tool_name: toolName,
        success: false,
        result: null,
        error: msg,
        latency_ms: 0,
      };
    }
  }

  logger.info('Executing MCP tool', { toolName, servicenowUrl });

  try {
    const result = await withRetry(
      () =>
        invoke<MCPToolResult>('execute_mcp_tool', {
          toolName,
          arguments: arguments_,
          servicenowUrl,
          profileId,
        }),
      (err) => {
        const msg = err instanceof Error ? err.message : String(err);
        const classified = classifyMCPError(toolName, msg);
        return classified.retryable;
      },
      { maxAttempts: 2, initialDelayMs: 500 },
    );

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const classified = classifyMCPError(toolName, msg);
    const userMessage = handleMCPError(classified);
    return {
      tool_name: toolName,
      success: false,
      result: null,
      error: userMessage,
      latency_ms: 0,
    };
  }
}
