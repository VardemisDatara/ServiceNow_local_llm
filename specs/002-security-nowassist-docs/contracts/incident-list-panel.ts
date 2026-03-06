/**
 * Contract: IncidentListPanel
 *
 * Component and service contract for the Security tab's proactive incident list panel.
 * Reuses existing executeMCPTool('query_incidents', ...) from src/core/mcp/client.ts.
 *
 * Layout: Left panel in SecurityPage side-by-side split (resizable, 220–500px, default 320px)
 * Auto-refresh: 5–15 minutes interval (default 5), configurable via inline stepper
 */

// ─── Fetch Options ────────────────────────────────────────────────────────────

export interface IncidentFetchOptions {
  status: 'open' | 'closed' | 'all';
  severity?: string | null;
  /** Page number, 0-indexed */
  page: number;
  /** Items per page — fixed at 50 per FR-006 */
  pageSize: 50;
}

// ─── Display Models ───────────────────────────────────────────────────────────

export interface IncidentSummary {
  number: string;
  shortDescription: string;
  severity: string;
  priority: string;
  state: string;
  assignmentGroup: string;
  lastUpdated: string;
}

export interface IncidentDetail extends IncidentSummary {
  description: string;
  affectedCIs: string[];
  comments: Array<{
    author: string;
    body: string;
    createdAt: string;
  }>;
}

export interface IncidentFetchResult {
  incidents: IncidentSummary[];
  total: number;
  hasMore: boolean;
  fetchedAt: Date;
}

// ─── Component Props ──────────────────────────────────────────────────────────

export interface IncidentListPanelProps {
  /** Active ServiceNow profile ID for MCP context */
  profileId: string;
  /** ServiceNow instance URL */
  servicenowUrl: string;
  /** Panel width in pixels (controlled by parent via resizable divider) */
  width: number;
}

// ─── Panel State ─────────────────────────────────────────────────────────────

export interface IncidentListPanelState {
  incidents: IncidentSummary[];
  total: number;
  page: number;
  filterStatus: 'open' | 'closed' | 'all';
  filterSeverity: string | null;
  loading: boolean;
  /** null = no error; string = user-visible message */
  error: string | null;
  lastRefreshedAt: Date | null;
  /** User-configurable: 5, 10, or 15 minutes */
  refreshIntervalMinutes: 5 | 10 | 15;
  /** Incident number of the currently expanded row, or null */
  expandedIncidentNumber: string | null;
  expandedDetail: IncidentDetail | null;
  detailLoading: boolean;
}

// ─── Refresh Behaviour ────────────────────────────────────────────────────────

/**
 * Refresh interval options exposed to the user in the panel header.
 * Default is 5 minutes per clarification Q5.
 */
export type RefreshIntervalOption = 5 | 10 | 15;

export const REFRESH_INTERVAL_OPTIONS: RefreshIntervalOption[] = [5, 10, 15];
export const DEFAULT_REFRESH_INTERVAL: RefreshIntervalOption = 5;

/**
 * Empty state reasons for user-visible messaging.
 */
export type EmptyStateReason =
  | 'no_incidents'         // Query returned 0 results for current filter
  | 'not_connected'        // No active ServiceNow profile
  | 'error';               // Fetch failed
