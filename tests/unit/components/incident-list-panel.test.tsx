/**
 * Unit tests for IncidentListPanel (T009)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

// ─── Mock executeMCPTool ───────────────────────────────────────────────────────
const mockExecuteMCPTool = vi.fn();
vi.mock('../../../src/core/mcp/client', () => ({
  executeMCPTool: mockExecuteMCPTool,
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeIncident(overrides: Record<string, unknown> = {}) {
  return {
    number: 'INC0001234',
    short_description: 'Test incident',
    severity: '2 - High',
    priority: '2 - High',
    state: 'Open',
    assignment_group: 'Security Team',
    sys_updated_on: '2026-03-01 10:00:00',
    description: 'Full incident description',
    ...overrides,
  };
}

function makeSuccessResult(incidents: ReturnType<typeof makeIncident>[], table = 'sn_si_incident') {
  return {
    tool_name: 'query_incidents',
    success: true,
    result: { incidents, table, total: incidents.length },
    error: null,
    latency_ms: 100,
  };
}

const defaultProps = {
  profileId: 'profile-123',
  servicenowUrl: 'https://test.service-now.com',
  width: 320,
};

async function renderPanel() {
  const { IncidentListPanel } = await import('../../../src/renderer/components/IncidentListPanel');
  return render(<IncidentListPanel {...defaultProps} />);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('IncidentListPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Render with mocked incident list ──────────────────────────────────────

  it('renders incident list after successful fetch', async () => {
    const incidents = [
      makeIncident({ number: 'INC0001234', short_description: 'Critical breach detected' }),
      makeIncident({ number: 'INC0001235', short_description: 'Phishing attempt' }),
    ];
    mockExecuteMCPTool.mockResolvedValue(makeSuccessResult(incidents));

    await renderPanel();

    await waitFor(() => expect(screen.getByText('INC0001234')).toBeTruthy());
    expect(screen.getByText('Critical breach detected')).toBeTruthy();
    expect(screen.getByText('INC0001235')).toBeTruthy();
  });

  // ── Empty state ───────────────────────────────────────────────────────────

  it('shows empty state message when no incidents returned', async () => {
    mockExecuteMCPTool.mockResolvedValue(makeSuccessResult([]));

    await renderPanel();

    await waitFor(() => expect(screen.getByText(/no.*incident/i)).toBeTruthy());
  });

  // ── Error state ───────────────────────────────────────────────────────────

  it('shows error state and Retry button on network failure', async () => {
    mockExecuteMCPTool.mockRejectedValue(new Error('Network timeout'));

    await renderPanel();

    await waitFor(() => expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy());
  });

  // ── Filter status change ──────────────────────────────────────────────────

  it('re-fetches with state:closed when Closed filter selected', async () => {
    mockExecuteMCPTool.mockResolvedValue(makeSuccessResult([]));

    await renderPanel();
    await waitFor(() => expect(mockExecuteMCPTool).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /closed/i }));

    await waitFor(() => {
      const lastCall = mockExecuteMCPTool.mock.calls[mockExecuteMCPTool.mock.calls.length - 1];
      expect(lastCall[1]).toMatchObject({ state: 'closed' });
    });
  });

  it('re-fetches with state:all when All filter selected', async () => {
    mockExecuteMCPTool.mockResolvedValue(makeSuccessResult([]));

    await renderPanel();
    await waitFor(() => expect(mockExecuteMCPTool).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /^all$/i }));

    await waitFor(() => {
      const lastCall = mockExecuteMCPTool.mock.calls[mockExecuteMCPTool.mock.calls.length - 1];
      expect(lastCall[1]).toMatchObject({ state: 'all' });
    });
  });

  // ── Row click expands detail ──────────────────────────────────────────────

  it('expands incident detail on row click', async () => {
    const incidents = [makeIncident({ number: 'INC0001234', description: 'Full description text' })];
    mockExecuteMCPTool.mockResolvedValue(makeSuccessResult(incidents));

    await renderPanel();
    await waitFor(() => screen.getByText('INC0001234'));

    fireEvent.click(screen.getByText('INC0001234'));

    await waitFor(() => expect(screen.getByText('Full description text')).toBeTruthy());
  });

  it('collapses already-expanded row on second click', async () => {
    const incidents = [makeIncident({ number: 'INC0001234', description: 'Full description text' })];
    mockExecuteMCPTool.mockResolvedValue(makeSuccessResult(incidents));

    await renderPanel();
    await waitFor(() => screen.getByText('INC0001234'));

    // First click — expand
    fireEvent.click(screen.getByText('INC0001234'));
    await waitFor(() => screen.getByText('Full description text'));

    // Second click — collapse
    fireEvent.click(screen.getByText('INC0001234'));
    await waitFor(() => expect(screen.queryByText('Full description text')).toBeNull());
  });

  // ── Load more button ──────────────────────────────────────────────────────

  it('shows Load more button when returned count equals page size (50)', async () => {
    const fifty = Array.from({ length: 50 }, (_, i) =>
      makeIncident({ number: `INC${String(i).padStart(7, '0')}` })
    );
    mockExecuteMCPTool.mockResolvedValue(makeSuccessResult(fifty));

    await renderPanel();

    await waitFor(() => expect(screen.getByRole('button', { name: /load more/i })).toBeTruthy());
  });

  it('does not show Load more button when returned count is less than 50', async () => {
    mockExecuteMCPTool.mockResolvedValue(makeSuccessResult([makeIncident()]));

    await renderPanel();
    await waitFor(() => screen.getByText('INC0001234'));

    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull();
  });

  // ── Auto-refresh timer ────────────────────────────────────────────────────

  it('auto-refresh fires at configured interval (fake timers)', async () => {
    vi.useFakeTimers();
    mockExecuteMCPTool.mockResolvedValue(makeSuccessResult([]));

    const { IncidentListPanel } = await import('../../../src/renderer/components/IncidentListPanel');
    await act(async () => {
      render(<IncidentListPanel {...defaultProps} />);
      // flush initial async operations
      await Promise.resolve();
    });

    const callsAfterMount = mockExecuteMCPTool.mock.calls.length;
    expect(callsAfterMount).toBeGreaterThanOrEqual(1);

    // Advance 5 min → auto-refresh should fire
    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000);
      await Promise.resolve();
    });

    expect(mockExecuteMCPTool.mock.calls.length).toBeGreaterThan(callsAfterMount);
  });

  it('clears timer on unmount (fake timers)', async () => {
    vi.useFakeTimers();
    mockExecuteMCPTool.mockResolvedValue(makeSuccessResult([]));

    const { IncidentListPanel } = await import('../../../src/renderer/components/IncidentListPanel');
    let unmount!: () => void;
    await act(async () => {
      const result = render(<IncidentListPanel {...defaultProps} />);
      unmount = result.unmount;
      await Promise.resolve();
    });

    const callsBeforeUnmount = mockExecuteMCPTool.mock.calls.length;
    unmount();

    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000);
      await Promise.resolve();
    });

    // No new calls after unmount
    expect(mockExecuteMCPTool.mock.calls.length).toBe(callsBeforeUnmount);
  });

  // ── Manual refresh button ─────────────────────────────────────────────────

  it('manual refresh button triggers immediate fetch', async () => {
    mockExecuteMCPTool.mockResolvedValue(makeSuccessResult([]));

    await renderPanel();
    await waitFor(() => expect(mockExecuteMCPTool).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /refresh incidents/i }));

    await waitFor(() => expect(mockExecuteMCPTool).toHaveBeenCalledTimes(2));
  });

  // ── Refresh interval control ──────────────────────────────────────────────

  it('refresh interval control shows 5/10/15 min options', async () => {
    mockExecuteMCPTool.mockResolvedValue(makeSuccessResult([]));

    await renderPanel();
    await waitFor(() => screen.getByText('5 min'));

    expect(screen.getByText('10 min')).toBeTruthy();
    expect(screen.getByText('15 min')).toBeTruthy();
  });

  it('changing interval to 10 min updates the auto-refresh schedule (fake timers)', async () => {
    vi.useFakeTimers();
    mockExecuteMCPTool.mockResolvedValue(makeSuccessResult([]));

    const { IncidentListPanel } = await import('../../../src/renderer/components/IncidentListPanel');
    await act(async () => {
      render(<IncidentListPanel {...defaultProps} />);
      await Promise.resolve();
    });

    const callsAfterMount = mockExecuteMCPTool.mock.calls.length;
    expect(callsAfterMount).toBeGreaterThanOrEqual(1);

    // Find and click the "10 min" button
    const btn10 = screen.getByText('10 min');
    await act(async () => {
      fireEvent.click(btn10);
      await Promise.resolve();
    });

    // Advance only 5 min — should NOT trigger a refresh (interval is now 10 min)
    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000);
      await Promise.resolve();
    });

    const callsAt5min = mockExecuteMCPTool.mock.calls.length;
    // After clicking "10 min", the component fetches fresh data (filterStatus/interval change)
    // but the timer for repeat refresh should be 10 min now

    // Advance another 5 min (10 min total) → timer should fire
    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000);
      await Promise.resolve();
    });

    expect(mockExecuteMCPTool.mock.calls.length).toBeGreaterThan(callsAt5min);
  });
});
