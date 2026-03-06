/**
 * Contract: NowAssistMCPClient
 *
 * Service responsible for connecting to a ServiceNow MCP server endpoint,
 * discovering Now Assist tools, and invoking them on behalf of the local LLM.
 *
 * Implementation file: src/core/services/now-assist-mcp-client.ts
 *
 * Authentication: Bearer token (Personal Access Token) stored in OS keychain
 * Transport: StreamableHTTPClientTransport (primary) → SSEClientTransport (fallback)
 * SDK: @modelcontextprotocol/sdk (already installed)
 */

// ─── Input / Output Types ────────────────────────────────────────────────────

export interface NowAssistTool {
  /** MCP tool identifier (e.g. 'summarize_incident') */
  name: string;
  /** Human-readable description shown in Settings tool list */
  description: string;
  /** JSON Schema for the tool's input parameters */
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
  /** Echo of the tool name for attribution */
  toolName: string;
  /** Human-readable formatted content for injection into chat context */
  content: string;
  /** Whether the MCP server returned an error result */
  isError: boolean;
  /** Round-trip latency in milliseconds */
  latencyMs: number;
}

// ─── Connection Config ────────────────────────────────────────────────────────

/**
 * Auth mode for the ServiceNow MCP server connection.
 *
 * - 'apikey': sends `x-sn-apikey: <token>` — for ServiceNow native API Keys (PAT)
 *   generated in the ServiceNow admin console. Requires plugin com.glide.tokenbased_auth.
 * - 'bearer': sends `Authorization: Bearer <token>` — for OAuth 2.1 access tokens.
 *
 * Default: 'apikey' (most common for desktop app integrations).
 */
export type NowAssistAuthMode = 'apikey' | 'bearer';

export interface NowAssistConnectionConfig {
  /**
   * Full MCP server endpoint URL.
   * Format: https://<instance>.service-now.com/sncapps/mcp-server/<server-sys-id>
   * The server-sys-id is found in the MCP Server Console record in ServiceNow admin.
   */
  endpoint: string;
  /** Token retrieved from OS keychain */
  token: string;
  /** How to send the token. Default: 'apikey' */
  authMode: NowAssistAuthMode;
}

// ─── Client Contract ─────────────────────────────────────────────────────────

export interface NowAssistMCPClientContract {
  /**
   * Establish a connection to the ServiceNow MCP server.
   * On success, discovers and caches available tools.
   * Throws if connection or tool discovery fails.
   */
  connect(config: NowAssistConnectionConfig): Promise<void>;

  /**
   * Gracefully disconnect and clean up the MCP client session.
   */
  disconnect(): Promise<void>;

  /**
   * Returns true if the client is currently connected and tools are available.
   */
  isConnected(): boolean;

  /**
   * Returns the list of Now Assist tools discovered during connection.
   * Returns [] if not connected.
   */
  getDiscoveredTools(): NowAssistTool[];

  /**
   * Invoke a Now Assist tool by name with the provided arguments.
   * Throws NowAssistConnectionError if not connected.
   * Implements retry with exponential backoff on HTTP 429.
   * Max 3 retries, initial delay 1s, max delay 30s.
   */
  callTool(params: NowAssistToolCallParams): Promise<NowAssistToolResult>;

  /**
   * Test connectivity only — connects, lists tools, then disconnects.
   * Used by the Settings "Test Connection" button.
   * Returns discovered tool count on success; throws on failure.
   */
  testConnection(config: NowAssistConnectionConfig): Promise<number>;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class NowAssistConnectionError extends Error {
  constructor(
    message: string,
    public readonly code: 'AUTH_FAILED' | 'ENDPOINT_UNREACHABLE' | 'TOOL_DISCOVERY_FAILED' | 'NOT_CONNECTED'
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
