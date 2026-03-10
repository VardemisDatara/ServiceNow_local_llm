# Tauri IPC Contracts: Multi-Vault Credential Provider

**Branch**: `004-multi-vault-credentials` | **Date**: 2026-03-10

This feature extends the Tauri IPC layer with new commands for provider management, and modifies existing credential commands to route through the active provider.

---

## New Commands

### `get_available_providers`

Returns all supported providers with their current installation and authentication status.

**Invoke**: `invoke('get_available_providers')`

**Response**:
```typescript
type ProviderStatus = {
  id: 'keychain' | '1password' | 'bitwarden';
  display_name: string;           // "OS Keychain" | "1Password" | "Bitwarden"
  is_installed: boolean;          // CLI detected on PATH
  is_authenticated: boolean;      // Session active / vault unlocked
  error_message: string | null;   // Human-readable issue if not ready
};

type GetAvailableProvidersResponse = ProviderStatus[];
```

**Behavior**:
- OS Keychain: always `is_installed = true`, `is_authenticated = true`
- 1Password: `is_installed` = `which op` succeeds AND version >= 2.0.0; `is_authenticated` = `op whoami` exits 0
- Bitwarden: `is_installed` = `which bw` succeeds; `is_authenticated` = `bw status` `.status === "unlocked"`
- Must complete within 2 seconds (per SC-004)
- Detection runs for all three providers in parallel

**Errors**: Never errors — unavailable providers are represented with `is_installed: false` or `is_authenticated: false`

---

### `get_provider_configuration`

Returns the current global default provider and all per-credential overrides.

**Invoke**: `invoke('get_provider_configuration')`

**Response**:
```typescript
type ProviderConfiguration = {
  default_provider: 'keychain' | '1password' | 'bitwarden';
  overrides: Record<string, 'keychain' | '1password' | 'bitwarden'>;  // credential_key → provider_id
};
```

**Errors**: None expected (reads from local SQLite)

---

### `set_default_provider`

Sets the global default credential storage provider.

**Invoke**: `invoke('set_default_provider', { provider_id: '1password' })`

**Payload**:
```typescript
{ provider_id: 'keychain' | '1password' | 'bitwarden' }
```

**Response**: `{ success: true }`

**Errors**:
- `PROVIDER_NOT_AVAILABLE`: provider is not installed or not authenticated
- `INVALID_PROVIDER`: unknown provider_id

**Behavior**: Saves to `provider_configuration` table. Does NOT trigger migration — that is a separate step.

---

### `set_credential_provider_override`

Sets a per-credential provider override.

**Invoke**: `invoke('set_credential_provider_override', { credential_key: 'llm_openai', provider_id: 'keychain' })`

**Payload**:
```typescript
{ credential_key: string; provider_id: 'keychain' | '1password' | 'bitwarden' }
```

**Response**: `{ success: true }`

**Errors**:
- `PROVIDER_NOT_AVAILABLE`: target provider not ready
- `INVALID_CREDENTIAL_KEY`: unknown credential key
- `INVALID_PROVIDER`: unknown provider_id

---

### `remove_credential_provider_override`

Removes a per-credential override; the credential falls back to the global default.

**Invoke**: `invoke('remove_credential_provider_override', { credential_key: 'llm_openai' })`

**Payload**:
```typescript
{ credential_key: string }
```

**Response**: `{ success: true }`

**Errors**: `INVALID_CREDENTIAL_KEY`

---

### `migrate_credentials`

Copies all credentials from the current active provider to a new provider in one atomic step. If all succeed, switches the default provider. If any fail, rolls back (old provider remains, no credentials cleared).

**Invoke**: `invoke('migrate_credentials', { target_provider_id: 'bitwarden' })`

**Payload**:
```typescript
{ target_provider_id: 'keychain' | '1password' | 'bitwarden' }
```

**Response**:
```typescript
type MigrateCredentialsResponse = {
  success: boolean;
  migrated: string[];        // credential_keys successfully migrated
  failed: Array<{
    credential_key: string;
    error: string;
  }>;
  provider_changed: boolean; // true only if ALL credentials migrated
};
```

**Errors**:
- `PROVIDER_NOT_AVAILABLE`: target provider not ready
- `SAME_PROVIDER`: source and target are the same
- `MIGRATION_PARTIAL_FAILURE`: one or more credentials failed — response body contains details, provider NOT switched

**Behavior**:
1. Read all known credential keys from the current provider
2. Write each to the target provider
3. If all writes succeed → update `default_provider` in SQLite → delete originals from old provider → return `provider_changed: true`
4. If any write fails → delete any partially-written items from target provider → return `provider_changed: false` with failed list

---

## Modified Existing Commands

The following existing Tauri commands are NOT changed in signature, but their implementation is updated to route through the active provider (global default or per-credential override) instead of always using the OS keychain.

| Command | Current behavior | New behavior |
|---------|-----------------|--------------|
| `store_credential(key, value)` | Writes to OS keychain | Writes to active provider for `key` |
| `get_credential(key)` | Reads from OS keychain | Reads from active provider for `key`; re-checks provider availability |
| `delete_credential(key)` | Deletes from OS keychain | Deletes from active provider for `key` |
| `has_credential(key)` | Checks OS keychain | Checks active provider for `key` |

**Error additions** for all modified commands:
- `PROVIDER_LOCKED`: active provider became unavailable mid-session (user must re-unlock vault)
- `PROVIDER_NOT_INSTALLED`: active provider CLI no longer found (user must reinstall or switch)

---

## TypeScript Enums / Types (shared)

Located in `src/core/services/credential-provider.ts`:

```typescript
export type ProviderId = 'keychain' | '1password' | 'bitwarden';

export interface ProviderStatus {
  id: ProviderId;
  displayName: string;
  isInstalled: boolean;
  isAuthenticated: boolean;
  errorMessage: string | null;
}

export interface ProviderConfiguration {
  defaultProvider: ProviderId;
  overrides: Record<string, ProviderId>;
}

export const CREDENTIAL_KEYS = [
  'servicenow_url', 'servicenow_username', 'servicenow_password',
  'oauth_access_token', 'oauth_refresh_token', 'oauth_id_token',
  'llm_openai', 'llm_mistral', 'perplexity', 'google',
] as const;

export type CredentialKey = typeof CREDENTIAL_KEYS[number];
```
