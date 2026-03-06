/**
 * Integration tests for security tab incident fetch → filter → display cycle (T010)
 *
 * Tests: fetch incidents with status:'open', filter change to 'closed',
 * error state on tool failure, empty state on empty result.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExecuteMCPTool = vi.fn();

vi.mock('../../src/core/mcp/client', () => ({
  executeMCPTool: mockExecuteMCPTool,
}));

vi.mock('../../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeIncident(n: string, state = 'Open') {
  return { number: n, short_description: `Incident ${n}`, state, priority: '2 - High', severity: '2 - High' };
}

function successResult(incidents: ReturnType<typeof makeIncident>[]) {
  return { tool_name: 'query_incidents', success: true, result: { incidents, table: 'sn_si_incident', total: incidents.length }, error: null, latency_ms: 50 };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Security tab incident fetch integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls executeMCPTool("query_incidents", { state:"open", limit:50 }) on initial load', async () => {
    const { fetchIncidents } = await import('../../src/renderer/components/IncidentListPanel');

    mockExecuteMCPTool.mockResolvedValue(successResult([makeIncident('INC001')]));

    await fetchIncidents({ profileId: 'p1', servicenowUrl: 'https://test.service-now.com', filterStatus: 'open', page: 0 });

    expect(mockExecuteMCPTool).toHaveBeenCalledWith(
      'query_incidents',
      expect.objectContaining({ state: 'open', limit: 50 }),
      'https://test.service-now.com',
      'p1'
    );
  });

  it('calls with state:"closed" after filter change', async () => {
    const { fetchIncidents } = await import('../../src/renderer/components/IncidentListPanel');

    mockExecuteMCPTool.mockResolvedValue(successResult([makeIncident('INC002', 'Closed')]));

    await fetchIncidents({ profileId: 'p1', servicenowUrl: 'https://test.service-now.com', filterStatus: 'closed', page: 0 });

    expect(mockExecuteMCPTool).toHaveBeenCalledWith(
      'query_incidents',
      expect.objectContaining({ state: 'closed', limit: 50 }),
      'https://test.service-now.com',
      'p1'
    );
  });

  it('returns error result when executeMCPTool throws', async () => {
    const { fetchIncidents } = await import('../../src/renderer/components/IncidentListPanel');

    mockExecuteMCPTool.mockRejectedValue(new Error('ServiceNow unreachable'));

    const result = await fetchIncidents({
      profileId: 'p1',
      servicenowUrl: 'https://test.service-now.com',
      filterStatus: 'open',
      page: 0,
    });

    expect(result.error).toBeTruthy();
    expect(result.incidents).toHaveLength(0);
  });

  it('returns empty incidents when result is empty', async () => {
    const { fetchIncidents } = await import('../../src/renderer/components/IncidentListPanel');

    mockExecuteMCPTool.mockResolvedValue(successResult([]));

    const result = await fetchIncidents({
      profileId: 'p1',
      servicenowUrl: 'https://test.service-now.com',
      filterStatus: 'open',
      page: 0,
    });

    expect(result.incidents).toHaveLength(0);
    expect(result.error).toBeNull();
  });
});
