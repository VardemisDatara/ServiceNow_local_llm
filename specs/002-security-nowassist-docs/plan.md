# Implementation Plan: Security Incidents Dashboard, Now Assist Integration & App Documentation

**Branch**: `002-security-nowassist-docs` | **Date**: 2026-03-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-security-nowassist-docs/spec.md`

---

## Summary

Extend the existing ServiceNow MCP Bridge desktop app (Tauri + React + Rust) with three independently deliverable capabilities:

1. **Security Incidents Dashboard** — Refactor the existing Security tab into a side-by-side split: an `IncidentListPanel` on the left shows live security incidents from ServiceNow (filtered, paginated, auto-refreshing every 5–15 min), alongside the existing chat workflow on the right.

2. **Now Assist LLM Integration via MCP** — Add a `NowAssistMCPClient` service that connects to the ServiceNow Yokohama MCP server (`/sncapps/mcp-server`) using a Bearer token. The local AI model auto-detects when a user query warrants a Now Assist tool call, invokes it transparently, and displays the response with an inline **Now Assist ✦** attribution badge.

3. **App Documentation** — Author comprehensive Markdown documentation in `docs/` covering setup, all features, and troubleshooting.

Technical approach: extend existing infrastructure (Phase 5 `executeMCPTool`, Phase 6 Security tab, `@modelcontextprotocol/sdk` already installed, `'servicenow_now_assist'` sender enum already in DB). Minimal new schema: two nullable columns added to `configuration_profiles`. No Rust changes needed for the Now Assist client — all MCP communication is TypeScript-side.

---

## Technical Context

**Language/Version**: TypeScript 5.x (renderer/core) + Rust 1.75+ (Tauri commands — no new Rust needed for this feature)
**Primary Dependencies**: React 18, Tauri v2.0, `@modelcontextprotocol/sdk` (already installed — `streamableHttp.js` confirmed present), Zustand 5.x, Drizzle ORM + `tauri-plugin-sql`, `tauri-plugin-keyring`
**Storage**: SQLite via `tauri-plugin-sql` + `drizzle-orm/sqlite-proxy` — migration 0002 adds 2 nullable TEXT columns to `configuration_profiles`
**Testing**: Vitest (unit/integration), Playwright (E2E), `cargo test` + `cargo clippy` (Rust)
**Target Platform**: macOS desktop via Tauri v2 (single-user, single active profile)
**Performance Goals**: Incident list loads < 5 s; detail renders < 1 s; auto-refresh runs silently without UI jank; Now Assist tool calls complete within overall chat streaming response time
**Constraints**: `@modelcontextprotocol/sdk` already installed; `'servicenow_now_assist'` sender enum already in DB (no message table migration); SQLite nullable column additions do not require drop/recreate; single active ServiceNow profile; `phi3:mini` too small for Now Assist routing (use Mistral:7b or cloud LLM)
**Scale/Scope**: Single-user desktop app; incident list paged at 50 items; Now Assist tools discovered dynamically (count varies by instance licensing)

---

## Constitution Check

*GATE: Must pass before Phase 1. Re-checked after Phase 1 design artifacts.*

### I. Code Quality Standards
- [x] Type safety: TypeScript strict mode, all new interfaces and service methods fully typed; no `any`
- [x] Error handling: all MCP/ServiceNow calls wrapped in try-catch; 429 → exponential backoff; errors surface as user-actionable messages
- [x] Security: Bearer token stored in OS keychain via `IPC.storeApiKey`; never logged or serialised to chat; input validated at all ServiceNow data boundaries
- [x] Dependencies: `@modelcontextprotocol/sdk` already a project dependency — no new dependency added

### II. Testing First (NON-NEGOTIABLE)
- [x] TDD workflow: tests written before each implementation unit
- [x] Unit tests: `NowAssistMCPClient` (connect/disconnect/callTool/error paths), `IncidentListPanel` state logic, `detectToolCallsFromMessage` extension
- [x] Integration tests: Settings save/load with `nowAssistEndpoint` + `nowAssistApiKeyRef`; incident fetch + filter; Now Assist tool invocation round-trip
- [x] Contract tests: `NowAssistMCPClientContract` interface compliance; `IncidentFetchResult` schema validation
- [x] Manual test plan: documented per phase; executed before phase sign-off
- [x] Coverage target: ≥ 80%

### III. User Experience Consistency
- [x] Layout: side-by-side split with resizable divider (follows established `ChatPage.tsx` + `History.tsx` pattern)
- [x] Feedback: incident list shows spinner on load/refresh; "last refreshed" timestamp always visible; Now Assist badge inline
- [x] Accessibility: WCAG 2.1 Level AA — keyboard-navigable incident list, focus management on row expansion, colour-contrast-safe badge
- [x] Error recovery: incident list error state shows retry button; Now Assist gracefully degrades to local model

### IV. Performance Standards
- [x] Response times: incident list < 5 s; incident detail < 1 s; auto-refresh background (no UI block); MCP tool call within streaming response time
- [x] Resource limits: pagination at 50 items per render cycle; MCP client singleton (no multiple connections)
- [x] Scalability: N/A — single-user desktop app
- [x] Monitoring: latency logged per MCP call (consistent with existing `ToolMessageMetadata.latencyMs`)

### V. Phase Validation Gates
- [x] Automated: Vitest suite passes, TypeScript strict passes, `cargo clippy` passes, coverage ≥ 80%
- [x] Manual: UI walkthrough per user story; test plan documented and executed
- [x] No exceptions: all gates enforced before phase sign-off

---

## Project Structure

### Documentation (this feature)

```text
specs/002-security-nowassist-docs/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   ├── now-assist-mcp-client.ts
│   ├── incident-list-panel.ts
│   └── settings-now-assist.ts
└── tasks.md             ← Phase 2 output (/speckit.tasks command)
```

### Source Code

```text
src/
├── core/
│   ├── services/
│   │   └── now-assist-mcp-client.ts      [NEW] NowAssistMCPClient implementation
│   │   └── chat.ts                        [EXTEND] detectToolCallsFromMessage, formatToolResult
│   ├── mcp/
│   │   └── client.ts                      [EXTEND] route now_assist tools to NowAssistMCPClient
│   └── storage/
│       ├── schema.ts                      [EXTEND] add nowAssistEndpoint, nowAssistApiKeyRef columns
│       ├── migrations/
│       │   └── 0002_add_now_assist_config.sql  [NEW]
│       └── repositories/
│           └── configuration.ts           [EXTEND] read/write nowAssistEndpoint, nowAssistApiKeyRef
├── renderer/
│   ├── pages/
│   │   └── SecurityPage.tsx               [REFACTOR] side-by-side split layout
│   ├── components/
│   │   ├── IncidentListPanel.tsx          [NEW] left panel component
│   │   ├── Configuration.tsx              [EXTEND] add Now Assist MCP section
│   │   └── Message.tsx                    [EXTEND] Now Assist attribution badge
│   └── store/
│       └── index.ts                       [EXTEND] add nowAssistConnected, nowAssistTools
└── main/
    └── ipc.ts                             [no changes — existing storeApiKey/getApiKey reused]

docs/
├── README.md                              [NEW] documentation index
├── getting-started.md                     [NEW] setup guide
├── configuration.md                       [NEW] profiles + all providers
├── features/
│   ├── chat.md                            [NEW] chat interface guide
│   ├── security-tab.md                    [NEW] incident dashboard guide
│   └── now-assist.md                      [NEW] Now Assist integration guide
└── troubleshooting.md                     [NEW] ≥ 5 common errors

tests/
├── unit/
│   ├── now-assist-mcp-client.test.ts      [NEW]
│   ├── incident-list-panel.test.tsx       [NEW]
│   └── chat-service-now-assist.test.ts    [NEW]
└── integration/
    ├── settings-now-assist.test.ts        [NEW]
    └── security-tab-incidents.test.ts     [NEW]
```

**Structure decision**: Single project (existing structure extended). No new packages or workspace members needed.

---

## Implementation Phases

---

### Phase 1: Foundation — DB Migration + NowAssistMCPClient (Blocking)

**Goal**: Lay infrastructure required by both US1 and US2. No UI changes yet.

**Deliverables**:

1. **DB migration `0002_add_now_assist_config.sql`**
   - `ALTER TABLE configuration_profiles ADD COLUMN now_assist_endpoint TEXT;`
   - `ALTER TABLE configuration_profiles ADD COLUMN now_assist_api_key_ref TEXT;`
   - `ALTER TABLE configuration_profiles ADD COLUMN now_assist_auth_mode TEXT DEFAULT 'apikey';`
   - Applied automatically by existing migration runner on app start
   - *No FTS5 rebuild, no CHECK constraint change — plain nullable TEXT additions*

2. **Schema extension** (`src/core/storage/schema.ts`)
   - Add `nowAssistEndpoint: text('now_assist_endpoint')` (nullable)
   - Add `nowAssistApiKeyRef: text('now_assist_api_key_ref')` (nullable)
   - Add `nowAssistAuthMode: text('now_assist_auth_mode').$default(() => 'apikey')` (nullable, default `'apikey'`)
   - Update `ConfigurationProfile` and `NewConfigurationProfile` TypeScript types

3. **Configuration repository extension** (`src/core/storage/repositories/configuration.ts`)
   - `create()` and `update()` accept and persist `nowAssistEndpoint` + `nowAssistApiKeyRef`
   - `findActive()` returns these fields in the profile object

4. **`NowAssistMCPClient` service** (`src/core/services/now-assist-mcp-client.ts`)
   - Implements `NowAssistMCPClientContract` (see `contracts/now-assist-mcp-client.ts`)
   - `connect()`: tries `StreamableHTTPClientTransport` first; falls back to `SSEClientTransport` on 4xx; calls `client.listTools()` to populate tools cache
   - `callTool()`: wraps `client.callTool()`; implements exponential backoff on HTTP 429 (max 3 retries, initial 1 s, max 30 s)
   - `testConnection()`: connect → listTools → disconnect; returns tool count
   - Singleton lifecycle: one instance per active profile; destroyed/recreated on profile switch
   - Auth header injected based on `authMode`:
     - `'apikey'` → `{ 'x-sn-apikey': token }` (ServiceNow native API Key — requires `com.glide.tokenbased_auth` plugin)
     - `'bearer'` → `{ 'Authorization': 'Bearer ${token}' }` (OAuth 2.1 access token)
   - Headers passed in both `requestInit` and `eventSourceInit` for SSE fallback (workaround for SDK issue #436)

5. **Zustand store extension** (`src/renderer/store/index.ts`)
   - Add `nowAssistConnected: boolean` (default `false`)
   - Add `nowAssistTools: NowAssistTool[]` (default `[]`)
   - Add `nowAssistError: string | null` (default `null`)
   - Add actions: `setNowAssistConnected`, `setNowAssistTools`, `setNowAssistError`

**Tests** (TDD — write before implementing):
- `tests/unit/now-assist-mcp-client.test.ts`: connect success/failure, callTool success/error/429-retry, testConnection, disconnect
- `tests/integration/settings-now-assist.test.ts`: profile create/update/read with new fields; IPC credential store/retrieve

**Phase 1 Gate**:
- [ ] Migration runs cleanly against existing DB (verified in dev)
- [ ] `NowAssistMCPClient` unit tests pass (≥ 80% coverage)
- [ ] TypeScript strict: zero new errors
- [ ] `cargo clippy`: no new warnings

---

### Phase 2: US1 — Security Incidents Dashboard

**Goal**: Refactor `SecurityPage.tsx` into a side-by-side split with the new `IncidentListPanel` on the left.

**Deliverables**:

1. **`IncidentListPanel` component** (`src/renderer/components/IncidentListPanel.tsx`)
   - Implements `IncidentListPanelProps` and `IncidentListPanelState` (see `contracts/incident-list-panel.ts`)
   - On mount: fetches incidents via `executeMCPTool('query_incidents', { state: filterStatus, limit: 50 })`
   - **Filter bar**: status toggle (Open / Closed / All) + severity dropdown
   - **Incident rows**: number, short description, severity badge, state, last updated
   - **Row expansion**: click to expand detail view (description, assignment group, affected CIs, comments)
   - **Pagination**: "Load more" button when `hasMore === true`
   - **Auto-refresh timer**: `useRef<NodeJS.Timeout>`; default 5 min; cleared on unmount
   - **Refresh interval control**: inline stepper in panel header (5 / 10 / 15 min)
   - **"Last refreshed" timestamp**: always visible in panel header
   - **Manual refresh button**: re-runs fetch immediately
   - **Empty state**: friendly message when 0 results for current filter
   - **Error state**: message + retry button when fetch fails or ServiceNow unreachable
   - **Loading state**: spinner overlay on initial load and manual refresh

2. **`SecurityPage.tsx` refactor**
   - Replace current full-width layout with side-by-side split:
     - Left: `IncidentListPanel` (default 320px, min 220px, max 500px)
     - Resizable divider: follows `ChatPage.tsx` pattern (`useRef<boolean>`, `useEffect` with `mousemove`/`mouseup`)
     - Right: existing `SecurityWorkflow` (`flex: 1`)
   - Pass `profileId`, `servicenowUrl` to `IncidentListPanel`
   - Layout CSS: `flex-direction: row`, `overflow: hidden` (existing full-height pattern)

**Tests** (TDD):
- `tests/unit/incident-list-panel.test.tsx`: render with incidents, empty state, error state, filter change, row expansion, refresh timer, pagination
- `tests/integration/security-tab-incidents.test.ts`: incident fetch → display → filter → refresh cycle

**Phase 2 Gate**:
- [ ] `IncidentListPanel` renders correctly with mocked tool results
- [ ] Auto-refresh timer fires at correct interval and clears on unmount
- [ ] Side-by-side split is resizable without layout breaking
- [ ] Empty/error/loading states all render correctly
- [ ] Filter changes trigger new fetch
- [ ] Vitest suite passes; coverage ≥ 80% for new components
- [ ] Manual test: navigate to Security tab with live ServiceNow profile, incidents appear in ≤ 5 s

---

### Phase 3: US2 — Now Assist Integration

**Goal**: Wire `NowAssistMCPClient` into the Settings UI and the chat pipeline.

**Deliverables**:

1. **Settings — Now Assist section** (`src/renderer/components/Configuration.tsx`)
   - New `NowAssistConfig` sub-component (same pattern as `LLMProviderConfig`)
   - Fields: **Endpoint URL** (text input) + **Bearer Token** (password input, masked)
   - **Test Connection** button: calls `NowAssistMCPClient.testConnection()`; on success shows `✓ Connected — N tools discovered`; on failure shows error message
   - **Save** persists `nowAssistEndpoint` to profile + `nowAssistApiKeyRef` via `IPC.storeApiKey('now_assist', profileId, token)`
   - **Clear** removes endpoint from profile + deletes token from keychain
   - Validation: endpoint must be non-empty HTTPS URL; token required when endpoint set

2. **App init — auto-connect** (`src/renderer/pages/Home.tsx` or `App.tsx`)
   - On active profile load: if `nowAssistEndpoint` and `nowAssistApiKeyRef` are set, auto-connect `NowAssistMCPClient` and populate Zustand `nowAssistTools`

3. **Chat service extension** (`src/core/services/chat.ts`)
   - `detectToolCallsFromMessage()`: add Now Assist tool detection
     - If `nowAssistTools` (from store) is non-empty AND message contains intent keywords matching tool descriptions, return `[{ name: toolName, provider: 'now_assist', arguments: {...} }]`
     - Detection: lightweight keyword matching against discovered tool descriptions (no hardcoded tool names)
   - `formatToolResult()` extension: handle `provider === 'now_assist'` → format `NowAssistToolResult.content` into a readable chat-injected string
   - Execution flow (consistent with Phase 5): detect → call `NowAssistMCPClient.callTool()` → inject as user/assistant pair with `sender: 'servicenow_now_assist'` BEFORE the user's message → persist with `ToolMessageMetadata`

4. **`Message.tsx` extension** (`src/renderer/components/Message.tsx`)
   - When `message.sender === 'servicenow_now_assist'`: render an inline **Now Assist ✦** badge adjacent to the message content
   - Badge style: small pill/tag, consistent with existing attribution labels (cloud LLM model name, web search provider)
   - Attribution is always shown — never hidden

5. **Graceful degradation**
   - If `nowAssistConnected === false` (store) when a Now Assist tool call is attempted: skip tool call, continue with local model, append system note in response: `[Now Assist unavailable — answering with local model only]`

**Tests** (TDD):
- `tests/unit/chat-service-now-assist.test.ts`: tool detection with/without Now Assist tools in store; tool invocation; graceful degradation when disconnected
- Extend `tests/unit/now-assist-mcp-client.test.ts`: auth failure, rate limit retry, tool call with malformed response

**Phase 3 Gate**:
- [ ] Settings Now Assist section saves/loads correctly
- [ ] Test Connection button shows discovered tool count
- [ ] Chat: Now Assist tool invocation logged and attributed in response
- [ ] Chat: graceful degradation when Now Assist unavailable
- [ ] Badge renders in Message component for `sender: 'servicenow_now_assist'`
- [ ] Credentials never appear in logs (verified by log inspection)
- [ ] Vitest suite passes; coverage ≥ 80% for new/modified code
- [ ] Manual test: end-to-end Now Assist invocation with live instance

---

### Phase 4: US3 — App Documentation

**Goal**: Author complete Markdown documentation that reflects the final state of the application.

**Deliverables** (`docs/` directory):

| File | Contents |
|------|----------|
| `docs/README.md` | Overview, feature list, quick links to each guide |
| `docs/getting-started.md` | Prerequisites → install → first launch → connect ServiceNow → send first message (≤ 15 min read) |
| `docs/configuration.md` | Profile creation, ServiceNow URL/credentials, Ollama setup, LLM provider selection, search provider setup, Now Assist MCP setup |
| `docs/features/chat.md` | Chat interface, model selection, tool calling overview, web search augmentation |
| `docs/features/security-tab.md` | Incident list panel, filters, detail expansion, auto-refresh interval, refreshing manually |
| `docs/features/now-assist.md` | Prerequisites (Yokohama, MCP server activated), configuration, how invocations work, attribution badge, troubleshooting connection |
| `docs/troubleshooting.md` | ≥ 5 documented errors with cause and resolution |

**Troubleshooting entries** (minimum):
1. ServiceNow connection fails ("401 Unauthorized") — wrong credentials or URL
2. Now Assist "Test Connection" fails ("404 Not Found") — MCP server not activated / wrong endpoint path
3. Ollama not responding — Ollama not running or wrong endpoint
4. Incident list shows "Connection error" — ServiceNow profile not active or network issue
5. Now Assist tools not appearing in settings — MCP server configured but no tools assigned to server role
6. Cloud LLM (OpenAI/Mistral) returns 401 — invalid API key or wrong key provider stored

**Phase 4 Gate**:
- [ ] All 7 documentation files authored
- [ ] Getting Started guide validated: followed on clean machine → working app
- [ ] Every documented UI element verified to exist in the app
- [ ] Troubleshooting covers ≥ 5 errors with clear resolutions

---

### Phase 5: Integration & Polish

**Goal**: Cross-feature integration testing, performance validation, documentation sync.

**Deliverables**:

1. **End-to-end integration**: incident list loads → user asks about an incident → Now Assist tool invoked → response attributed → chat persists
2. **Performance validation**: measure incident list load time (< 5 s target), detail render (< 1 s), auto-refresh non-blocking
3. **Documentation sync pass**: verify every doc page against final app state; update if any discrepancy
4. **Final regression suite**: full Vitest + Playwright run; all tests green

**Phase 5 Gate**:
- [ ] Full test suite passes (Vitest + Playwright + cargo test)
- [ ] Coverage ≥ 80% across all new code
- [ ] Performance targets met (manual measurement)
- [ ] Documentation verified against final app
- [ ] No TypeScript strict errors; no `cargo clippy` warnings
- [ ] Security review: credentials not in logs, OWASP compliance confirmed

---

## Complexity Tracking

> No Constitution violations requiring justification.

All new complexity is justified by feature requirements:
- `NowAssistMCPClient` singleton: necessary to maintain a persistent MCP connection without re-authenticating on every tool call
- Side-by-side resizable split: established pattern already used in `ChatPage.tsx` — not new complexity
- Exponential backoff on 429: required by ServiceNow API rate limiting best practices
