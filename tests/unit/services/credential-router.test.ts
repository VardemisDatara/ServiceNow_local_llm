/**
 * Unit tests for credential-router.ts — getAvailableProviders and setDefaultProvider.
 *
 * Tests:
 * 1. getAvailableProviders() maps snake_case response fields to camelCase ProviderStatus objects
 * 2. setDefaultProvider('1password') calls ProviderConfigRepository.setDefaultProvider
 * 3. getAvailableProviders() handles empty response array
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoist mock helpers ───────────────────────────────────────────────────────

const { mockInvoke, mockRepoSetDefaultProvider } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockRepoSetDefaultProvider: vi.fn(),
}));

// ─── Mock external dependencies ───────────────────────────────────────────────

// Tauri invoke is not available in Node/Vitest
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// Mock the ProviderConfigRepository singleton
vi.mock('../../../src/core/storage/repositories/provider-config', () => ({
  providerConfigRepository: {
    getDefaultProvider: vi.fn().mockResolvedValue('keychain'),
    setDefaultProvider: (...args: unknown[]) => mockRepoSetDefaultProvider(...args),
    setOverride: vi.fn(),
    removeOverride: vi.fn(),
    getAllOverrides: vi.fn().mockResolvedValue({}),
    getOverride: vi.fn(),
    getExternalItemId: vi.fn(),
    setExternalItemId: vi.fn(),
    removeExternalItemId: vi.fn(),
  },
}));

// ─── Import the module under test AFTER mocks ─────────────────────────────────

import { getAvailableProviders, setDefaultProvider } from '../../../src/core/services/credential-router';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a raw snake_case response as Rust would return it. */
function buildRawProvider(overrides: {
  id?: string;
  display_name?: string;
  is_installed?: boolean;
  is_authenticated?: boolean;
  error_message?: string | null;
} = {}) {
  return {
    id: 'keychain',
    display_name: 'OS Keychain',
    is_installed: true,
    is_authenticated: true,
    error_message: null,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('credential-router — getAvailableProviders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps snake_case response fields to camelCase ProviderStatus objects', async () => {
    mockInvoke.mockResolvedValue([
      buildRawProvider({ id: 'keychain', display_name: 'OS Keychain', is_installed: true, is_authenticated: true, error_message: null }),
      buildRawProvider({ id: '1password', display_name: '1Password', is_installed: true, is_authenticated: false, error_message: '1Password session expired — run `op signin` and retry' }),
      buildRawProvider({ id: 'bitwarden', display_name: 'Bitwarden', is_installed: false, is_authenticated: false, error_message: 'Bitwarden CLI (bw) not installed' }),
    ]);

    const statuses = await getAvailableProviders();

    expect(statuses).toHaveLength(3);

    const keychain = statuses.find((s) => s.id === 'keychain');
    expect(keychain).toBeDefined();
    expect(keychain?.displayName).toBe('OS Keychain');
    expect(keychain?.isInstalled).toBe(true);
    expect(keychain?.isAuthenticated).toBe(true);
    expect(keychain?.errorMessage).toBeNull();

    const op = statuses.find((s) => s.id === '1password');
    expect(op).toBeDefined();
    expect(op?.displayName).toBe('1Password');
    expect(op?.isInstalled).toBe(true);
    expect(op?.isAuthenticated).toBe(false);
    expect(op?.errorMessage).toBe('1Password session expired — run `op signin` and retry');

    const bw = statuses.find((s) => s.id === 'bitwarden');
    expect(bw).toBeDefined();
    expect(bw?.isInstalled).toBe(false);
    expect(bw?.errorMessage).toBe('Bitwarden CLI (bw) not installed');
  });

  it('invokes the get_available_providers Tauri command', async () => {
    mockInvoke.mockResolvedValue([]);

    await getAvailableProviders();

    expect(mockInvoke).toHaveBeenCalledOnce();
    expect(mockInvoke).toHaveBeenCalledWith('get_available_providers');
  });

  it('handles empty response array without errors', async () => {
    mockInvoke.mockResolvedValue([]);

    const statuses = await getAvailableProviders();

    expect(statuses).toEqual([]);
    expect(Array.isArray(statuses)).toBe(true);
  });

  it('preserves null error_message as null (not converted to undefined)', async () => {
    mockInvoke.mockResolvedValue([
      buildRawProvider({ error_message: null }),
    ]);

    const [status] = await getAvailableProviders();

    expect(status?.errorMessage).toBeNull();
  });

  it('propagates errors from the Tauri invoke call', async () => {
    mockInvoke.mockRejectedValue(new Error('Tauri command failed'));

    await expect(getAvailableProviders()).rejects.toThrow('Tauri command failed');
  });
});

describe('credential-router — setDefaultProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls repo.setDefaultProvider('1password')", async () => {
    mockRepoSetDefaultProvider.mockResolvedValue(undefined);

    await setDefaultProvider('1password');

    expect(mockRepoSetDefaultProvider).toHaveBeenCalledOnce();
    expect(mockRepoSetDefaultProvider).toHaveBeenCalledWith('1password');
  });

  it("calls repo.setDefaultProvider('keychain')", async () => {
    mockRepoSetDefaultProvider.mockResolvedValue(undefined);

    await setDefaultProvider('keychain');

    expect(mockRepoSetDefaultProvider).toHaveBeenCalledWith('keychain');
  });

  it("calls repo.setDefaultProvider('bitwarden')", async () => {
    mockRepoSetDefaultProvider.mockResolvedValue(undefined);

    await setDefaultProvider('bitwarden');

    expect(mockRepoSetDefaultProvider).toHaveBeenCalledWith('bitwarden');
  });

  it('propagates errors from the repository', async () => {
    mockRepoSetDefaultProvider.mockRejectedValue(new Error('DB write error'));

    await expect(setDefaultProvider('1password')).rejects.toThrow('DB write error');
  });
});
