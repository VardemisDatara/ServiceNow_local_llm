/**
 * NowAssistMCPClient — Rust-proxy edition
 *
 * Replaces the previous `@modelcontextprotocol/sdk`-based implementation.
 *
 * Root cause for the change: the MCP SDK uses browser `fetch()` internally.
 * When running inside the Tauri WebView (origin http://localhost:5173 in dev),
 * every request to a ServiceNow MCP endpoint is blocked by the browser's CORS
 * policy because ServiceNow does not return `Access-Control-Allow-Origin` headers
 * for localhost.
 *
 * Fix: delegate all MCP network calls to two Tauri commands that run in the Rust
 * main process via `reqwest` — completely bypassing WebView CORS restrictions.
 *
 *   now_assist_connect   → initialize + tools/list
 *   now_assist_call_tool → initialize + tools/call
 *
 * The public interface of this class (`connect`, `disconnect`, `callTool`,
 * `testConnection`, `isConnected`, `getDiscoveredTools`) is unchanged so that
 * all callers (Configuration.tsx, chat service, etc.) require no modification.
 */

import { IPC } from '../../main/ipc';
import { useAppStore } from '../../renderer/store/index';
import { logger } from '../../utils/logger';

// ─── Public types ──────────────────────────────────────────────────────────────

export type NowAssistAuthMode = 'apikey' | 'bearer';

export interface NowAssistConnectionConfig {
  /** Full MCP server endpoint URL. */
  endpoint: string;
  /** Token retrieved from OS keychain. */
  token: string;
  /** How to send the token. Default: 'apikey' */
  authMode: NowAssistAuthMode;
}

export interface NowAssistTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description?: string; enum?: string[] }>;
    required?: string[];
  };
}

export interface NowAssistToolCallParams {
  name: string;
  arguments: Record<string, unknown>;
}

export interface NowAssistToolResult {
  toolName: string;
  content: string;
  isError: boolean;
  latencyMs: number;
}

// ─── Custom errors ─────────────────────────────────────────────────────────────

export class NowAssistConnectionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'AUTH_FAILED'
      | 'ENDPOINT_UNREACHABLE'
      | 'TOOL_DISCOVERY_FAILED'
      | 'NOT_CONNECTED'
  ) {
    super(message);
    this.name = 'NowAssistConnectionError';
  }
}

export class NowAssistRateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfterSeconds: number
  ) {
    super(message);
    this.name = 'NowAssistRateLimitError';
  }
}

// ─── NowAssistMCPClient ────────────────────────────────────────────────────────

export class NowAssistMCPClient {
  private _isConnected = false;
  private _discoveredTools: NowAssistTool[] = [];
  private _config: NowAssistConnectionConfig | null = null;

  isConnected(): boolean {
    return this._isConnected;
  }

  getDiscoveredTools(): NowAssistTool[] {
    return this._isConnected ? this._discoveredTools : [];
  }

  /**
   * Connect to the Now Assist MCP server.
   * Calls the Rust `now_assist_connect` command which performs
   *   initialize → notifications/initialized → tools/list
   * all via `reqwest` (no CORS restrictions).
   */
  async connect(config: NowAssistConnectionConfig): Promise<void> {
    logger.info('NowAssistMCPClient: connecting', {
      endpoint: config.endpoint,
      authMode: config.authMode,
    });

    if (this._isConnected) {
      this.disconnect();
    }

    try {
      const result = await IPC.nowAssistConnect(
        config.endpoint,
        config.token,
        config.authMode,
      );

      this._discoveredTools = result.tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: (t.input_schema as NowAssistTool['inputSchema']) ?? {
          type: 'object',
          properties: {},
        },
      }));
      this._config = config;
      this._isConnected = true;

      // Sync to Zustand store so chat service and UI can read the tool list
      const store = useAppStore.getState();
      store.setNowAssistConnected(true);
      store.setNowAssistTools(this._discoveredTools);
      store.setNowAssistError(null);

      logger.info('NowAssistMCPClient: connected', {
        toolCount: result.tool_count,
      });
    } catch (err) {
      this._cleanup();
      const msg = err instanceof Error ? err.message : String(err);

      if (msg.includes('401') || msg.includes('403') || /unauthorized|forbidden/i.test(msg)) {
        throw new NowAssistConnectionError(
          `Authentication failed: ${msg}`,
          'AUTH_FAILED'
        );
      }
      if (msg.includes('Tool discovery failed') || msg.includes('tools/list')) {
        throw new NowAssistConnectionError(
          `Tool discovery failed: ${msg}`,
          'TOOL_DISCOVERY_FAILED'
        );
      }
      throw new NowAssistConnectionError(
        `Cannot reach endpoint: ${msg}`,
        'ENDPOINT_UNREACHABLE'
      );
    }
  }

  /** Disconnect and reset state. Synchronous — no network call needed. */
  disconnect(): void {
    logger.info('NowAssistMCPClient: disconnecting');
    this._cleanup();
  }

  /**
   * Call a Now Assist tool.
   * Delegates to the Rust `now_assist_call_tool` command which
   * performs initialize → notifications/initialized → tools/call
   * in a single round-trip sequence via `reqwest`.
   */
  async callTool(params: NowAssistToolCallParams): Promise<NowAssistToolResult> {
    if (!this._isConnected || !this._config) {
      throw new NowAssistConnectionError(
        'Not connected to Now Assist MCP server',
        'NOT_CONNECTED'
      );
    }

    const start = Date.now();

    try {
      const result = await IPC.nowAssistCallTool(
        this._config.endpoint,
        this._config.token,
        this._config.authMode,
        params.name,
        params.arguments,
      );

      return {
        toolName: params.name,
        content: result.content,
        isError: result.is_error,
        latencyMs: result.latency_ms,
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const msg = err instanceof Error ? err.message : String(err);

      if (msg.includes('429') || /rate.limit|too many requests/i.test(msg)) {
        const match = msg.match(/retry.after[:\s]+(\d+)/i);
        const retryAfterSeconds = match ? parseInt(match[1] ?? '60', 10) : 60;
        throw new NowAssistRateLimitError(
          `Rate limited: ${msg}`,
          retryAfterSeconds
        );
      }

      // Return error as a failed tool result rather than throwing,
      // so the chat service can surface it gracefully to the user.
      return {
        toolName: params.name,
        content: `Tool call failed: ${msg}`,
        isError: true,
        latencyMs,
      };
    }
  }

  /**
   * Test the connection without persisting state.
   * Returns the number of tools discovered on success.
   */
  async testConnection(config: NowAssistConnectionConfig): Promise<number> {
    logger.info('NowAssistMCPClient.testConnection: testing', { endpoint: config.endpoint });

    const result = await IPC.nowAssistConnect(
      config.endpoint,
      config.token,
      config.authMode,
    );

    logger.info('NowAssistMCPClient.testConnection: success', { toolCount: result.tool_count });
    return result.tool_count;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _cleanup(): void {
    this._isConnected = false;
    this._discoveredTools = [];
    this._config = null;
    // Sync disconnected state to Zustand store
    const store = useAppStore.getState();
    store.setNowAssistConnected(false);
    store.setNowAssistTools([]);
  }
}

// ─── Singleton instance ────────────────────────────────────────────────────────
export const nowAssistMCPClient = new NowAssistMCPClient();
