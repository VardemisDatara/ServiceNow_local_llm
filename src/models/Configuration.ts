import type { ConfigurationProfile } from '../core/storage/schema';

/**
 * T028: ConfigurationProfile TypeScript model
 * Extends the Drizzle schema type with application-level types for forms and UI
 */

// Re-export the database type for convenience
export type { ConfigurationProfile };

// ============================================================================
// Form Types (for UI forms before saving to DB)
// ============================================================================

export interface ConfigurationFormValues {
  name: string;
  servicenowUrl: string;
  servicenowUsername: string;
  servicenowPassword: string;
  ollamaEndpoint: string;
  ollamaModel: string;
  searchProvider: 'duckduckgo' | 'perplexity' | 'google';
  searchApiKey?: string;
  // LLM Provider (T114)
  llmProvider: 'ollama' | 'openai' | 'mistral';
  llmApiKey?: string;
  cloudLlmModel?: string;
  sessionTimeoutHours: number;
  persistConversations: boolean;
  isActive: boolean;
}

export type ConnectionStatus = 'unknown' | 'connecting' | 'connected' | 'failed' | 'degraded';

export interface ConnectionState {
  status: ConnectionStatus;
  message?: string;
  testedAt?: Date;
  latencyMs?: number;
}

export interface ConnectionTestResult {
  success: boolean;
  latencyMs: number;
  message: string;
  version?: string | undefined;
  models?: string[] | undefined;
}

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_CONFIGURATION: Omit<ConfigurationFormValues, 'name' | 'servicenowUrl' | 'servicenowUsername' | 'servicenowPassword'> = {
  ollamaEndpoint: 'http://localhost:11434',
  ollamaModel: 'llama3.2',
  searchProvider: 'duckduckgo',
  llmProvider: 'ollama',
  sessionTimeoutHours: 24,
  persistConversations: true,
  isActive: false,
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert a ConfigurationProfile DB record to form values (without credentials)
 */
export function profileToFormValues(
  profile: ConfigurationProfile,
): Omit<ConfigurationFormValues, 'servicenowPassword' | 'searchApiKey' | 'llmApiKey'> {
  return {
    name: profile.name,
    servicenowUrl: profile.servicenowUrl,
    servicenowUsername: '', // Credentials retrieved from keychain separately
    ollamaEndpoint: profile.ollamaEndpoint,
    ollamaModel: profile.ollamaModel,
    searchProvider: profile.searchProvider,
    llmProvider: profile.llmProvider ?? 'ollama',
    ...(profile.cloudLlmModel !== null && profile.cloudLlmModel !== undefined
      ? { cloudLlmModel: profile.cloudLlmModel }
      : {}),
    sessionTimeoutHours: profile.sessionTimeoutHours,
    persistConversations: profile.persistConversations,
    isActive: profile.isActive,
  };
}

/**
 * Map connection status to human-readable label
 */
export function connectionStatusLabel(status: ConnectionStatus): string {
  switch (status) {
    case 'unknown': return 'Not tested';
    case 'connecting': return 'Connecting...';
    case 'connected': return 'Connected';
    case 'failed': return 'Connection failed';
    case 'degraded': return 'Degraded';
  }
}
