/**
 * Unit tests for ConversationMessageRepository.getNextSequenceNumber
 *
 * NOTE: getNextSequenceNumber has a TOCTOU race condition (Issue #3 from security review).
 * These tests verify single-threaded behavior. Fix the race by wrapping in a transaction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock the database layer ──────────────────────────────────────────────────
// getDatabase() returns a drizzle-orm/sqlite-proxy DB object. We mock it so the
// repository can be exercised without a real SQLite file.

const { mockSelect } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
}));

vi.mock('../../src/core/storage/database', () => ({
  getDatabase: vi.fn(async () => ({
    select: mockSelect,
    insert: vi.fn(),
    delete: vi.fn(),
  })),
}));

vi.mock('../../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

// ─── Import after mocks ───────────────────────────────────────────────────────
import { ConversationMessageRepository } from '../../src/core/storage/repositories/message';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a chainable drizzle-style select mock that ultimately resolves with
 * `rows`. The chain is: select({ maxSeq }) → from() → where() → resolves with rows.
 */
function buildSelectChain(rows: Array<{ maxSeq: number | null }>) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
  mockSelect.mockReturnValue(chain);
  return chain;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ConversationMessageRepository — getNextSequenceNumber', () => {
  let repo: ConversationMessageRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new ConversationMessageRepository();
  });

  it('returns 1 when no messages exist yet (maxSeq is null)', async () => {
    // The DB returns null for MAX() on an empty table.
    buildSelectChain([{ maxSeq: null }]);

    const seq = await repo.getNextSequenceNumber('session-empty');

    expect(seq).toBe(1);
  });

  it('returns maxSeq + 1 when messages already exist', async () => {
    buildSelectChain([{ maxSeq: 5 }]);

    const seq = await repo.getNextSequenceNumber('session-existing');

    expect(seq).toBe(6);
  });

  it('returns incrementing values on two sequential calls (single-threaded)', async () => {
    // First call: last sequence is 3 → expect 4
    buildSelectChain([{ maxSeq: 3 }]);
    const first = await repo.getNextSequenceNumber('session-seq');

    // Second call: simulate that a message was written (last sequence is now 4)
    buildSelectChain([{ maxSeq: 4 }]);
    const second = await repo.getNextSequenceNumber('session-seq');

    expect(first).toBe(4);
    expect(second).toBe(5);
    expect(second).toBeGreaterThan(first);
  });

  it('returns 1 when DB returns undefined result row', async () => {
    // Edge case: result array is empty (unexpected but defensive)
    buildSelectChain([]);

    const seq = await repo.getNextSequenceNumber('session-undefined');

    expect(seq).toBe(1);
  });
});
