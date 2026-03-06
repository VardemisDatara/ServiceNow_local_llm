/**
 * Contract: Settings — Now Assist MCP Configuration
 *
 * Defines the configuration form fields and validation rules for the
 * Now Assist MCP server section in the Settings page (Configuration.tsx).
 *
 * Follows the exact same patterns as LLMProviderConfig and SearchProviderConfig.
 */

// ─── Form State ───────────────────────────────────────────────────────────────

export interface NowAssistConfigFormState {
  /** Full MCP server URL. Format: https://<instance>.service-now.com/sncapps/mcp-server/<sys_id> */
  nowAssistEndpoint: string;
  /**
   * Authentication mode selector:
   * - 'apikey': sends x-sn-apikey header (ServiceNow native API Key / PAT)
   * - 'bearer': sends Authorization: Bearer header (OAuth 2.1 access token)
   * Default: 'apikey'
   */
  nowAssistAuthMode: 'apikey' | 'bearer';
  /** Token value. Not shown in plaintext after save. */
  nowAssistToken: string;
  /** Whether the test connection button is in a loading state */
  testingConnection: boolean;
  /** Number of tools discovered during test, or null if not yet tested */
  discoveredToolCount: number | null;
  /** Error message from test connection, or null */
  testError: string | null;
}

// ─── Validation Rules ─────────────────────────────────────────────────────────

export interface NowAssistConfigValidation {
  /** Endpoint must start with https:// and end with /sncapps/mcp-server (or similar MCP path) */
  endpointValid: boolean;
  /** Bearer token must be a non-empty string when endpoint is provided */
  tokenValid: boolean;
  /** Form is submittable: either both fields empty (disabled) OR both fields valid */
  canSave: boolean;
}

// ─── Profile Fields (additions to ConfigurationProfile) ──────────────────────

export interface NowAssistProfileFields {
  /** Stored in configuration_profiles.now_assist_endpoint */
  nowAssistEndpoint?: string | undefined;
  /** Stored in configuration_profiles.now_assist_api_key_ref (value: 'now_assist') */
  nowAssistApiKeyRef?: string | undefined;
}

// ─── IPC calls used by this config section ────────────────────────────────────
// IPC.storeApiKey('now_assist', profileId, bearerToken)  → saves to OS keychain
// IPC.getApiKey('now_assist', profileId)                 → reads from OS keychain
// IPC.deleteApiKey('now_assist', profileId)              → removes from OS keychain
// IPC.hasApiKey('now_assist', profileId)                 → checks existence
