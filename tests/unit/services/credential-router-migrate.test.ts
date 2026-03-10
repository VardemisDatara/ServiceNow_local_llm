/**
 * Unit tests for migrateCredentials() in credential-router.ts.
 *
 * Tests:
 * 1. Success case: result maps snake_case fields to camelCase MigrateCredentialsResult.
 * 2. Partial failure: failed array maps credential_key → credentialKey correctly.
 * 3. Invoke error propagation: if invoke throws, migrateCredentials() propagates the error.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoist mock helpers ───────────────────────────────────────────────────────

const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
}));

// ─── Mock external dependencies ───────────────────────────────────────────────

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock('../../../src/core/storage/repositories/provider-config', () => ({
  providerConfigRepository: {
    getDefaultProvider: vi.fn().mockResolvedValue('keychain'),
    setDefaultProvider: vi.fn().mockResolvedValue(undefined),
    setOverride: vi.fn(),
    removeOverride: vi.fn(),
    getAllOverrides: vi.fn().mockResolvedValue({}),
    getOverride: vi.fn(),
    getExternalItemId: vi.fn(),
    setExternalItemId: vi.fn(),
    removeExternalItemId: vi.fn(),
  },
}));

// ─── Import module under test AFTER mocks ─────────────────────────────────────

import { migrateCredentials } from '../../../src/core/services/credential-router';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('credential-router — migrateCredentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Test 1: Success case ──────────────────────────────────────────────────

  it('maps snake_case response to camelCase MigrateCredentialsResult on success', async () => {
    mockInvoke.mockResolvedValue({
      success: true,
      migrated: ['servicenow_url', 'servicenow_username'],
      failed: [],
      provider_changed: true,
    });

    const result = await migrateCredentials('1password');

    expect(result.success).toBe(true);
    expect(result.migrated).toEqual(['servicenow_url', 'servicenow_username']);
    expect(result.failed).toEqual([]);
    expect(result.providerChanged).toBe(true);
  });

  it('invokes migrate_credentials with targetProviderId', async () => {
    mockInvoke.mockResolvedValue({
      success: true,
      migrated: [],
      failed: [],
      provider_changed: true,
    });

    await migrateCredentials('1password');

    expect(mockInvoke).toHaveBeenCalledOnce();
    expect(mockInvoke).toHaveBeenCalledWith('migrate_credentials', {
      targetProviderId: '1password',
      bwSession: null,
    });
  });

  it('passes bwSession when provided', async () => {
    mockInvoke.mockResolvedValue({
      success: true,
      migrated: [],
      failed: [],
      provider_changed: true,
    });

    await migrateCredentials('bitwarden', 'my-session-token');

    expect(mockInvoke).toHaveBeenCalledWith('migrate_credentials', {
      targetProviderId: 'bitwarden',
      bwSession: 'my-session-token',
    });
  });

  it('passes null bwSession when not provided', async () => {
    mockInvoke.mockResolvedValue({
      success: true,
      migrated: [],
      failed: [],
      provider_changed: true,
    });

    await migrateCredentials('keychain');

    expect(mockInvoke).toHaveBeenCalledWith('migrate_credentials', {
      targetProviderId: 'keychain',
      bwSession: null,
    });
  });

  // ── Test 2: Partial failure ───────────────────────────────────────────────

  it('maps partial failure — failed array uses camelCase credentialKey', async () => {
    mockInvoke.mockResolvedValue({
      success: false,
      migrated: ['servicenow_url', 'servicenow_username'],
      failed: [
        { credential_key: 'llm_openai', error: '1Password session expired' },
        { credential_key: 'llm_mistral', error: 'Network timeout' },
      ],
      provider_changed: false,
    });

    const result = await migrateCredentials('1password');

    expect(result.success).toBe(false);
    expect(result.migrated).toEqual(['servicenow_url', 'servicenow_username']);
    expect(result.providerChanged).toBe(false);

    expect(result.failed).toHaveLength(2);

    const firstFailed = result.failed[0];
    expect(firstFailed).toBeDefined();
    expect(firstFailed?.credentialKey).toBe('llm_openai');
    expect(firstFailed?.error).toBe('1Password session expired');

    const secondFailed = result.failed[1];
    expect(secondFailed).toBeDefined();
    expect(secondFailed?.credentialKey).toBe('llm_mistral');
    expect(secondFailed?.error).toBe('Network timeout');
  });

  it('handles full failure — all credentials in failed list', async () => {
    mockInvoke.mockResolvedValue({
      success: false,
      migrated: [],
      failed: [
        { credential_key: 'servicenow_url', error: 'Not installed' },
      ],
      provider_changed: false,
    });

    const result = await migrateCredentials('bitwarden', 'token');

    expect(result.success).toBe(false);
    expect(result.migrated).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.providerChanged).toBe(false);
  });

  it('does not include raw credential_key on the mapped failed items', async () => {
    mockInvoke.mockResolvedValue({
      success: false,
      migrated: [],
      failed: [{ credential_key: 'llm_openai', error: 'err' }],
      provider_changed: false,
    });

    const result = await migrateCredentials('1password');

    const failedItem = result.failed[0] as Record<string, unknown>;
    // The snake_case field must not be present on the mapped result
    expect('credential_key' in failedItem).toBe(false);
    expect(failedItem['credentialKey']).toBe('llm_openai');
  });

  // ── Test 3: Invoke error propagation ─────────────────────────────────────

  it('propagates errors thrown by invoke', async () => {
    mockInvoke.mockRejectedValue(new Error('Tauri IPC error'));

    await expect(migrateCredentials('1password')).rejects.toThrow('Tauri IPC error');
  });

  it('propagates string errors thrown by invoke', async () => {
    mockInvoke.mockRejectedValue('provider not found');

    await expect(migrateCredentials('1password')).rejects.toBe('provider not found');
  });
});
