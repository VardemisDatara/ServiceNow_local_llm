# Tasks: Security Incidents Dashboard, Now Assist Integration & App Documentation

**Input**: Design documents from `/specs/002-security-nowassist-docs/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Organization**: Tasks grouped by user story. Each story is independently implementable and testable.
**TDD**: Constitution requires TDD (NON-NEGOTIABLE). Test tasks appear before implementation tasks in each phase.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies between them)
- **[Story]**: User story this task belongs to (US1, US2, US3)
- Exact file paths included in every task description

---

## Phase 1: Setup

**Purpose**: Create migration file and docs directory structure. No code changes yet.

- [X] T001 Create DB migration file `src/core/storage/migrations/0002_add_now_assist_config.sql` with three `ALTER TABLE configuration_profiles ADD COLUMN` statements: `now_assist_endpoint TEXT`, `now_assist_api_key_ref TEXT`, `now_assist_auth_mode TEXT DEFAULT 'apikey'`
- [X] T002 [P] Create `docs/` directory structure: `docs/features/` subdirectory and empty placeholder files (`README.md`, `getting-started.md`, `configuration.md`, `features/chat.md`, `features/security-tab.md`, `features/now-assist.md`, `troubleshooting.md`)

### Phase 1 Validation Gates

**Automated Gates**:
- [ ] Migration SQL file parses without error (no syntax issues)
- [ ] `docs/` directory tree created with correct hierarchy

**Manual Gates**:
- [ ] Migration SQL reviewed: exactly 3 `ALTER TABLE` statements, correct column names and types
- [ ] Docs directory structure matches plan.md specification

**Documentation**: Create `specs/002-security-nowassist-docs/phase1-validation.md` with gate results

---

## Phase 2: Foundation (Blocking Prerequisites)

**Purpose**: DB migration, schema extension, `NowAssistMCPClient` service, Zustand store slice. All user stories depend on this phase.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete and gates pass.

### Tests (TDD — write these FIRST; they MUST FAIL before implementation)

- [X] T003 [P] Write unit tests for `NowAssistMCPClient` in `tests/unit/now-assist-mcp-client.test.ts`: cover `connect()` success, `connect()` with unreachable endpoint, `connect()` with 401 auth failure, `callTool()` success, `callTool()` with HTTP 429 retries (≤3), `callTool()` with malformed response, `testConnection()`, `disconnect()`, and `getDiscoveredTools()` returns empty when not connected
- [X] T004 [P] Write integration tests for configuration profile Now Assist fields in `tests/integration/settings-now-assist.test.ts`: profile `create()` with `nowAssistEndpoint`+`nowAssistAuthMode`, `update()` modifying those fields, `findActive()` returns new fields, keychain `storeApiKey`/`getApiKey`/`deleteApiKey` round-trip with key `'now_assist'`

### Implementation

- [X] T005 [P] Extend `src/core/storage/schema.ts`: add `nowAssistEndpoint: text('now_assist_endpoint')`, `nowAssistApiKeyRef: text('now_assist_api_key_ref')`, `nowAssistAuthMode: text('now_assist_auth_mode').$default(() => 'apikey')` to the `configurationProfiles` table definition; update `ConfigurationProfile` and `NewConfigurationProfile` inferred types
- [X] T006 Extend `src/core/storage/repositories/configuration.ts`: update `create()` and `update()` methods to accept and persist `nowAssistEndpoint`, `nowAssistApiKeyRef`, `nowAssistAuthMode`; update `findActive()` and `findAll()` return types to include the three new fields
- [X] T007 Implement `src/core/services/now-assist-mcp-client.ts` implementing `NowAssistMCPClientContract` (see `specs/002-security-nowassist-docs/contracts/now-assist-mcp-client.ts`): `connect()` tries `StreamableHTTPClientTransport` first then falls back to `SSEClientTransport` on 4xx; auth header based on `authMode` (`'apikey'` → `x-sn-apikey: <token>`, `'bearer'` → `Authorization: Bearer <token>`); for SSE pass headers in both `eventSourceInit` and `requestInit`; `connect()` calls `client.listTools()` with cursor pagination to populate tools cache; `callTool()` wraps `client.callTool()` with exponential backoff on HTTP 429 (3 retries, initial delay 1 s, max 30 s, respects `Retry-After` header); `testConnection()` connects → lists tools → disconnects and returns tool count; `disconnect()` calls `transport.terminateSession()` then `client.close()`; singleton — destroyed and recreated on profile switch
- [X] T008 [P] Extend `src/renderer/store/index.ts`: add `nowAssistConnected: boolean` (default `false`), `nowAssistTools: NowAssistTool[]` (default `[]`), `nowAssistError: string | null` (default `null`) state fields; add `setNowAssistConnected`, `setNowAssistTools`, `setNowAssistError` actions; export `useNowAssistConnected()`, `useNowAssistTools()` selector hooks using `useShallow` where needed

### Phase 2 Validation Gates

**Automated Gates**:
- [ ] `pnpm test` — T003 tests now pass against T007 implementation; T004 tests pass against T006
- [ ] TypeScript strict mode: `pnpm tsc --noEmit` — zero new errors
- [ ] `cd src-tauri && cargo clippy` — no new warnings

**Manual Gates**:
- [ ] Code review: `NowAssistMCPClient` auth header logic reviewed (confirm `x-sn-apikey` vs `Authorization: Bearer` is correct per auth mode)
- [ ] DB migration applied in dev environment: `pnpm tauri dev` starts without error; verify new columns exist with `sqlite3` on the app DB
- [ ] Manual smoke test: `testConnection()` call logged in dev tools without credential leakage

**Documentation**: Create `specs/002-security-nowassist-docs/phase2-validation.md` with gate results

**Checkpoint**: Foundation complete — US1, US2, US3 can now begin

---

## Phase 3: User Story 1 — Security Incidents Dashboard (Priority: P1) 🎯 MVP

**Goal**: Refactor the Security tab into a side-by-side split with a proactive `IncidentListPanel` on the left and the existing `SecurityWorkflow` on the right. Incidents load automatically, can be filtered and paginated, auto-refresh every 5–15 minutes, and expand on click.

**Independent Test**: Navigate to the Security tab with an active ServiceNow profile; the incident list appears within 5 seconds without any user query; filter "Open" shows only open incidents; clicking a row expands its detail.

### Tests (TDD — write FIRST; must FAIL before implementation)

- [X] T009 [P] [US1] Write unit tests for `IncidentListPanel` in `tests/unit/incident-list-panel.test.tsx`: render with mocked incident list, empty state (0 results), error state (network failure), filter status change triggers re-fetch, filter severity change triggers re-fetch, row click expands detail, row click on already-expanded row collapses it, "Load more" button appears when `hasMore===true`, auto-refresh timer fires at configured interval, timer clears on unmount, manual refresh button triggers immediate fetch, refresh interval control changes interval value
- [X] T010 [P] [US1] Write integration tests for security tab incident fetch→filter→display cycle in `tests/integration/security-tab-incidents.test.ts`: fetch incidents with `status:'open'`, verify `executeMCPTool('query_incidents',{state:'open',limit:50})` is called; filter change to `'closed'` triggers new call with `state:'closed'`; error from tool call renders error state; empty result renders empty state with correct message

### Implementation

- [X] T011 [US1] Create `src/renderer/components/IncidentListPanel.tsx`: component accepting `IncidentListPanelProps` (`profileId`, `servicenowUrl`, `width`); on mount fetches via `executeMCPTool('query_incidents', { state: filterStatus, limit: 50 })` from `src/core/mcp/client.ts`; renders scrollable list of incident rows showing number, short description, severity badge, state chip, last updated; loading spinner on initial fetch and manual refresh; empty state message when 0 results; error message with Retry button when fetch fails; use `useShallow` for any Zustand object selectors
- [X] T012 [US1] Add filter bar to `src/renderer/components/IncidentListPanel.tsx`: status toggle group (Open / Closed / All, default Open); severity dropdown (All / Critical / High / Medium / Low); filter changes re-trigger fetch with updated params; TypeScript-side filter in `formatToolResult` result as the guaranteed final gate (pass `filterStatus` so it knows the requested state)
- [X] T013 [US1] Add row expansion to `src/renderer/components/IncidentListPanel.tsx`: click row to expand inline detail view showing full description, assignment group, affected CIs, and comments/work notes; click again to collapse; only one row expanded at a time; detail loaded from the cached incident list result (no extra fetch for basic fields)
- [X] T014 [US1] Add pagination to `src/renderer/components/IncidentListPanel.tsx`: show "Load more" button when `hasMore === true` (i.e. returned incident count equals page size of 50); clicking appends next page to current list; page counter tracked in component state
- [X] T015 [US1] Add auto-refresh to `src/renderer/components/IncidentListPanel.tsx`: `useRef<NodeJS.Timeout>` timer that fires silently at `refreshIntervalMinutes * 60 * 1000`; timer cleared and reset when interval changes; timer cleared on unmount; "Last refreshed: HH:MM" timestamp in panel header always visible; manual refresh button in header triggers immediate reload and resets timer; refresh interval stepper (5 / 10 / 15 min options) with default 5
- [X] T016 [US1] Refactor `src/renderer/pages/SecurityPage.tsx` into side-by-side resizable split: left panel = `IncidentListPanel` (default 320px wide, min 220px, max 500px); right panel = existing `SecurityWorkflow` (`flex: 1`); resizable divider using established `ChatPage.tsx` pattern (`useRef<boolean>` isResizing, `useState<number>` width, single `useEffect` with `mousemove`/`mouseup` listeners, `document.body.style.cursor = 'col-resize'` on drag); outer layout: `flex-direction: row`, `overflow: hidden`, `height: 100%`

### User Story 1 Validation Gates

**Automated Gates**:
- [ ] `pnpm test` — T009, T010 tests passing
- [ ] TypeScript strict: zero new errors
- [ ] Code coverage ≥80% for `IncidentListPanel.tsx` and `SecurityPage.tsx` changes

**Manual Gates**:
- [ ] Navigate to Security tab with live ServiceNow profile → incidents appear in ≤5 s
- [ ] Filter toggles update list correctly; "All" shows all incidents
- [ ] Row click expands detail; second click collapses
- [ ] Auto-refresh fires at 5 min (verify via "last refreshed" timestamp); changing to 10 min works
- [ ] Resizable divider drags smoothly; layout doesn't break at min/max widths
- [ ] Error state displays when ServiceNow is unreachable; Retry button works
- [ ] Empty state displays when filter returns 0 results

**Documentation**: Create `specs/002-security-nowassist-docs/us1-validation.md` with gate results

**Checkpoint**: US1 fully functional and independently testable — MVP deliverable

---

## Phase 4: User Story 2 — Local LLM ↔ Now Assist Exchange via MCP (Priority: P2)

**Goal**: Add a Now Assist MCP configuration section to Settings; the local AI model auto-detects when a user query warrants a Now Assist tool call, invokes it via `NowAssistMCPClient`, injects the result into the chat context, and renders an inline **Now Assist ✦** attribution badge.

**Independent Test**: Configure the Settings Now Assist section with a valid endpoint and token; click "Test Connection" and see discovered tool count; ask the chat a question that matches a Now Assist tool; observe the response includes content with "Now Assist ✦" badge; disconnect the endpoint and ask the same question — the local model responds alone with a graceful degradation note.

### Tests (TDD — write FIRST; must FAIL before implementation)

- [X] T017 [P] [US2] Write unit tests for chat service Now Assist extensions in `tests/unit/chat-service-now-assist.test.ts`: `detectToolCallsFromMessage()` returns Now Assist tool when store has matching tools and message has relevant keywords; `detectToolCallsFromMessage()` returns empty when `nowAssistConnected === false`; `formatToolResult()` formats Now Assist result content for chat injection; graceful degradation: when `nowAssistConnected === false` and tool would be called, chat pipeline continues without Now Assist and appends unavailability note
- [X] T018 [P] [US2] Write integration tests for Now Assist invocation round-trip in `tests/integration/now-assist-integration.test.tsx`: Settings form saves `nowAssistEndpoint` + `nowAssistAuthMode` to profile and token to keychain via `IPC.storeApiKey('now_assist', ...)`, Settings form clears values and calls `IPC.deleteApiKey('now_assist', ...)`; Test Connection button calls `NowAssistMCPClient.testConnection()` and displays tool count on success and error message on failure

### Implementation

- [X] T019 [US2] Add `NowAssistConfig` sub-component inside `src/renderer/components/Configuration.tsx` following the same pattern as `LLMProviderConfig`: endpoint URL text input with placeholder `https://<instance>.service-now.com/sncapps/mcp-server/<sys_id>`; auth mode radio group (`API Key (x-sn-apikey)` / `OAuth Bearer`); token password input (masked, shows `•••••••` when saved); **Test Connection** button that calls `NowAssistMCPClient.testConnection()` and displays `✓ Connected — N tools discovered` or error message; **Save** button persists `nowAssistEndpoint` + `nowAssistAuthMode` to profile and calls `IPC.storeApiKey('now_assist', profileId, token)`; **Clear** button removes endpoint from profile and calls `IPC.deleteApiKey('now_assist', profileId)`; validation: endpoint required when token set; both must be valid or both empty
- [X] T020 [US2] Add auto-connect on active profile load in `src/App.tsx` or `src/renderer/pages/Home.tsx`: after active profile resolves, if `profile.nowAssistEndpoint` and `profile.nowAssistApiKeyRef` are set, retrieve token via `IPC.getApiKey('now_assist', profileId)` and call `NowAssistMCPClient.connect({ endpoint, token, authMode })`, then dispatch `setNowAssistConnected(true)` and `setNowAssistTools(tools)` to Zustand store; on profile switch, call `NowAssistMCPClient.disconnect()` before connecting with new profile's config; on connect failure, dispatch `setNowAssistError(message)` and `setNowAssistConnected(false)`
- [X] T021 [US2] Extend `detectToolCallsFromMessage()` in `src/core/services/chat.ts`: if `nowAssistConnected` is `true` in the Zustand store and `nowAssistTools` is non-empty, check user message text against discovered tool descriptions using keyword matching (do NOT hardcode tool names); return matched tools as `[{ name: toolName, provider: 'now_assist', arguments: { input: userMessage } }]`; detection should NOT fire when store is disconnected or tools list is empty
- [X] T022 [US2] Extend `executeMCPTool` routing in `src/core/mcp/client.ts`: when `provider === 'now_assist'`, route call to `NowAssistMCPClient.callTool()` instead of the existing Rust MCP server path; return result as `MCPToolResult`-compatible object with `toolName`, `content`, `isError`, `latencyMs`
- [X] T023 [US2] Extend `formatToolResult()` in `src/core/services/chat.ts`: add case for `provider === 'now_assist'`: format `NowAssistToolResult.content` as a readable string suitable for injection into the chat context as a user/assistant pair; preserve existing formatting for other providers
- [X] T024 [US2] Add Now Assist attribution badge to `src/renderer/components/Message.tsx`: when `message.sender === 'servicenow_now_assist'`, render a small inline **Now Assist ✦** pill/badge immediately before the message content; style consistent with existing attribution labels (cloud LLM model name badge, web search provider chip); badge always visible — never hidden
- [X] T025 [US2] Implement graceful degradation in `src/core/services/chat.ts`: in the tool detection and execution loop, when a `provider:'now_assist'` tool is detected but `nowAssistConnected === false`, skip the tool call entirely; after local model streaming completes, append a system-level note to the response: `[Now Assist unavailable for this response — answered using local model only]`

### User Story 2 Validation Gates

**Automated Gates**:
- [ ] `pnpm test` — T017, T018 tests passing
- [ ] TypeScript strict: zero new errors
- [ ] Code coverage ≥80% for all US2 modified/created files
- [ ] Regression: US1 tests still passing

**Manual Gates**:
- [ ] Settings: enter valid Now Assist endpoint + token → Test Connection shows tool count
- [ ] Settings: save credentials → restart app → token persists in keychain; endpoint shown in UI
- [ ] Settings: clear credentials → `IPC.deleteApiKey` confirmed via keychain inspector
- [ ] Chat: ask question matching a Now Assist tool → response includes **Now Assist ✦** badge
- [ ] Chat: disconnect Now Assist in Settings → ask same question → local model responds alone with degradation note
- [ ] Dev tools inspection: no credential strings visible in network requests, console logs, or persisted messages

**Documentation**: Create `specs/002-security-nowassist-docs/us2-validation.md` with gate results

**Checkpoint**: US2 fully functional and independently testable

---

## Phase 5: User Story 3 — Full Application Documentation (Priority: P3)

**Goal**: Author comprehensive Markdown documentation in `docs/` covering installation, all features (chat, security tab, Now Assist), and troubleshooting with ≥6 common errors.

**Independent Test**: Follow the Getting Started guide from scratch on a clean machine; the user can connect to ServiceNow and send a chat message within 15 minutes without external support.

### Implementation

- [X] T026 [P] [US3] Author `docs/README.md`: application overview, feature summary (chat, security incidents dashboard, Now Assist integration), quick-link table to all guide sections, prerequisites at a glance
- [X] T027 [P] [US3] Author `docs/getting-started.md`: step-by-step from zero to working app — install Tauri prerequisites, clone/download app, `pnpm install && pnpm tauri dev`, create first profile, enter ServiceNow URL + credentials, select Ollama model, send first chat message; target: under 15 minutes end-to-end
- [X] T028 [P] [US3] Author `docs/configuration.md`: profile creation and management, ServiceNow URL and credential fields, Ollama endpoint and model selection, LLM provider selection (Ollama/OpenAI/Mistral) and API key setup, web search provider setup (Perplexity/Google/DuckDuckGo), Now Assist MCP section (endpoint URL format, auth mode choice between API Key and OAuth Bearer, where to find the ServiceNow MCP server sys_id)
- [X] T029 [P] [US3] Author `docs/features/chat.md`: chat interface overview, selecting the active LLM model from the dropdown, how MCP tool calling works (auto-detection, not requiring explicit commands), web search augmentation (when it triggers), understanding tool result cards in the chat, conversation history
- [X] T030 [P] [US3] Author `docs/features/security-tab.md`: the side-by-side split layout, incident list panel (filters by status and severity, what each column means, clicking to expand detail, affected CIs, comments), auto-refresh (default 5 min, how to change to 10 or 15 min, "last refreshed" timestamp), manual refresh button, resizing the divider, understanding the chat panel on the right
- [X] T031 [P] [US3] Author `docs/features/now-assist.md`: prerequisites (Yokohama instance, MCP Server Console plugin `sn_mcp_server` installed, tools assigned to a server record), how to find the server sys_id in the admin console, configuration in app Settings (choosing `API Key` vs `OAuth Bearer` mode), what happens when the local model invokes a Now Assist tool, reading the **Now Assist ✦** attribution badge, understanding graceful degradation when Now Assist is unavailable
- [X] T032 [US3] Author `docs/troubleshooting.md` with ≥6 documented errors, each covering: symptom, likely cause(s), step-by-step resolution:
  1. **ServiceNow 401 Unauthorized** — wrong credentials or URL; verify instance URL format `https://<instance>.service-now.com`, re-enter credentials
  2. **Now Assist "Test Connection" 404** — MCP server not activated or wrong endpoint path; verify `sn_mcp_server` plugin active, confirm server sys_id in Connection URL field of MCP Server Console record
  3. **Now Assist 401 with API Key** — `x-sn-apikey` auth requires `com.glide.tokenbased_auth` plugin active; verify plugin is installed on the instance
  4. **Ollama not responding** — Ollama not running or wrong port; verify `ollama serve` is running, check endpoint default `http://localhost:11434`
  5. **Incident list shows "Connection error"** — no active ServiceNow profile or network issue; confirm profile is set active in Settings, check VPN/network
  6. **No Now Assist tools in Settings after Test Connection** — MCP server connected but no tools assigned to the server role; configure tool packages in ServiceNow MCP Server Console admin UI
- [X] T033 [US3] Validate `docs/` against live app: read each documentation file and cross-check every described UI element, setting name, and menu path against the running application; fix any discrepancies found

### User Story 3 Validation Gates

**Automated Gates**:
- [ ] All documentation files exist with non-empty content (`docs/README.md`, `getting-started.md`, `configuration.md`, `features/chat.md`, `features/security-tab.md`, `features/now-assist.md`, `troubleshooting.md`)
- [ ] `troubleshooting.md` contains ≥6 documented errors

**Manual Gates**:
- [ ] Follow Getting Started guide from scratch on a clean environment — confirm works in ≤15 min
- [ ] Review each doc section against the running app — no documented feature is missing from the UI
- [ ] Now Assist setup steps in `docs/features/now-assist.md` verified against a Yokohama instance

**Documentation**: Create `specs/002-security-nowassist-docs/us3-validation.md` with gate results

**Checkpoint**: All user stories complete and independently testable

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end integration validation, performance measurement, final regression, and documentation sync.

- [X] T034 [P] Run `pnpm test` (full Vitest suite); confirm ≥80% code coverage across all new files; fix any failing tests or coverage gaps
- [X] T035 [P] Run `pnpm tsc --noEmit` (TypeScript strict) and `cd src-tauri && cargo clippy`; resolve all new warnings and errors
- [X] T036 Run full end-to-end integration scenario in the running app: open Security tab → incident list loads → expand an incident → ask chat question about that incident → Now Assist tool invoked → response attributed with **Now Assist ✦** badge → chat message persists after reload
- [X] T037 Measure and document performance benchmarks: time incident list initial load (must be <5 s), time incident detail render on row click (must be <1 s), confirm auto-refresh completes silently without blocking user interaction; document results in `specs/002-security-nowassist-docs/production-validation.md`
- [X] T038 Security review: inspect application logs during a Now Assist tool call and confirm no token, credentials, or sensitive headers appear; verify ServiceNow password field is masked; run `pnpm audit` and address any critical/high vulnerabilities
- [X] T039 Final documentation sync: after any changes during Phase 6, re-read all `docs/` files and confirm every described step, UI element, and setting still matches the final app state; update any stale content

### Final Validation Gates *(Production Readiness)*

**Automated Gates**:
- [ ] Full Vitest test suite passing (zero failures)
- [ ] Code coverage ≥80% across entire feature
- [ ] TypeScript strict: zero errors
- [ ] `cargo clippy`: zero warnings
- [ ] `pnpm audit`: no critical/high vulnerabilities

**Manual Gates**:
- [ ] Full end-to-end scenario validated (T036)
- [ ] Performance targets met and documented (T037)
- [ ] Security review complete (T038)
- [ ] Documentation verified accurate (T039)
- [ ] All phase validation documents created and reviewed

**Documentation**: `specs/002-security-nowassist-docs/production-validation.md` — final gate results and production readiness sign-off

**Production Ready**: Feature meets all constitution requirements

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    └─► Phase 2 (Foundation) ◄── BLOCKS ALL USER STORIES
            ├─► Phase 3 (US1 — P1) ← Can start immediately after Phase 2
            ├─► Phase 4 (US2 — P2) ← Can start after Phase 2; integrates Foundation service
            └─► Phase 5 (US3 — P3) ← Fully independent of US1/US2; can run in parallel
                        └─► Phase 6 (Polish) ← After all stories complete
```

### User Story Dependencies

| Story | Depends On | Notes |
|-------|-----------|-------|
| **US1** (Incident Dashboard) | Phase 2 only | Uses existing `executeMCPTool` — no US2 dependency |
| **US2** (Now Assist) | Phase 2 | Needs `NowAssistMCPClient` from Phase 2; independent of US1 |
| **US3** (Documentation) | All features done | Authors docs for final app state |

### Within Each Phase

- TDD tasks (T003, T004, T009, T010, T017, T018) MUST be written and FAIL before their implementation tasks
- DB schema (T005) should complete before repository (T006) which should complete before service (T007)
- Store extension (T008) can run in parallel with T005–T007
- US2 detection/routing tasks (T021–T025) can all run in parallel (different files)
- US3 documentation tasks (T026–T032) are ALL independent and can run in parallel

---

## Parallel Opportunities

### Phase 2 Parallel Execution

```
T003 [write NowAssistMCPClient tests]  ─┐
T004 [write settings integration tests] ─┤ All parallel
T005 [extend schema.ts]                 ─┤
T008 [extend Zustand store]             ─┘
     ↓
T006 [extend configuration repository]  ← depends on T005
T007 [implement NowAssistMCPClient]     ← after T003 (tests must exist)
```

### Phase 3 Parallel Execution

```
T009 [write IncidentListPanel unit tests]   ─┐ parallel
T010 [write security tab integration tests] ─┘
     ↓
T011 [create IncidentListPanel base]
T012 [add filter bar]          ← after T011
T013 [add row expansion]       ← after T011
T014 [add pagination]          ← after T011
T015 [add auto-refresh]        ← after T011
T016 [refactor SecurityPage]   ← after T011-T015 complete
```

### Phase 4 Parallel Execution

```
T017 [write chat service tests]          ─┐ parallel
T018 [write integration tests]           ─┘
     ↓
T019 [Settings NowAssistConfig component]  ─┐
T020 [auto-connect on profile load]        ─┘ parallel (different files)
     ↓
T021 [extend detectToolCallsFromMessage]  ─┐
T022 [extend executeMCPTool routing]      ─┤ parallel (different files)
T023 [extend formatToolResult]            ─┤
T024 [Now Assist badge in Message.tsx]    ─┘
     ↓
T025 [graceful degradation in chat.ts]   ← after T021-T023

```

### Phase 5 Parallel Execution

```
T026 [docs/README.md]                ─┐
T027 [docs/getting-started.md]       ─┤
T028 [docs/configuration.md]         ─┤ ALL PARALLEL
T029 [docs/features/chat.md]         ─┤
T030 [docs/features/security-tab.md] ─┤
T031 [docs/features/now-assist.md]   ─┘
     ↓
T032 [docs/troubleshooting.md]   ← after all feature docs done (reference them)
T033 [validate docs vs app]      ← after T032
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundation *(CRITICAL — blocks everything)*
3. Complete Phase 3: User Story 1 — Security Incidents Dashboard
4. **STOP and VALIDATE**: Security tab shows live incidents independently
5. Demo/ship as MVP increment

### Incremental Delivery

1. Phase 1 + Phase 2 → Foundation ready
2. + Phase 3 → Security tab incident dashboard → **Demo and validate independently**
3. + Phase 4 → Now Assist chat integration → **Demo and validate independently**
4. + Phase 5 → App documentation → **All stories delivered**
5. + Phase 6 → Production-ready release

### Parallel Team Strategy

With 2+ developers after Phase 2 completes:
- **Dev A**: Phase 3 (US1 — Incident Dashboard)
- **Dev B**: Phase 4 (US2 — Now Assist integration)
- **Dev C** (or later): Phase 5 (US3 — Documentation, can begin once US1+US2 are feature-complete)

---

## Notes

- **[P]** = different files, no shared state dependency — safe to implement in parallel
- **[US1/US2/US3]** maps each task to a user story for traceability to `spec.md`
- TDD is NON-NEGOTIABLE per constitution: tests must FAIL before implementation, PASS after
- `NowAssistMCPClient` is a singleton — one instance per active profile
- Never hardcode Now Assist tool names — they are discovered dynamically via `listTools()`
- ServiceNow API Key auth uses `x-sn-apikey` header, NOT `Authorization: Bearer`
- `'servicenow_now_assist'` sender enum already in DB — no message table migration needed
- `phi3:mini` is too small for reliable Now Assist tool routing — use `mistral:7b` or cloud LLM
- Commit after each task or logical group to maintain clean git history
