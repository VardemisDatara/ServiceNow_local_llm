/**
 * IncidentListPanel (T011-T015)
 *
 * Left panel of the Security tab. Fetches ServiceNow security incidents via
 * executeMCPTool('query_incidents', ...), renders a scrollable list with:
 *  - Status filter toggle (Open / Closed / All)
 *  - Severity dropdown filter
 *  - Row click → inline expanded detail
 *  - Load More pagination (page size 50)
 *  - Auto-refresh (5/10/15 min, default 5, configurable)
 *  - Manual refresh button
 *  - "Last refreshed" timestamp
 *
 * Exported fetchIncidents() helper for integration tests (T010).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { executeMCPTool } from '../../core/mcp/client';
import { logger } from '../../utils/logger';
import { SN_THEME } from '../theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IncidentSummary {
  number: string;
  shortDescription: string;
  severity: string;
  priority: string;
  state: string;
  assignmentGroup: string;
  lastUpdated: string;
  description?: string;
}

export type FilterStatus = 'open' | 'closed' | 'all';
export type RefreshIntervalOption = 5 | 10 | 15;

export interface IncidentListPanelProps {
  profileId: string;
  servicenowUrl: string;
  width: number;
  onAnalyze?: (incident: IncidentSummary) => void;
}

export interface FetchIncidentsParams {
  profileId: string;
  servicenowUrl: string;
  filterStatus: FilterStatus;
  page: number;
}

export interface FetchIncidentsResult {
  incidents: IncidentSummary[];
  hasMore: boolean;
  error: string | null;
}

// ─── fetchIncidents helper (exported for integration tests) ───────────────────
// eslint-disable-next-line react-refresh/only-export-components
export async function fetchIncidents(params: FetchIncidentsParams): Promise<FetchIncidentsResult> {
  const PAGE_SIZE = 50;
  try {
    const result = await executeMCPTool(
      'query_incidents',
      { state: params.filterStatus, limit: PAGE_SIZE, offset: params.page * PAGE_SIZE },
      params.servicenowUrl,
      params.profileId,
    );

    if (!result.success || !result.result) {
      return { incidents: [], hasMore: false, error: result.error ?? 'Unknown error' };
    }

    const raw = result.result as { incidents?: Array<Record<string, unknown>>; table?: string };
    const rawList = raw.incidents ?? [];

    // TypeScript-side filter as the guaranteed final gate
    const filtered: Array<Record<string, unknown>> =
      params.filterStatus === 'all'
        ? rawList
        : rawList.filter((inc) => {
            const stateLabel = String(inc['state'] ?? '').toLowerCase();
            return params.filterStatus === 'open'
              ? !stateLabel.includes('closed')
              : stateLabel.includes('closed');
          });

    const incidents: IncidentSummary[] = filtered.map((inc) => ({
      number: String(inc['number'] ?? ''),
      shortDescription: String(inc['short_description'] ?? 'No description'),
      severity: String(inc['severity'] ?? 'N/A'),
      priority: String(inc['priority'] ?? 'N/A'),
      state: String(inc['state'] ?? 'Unknown'),
      assignmentGroup: String(inc['assignment_group'] ?? 'Unassigned'),
      lastUpdated: String(inc['sys_updated_on'] ?? ''),
      ...(inc['description'] != null ? { description: String(inc['description']) } : {}),
    }));

    return { incidents, hasMore: filtered.length >= PAGE_SIZE, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn('IncidentListPanel: fetch failed', {}, err instanceof Error ? err : new Error(msg));
    return { incidents: [], hasMore: false, error: msg };
  }
}

// ─── Severity badge colors ────────────────────────────────────────────────────

function severityColor(severity: string): string {
  const s = severity.toLowerCase();
  if (s.includes('1') || s.includes('critical')) return '#dc2626';
  if (s.includes('2') || s.includes('high')) return '#ea580c';
  if (s.includes('3') || s.includes('medium')) return '#ca8a04';
  if (s.includes('4') || s.includes('low')) return '#16a34a';
  return '#6b7280';
}

function stateColor(state: string): string {
  const s = state.toLowerCase();
  if (s.includes('open') || s.includes('new') || s.includes('in progress') || s.includes('active')) return '#0ea5e9';
  if (s.includes('closed') || s.includes('resolved')) return '#16a34a';
  return '#6b7280';
}

// ─── IncidentListPanel ────────────────────────────────────────────────────────

export function IncidentListPanel({ profileId, servicenowUrl, width, onAnalyze }: IncidentListPanelProps) {
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('open');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [expandedNumber, setExpandedNumber] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<RefreshIntervalOption>(5);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingMore = useRef(false);

  const load = useCallback(async (currentPage = 0, append = false) => {
    if (!append) setLoading(true);
    setError(null);

    const result = await fetchIncidents({ profileId, servicenowUrl, filterStatus, page: currentPage });

    if (result.error) {
      setError(result.error);
      if (!append) setLoading(false);
      return;
    }

    if (append) {
      setIncidents((prev) => [...prev, ...result.incidents]);
    } else {
      setIncidents(result.incidents);
    }
    setHasMore(result.hasMore);
    setLastRefreshed(new Date());
    setLoading(false);
  }, [profileId, servicenowUrl, filterStatus]);

  // Start/restart the auto-refresh timer
  function startTimer() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void load(0);
      startTimer();
    }, refreshInterval * 60 * 1000);
  }

  // On mount and when filter/interval changes, fetch fresh data and reset timer
  useEffect(() => {
    setPage(0);
    void load(0);
    startTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, refreshInterval, profileId, servicenowUrl]);

  function handleManualRefresh() {
    setPage(0);
    void load(0);
    startTimer();
  }

  function handleLoadMore() {
    if (isLoadingMore.current) return;
    isLoadingMore.current = true;
    const nextPage = page + 1;
    setPage(nextPage);
    void load(nextPage, true).finally(() => { isLoadingMore.current = false; });
  }

  function handleRowClick(number: string) {
    setExpandedNumber((prev) => (prev === number ? null : number));
  }

  // Apply severity filter client-side
  const visibleIncidents =
    filterSeverity === 'all'
      ? incidents
      : incidents.filter((inc) => inc.severity.toLowerCase().includes(filterSeverity));

  const lastRefreshedStr = lastRefreshed
    ? lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div
      style={{
        width,
        minWidth: 220,
        maxWidth: 500,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #e5e7eb',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 12px 6px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#111827' }}>
            Live Incidents
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>
              Refreshed: {lastRefreshedStr}
            </span>
            <button
              onClick={handleManualRefresh}
              title="Refresh now"
              aria-label="Refresh incidents"
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: '#6b7280',
                fontSize: '0.75rem',
                padding: '2px 4px',
              }}
            >
              ↻
            </button>
          </div>
        </div>

        {/* Status filter */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          {(['open', 'closed', 'all'] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              style={{
                padding: '2px 8px',
                fontSize: '0.7rem',
                borderRadius: 4,
                border: filterStatus === s ? `1px solid ${SN_THEME.navActiveBackground}` : '1px solid #d1d5db',
                backgroundColor: filterStatus === s ? '#d1fae5' : '#fff',
                color: filterStatus === s ? SN_THEME.navActiveText : '#374151',
                cursor: 'pointer',
                fontWeight: filterStatus === s ? 700 : 400,
                textTransform: 'capitalize',
              }}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Severity filter + refresh interval */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            style={{ fontSize: '0.7rem', padding: '1px 4px', border: '1px solid #d1d5db', borderRadius: 4, flex: 1 }}
            aria-label="Filter by severity"
          >
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {([5, 10, 15] as RefreshIntervalOption[]).map((mins) => (
              <button
                key={mins}
                onClick={() => setRefreshInterval(mins)}
                style={{
                  padding: '1px 6px',
                  fontSize: '0.65rem',
                  borderRadius: 3,
                  border: refreshInterval === mins ? `1px solid ${SN_THEME.navActiveBackground}` : '1px solid #d1d5db',
                  backgroundColor: refreshInterval === mins ? '#d1fae5' : '#fff',
                  color: refreshInterval === mins ? SN_THEME.navActiveText : '#374151',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {mins} min
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: '0.8rem' }}>
            Loading incidents…
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: 12 }}>
            <p style={{ color: '#dc2626', fontSize: '0.75rem', marginBottom: 8 }}>
              {error}
            </p>
            <button
              onClick={handleManualRefresh}
              aria-label="Retry loading incidents"
              style={{
                fontSize: '0.75rem',
                padding: '4px 12px',
                border: '1px solid #dc2626',
                borderRadius: 4,
                background: '#fff',
                color: '#dc2626',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && visibleIncidents.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: '0.75rem' }}>
            No {filterStatus !== 'all' ? filterStatus + ' ' : ''}incidents found.
          </div>
        )}

        {!loading && !error && visibleIncidents.map((inc) => (
          <div key={inc.number}>
            {/* Incident row */}
            <div
              data-testid="incident-row"
              onClick={() => handleRowClick(inc.number)}
              style={{
                padding: '8px 12px',
                borderBottom: '1px solid #f3f4f6',
                cursor: 'pointer',
                backgroundColor: expandedNumber === inc.number ? '#f0fdf4' : '#fff',
              }}
              onMouseEnter={(e) => { if (expandedNumber !== inc.number) e.currentTarget.style.backgroundColor = '#f9fafb'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = expandedNumber === inc.number ? '#f0fdf4' : '#fff'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <span
                  style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1e40af', fontFamily: 'monospace' }}
                >
                  {inc.number}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <span style={{
                    fontSize: '0.6rem', padding: '1px 5px', borderRadius: 10,
                    backgroundColor: severityColor(inc.severity) + '20',
                    color: severityColor(inc.severity), fontWeight: 600,
                  }}>
                    {inc.severity}
                  </span>
                  <span style={{
                    fontSize: '0.6rem', padding: '1px 5px', borderRadius: 10,
                    backgroundColor: stateColor(inc.state) + '20',
                    color: stateColor(inc.state), fontWeight: 600,
                  }}>
                    {inc.state}
                  </span>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#374151', lineHeight: 1.4, wordBreak: 'break-word' }}>
                {inc.shortDescription}
              </p>
              <p style={{ margin: '3px 0 0', fontSize: '0.65rem', color: '#9ca3af' }}>
                {inc.assignmentGroup} · {inc.lastUpdated.substring(0, 10)}
              </p>
            </div>

            {/* Expanded detail */}
            {expandedNumber === inc.number && (
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#f0fdf4',
                  borderBottom: '1px solid #e5e7eb',
                  borderLeft: `3px solid ${SN_THEME.navActiveBackground}`,
                }}
              >
                <p style={{ margin: '0 0 4px', fontSize: '0.7rem', fontWeight: 700, color: '#065f46' }}>
                  Assignment Group
                </p>
                <p style={{ margin: '0 0 8px', fontSize: '0.72rem', color: '#374151' }}>
                  {inc.assignmentGroup}
                </p>
                {inc.description && (
                  <>
                    <p style={{ margin: '0 0 4px', fontSize: '0.7rem', fontWeight: 700, color: '#065f46' }}>
                      Description
                    </p>
                    <p style={{ margin: '0 0 8px', fontSize: '0.72rem', color: '#374151', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {inc.description}
                    </p>
                  </>
                )}
                {onAnalyze && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onAnalyze(inc); }}
                    style={{
                      marginTop: 4,
                      padding: '4px 12px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      borderRadius: 4,
                      border: 'none',
                      backgroundColor: SN_THEME.primaryButton,
                      color: SN_THEME.primaryButtonText,
                      cursor: 'pointer',
                    }}
                  >
                    Analyze ▶
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Load more */}
        {!loading && !error && hasMore && (
          <div style={{ padding: 8, textAlign: 'center' }}>
            <button
              onClick={handleLoadMore}
              aria-label="Load more incidents"
              style={{
                fontSize: '0.75rem',
                padding: '4px 16px',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                background: '#fff',
                color: '#374151',
                cursor: 'pointer',
              }}
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default IncidentListPanel;
