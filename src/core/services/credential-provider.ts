/**
 * Credential Provider — shared types and constants for the multi-vault credential system.
 *
 * Defines the three supported storage backends, their status shape, and the
 * canonical set of credential keys the app manages.
 */

export type ProviderId = 'keychain' | '1password' | 'bitwarden';

export interface ProviderStatus {
  id: ProviderId;
  displayName: string;
  /** Whether the CLI / runtime is installed and accessible */
  isInstalled: boolean;
  /** Whether the session is active (vault unlocked / signed in) */
  isAuthenticated: boolean;
  /** Human-readable explanation when not installed or not authenticated */
  errorMessage: string | null;
}

export interface ProviderConfiguration {
  defaultProvider: ProviderId;
  /** Map of credential_key → provider override (absent = use defaultProvider) */
  overrides: Record<string, ProviderId>;
}

/**
 * All credential keys the app manages.
 * Every key here must be routed through the active provider on read/write.
 */
export const CREDENTIAL_KEYS = [
  'servicenow_url',
  'servicenow_username',
  'servicenow_password',
  'oauth_access_token',
  'oauth_refresh_token',
  'oauth_id_token',
  'llm_openai',
  'llm_mistral',
  'perplexity',
  'google',
] as const;

export type CredentialKey = (typeof CREDENTIAL_KEYS)[number];

/** Type guard: returns true if the given string is a known credential key */
export function isCredentialKey(key: string): key is CredentialKey {
  return (CREDENTIAL_KEYS as readonly string[]).includes(key);
}

/** Type guard: returns true if the given string is a valid ProviderId */
export function isProviderId(id: string): id is ProviderId {
  return id === 'keychain' || id === '1password' || id === 'bitwarden';
}

export const PROVIDER_DISPLAY_NAMES: Record<ProviderId, string> = {
  keychain: 'OS Keychain',
  '1password': '1Password',
  bitwarden: 'Bitwarden',
};
