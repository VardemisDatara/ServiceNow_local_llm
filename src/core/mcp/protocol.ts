/**
 * T061: MCP Protocol Types
 * Defines the type system for MCP tool calling integration with Ollama
 */

/** Ollama function tool definition (JSON Schema parameters) */
export interface OllamaToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema object
  };
}

/** A single tool call returned by Ollama in its response */
export interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

/** Result from the check_ollama_tool_calls Tauri command */
export interface OllamaToolCheckResult {
  tool_calls: OllamaToolCall[] | null;
  content: string | null;
}

/** Result from the execute_mcp_tool Tauri command */
export interface MCPToolResult {
  tool_name: string;
  success: boolean;
  result: Record<string, unknown> | null;
  error: string | null;
  latency_ms: number;
}

/** Definition of a registered MCP tool */
export interface MCPToolDefinition {
  name: string;
  description: string;
  category: 'security' | 'search' | 'data' | 'workflow' | 'analysis';
  provider: 'servicenow' | 'builtin';
  /** Returns this tool as an Ollama function tool definition */
  toOllamaDefinition(): OllamaToolDefinition;
}

/** Context required to execute MCP tools */
export interface ToolExecutionContext {
  profileId: string;
  servicenowUrl: string;
}

/** A message sent to Ollama for tool checking */
export interface McpChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
}

/** Metadata stored on tool-related conversation messages */
export interface ToolMessageMetadata {
  type: 'tool_call' | 'tool_result';
  toolName: string;
  latencyMs?: number;
  success?: boolean;
}

/** Metadata stored on web_search conversation messages */
export interface WebSearchMetadata {
  type: 'web_search';
  query: string;
  provider: string;
  results: Array<{ title: string; url: string; snippet: string }>;
  error?: string;
}

/** Metadata stored on cloud LLM (OpenAI / Mistral) response messages (T117) */
export interface LLMProviderMetadata {
  type: 'llm_provider';
  /** Actual LLM provider ('openai' | 'mistral') */
  provider: 'openai' | 'mistral';
  /** Model used for this response */
  model: string;
}
