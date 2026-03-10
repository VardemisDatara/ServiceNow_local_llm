-- Migration 0004: Multi-vault credential provider configuration
-- Adds provider_configuration (key/value store for global default + per-credential overrides)
-- and credential_provider_item_ids (UUID cache for Bitwarden/1Password item IDs)

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

-- Seed default provider (OS keychain — always available, no prerequisites)
INSERT OR IGNORE INTO provider_configuration (key, value)
VALUES ('default_provider', 'keychain');
