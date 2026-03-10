/**
 * Unit tests for ProviderConfigRepository
 *
 * Tests:
 * 1. getDefaultProvider() returns 'keychain' when no row exists in the DB
 * 2. setDefaultProvider('1password') performs an upsert (insert or replace)
 * 3. getOverride('llm_openai') returns undefined when no override exists
 * 4. setOverride('llm_openai', 'bitwarden') writes key 'override:llm_openai'
 *
 * Follows the pattern from tests/unit/sequence-number.test.ts for mocking the DB.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock the database layer ──────────────────────────────────────────────────
// getDatabase() returns a drizzle-orm/sqlite-proxy DB object. We mock it so
// the repository can be exercised without a real SQLite file.

const { mockSelect, mockInsert, mockDelete } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('../../../src/core/storage/database', () => ({
  getDatabase: vi.fn(async () => ({
    select: mockSelect,
    insert: mockInsert,
    delete: mockDelete,
  })),
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { ProviderConfigRepository } from '../../../src/core/storage/repositories/provider-config';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a chainable drizzle-style select mock that resolves with `rows`.
 * Chain: select() → from() → where() → limit() → resolves with rows
 */
function buildSelectChain(rows: Array<{ key: string; value: string }>) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  mockSelect.mockReturnValue(chain);
  return chain;
}

/**
 * Build a chainable drizzle-style select mock for queries without .limit().
 * Chain: select() → from() → where() → resolves with rows
 */
function buildSelectChainNoLimit(rows: Array<{ key: string; value: string }>) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
  mockSelect.mockReturnValue(chain);
  return chain;
}

/**
 * Build a chainable drizzle-style insert mock.
 * Chain: insert() → values() → onConflictDoUpdate() → resolves
 */
function buildInsertChain() {
  const chain = {
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
  };
  mockInsert.mockReturnValue(chain);
  return chain;
}

/**
 * Build a chainable drizzle-style delete mock.
 * Chain: delete() → where() → resolves
 */
function buildDeleteChain() {
  const chain = {
    where: vi.fn().mockResolvedValue(undefined),
  };
  mockDelete.mockReturnValue(chain);
  return chain;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProviderConfigRepository', () => {
  let repo: ProviderConfigRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new ProviderConfigRepository();
  });

  // ── getDefaultProvider ─────────────────────────────────────────────────────

  describe('getDefaultProvider', () => {
    it("returns 'keychain' when no row exists in the DB", async () => {
      // Empty result → no row stored → fall back to default
      buildSelectChain([]);

      const provider = await repo.getDefaultProvider();

      expect(provider).toBe('keychain');
    });

    it("returns the stored provider id when a row exists", async () => {
      buildSelectChain([{ key: 'default_provider', value: '1password' }]);

      const provider = await repo.getDefaultProvider();

      expect(provider).toBe('1password');
    });

    it("returns 'keychain' when the stored value is not a valid ProviderId", async () => {
      buildSelectChain([{ key: 'default_provider', value: 'unknown_vault' }]);

      const provider = await repo.getDefaultProvider();

      expect(provider).toBe('keychain');
    });

    it('queries the DB with key = default_provider', async () => {
      const chain = buildSelectChain([]);

      await repo.getDefaultProvider();

      expect(chain.from).toHaveBeenCalledOnce();
      expect(chain.where).toHaveBeenCalledOnce();
      expect(chain.limit).toHaveBeenCalledWith(1);
    });
  });

  // ── setDefaultProvider ─────────────────────────────────────────────────────

  describe('setDefaultProvider', () => {
    it("performs an upsert when setting provider to '1password'", async () => {
      const chain = buildInsertChain();

      await repo.setDefaultProvider('1password');

      expect(mockInsert).toHaveBeenCalledOnce();
      expect(chain.values).toHaveBeenCalledWith({
        key: 'default_provider',
        value: '1password',
      });
      expect(chain.onConflictDoUpdate).toHaveBeenCalledOnce();
    });

    it("sets value to 'bitwarden' in the upsert payload", async () => {
      const chain = buildInsertChain();

      await repo.setDefaultProvider('bitwarden');

      expect(chain.values).toHaveBeenCalledWith({
        key: 'default_provider',
        value: 'bitwarden',
      });
    });

    it("sets value to 'keychain' in the upsert payload", async () => {
      const chain = buildInsertChain();

      await repo.setDefaultProvider('keychain');

      expect(chain.values).toHaveBeenCalledWith({
        key: 'default_provider',
        value: 'keychain',
      });
    });

    it('uses onConflictDoUpdate to update the value when the key already exists', async () => {
      const chain = buildInsertChain();

      await repo.setDefaultProvider('1password');

      const conflictCall = chain.onConflictDoUpdate.mock.calls[0]?.[0] as {
        set?: { value?: string };
      } | undefined;
      expect(conflictCall?.set?.value).toBe('1password');
    });
  });

  // ── getOverride ────────────────────────────────────────────────────────────

  describe('getOverride', () => {
    it("returns undefined when no override exists for 'llm_openai'", async () => {
      buildSelectChain([]);

      const override = await repo.getOverride('llm_openai');

      expect(override).toBeUndefined();
    });

    it("returns the stored ProviderId when an override exists", async () => {
      buildSelectChain([{ key: 'override:llm_openai', value: 'bitwarden' }]);

      const override = await repo.getOverride('llm_openai');

      expect(override).toBe('bitwarden');
    });

    it("returns undefined when the stored override value is not a valid ProviderId", async () => {
      buildSelectChain([{ key: 'override:llm_openai', value: 'not_a_valid_provider' }]);

      const override = await repo.getOverride('llm_openai');

      expect(override).toBeUndefined();
    });
  });

  // ── setOverride ────────────────────────────────────────────────────────────

  describe('setOverride', () => {
    it("writes key 'override:llm_openai' when setting override for 'llm_openai'", async () => {
      const chain = buildInsertChain();

      await repo.setOverride('llm_openai', 'bitwarden');

      expect(chain.values).toHaveBeenCalledWith({
        key: 'override:llm_openai',
        value: 'bitwarden',
      });
    });

    it("writes key 'override:servicenow_password' for that credential key", async () => {
      const chain = buildInsertChain();

      await repo.setOverride('servicenow_password', '1password');

      expect(chain.values).toHaveBeenCalledWith({
        key: 'override:servicenow_password',
        value: '1password',
      });
    });

    it('uses onConflictDoUpdate so existing overrides are replaced', async () => {
      const chain = buildInsertChain();

      await repo.setOverride('llm_openai', 'bitwarden');

      expect(chain.onConflictDoUpdate).toHaveBeenCalledOnce();
    });
  });

  // ── removeOverride ─────────────────────────────────────────────────────────

  describe('removeOverride', () => {
    it("deletes the row with key 'override:llm_openai'", async () => {
      const chain = buildDeleteChain();

      await repo.removeOverride('llm_openai');

      expect(mockDelete).toHaveBeenCalledOnce();
      expect(chain.where).toHaveBeenCalledOnce();
    });
  });

  // ── getAllOverrides ─────────────────────────────────────────────────────────

  describe('getAllOverrides', () => {
    it('returns empty object when no overrides exist', async () => {
      buildSelectChainNoLimit([]);

      const overrides = await repo.getAllOverrides();

      expect(overrides).toEqual({});
    });

    it('maps stored override rows to a Record<string, ProviderId>', async () => {
      buildSelectChainNoLimit([
        { key: 'override:llm_openai', value: 'bitwarden' },
        { key: 'override:perplexity', value: '1password' },
      ]);

      const overrides = await repo.getAllOverrides();

      expect(overrides).toEqual({
        llm_openai: 'bitwarden',
        perplexity: '1password',
      });
    });

    it('skips rows with invalid provider ids', async () => {
      buildSelectChainNoLimit([
        { key: 'override:llm_openai', value: 'bitwarden' },
        { key: 'override:unknown_key', value: 'not_a_provider' },
      ]);

      const overrides = await repo.getAllOverrides();

      expect(overrides).toEqual({ llm_openai: 'bitwarden' });
    });
  });
});
