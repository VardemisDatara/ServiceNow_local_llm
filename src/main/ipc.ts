import { invoke } from '@tauri-apps/api/core';
import { logger } from '../utils/logger';
import { AppError, ErrorCode, ErrorHandler } from '../utils/errors';

/**
 * Type-safe Tauri IPC wrapper
 * Provides typed frontend-to-backend communication
 */

// ============================================================================
// Credential Management Commands
// ============================================================================

export interface ServiceNowCredentials {
  username: string;
  password: string;
}

/**
 * Store ServiceNow credentials in OS keychain
 */
export async function storeServiceNowCredentials(
  profileId: string,
  username: string,
  password: string
): Promise<void> {
  try {
    logger.debug('Storing ServiceNow credentials', { profileId });
    await invoke('store_servicenow_credentials', {
      profileId,
      username,
      password,
    });
    logger.info('ServiceNow credentials stored successfully', { profileId });
  } catch (error) {
    logger.error('Failed to store ServiceNow credentials', { profileId }, error as Error);
    throw new AppError(
      ErrorCode.CREDENTIAL_STORAGE_FAILED,
      'Failed to store ServiceNow credentials',
      { profileId },
      error as Error
    );
  }
}

/**
 * Get ServiceNow credentials from OS keychain
 */
export async function getServiceNowCredentials(
  profileId: string
): Promise<ServiceNowCredentials> {
  try {
    logger.debug('Retrieving ServiceNow credentials', { profileId });
    const result = await invoke<ServiceNowCredentials>('get_servicenow_credentials', {
      profileId,
    });
    logger.debug('ServiceNow credentials retrieved', { profileId });
    return result;
  } catch (error) {
    logger.warn('Failed to retrieve ServiceNow credentials', { profileId }, error as Error);
    throw new AppError(
      ErrorCode.CREDENTIAL_NOT_FOUND,
      'ServiceNow credentials not found',
      { profileId },
      error as Error
    );
  }
}

/**
 * Delete ServiceNow credentials from OS keychain
 */
export async function deleteServiceNowCredentials(profileId: string): Promise<void> {
  try {
    logger.debug('Deleting ServiceNow credentials', { profileId });
    await invoke('delete_servicenow_credentials', { profileId });
    logger.info('ServiceNow credentials deleted', { profileId });
  } catch (error) {
    logger.error('Failed to delete ServiceNow credentials', { profileId }, error as Error);
    throw new AppError(
      ErrorCode.CREDENTIAL_STORAGE_FAILED,
      'Failed to delete ServiceNow credentials',
      { profileId },
      error as Error
    );
  }
}

/**
 * Check if ServiceNow credentials exist
 */
export async function hasServiceNowCredentials(profileId: string): Promise<boolean> {
  try {
    const result = await invoke<{ exists: boolean }>('has_servicenow_credentials', {
      profileId,
    });
    return result.exists;
  } catch (error) {
    logger.warn('Failed to check ServiceNow credentials', { profileId }, error as Error);
    return false;
  }
}

// ============================================================================
// API Key Management Commands
// ============================================================================

/**
 * Store API key in OS keychain
 */
export async function storeApiKey(
  provider: string,
  profileId: string,
  apiKey: string
): Promise<void> {
  try {
    logger.debug('Storing API key', { provider, profileId });
    await invoke('store_api_key', {
      provider,
      profileId,
      apiKey,
    });
    logger.info('API key stored successfully', { provider, profileId });
  } catch (error) {
    logger.error('Failed to store API key', { provider, profileId }, error as Error);
    throw new AppError(
      ErrorCode.CREDENTIAL_STORAGE_FAILED,
      `Failed to store ${provider} API key`,
      { provider, profileId },
      error as Error
    );
  }
}

/**
 * Get API key from OS keychain
 */
export async function getApiKey(provider: string, profileId: string): Promise<string> {
  try {
    logger.debug('Retrieving API key', { provider, profileId });
    const apiKey = await invoke<string>('get_api_key', {
      provider,
      profileId,
    });
    logger.debug('API key retrieved', { provider, profileId });
    return apiKey;
  } catch (error) {
    logger.warn('Failed to retrieve API key', { provider, profileId }, error as Error);
    throw new AppError(
      ErrorCode.CREDENTIAL_NOT_FOUND,
      `${provider} API key not found`,
      { provider, profileId },
      error as Error
    );
  }
}

/**
 * Delete API key from OS keychain
 */
export async function deleteApiKey(provider: string, profileId: string): Promise<void> {
  try {
    logger.debug('Deleting API key', { provider, profileId });
    await invoke('delete_api_key', { provider, profileId });
    logger.info('API key deleted', { provider, profileId });
  } catch (error) {
    logger.error('Failed to delete API key', { provider, profileId }, error as Error);
    throw new AppError(
      ErrorCode.CREDENTIAL_STORAGE_FAILED,
      `Failed to delete ${provider} API key`,
      { provider, profileId },
      error as Error
    );
  }
}

/**
 * Check if API key exists
 */
export async function hasApiKey(provider: string, profileId: string): Promise<boolean> {
  try {
    const result = await invoke<{ exists: boolean }>('has_api_key', {
      provider,
      profileId,
    });
    return result.exists;
  } catch (error) {
    logger.warn('Failed to check API key', { provider, profileId }, error as Error);
    return false;
  }
}

/**
 * Fetch a ServiceNow OAuth 2.0 Bearer token via the Resource Owner Password flow.
 * Runs in Rust (reqwest) to avoid CORS restrictions in the renderer.
 */
export async function getNowAssistOAuthToken(
  instanceUrl: string,
  clientId: string,
  clientSecret: string,
  username: string,
  password: string,
): Promise<string> {
  try {
    logger.debug('Fetching Now Assist OAuth token', { instanceUrl });
    const token = await invoke<string>('get_now_assist_oauth_token', {
      instanceUrl,
      clientId,
      clientSecret,
      username,
      password,
    });
    logger.info('Now Assist OAuth token fetched successfully');
    return token;
  } catch (error) {
    logger.warn('Failed to fetch Now Assist OAuth token', { instanceUrl }, error as Error);
    throw error;
  }
}

/**
 * Initiate a ServiceNow OAuth 2.0 Authorization Code flow via browser.
 *
 * Opens the ServiceNow login page in the default browser (works with SSO/MFA),
 * waits for the redirect to http://localhost:7823/oauth, and exchanges the
 * authorization code for an access token.
 *
 * The redirect URI `http://localhost:7823/oauth` must be registered in the
 * ServiceNow OAuth Application Registry record.
 *
 * Returns the OAuth Bearer access token string.
 */
export async function nowAssistOAuthLogin(
  instanceUrl: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  logger.debug('nowAssistOAuthLogin: starting browser OAuth flow', { instanceUrl });
  const token = await invoke<string>('now_assist_oauth_login', {
    instanceUrl,
    clientId,
    clientSecret,
  });
  logger.info('nowAssistOAuthLogin: token obtained');
  return token;
}

// ============================================================================
// Now Assist MCP Proxy Commands (Rust-side, bypasses WebView CORS)
// ============================================================================

export interface McpToolInfo {
  name: string;
  description: string;
  input_schema: unknown;
}

export interface NowAssistConnectResult {
  tools: McpToolInfo[];
  tool_count: number;
}

export interface NowAssistCallToolResult {
  content: string;
  is_error: boolean;
  latency_ms: number;
}

/**
 * Connect to a ServiceNow Now Assist MCP server and list available tools.
 * Runs in Rust (reqwest) to avoid CORS restrictions in the WebView renderer.
 */
export async function nowAssistConnect(
  endpoint: string,
  token: string,
  authMode: string,
): Promise<NowAssistConnectResult> {
  try {
    logger.debug('nowAssistConnect: connecting', { endpoint, authMode });
    const result = await invoke<NowAssistConnectResult>('now_assist_connect', {
      endpoint,
      token,
      authMode,
    });
    logger.info('nowAssistConnect: connected', { toolCount: result.tool_count });
    return result;
  } catch (error) {
    logger.warn('nowAssistConnect: failed', { endpoint }, error as Error);
    throw error;
  }
}

/**
 * Call a Now Assist MCP tool by name.
 * Runs in Rust (reqwest) to avoid CORS restrictions in the WebView renderer.
 *
 * @param arguments - JSON-encoded arguments string, e.g. '{"query":"hello"}'
 */
export async function nowAssistCallTool(
  endpoint: string,
  token: string,
  authMode: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<NowAssistCallToolResult> {
  try {
    logger.debug('nowAssistCallTool: calling tool', { toolName });
    const result = await invoke<NowAssistCallToolResult>('now_assist_call_tool', {
      endpoint,
      token,
      authMode,
      toolName,
      arguments: JSON.stringify(args),
    });
    logger.info('nowAssistCallTool: completed', { toolName, latencyMs: result.latency_ms });
    return result;
  } catch (error) {
    logger.warn('nowAssistCallTool: failed', { toolName }, error as Error);
    throw error;
  }
}

// ============================================================================
// Connection Testing Commands (T032-T033)
// ============================================================================

export interface OllamaTestResult {
  success: boolean;
  version: string | null;
  models: string[];
  latency_ms: number;
  error: string | null;
}

export interface ServiceNowTestResult {
  success: boolean;
  instance: string | null;
  latency_ms: number;
  error: string | null;
}

/**
 * Test connection to Ollama and list available models
 */
export async function testOllamaConnection(endpoint: string): Promise<OllamaTestResult> {
  try {
    logger.debug('Testing Ollama connection', { endpoint });
    const result = await invoke<OllamaTestResult>('test_ollama_connection', { endpoint });
    logger.info('Ollama connection test complete', { success: result.success, endpoint });
    return result;
  } catch (error) {
    logger.error('Ollama connection test invoke failed', { endpoint }, error as Error);
    throw ErrorHandler.toAppError(error);
  }
}

/**
 * Test connection to ServiceNow using provided credentials
 */
export async function testServiceNowConnection(
  instanceUrl: string,
  username: string,
  password: string
): Promise<ServiceNowTestResult> {
  try {
    logger.debug('Testing ServiceNow connection', { instanceUrl, username });
    const result = await invoke<ServiceNowTestResult>('test_servicenow_connection', {
      instanceUrl,
      username,
      password,
    });
    logger.info('ServiceNow connection test complete', { success: result.success, instanceUrl });
    return result;
  } catch (error) {
    logger.error('ServiceNow connection test invoke failed', { instanceUrl }, error as Error);
    throw ErrorHandler.toAppError(error);
  }
}

// ============================================================================
// Testing & Utilities
// ============================================================================

/**
 * Test credential system (development only)
 */
export async function testCredentials(): Promise<string> {
  try {
    const result = await invoke<string>('test_credentials');
    logger.info('Credential test completed', { result });
    return result;
  } catch (error) {
    logger.error('Credential test failed', {}, error as Error);
    throw ErrorHandler.toAppError(error);
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if error is a Tauri invoke error
 */
export function isTauriError(error: unknown): error is Error {
  return error instanceof Error && 'message' in error;
}

/**
 * Parse Tauri error message
 */
export function parseTauriError(error: unknown): string {
  if (isTauriError(error)) {
    return error.message;
  }
  return String(error);
}

// Export all functions as a namespace for organized imports
export const IPC = {
  // Credentials
  storeServiceNowCredentials,
  getServiceNowCredentials,
  deleteServiceNowCredentials,
  hasServiceNowCredentials,

  // API Keys
  storeApiKey,
  getApiKey,
  deleteApiKey,
  hasApiKey,
  getNowAssistOAuthToken,
  nowAssistOAuthLogin,

  // Now Assist MCP Proxy
  nowAssistConnect,
  nowAssistCallTool,

  // Connection Tests
  testOllamaConnection,
  testServiceNowConnection,

  // Testing
  testCredentials,

  // Utilities
  parseTauriError,
};

export default IPC;
