/**
 * Unit tests for credential-router.ts — per-credential provider override functions.
 *
 * Verifies that setCredentialProviderOverride, removeCredentialProviderOverride,
 * and getProviderConfiguration delegate correctly to ProviderConfigRepository.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoist mock helpers (must be at the top, before any vi.mock calls) ────────
// `vi.mock` factory functions are hoisted to the top of the file by Vitest, so
// any variables they reference must also be hoisted via `vi.hoisted`.

const {
  mockGetDefaultProvider,
  mockSetDefaultProvider,
  mockSetOverride,
  mockRemoveOverride,
  mockGetAllOverrides,
  mockGetOverride,
} = vi.hoisted(() => ({
  mockGetDefaultProvider: vi.fn(),
  mockSetDefaultProvider: vi.fn(),
  mockSetOverride: vi.fn(),
  mockRemoveOverride: vi.fn(),
  mockGetAllOverrides: vi.fn(),
  mockGetOverride: vi.fn(),
}));

// ─── Mock external dependencies ───────────────────────────────────────────────

// Tauri invoke is not available in Node/Vitest
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock the ProviderConfigRepository singleton used by credential-router.ts
vi.mock('../../../src/core/storage/repositories/provider-config', () => ({
  providerConfigRepository: {
    getDefaultProvider: mockGetDefaultProvider,
    setDefaultProvider: mockSetDefaultProvider,
    setOverride: mockSetOverride,
    removeOverride: mockRemoveOverride,
    getAllOverrides: mockGetAllOverrides,
    getOverride: mockGetOverride,
    getExternalItemId: vi.fn(),
    setExternalItemId: vi.fn(),
    removeExternalItemId: vi.fn(),
  },
}));

// ─── Import the module under test AFTER mocks ─────────────────────────────────
import {
  setCredentialProviderOverride,
  removeCredentialProviderOverride,
  getProviderConfiguration,
} from '../../../src/core/services/credential-router';

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('credential-router — per-credential provider overrides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── setCredentialProviderOverride ──────────────────────────────────────────

  describe('setCredentialProviderOverride', () => {
    it('calls repo.setOverride with the credential key and provider id', async () => {
      mockSetOverride.mockResolvedValue(undefined);

      await setCredentialProviderOverride('llm_openai', 'bitwarden');

      expect(mockSetOverride).toHaveBeenCalledOnce();
      expect(mockSetOverride).toHaveBeenCalledWith('llm_openai', 'bitwarden');
    });

    it('propagates errors thrown by the repository', async () => {
      mockSetOverride.mockRejectedValue(new Error('DB write failed'));

      await expect(
        setCredentialProviderOverride('llm_openai', 'bitwarden'),
      ).rejects.toThrow('DB write failed');
    });

    it('calls repo.setOverride for all valid provider ids', async () => {
      mockSetOverride.mockResolvedValue(undefined);

      await setCredentialProviderOverride('servicenow_password', 'keychain');
      expect(mockSetOverride).toHaveBeenCalledWith('servicenow_password', 'keychain');

      mockSetOverride.mockClear();
      await setCredentialProviderOverride('llm_mistral', '1password');
      expect(mockSetOverride).toHaveBeenCalledWith('llm_mistral', '1password');
    });
  });

  // ── removeCredentialProviderOverride ──────────────────────────────────────

  describe('removeCredentialProviderOverride', () => {
    it('calls repo.removeOverride with the credential key', async () => {
      mockRemoveOverride.mockResolvedValue(undefined);

      await removeCredentialProviderOverride('llm_openai');

      expect(mockRemoveOverride).toHaveBeenCalledOnce();
      expect(mockRemoveOverride).toHaveBeenCalledWith('llm_openai');
    });

    it('propagates errors thrown by the repository', async () => {
      mockRemoveOverride.mockRejectedValue(new Error('DB delete failed'));

      await expect(
        removeCredentialProviderOverride('llm_openai'),
      ).rejects.toThrow('DB delete failed');
    });

    it('does not call setOverride when removing an override', async () => {
      mockRemoveOverride.mockResolvedValue(undefined);

      await removeCredentialProviderOverride('llm_openai');

      expect(mockSetOverride).not.toHaveBeenCalled();
    });
  });

  // ── getProviderConfiguration ───────────────────────────────────────────────

  describe('getProviderConfiguration', () => {
    it('returns defaultProvider and overrides from the repository', async () => {
      mockGetDefaultProvider.mockResolvedValue('keychain');
      mockGetAllOverrides.mockResolvedValue({
        llm_openai: 'bitwarden',
        servicenow_password: '1password',
      });

      const config = await getProviderConfiguration();

      expect(config.defaultProvider).toBe('keychain');
      expect(config.overrides).toEqual({
        llm_openai: 'bitwarden',
        servicenow_password: '1password',
      });
    });

    it('returns empty overrides map when no overrides are stored', async () => {
      mockGetDefaultProvider.mockResolvedValue('keychain');
      mockGetAllOverrides.mockResolvedValue({});

      const config = await getProviderConfiguration();

      expect(config.overrides).toEqual({});
    });

    it('calls both getDefaultProvider and getAllOverrides', async () => {
      mockGetDefaultProvider.mockResolvedValue('1password');
      mockGetAllOverrides.mockResolvedValue({ perplexity: 'bitwarden' });

      await getProviderConfiguration();

      expect(mockGetDefaultProvider).toHaveBeenCalledOnce();
      expect(mockGetAllOverrides).toHaveBeenCalledOnce();
    });

    it('propagates errors from getDefaultProvider', async () => {
      mockGetDefaultProvider.mockRejectedValue(new Error('DB read error'));
      mockGetAllOverrides.mockResolvedValue({});

      await expect(getProviderConfiguration()).rejects.toThrow('DB read error');
    });
  });
});
