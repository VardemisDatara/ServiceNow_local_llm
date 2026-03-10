/**
 * Credential Router — thin wrappers over Tauri `invoke()` calls and direct
 * TypeScript DB queries for credential provider management.
 *
 * Provider *availability* checks (`get_available_providers`) go through Rust
 * because they need to shell-out to the `op` / `bw` CLIs.
 *
 * Provider *configuration* (default provider, overrides) is handled entirely
 * in TypeScript via ProviderConfigRepository to avoid a round-trip to Rust.
 */

import { invoke } from '@tauri-apps/api/core';
import type { ProviderId, ProviderStatus, ProviderConfiguration } from './credential-provider';
import { providerConfigRepository } from '../storage/repositories/provider-config';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MigrateCredentialsResult {
  success: boolean;
  migrated: string[];
  failed: Array<{ credentialKey: string; error: string }>;
  providerChanged: boolean;
}

// ── Provider availability (Rust) ──────────────────────────────────────────────

/**
 * Ask Rust to probe the three credential backends in parallel.
 * Returns availability/authentication status for each provider.
 */
export async function getAvailableProviders(): Promise<ProviderStatus[]> {
  const raw = await invoke<
    Array<{
      id: string;
      display_name: string;
      is_installed: boolean;
      is_authenticated: boolean;
      error_message: string | null;
    }>
  >('get_available_providers');

  return raw.map((p) => ({
    id: p.id as ProviderId,
    displayName: p.display_name,
    isInstalled: p.is_installed,
    isAuthenticated: p.is_authenticated,
    errorMessage: p.error_message,
  }));
}

// ── Provider configuration (TypeScript / Drizzle) ─────────────────────────────

/**
 * Read the current provider configuration from SQLite.
 */
export async function getProviderConfiguration(): Promise<ProviderConfiguration> {
  const [defaultProvider, overrides] = await Promise.all([
    providerConfigRepository.getDefaultProvider(),
    providerConfigRepository.getAllOverrides(),
  ]);
  return { defaultProvider, overrides };
}

/**
 * Persist a new default provider to SQLite.
 */
export async function setDefaultProvider(providerId: ProviderId): Promise<void> {
  await providerConfigRepository.setDefaultProvider(providerId);
}

/**
 * Set a per-credential provider override in SQLite.
 */
export async function setCredentialProviderOverride(
  credentialKey: string,
  providerId: ProviderId,
): Promise<void> {
  await providerConfigRepository.setOverride(credentialKey, providerId);
}

/**
 * Remove a per-credential provider override from SQLite.
 */
export async function removeCredentialProviderOverride(
  credentialKey: string,
): Promise<void> {
  await providerConfigRepository.removeOverride(credentialKey);
}

// ── Credential migration (Rust) ───────────────────────────────────────────────

/**
 * Migrate all credentials to the target provider.
 * Delegates to the `migrate_credentials` Rust command.
 */
export async function migrateCredentials(
  targetProviderId: ProviderId,
  bwSession?: string,
): Promise<MigrateCredentialsResult> {
  const raw = await invoke<{
    success: boolean;
    migrated: string[];
    failed: Array<{ credential_key: string; error: string }>;
    provider_changed: boolean;
  }>('migrate_credentials', { targetProviderId, bwSession: bwSession ?? null });

  return {
    success: raw.success,
    migrated: raw.migrated,
    failed: raw.failed.map((f) => ({
      credentialKey: f.credential_key,
      error: f.error,
    })),
    providerChanged: raw.provider_changed,
  };
}
