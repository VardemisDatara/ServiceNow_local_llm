/**
 * Unit tests for chat service Now Assist extensions (T017)
 *
 * Tests:
 *  - detectToolCallsFromMessage() returns Now Assist tool when store has matching tools
 *    and message has relevant keywords
 *  - detectToolCallsFromMessage() returns empty when nowAssistConnected === false
 *  - formatToolResult() formats Now Assist result content for chat injection
 *  - Graceful degradation: when disconnected, no Now Assist calls in detected output
 *
 * THESE TESTS FAIL until T021 and T023 export detectToolCallsFromMessage/formatToolResult
 * from chat.ts and extend them for Now Assist.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock the Zustand store ────────────────────────────────────────────────────
// Use vi.hoisted so mockGetState is available in the vi.mock factory (which is
// hoisted before variable declarations in the module).
const { mockGetState } = vi.hoisted(() => ({
  mockGetState: vi.fn(() => ({
    nowAssistConnected: false,
    nowAssistTools: [] as Array<{ name: string; description: string; inputSchema: object }>,
  })),
}));

vi.mock('../../../src/renderer/store/index', () => ({
  useAppStore: { getState: mockGetState },
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

// ─── Import after mocks ────────────────────────────────────────────────────────
// These named exports will be undefined until T021/T023 add them → tests fail
// as TDD requires. Vite/esbuild transpiles without type-checking; runtime
// undefined calls throw "detectToolCallsFromMessage is not a function".
import * as chatModule from '../../../src/core/services/chat';

type ToolCall = { name: string; provider?: string; arguments: Record<string, unknown> };

const detectToolCallsFromMessage = (chatModule as Record<string, unknown>)[
  'detectToolCallsFromMessage'
] as ((content: string) => ToolCall[]) | undefined;

const formatToolResult = (chatModule as Record<string, unknown>)[
  'formatToolResult'
] as
  | ((
      toolName: string,
      result: Record<string, unknown>,
      args?: Record<string, unknown>,
    ) => string)
  | undefined;

// ─── Helpers ───────────────────────────────────────────────────────────────────

const kbTool = {
  name: 'sn_get_kb_article',
  description: 'Retrieve ServiceNow knowledge base articles by keyword or category',
  inputSchema: {
    type: 'object' as const,
    properties: { query: { type: 'string', description: 'Search query' } },
    required: ['query'],
  },
};

const changeTool = {
  name: 'sn_create_change_request',
  description: 'Create a new change request in ServiceNow',
  inputSchema: {
    type: 'object' as const,
    properties: {
      short_description: { type: 'string' },
      category: { type: 'string' },
    },
    required: ['short_description'],
  },
};

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('chat service — Now Assist extensions (T017)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── detectToolCallsFromMessage — Now Assist detection ────────────────────

  describe('detectToolCallsFromMessage() — Now Assist detection', () => {
    it('returns a Now Assist tool call when connected and message matches tool description', () => {
      if (!detectToolCallsFromMessage) throw new Error('detectToolCallsFromMessage not exported yet (T021)');

      mockGetState.mockReturnValue({ nowAssistConnected: true, nowAssistTools: [kbTool] });

      const result = detectToolCallsFromMessage('show me knowledge base articles about password reset');

      const naCalls = result.filter((c) => c.provider === 'now_assist');
      expect(naCalls).toHaveLength(1);
      expect(naCalls[0].name).toBe('sn_get_kb_article');
      expect(naCalls[0].arguments).toMatchObject({ input: expect.any(String) });
    });

    it('returns empty Now Assist calls when nowAssistConnected is false', () => {
      if (!detectToolCallsFromMessage) throw new Error('detectToolCallsFromMessage not exported yet (T021)');

      mockGetState.mockReturnValue({ nowAssistConnected: false, nowAssistTools: [kbTool] });

      const result = detectToolCallsFromMessage('show me knowledge base articles about password reset');

      const naCalls = result.filter((c) => c.provider === 'now_assist');
      expect(naCalls).toHaveLength(0);
    });

    it('returns empty Now Assist calls when nowAssistTools list is empty', () => {
      if (!detectToolCallsFromMessage) throw new Error('detectToolCallsFromMessage not exported yet (T021)');

      mockGetState.mockReturnValue({ nowAssistConnected: true, nowAssistTools: [] });

      const result = detectToolCallsFromMessage('show me knowledge base articles about password reset');

      const naCalls = result.filter((c) => c.provider === 'now_assist');
      expect(naCalls).toHaveLength(0);
    });

    it('does not match Now Assist tool when message has no relevant keywords', () => {
      if (!detectToolCallsFromMessage) throw new Error('detectToolCallsFromMessage not exported yet (T021)');

      mockGetState.mockReturnValue({ nowAssistConnected: true, nowAssistTools: [kbTool] });

      // Message has no keywords related to KB articles
      const result = detectToolCallsFromMessage('What is the capital of France?');

      const naCalls = result.filter((c) => c.provider === 'now_assist');
      expect(naCalls).toHaveLength(0);
    });

    it('can match multiple Now Assist tools when message is broad', () => {
      if (!detectToolCallsFromMessage) throw new Error('detectToolCallsFromMessage not exported yet (T021)');

      mockGetState.mockReturnValue({
        nowAssistConnected: true,
        nowAssistTools: [kbTool, changeTool],
      });

      // Message that could match both KB and change request tools
      const result = detectToolCallsFromMessage(
        'search the knowledge base for articles and create a change request',
      );

      const naCalls = result.filter((c) => c.provider === 'now_assist');
      // At least one tool matched
      expect(naCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('still returns regular ServiceNow tool calls regardless of Now Assist state', () => {
      if (!detectToolCallsFromMessage) throw new Error('detectToolCallsFromMessage not exported yet (T021)');

      mockGetState.mockReturnValue({ nowAssistConnected: false, nowAssistTools: [] });

      // CVE triggers assess_vulnerability regardless of Now Assist state
      const result = detectToolCallsFromMessage('Tell me about CVE-2024-1234');

      expect(result.some((c) => c.name === 'assess_vulnerability')).toBe(true);
    });
  });

  // ── formatToolResult — now_assist provider ────────────────────────────────

  describe('formatToolResult() — now_assist provider', () => {
    it('returns the content string when provider is now_assist', () => {
      if (!formatToolResult) throw new Error('formatToolResult not exported yet (T023)');

      const content = 'KB Article: Password Reset Procedure\n1. Go to self-service portal\n2. Click Reset Password';
      const result = formatToolResult('sn_get_kb_article', { content, provider: 'now_assist' });

      expect(typeof result).toBe('string');
      expect(result).toContain('Password Reset Procedure');
    });

    it('returns the exact content for a now_assist result without extra wrapping', () => {
      if (!formatToolResult) throw new Error('formatToolResult not exported yet (T023)');

      const content = 'Change request CHG0012345 has been created successfully.';
      const result = formatToolResult('sn_create_change_request', { content, provider: 'now_assist' });

      expect(result).toBe(content);
    });

    it('handles empty content gracefully for now_assist provider', () => {
      if (!formatToolResult) throw new Error('formatToolResult not exported yet (T023)');

      expect(() => {
        formatToolResult('sn_get_kb_article', { content: '', provider: 'now_assist' });
      }).not.toThrow();
    });

    it('does not affect existing ServiceNow tool formatting when provider is not now_assist', () => {
      if (!formatToolResult) throw new Error('formatToolResult not exported yet (T023)');

      const result = formatToolResult('query_incidents', {
        incidents: [
          { number: 'INC001', short_description: 'Test', state: 'Open', priority: '1' },
        ],
        table: 'sn_si_incident',
      });

      expect(result).toContain('INC001');
    });
  });

  // ── Graceful degradation ──────────────────────────────────────────────────

  describe('graceful degradation — Now Assist unavailable', () => {
    it('detectToolCallsFromMessage does not include now_assist calls when disconnected', () => {
      if (!detectToolCallsFromMessage) throw new Error('detectToolCallsFromMessage not exported yet (T021)');

      mockGetState.mockReturnValue({ nowAssistConnected: false, nowAssistTools: [kbTool] });

      const calls = detectToolCallsFromMessage('search knowledge base for articles about networking');
      const nowAssistCalls = calls.filter((c) => c.provider === 'now_assist');

      expect(nowAssistCalls).toHaveLength(0);
    });

    it('detectToolCallsFromMessage does not include now_assist calls when tools empty even if connected', () => {
      if (!detectToolCallsFromMessage) throw new Error('detectToolCallsFromMessage not exported yet (T021)');

      mockGetState.mockReturnValue({ nowAssistConnected: true, nowAssistTools: [] });

      const calls = detectToolCallsFromMessage('search knowledge base for articles');
      const nowAssistCalls = calls.filter((c) => c.provider === 'now_assist');

      expect(nowAssistCalls).toHaveLength(0);
    });
  });
});
