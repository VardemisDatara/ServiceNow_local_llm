/**
 * Integration tests for provider config persistence via ProviderConfigRepository.
 *
 * Tests:
 * 1. Set default provider to '1password' → read it back → verify '1password'.
 * 2. Set a per-credential override → getAllOverrides() → verify it's included.
 * 3. Remove override → getAllOverrides() → verify it's gone.
 *
 * Uses mocked DB layer following the pattern from tests/unit/repositories/provider-config.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock the database layer ──────────────────────────────────────────────────

const { mockSelect, mockInsert, mockDelete } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('../../src/core/storage/database', () => ({
  getDatabase: vi.fn(async () => ({
    select: mockSelect,
    insert: mockInsert,
    delete: mockDelete,
  })),
}));

vi.mock('../../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { ProviderConfigRepository } from '../../src/core/storage/repositories/provider-config';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Chainable select mock that resolves with `rows` via .limit(). */
function buildSelectChain(rows: Array<{ key: string; value: string }>) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  mockSelect.mockReturnValue(chain);
  return chain;
}

/** Chainable select mock without .limit() (for getAllOverrides). */
function buildSelectChainNoLimit(rows: Array<{ key: string; value: string }>) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
  mockSelect.mockReturnValue(chain);
  return chain;
}

/** Chainable insert mock. */
function buildInsertChain() {
  const chain = {
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
  };
  mockInsert.mockReturnValue(chain);
  return chain;
}

/** Chainable delete mock. */
function buildDeleteChain() {
  const chain = {
    where: vi.fn().mockResolvedValue(undefined),
  };
  mockDelete.mockReturnValue(chain);
  return chain;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProviderConfigRepository — persistence integration', () => {
  let repo: ProviderConfigRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new ProviderConfigRepository();
  });

  // ── Test 1: Set default provider → read back ──────────────────────────────

  describe('default provider round-trip', () => {
    it("set '1password' → getDefaultProvider() returns '1password'", async () => {
      const insertChain = buildInsertChain();

      await repo.setDefaultProvider('1password');

      // Verify the insert was called with the right payload
      expect(insertChain.values).toHaveBeenCalledWith({
        key: 'default_provider',
        value: '1password',
      });
      expect(insertChain.onConflictDoUpdate).toHaveBeenCalledOnce();

      // Now simulate reading it back
      buildSelectChain([{ key: 'default_provider', value: '1password' }]);

      const provider = await repo.getDefaultProvider();
      expect(provider).toBe('1password');
    });

    it("set 'bitwarden' → getDefaultProvider() returns 'bitwarden'", async () => {
      buildInsertChain();
      await repo.setDefaultProvider('bitwarden');

      buildSelectChain([{ key: 'default_provider', value: 'bitwarden' }]);
      const provider = await repo.getDefaultProvider();

      expect(provider).toBe('bitwarden');
    });

    it("returns 'keychain' when default_provider row does not exist", async () => {
      buildSelectChain([]);
      const provider = await repo.getDefaultProvider();
      expect(provider).toBe('keychain');
    });
  });

  // ── Test 2: Set override → getAllOverrides includes it ────────────────────

  describe('per-credential override round-trip', () => {
    it('setOverride → getAllOverrides() includes the override', async () => {
      const insertChain = buildInsertChain();

      await repo.setOverride('llm_openai', 'bitwarden');

      expect(insertChain.values).toHaveBeenCalledWith({
        key: 'override:llm_openai',
        value: 'bitwarden',
      });

      // Simulate reading all overrides
      buildSelectChainNoLimit([{ key: 'override:llm_openai', value: 'bitwarden' }]);

      const overrides = await repo.getAllOverrides();
      expect(overrides).toEqual({ llm_openai: 'bitwarden' });
    });

    it('multiple overrides are all returned by getAllOverrides()', async () => {
      buildInsertChain();
      await repo.setOverride('llm_openai', 'bitwarden');

      buildInsertChain();
      await repo.setOverride('perplexity', '1password');

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
  });

  // ── Test 3: Remove override → not in getAllOverrides ──────────────────────

  describe('removeOverride removes it from getAllOverrides()', () => {
    it('after removeOverride, the key is absent from getAllOverrides()', async () => {
      const deleteChain = buildDeleteChain();

      await repo.removeOverride('llm_openai');

      expect(mockDelete).toHaveBeenCalledOnce();
      expect(deleteChain.where).toHaveBeenCalledOnce();

      // Simulate DB now has no overrides for that key
      buildSelectChainNoLimit([]);

      const overrides = await repo.getAllOverrides();
      expect(overrides).toEqual({});
      expect('llm_openai' in overrides).toBe(false);
    });

    it('removeOverride leaves other overrides intact', async () => {
      buildDeleteChain();
      await repo.removeOverride('llm_openai');

      // Simulate DB still has perplexity override
      buildSelectChainNoLimit([{ key: 'override:perplexity', value: '1password' }]);

      const overrides = await repo.getAllOverrides();
      expect(overrides).toEqual({ perplexity: '1password' });
      expect('llm_openai' in overrides).toBe(false);
    });
  });
});
