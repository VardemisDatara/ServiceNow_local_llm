# Data Model: Multi-Vault Credential Provider

**Branch**: `004-multi-vault-credentials` | **Date**: 2026-03-10

---

## Entities

### 1. ProviderConfiguration (SQLite — new table)

Persists the user's global provider choice and per-credential overrides. Single-row config pattern (one row per `key`).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `key` | TEXT | PRIMARY KEY | Config key (e.g., `"default_provider"`, `"override:servicenow_url"`) |
| `value` | TEXT | NOT NULL | Config value (e.g., `"1password"`, `"bitwarden"`, `"keychain"`) |
| `updated_at` | TEXT | NOT NULL | ISO 8601 timestamp of last update |

**Rows written at setup**:
- `key = "default_provider"`, `value = "keychain"` (initial default)
- `key = "override:{credential_key}"`, `value = "{provider_id}"` (per-credential overrides, written on demand)

**Valid provider_id values**: `"keychain"` | `"1password"` | `"bitwarden"`

---

### 2. CredentialProviderItemId (SQLite — new table)

Caches external item identifiers (e.g., Bitwarden UUIDs) so subsequent reads/updates/deletes can bypass name-based lookup.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `credential_key` | TEXT | NOT NULL | App-level credential key (e.g., `"servicenow_url"`, `"llm_openai"`) |
| `provider_id` | TEXT | NOT NULL | Provider that owns this item (`"bitwarden"` | `"1password"`) |
| `external_item_id` | TEXT | NOT NULL | Provider's item identifier (Bitwarden UUID, or 1Password item UUID) |
| `updated_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**PRIMARY KEY**: `(credential_key, provider_id)`

**Note**: Only populated for providers that require ID-based access (Bitwarden). 1Password supports title-based access via `op read` so caching is optional but supported.

---

### 3. CredentialProvider (Rust enum — not persisted)

Runtime representation of a provider.

```rust
pub enum ProviderId {
    Keychain,
    OnePassword,
    Bitwarden,
}

pub struct CredentialProvider {
    pub id: ProviderId,
    pub display_name: &'static str,
    pub is_installed: bool,        // CLI/runtime available
    pub is_authenticated: bool,    // Session active / vault unlocked
}
```

**State transitions**:
```
Not installed → Installed (CLI detected) → Authenticated (session active) → [Locked] → Authenticated
```

---

### 4. CredentialEntry (conceptual — not a DB table)

The set of all credential keys the app manages. These are the existing keychain keys, now routed through the provider layer.

| Credential Key | Description |
|----------------|-------------|
| `servicenow_url` | ServiceNow instance URL |
| `servicenow_username` | ServiceNow username |
| `servicenow_password` | ServiceNow password |
| `oauth_access_token` | Now Assist OAuth access token |
| `oauth_refresh_token` | Now Assist OAuth refresh token |
| `oauth_id_token` | Now Assist OAuth ID token |
| `llm_openai` | OpenAI API key |
| `llm_mistral` | Mistral API key |
| `perplexity` | Perplexity search API key |
| `google` | Google search API key |

---

## SQLite Migration

**Migration**: `0003_provider_config.sql` (next sequential migration)

```sql
CREATE TABLE IF NOT EXISTS provider_configuration (
    key        TEXT PRIMARY KEY NOT NULL,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS credential_provider_item_ids (
    credential_key   TEXT NOT NULL,
    provider_id      TEXT NOT NULL,
    external_item_id TEXT NOT NULL,
    updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (credential_key, provider_id)
);

-- Seed default provider
INSERT OR IGNORE INTO provider_configuration (key, value)
VALUES ('default_provider', 'keychain');
```

---

## Drizzle Schema Additions (`src/core/storage/schema.ts`)

```typescript
export const providerConfiguration = sqliteTable('provider_configuration', {
  key: text('key').primaryKey().notNull(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const credentialProviderItemIds = sqliteTable(
  'credential_provider_item_ids',
  {
    credentialKey: text('credential_key').notNull(),
    providerId: text('provider_id').notNull(),
    externalItemId: text('external_item_id').notNull(),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.credentialKey, table.providerId] }),
  })
);
```

---

## Relationships

```
ProviderConfiguration (1 row per config key)
    ↓ value = "default_provider"
CredentialProvider (runtime, not persisted)
    ↓ routes to
CredentialEntry (app credential keys)
    ↓ if bitwarden
CredentialProviderItemId (UUID cache)
```
