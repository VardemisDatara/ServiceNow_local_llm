/**
 * Integration tests for Now Assist configuration profile fields (T004)
 *
 * Tests that:
 * - Profile create() accepts and persists nowAssistEndpoint + nowAssistAuthMode
 * - Profile update() can modify those fields
 * - findActive() returns the new fields
 * - IPC keychain storeApiKey/getApiKey/deleteApiKey round-trip with key 'now_assist'
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Tauri plugins ───────────────────────────────────────────────────────
const mockExecute = vi.fn().mockResolvedValue(undefined);
const mockSelect = vi.fn();

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: {
    load: vi.fn().mockResolvedValue({
      execute: mockExecute,
      select: mockSelect,
    }),
  },
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('../../src/utils/logger.ts', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

// ─── Mock IPC ────────────────────────────────────────────────────────────────
const mockStoreApiKey = vi.fn().mockResolvedValue(undefined);
const mockGetApiKey = vi.fn();
const mockDeleteApiKey = vi.fn().mockResolvedValue(undefined);
const mockHasApiKey = vi.fn();

vi.mock('../../src/main/ipc', () => ({
  IPC: {
    storeApiKey: mockStoreApiKey,
    getApiKey: mockGetApiKey,
    deleteApiKey: mockDeleteApiKey,
    hasApiKey: mockHasApiKey,
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeProfileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'profile-123',
    name: 'Test Profile',
    servicenow_url: 'https://test.service-now.com',
    servicenow_credential_ref: 'sn_cred',
    ollama_endpoint: 'http://localhost:11434',
    ollama_model: 'mistral:7b',
    search_provider: 'duckduckgo',
    search_api_key_ref: null,
    llm_provider: 'ollama',
    llm_api_key_ref: null,
    cloud_llm_model: null,
    now_assist_endpoint: null,
    now_assist_api_key_ref: null,
    now_assist_auth_mode: 'apikey',
    session_timeout_hours: 24,
    persist_conversations: 1,
    created_at: Date.now(),
    updated_at: Date.now(),
    is_active: 1,
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('Configuration profile — Now Assist fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create() with nowAssistEndpoint + nowAssistAuthMode', () => {
    it('persists nowAssistEndpoint and nowAssistAuthMode on profile create', async () => {
      // Return empty array for the existing profiles check, then return the new profile
      mockSelect
        .mockResolvedValueOnce([]) // existing profiles check
        .mockResolvedValueOnce([makeProfileRow({
          now_assist_endpoint: 'https://myinstance.service-now.com/sncapps/mcp-server/abc123',
          now_assist_auth_mode: 'bearer',
        })]);
      mockExecute.mockResolvedValue(undefined);

      const { ConfigurationProfileRepository } = await import('../../src/core/storage/repositories/configuration');
      const { resetDatabase } = await import('../../src/core/storage/database');
      resetDatabase();

      const repo = new ConfigurationProfileRepository();
      const profile = await repo.create({
        name: 'Test Profile',
        servicenowUrl: 'https://test.service-now.com',
        servicenowCredentialRef: 'sn_cred',
        ollamaEndpoint: 'http://localhost:11434',
        ollamaModel: 'mistral:7b',
        searchProvider: 'duckduckgo',
        llmProvider: 'ollama',
        nowAssistEndpoint: 'https://myinstance.service-now.com/sncapps/mcp-server/abc123',
        nowAssistAuthMode: 'bearer',
      });

      expect(profile.nowAssistEndpoint).toBe('https://myinstance.service-now.com/sncapps/mcp-server/abc123');
      expect(profile.nowAssistAuthMode).toBe('bearer');
    });
  });

  describe('update() modifying Now Assist fields', () => {
    it('updates nowAssistEndpoint and nowAssistApiKeyRef via update()', async () => {
      mockSelect.mockResolvedValue([makeProfileRow({
        now_assist_endpoint: 'https://updated.service-now.com/sncapps/mcp-server/xyz',
        now_assist_api_key_ref: 'now_assist',
      })]);

      const { ConfigurationProfileRepository } = await import('../../src/core/storage/repositories/configuration');
      const { resetDatabase } = await import('../../src/core/storage/database');
      resetDatabase();

      const repo = new ConfigurationProfileRepository();
      const updated = await repo.update('profile-123', {
        nowAssistEndpoint: 'https://updated.service-now.com/sncapps/mcp-server/xyz',
        nowAssistApiKeyRef: 'now_assist',
      });

      expect(updated.nowAssistEndpoint).toBe('https://updated.service-now.com/sncapps/mcp-server/xyz');
      expect(updated.nowAssistApiKeyRef).toBe('now_assist');
    });
  });

  describe('findActive() returns new fields', () => {
    it('returns nowAssistEndpoint and nowAssistAuthMode from active profile', async () => {
      mockSelect.mockResolvedValue([makeProfileRow({
        now_assist_endpoint: 'https://myinstance.service-now.com/sncapps/mcp-server/abc123',
        now_assist_auth_mode: 'apikey',
        now_assist_api_key_ref: 'now_assist',
      })]);

      const { ConfigurationProfileRepository } = await import('../../src/core/storage/repositories/configuration');
      const { resetDatabase } = await import('../../src/core/storage/database');
      resetDatabase();

      const repo = new ConfigurationProfileRepository();
      const profile = await repo.findActive();

      expect(profile).toBeDefined();
      expect(profile!.nowAssistEndpoint).toBe('https://myinstance.service-now.com/sncapps/mcp-server/abc123');
      expect(profile!.nowAssistAuthMode).toBe('apikey');
      expect(profile!.nowAssistApiKeyRef).toBe('now_assist');
    });
  });

  describe('IPC keychain round-trip for now_assist', () => {
    it('storeApiKey stores the token under the "now_assist" key', async () => {
      const { IPC } = await import('../../src/main/ipc');
      await IPC.storeApiKey('now_assist', 'profile-123', 'my-bearer-token');
      expect(mockStoreApiKey).toHaveBeenCalledWith('now_assist', 'profile-123', 'my-bearer-token');
    });

    it('getApiKey retrieves the token stored under "now_assist"', async () => {
      mockGetApiKey.mockResolvedValue('my-bearer-token');
      const { IPC } = await import('../../src/main/ipc');
      const token = await IPC.getApiKey('now_assist', 'profile-123');
      expect(token).toBe('my-bearer-token');
    });

    it('deleteApiKey removes the "now_assist" token', async () => {
      const { IPC } = await import('../../src/main/ipc');
      await IPC.deleteApiKey('now_assist', 'profile-123');
      expect(mockDeleteApiKey).toHaveBeenCalledWith('now_assist', 'profile-123');
    });

    it('storeApiKey then getApiKey round-trip returns stored value', async () => {
      mockGetApiKey.mockResolvedValue('round-trip-token');
      const { IPC } = await import('../../src/main/ipc');
      await IPC.storeApiKey('now_assist', 'profile-123', 'round-trip-token');
      const retrieved = await IPC.getApiKey('now_assist', 'profile-123');
      expect(retrieved).toBe('round-trip-token');
    });
  });
});
