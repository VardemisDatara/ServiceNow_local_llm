# Data Model: 002-security-nowassist-docs

**Date**: 2026-03-02
**Branch**: `002-security-nowassist-docs`

---

## Schema Changes

### 1. `configuration_profiles` table — ADD COLUMNS

Three new nullable columns (safe `ALTER TABLE ADD COLUMN` — no drop/recreate needed):

```sql
ALTER TABLE configuration_profiles ADD COLUMN now_assist_endpoint TEXT;
ALTER TABLE configuration_profiles ADD COLUMN now_assist_api_key_ref TEXT;
ALTER TABLE configuration_profiles ADD COLUMN now_assist_auth_mode TEXT DEFAULT 'apikey';
```

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `now_assist_endpoint` | TEXT | YES | — | Full URL to ServiceNow MCP server endpoint including server sys_id (e.g. `https://instance.service-now.com/sncapps/mcp-server/<sys_id>`) |
| `now_assist_api_key_ref` | TEXT | YES | — | Reference key for OS keychain lookup (`'now_assist'` — consistent with `searchApiKeyRef` pattern) |
| `now_assist_auth_mode` | TEXT | YES | `'apikey'` | Auth header mode: `'apikey'` sends `x-sn-apikey` header; `'bearer'` sends `Authorization: Bearer` |

**Note on auth modes**: ServiceNow native API Keys use the `x-sn-apikey` header (not `Authorization: Bearer`). OAuth 2.1 access tokens use `Authorization: Bearer`. The `now_assist_auth_mode` column stores which mode the user selected.

**Migration**: `src/core/storage/migrations/0002_add_now_assist_config.sql`
**No FTS5 rebuild needed** — changes are on `configuration_profiles`, not `conversation_messages`.
**No CHECK constraint change** — columns are plain TEXT with no enum constraint.

### 2. `conversation_messages` table — NO CHANGES

`'servicenow_now_assist'` is already present in the `sender` enum. No migration required.

### 3. `configuration_profiles` TypeScript type extension

```typescript
// src/core/storage/schema.ts — extend existing configurationProfiles table definition
nowAssistEndpoint: text('now_assist_endpoint'),        // nullable
nowAssistApiKeyRef: text('now_assist_api_key_ref'),    // nullable
```

---

## Key Entities (runtime, no new DB tables)

### NowAssistTool

Discovered at runtime via `client.listTools()`. Not persisted — cached in component state during the session.

```typescript
interface NowAssistTool {
  name: string;             // Tool identifier (e.g. 'summarize_incident')
  description: string;      // Human-readable description
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}
```

### NowAssistToolResult

Returned by `client.callTool()`. Stored as message content with `sender: 'servicenow_now_assist'`.

```typescript
interface NowAssistToolResult {
  toolName: string;
  content: string;          // Formatted text to inject into chat context
  rawContent: unknown;      // Raw MCP CallToolResult content array (for metadata)
  isError: boolean;
  latencyMs: number;
}
```

### IncidentSummary (display model for IncidentListPanel)

Derived from existing `query_incidents` tool result. No new DB table.

```typescript
interface IncidentSummary {
  number: string;           // e.g. 'INC0012345'
  shortDescription: string;
  severity: string;         // Display string (e.g. '1 - Critical')
  priority: string;
  state: string;            // Display string (e.g. 'Open', 'Closed')
  assignmentGroup: string;
  lastUpdated: string;      // ISO date string
}
```

### IncidentDetail (expanded view)

Full record loaded on row click. Fetched from the same `query_incidents` tool result (limit=1) or from the cached list.

```typescript
interface IncidentDetail extends IncidentSummary {
  description: string;
  affectedCIs: string[];
  comments: Array<{ author: string; body: string; createdAt: string }>;
}
```

### IncidentListState (React component state)

```typescript
interface IncidentListState {
  incidents: IncidentSummary[];
  total: number;
  page: number;              // Current page (0-indexed)
  pageSize: number;          // 50
  filterStatus: 'open' | 'closed' | 'all';
  filterSeverity: string | null;
  loading: boolean;
  error: string | null;
  lastRefreshedAt: Date | null;
  refreshIntervalMinutes: number;   // 5–15, default 5
  expandedIncidentNumber: string | null;
}
```

### NowAssistConnectionState (Zustand store addition)

```typescript
interface NowAssistConnectionState {
  nowAssistConnected: boolean;
  nowAssistTools: NowAssistTool[];    // Discovered tools cache
  nowAssistError: string | null;
}
```

---

## Credential Storage Pattern

Follows the exact same pattern as `llmApiKeyRef`:

| Action | Call |
|--------|------|
| Store token | `IPC.storeApiKey('now_assist', profileId, token)` |
| Retrieve token | `IPC.getApiKey('now_assist', profileId)` |
| Delete token | `IPC.deleteApiKey('now_assist', profileId)` |
| Check existence | `IPC.hasApiKey('now_assist', profileId)` |

The `nowAssistApiKeyRef` column stores the literal string `'now_assist'` as a reference (same pattern as `searchApiKeyRef` storing `'perplexity'` etc.).

---

## State Transitions

### NowAssistMCPClient lifecycle

```
DISCONNECTED
    │
    ├─ connect(endpoint, token) ──────────────────────► CONNECTING
    │                                                        │
    │                                           success ◄───┤──► failure
    │                                              │                │
    │                                         CONNECTED         DISCONNECTED
    │                                              │              (error set)
    │                                   listTools() runs
    │                                   tools cached in store
    │                                              │
    │                            callTool() / listTools() ──► CONNECTED
    │                                              │
    │                                    disconnect() ──► DISCONNECTED
    │
    └─ connection error (429, 401, network) ──► DISCONNECTED (error set)
```

### IncidentListPanel refresh cycle

```
IDLE ──► [tab opened / manual refresh / timer fires] ──► LOADING
          LOADING ──► success ──► LOADED (list shown, timestamp updated)
          LOADING ──► error ──► ERROR (error message shown, retry available)
          LOADED ──► [timer fires] ──► LOADING (silent background refresh)
          LOADED ──► [user navigates away] ──► timer cleared
```
