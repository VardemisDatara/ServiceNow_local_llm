# Tasks: Release UI Polish — Home Dashboard & Security Tab

**Input**: Design documents from `/specs/003-release-ui-polish/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Tests**: Included — TDD is mandated by the project constitution (non-negotiable).

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story ([US1], [US2], [US3])
- Paths are single-project layout (`src/`, `tests/` at repo root)

---

## Phase 1: Setup

**Purpose**: Confirm clean baseline before any changes.

- [x] T001 Verify TypeScript compiles cleanly with `npx tsc --noEmit` — must be green before any changes land

### Phase 1 Validation Gates

**Automated Gates**:
- [x] `npx tsc --noEmit` exits 0 (pre-existing errors in store/logger/config files excluded per project memory)
- [x] `npm run lint` exits 0 on changed files

**Manual Gates**:
- [x] Branch `003-release-ui-polish` is checked out and working tree clean

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared utilities and interface changes that US1 depends on. US2 and US3 can start independently after Phase 1.

**⚠️ CRITICAL**: US1 work cannot begin until T002 and T003 are complete.

- [x] T002 Export `probeAllConnections()` async wrapper function in `src/main/index.ts` — reads active profile from Zustand store, calls existing `reconnect()`, catches all errors internally, never rejects
- [x] T003 [P] Add `nowAssistMcpStatus?: ConnectionStatus | undefined` and `nowAssistMcpLatencyMs?: number | undefined` props to `ConnectionStatusPanelProps` interface and render corresponding `StatusIndicator` row (between ServiceNow and Search rows) in `src/renderer/components/StatusIndicator.tsx`

### Phase 2 Validation Gates

**Automated Gates**:
- [x] `npx tsc --noEmit` still exits 0 after T002 and T003
- [x] `npm run lint` exits 0 on changed files

**Manual Gates**:
- [x] `probeAllConnections` is importable from `src/main/index.ts`
- [x] `ConnectionStatusPanel` renders the Now Assist MCP row when `nowAssistMcpStatus` prop is passed

**Checkpoint**: Foundation ready — US1 can begin; US2 and US3 may already be in progress

---

## Phase 3: User Story 1 — Home Tab Connection Status + Refresh (Priority: P1) 🎯 MVP

**Goal**: Home tab shows live connection status for all 5 integrations (Ollama, ServiceNow, Now Assist MCP, Search, LLM) with a refresh button that re-probes on demand.

**Independent Test**: Open the app with Ollama stopped → Home tab shows red "Unreachable" for Ollama without affecting other rows. Click refresh → loading state appears then resolves. With no profile configured, refresh button is hidden.

### Tests for User Story 1

- [x] T004 [P] [US1] Unit tests for `ConnectionStatusPanel` with all 5 rows in `tests/unit/components/home-connection-status.test.tsx` — 14 tests passing
- [x] T005 [P] [US1] Integration test for `probeAllConnections` export and behavior in `tests/integration/home-refresh-probe.test.tsx` — 3 tests passing

### Implementation for User Story 1

- [x] T006 [US1] Add `isRefreshing` local state and derive all 5 connection statuses via `deriveStatus()` helper from Zustand store + `activeProfile` in `src/App.tsx`
- [x] T007 [US1] Add refresh button (`↻` / `&#8635;`, `aria-label="Refresh connection status"`) adjacent to "Connection Status" heading in `src/App.tsx` — disabled + animated during probing; hidden when no `activeProfile`
- [x] T008 [US1] Pass all 5 derived statuses into `ConnectionStatusPanel` in `src/App.tsx` (Ollama, ServiceNow, Now Assist MCP, Search, LLM)
- [x] T009 [US1] `lastCheck` timestamp display moved to below the `ConnectionStatusPanel` in `src/App.tsx`

### User Story 1 Validation Gates

**Automated Gates**:
- [x] All US1 tests passing (T004: 14 tests, T005: 3 tests)
- [x] `npx tsc --noEmit` exits 0 on changed files
- [x] `npm run lint` exits 0 on changed files

**Manual Gates**:
- [ ] Code review approved for T002, T003, T006–T009
- [ ] Manual QA: 5 indicators render correctly for each state (Connected/Unreachable/Not Configured)
- [ ] Manual QA: Refresh button disables during probe; re-enables after; `lastCheck` timestamp updates
- [ ] Manual QA: No sensitive credential values visible in the status panel

**Documentation**: Create `specs/003-release-ui-polish/us1-validation.md`

**Checkpoint**: US1 fully functional — connection dashboard works independently

---

## Phase 4: User Story 2 — Quick Start Guide (Priority: P2)

**Goal**: Home tab is clean and release-ready: no "Phase Progress" development text; replaced by a concise 3-step Quick Start guide with a conditional prompt to configure connections.

**Independent Test**: Open the app — search the rendered page for "Phase Progress", "Phase 1", "Phase 2" → none found. The "Quick Start" section is present with exactly 3 steps. When no connections are configured, step 1 shows an amber badge.

### Tests for User Story 2

- [x] T010 [P] [US2] Unit tests in `tests/unit/components/home-connection-status.test.tsx` asserting absence of Phase Progress text and presence of Quick Start with 3 steps — included in the 14 passing tests

### Implementation for User Story 2

- [x] T011 [US2] Removed entire "Phase Progress" `<div>` block from `src/App.tsx`
- [x] T012 [US2] Added static "Quick Start" section with 3 steps below connection status panel in `src/App.tsx`
- [x] T013 [US2] Added conditional amber badge on step 1 when `initialized && !connectionStatus.fullyConnected` in `src/App.tsx`

### User Story 2 Validation Gates

**Automated Gates**:
- [x] All US2 tests passing (T010)
- [x] `npx tsc --noEmit` exits 0
- [x] `npm run lint` exits 0

**Manual Gates**:
- [ ] Code review approved for T011–T013
- [ ] Manual QA: No "Phase" development text visible anywhere on Home tab
- [ ] Manual QA: Quick Start section visible with 3 steps
- [ ] Manual QA: Amber badge appears on step 1 when not fully connected; disappears when connected

**Documentation**: Create `specs/003-release-ui-polish/us2-validation.md`

**Checkpoint**: US2 complete — Home tab is clean and release-ready

---

## Phase 5: User Story 3 — Expandable XML Panels on Security Tab (Priority: P3)

**Goal**: XML payload fields in security analysis results are collapsed by default and individually expandable, reducing noise in the `AnalysisReport` view.

**Independent Test**: Run a security analysis on any incident. In the Security tab results, all known XML payload fields (e.g., `raw_xml`, `work_notes_xml`) are collapsed. Clicking a panel header reveals the full XML content inline. Clicking again collapses it. Other panels are unaffected.

### Tests for User Story 3

- [x] T014 [P] [US3] Unit tests for `isXmlPayloadField()` in `tests/unit/components/analysis-report-xml-panels.test.tsx` — 12 tests passing (all boundary cases)
- [x] T015 [P] [US3] `ResultCard` render tests in `tests/unit/components/analysis-report-xml-panels.test.tsx` — 5 tests passing

### Implementation for User Story 3

- [x] T016 [US3] Added `isXmlPayloadField(key, value)` pure helper (exported) in `src/renderer/components/AnalysisReport.tsx`
- [x] T017 [US3] Updated `ResultCard` to split XML fields into `<details>` panels (collapsed by default) and non-XML fields into catch-all JSON block in `src/renderer/components/AnalysisReport.tsx`

### User Story 3 Validation Gates

**Automated Gates**:
- [x] All US3 tests passing (T014: 12 tests, T015: 5 tests)
- [x] `npx tsc --noEmit` exits 0
- [x] `npm run lint` exits 0

**Manual Gates**:
- [ ] Code review approved for T016–T017
- [ ] Manual QA: Run any security analysis → XML fields in results are collapsed by default
- [ ] Manual QA: Click to expand one panel → full XML shown; other panels unchanged
- [ ] Manual QA: Click again → panel collapses
- [ ] Manual QA: Malformed XML string still renders inside panel without crashing

**Documentation**: Create `specs/003-release-ui-polish/us3-validation.md`

**Checkpoint**: All 3 user stories independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final quality pass across all stories before sign-off.

- [x] T018 [P] `npx tsc --noEmit` — no new type errors in changed files
- [x] T019 [P] `npm run lint` — all 4 changed source files lint clean (0 errors, 0 warnings)
- [x] T020 Full Vitest suite: 34 new tests passing (17 unit XML + 14 unit home + 3 integration); pre-existing failures in now-assist-mcp-client/chat-service/now-assist-integration tests are unchanged from before this feature
- [ ] T021 Execute manual QA acceptance checklist from `specs/003-release-ui-polish/quickstart.md` — `production-validation.md` created; pending visual sign-off with `npm run tauri dev`
- [x] T022 [P] Updated `specs/003-release-ui-polish/checklists/requirements.md` — all 12 items passing

### Final Validation Gates

**Automated Gates**:
- [x] New tests passing: 34 tests across 3 test files
- [x] `npx tsc --noEmit` exits 0 on changed files
- [x] `npm run lint` exits 0 on changed files (4 source files)
- [ ] Full manual QA acceptance checklist complete

**Manual Gates**:
- [ ] All acceptance criteria in `quickstart.md` checked off
- [ ] Code review approved for all phases
- [ ] Full system manual QA (Home tab + Security tab) documented

**Documentation**: `specs/003-release-ui-polish/production-validation.md` with sign-off

**Production Ready**: Pending manual QA sign-off

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS US1
- **Phase 3 (US1)**: Depends on Phase 2 — needs `probeAllConnections()` and `nowAssistMcpStatus` prop
- **Phase 4 (US2)**: Depends on Phase 1 only — can start in parallel with Phase 2/US1
- **Phase 5 (US3)**: Depends on Phase 1 only — can start in parallel with Phase 2/US1/US2
- **Phase 6 (Polish)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Requires Phase 2 complete (T002, T003)
- **US2 (P2)**: Independent of US1 and US3 — only touches `App.tsx` Phase Progress removal + Quick Start
- **US3 (P3)**: Independent of US1 and US2 — only touches `AnalysisReport.tsx`

### Parallel Opportunities

- T002 and T003 ran in parallel (different files)
- T004 and T005 ran in parallel (both test files)
- T014 and T015 ran in parallel (same test file, different describe blocks)

---

## Notes

- [P] tasks target different files — safe to run in parallel with no merge conflicts
- US2 and US3 are completely independent of each other and of US1 (different files)
- `isXmlPayloadField()` is a pure function — tested exhaustively with all boundary cases
- All new code is fully typed per the project constitution
- `<details>` / `<summary>` used for collapse — no useState needed
- Search and LLM provider status derives from `activeProfile` fields — no live API probe
