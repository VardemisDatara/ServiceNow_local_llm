# Tasks: ServiceNow Branding & Visual Identity

**Input**: Design documents from `/specs/001-sn-branding/`
**Prerequisites**: spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Tests**: Included — TDD is mandated by the project constitution (non-negotiable).

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story ([US1], [US2])
- Paths are single-project layout (`src/`, `tests/` at repo root)

---

## Phase 1: Setup

**Purpose**: Confirm clean baseline and add the logo asset before any code changes.

- [X] T001 Verify `npx tsc --noEmit` exits 0 (pre-existing errors in store/logger/config files excluded per project memory) — must be green before any changes land
- [X] T002 Source the ServiceNow logo SVG from official brand assets and place it at `src/assets/servicenow-logo.svg` (vector format, ≤50KB, renders cleanly at 28px height)

### Phase 1 Validation Gates

**Automated Gates**:
- [ ] `npx tsc --noEmit` exits 0
- [ ] `src/assets/servicenow-logo.svg` exists and is a valid SVG file

**Manual Gates**:
- [ ] Branch `001-sn-branding` is checked out and working tree clean
- [ ] Logo SVG renders correctly at 28px height in a browser preview

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create `src/renderer/theme.ts` — the single source of truth for brand colors that both US1 and US2 depend on.

**⚠️ CRITICAL**: US1 and US2 cannot begin until T003 is complete.

- [X] T003 Create `src/renderer/theme.ts` exporting `SN_THEME` constant with all brand tokens (`navBackground: '#293e40'`, `navActiveBackground: '#62d84e'`, `navActiveText: '#293e40'`, `navText: '#ffffff'`, `primaryButton: '#62d84e'`, `primaryButtonText: '#293e40'`) and semantic tokens (`statusConnected`, `statusFailed`, `statusUnknown`, `statusConnecting`, `statusDegraded`) per `contracts/component-interfaces.md`

### Phase 2 Validation Gates

**Automated Gates**:
- [ ] `npx tsc --noEmit` still exits 0 after T003
- [ ] `npm run lint` exits 0 on `src/renderer/theme.ts`

**Manual Gates**:
- [ ] `SN_THEME` is importable and all keys present
- [ ] Semantic color tokens match existing values in `StatusIndicator.tsx`

**Checkpoint**: Foundation ready — US1 and US2 can proceed (in parallel if desired)

---

## Phase 3: User Story 1 — App Rename & Logo (Priority: P1) 🎯 MVP

**Goal**: Replace "ServiceNow MCP Bridge" with "ServiceNow Local LLM" everywhere in the visible UI. Add the ServiceNow logo to the nav bar with a graceful `onError` fallback.

**Independent Test**: Open the app → nav bar shows ServiceNow logo and "ServiceNow Local LLM". OS window title reads "ServiceNow Local LLM". Search entire rendered UI for "MCP Bridge" → zero results.

### Tests for User Story 1

- [X] T004 [P] [US1] Write unit tests for nav bar branding in `tests/unit/components/app-branding.test.tsx` — assert: renders "ServiceNow Local LLM" text, renders `<img alt="ServiceNow">`, `onError` sets `display:none` on img, no "MCP Bridge" text anywhere in rendered output (minimum 5 tests)

### Implementation for User Story 1

- [X] T005 [US1] Update `src/App.tsx` nav bar: add logo `<img src={servicenowLogoUrl} alt="ServiceNow" height={28} onError={...}>` to the left of the `<h1>`, change `<h1>` text to "ServiceNow Local LLM", import logo via `import servicenowLogoUrl from './assets/servicenow-logo.svg'`
- [X] T006 [P] [US1] Update `src-tauri/tauri.conf.json`: set `productName` to `"servicenow-local-llm"` and `app.windows[0].title` to `"ServiceNow Local LLM"`
- [X] T007 [P] [US1] Update logger init message in `src/main/index.ts` line 15: `'Initializing ServiceNow MCP Bridge...'` → `'Initializing ServiceNow Local LLM...'`

### User Story 1 Validation Gates

**Automated Gates**:
- [ ] All US1 tests passing (T004: ≥5 tests)
- [ ] `npx tsc --noEmit` exits 0 on changed files
- [ ] `npm run lint` exits 0 on changed files

**Manual Gates**:
- [ ] Code review approved for T005–T007
- [ ] Manual QA: nav bar shows logo and "ServiceNow Local LLM" on every tab
- [ ] Manual QA: OS window/title bar reads "ServiceNow Local LLM"
- [ ] Manual QA: no "MCP Bridge" text visible anywhere in the UI

**Documentation**: Create `specs/001-sn-branding/us1-validation.md`

**Checkpoint**: US1 fully functional — rename and logo work independently

---

## Phase 4: User Story 2 — ServiceNow Brand Theme (Priority: P2)

**Goal**: Apply ServiceNow brand colors to all interactive/navigation elements. Nav bar is dark teal (`#293e40`), active tab and primary buttons use bright green (`#62d84e`) with dark text. Semantic status colors (green/red/gray dots) are preserved unchanged.

**Independent Test**: Open the app → nav bar background is dark teal, active tab highlight is bright green with dark text, connection status dots are unchanged. No `#10b981` remains on brand-relevant interactive elements.

### Tests for User Story 2

- [X] T008 [P] [US2] Write unit tests for theme constants in `tests/unit/theme.test.ts` — assert: all required `SN_THEME` keys exported; `navBackground === '#293e40'`; `navActiveBackground === '#62d84e'`; `navActiveText === '#293e40'`; `statusConnected === '#10b981'` (semantic unchanged); white-on-navBackground WCAG contrast ≥ 4.5:1; navActiveText-on-navActiveBackground contrast ≥ 4.5:1 (minimum 8 tests)

### Implementation for User Story 2

- [X] T009 [US2] Update `src/App.tsx` `navButtonStyle()`: replace `backgroundColor: active ? '#10b981' : 'transparent'` with `SN_THEME.navActiveBackground` / `'transparent'`; replace `color: active ? '#ffffff' : '#374151'` with `SN_THEME.navActiveText` / `SN_THEME.navText`; replace nav `<nav>` `backgroundColor: '#ffffff'` with `SN_THEME.navBackground`; update `<h1>` color to `SN_THEME.navText`
- [X] T010 [P] [US2] Update `src/renderer/components/ConversationList.tsx`: replace active indicator dot `color: '#10b981'` with `SN_THEME.navActiveBackground`; import `SN_THEME` from `../../renderer/theme`
- [X] T011 [P] [US2] Update `src/renderer/components/IncidentListPanel.tsx`: replace active filter button border/color `#10b981`/`#065f46` with `SN_THEME.navActiveBackground`/`SN_THEME.navActiveText`; replace selected incident left border `#10b981` with `SN_THEME.navActiveBackground`; replace "Analyze" button background `#10b981` with `SN_THEME.primaryButton` and add `color: SN_THEME.primaryButtonText`; import `SN_THEME`

### User Story 2 Validation Gates

**Automated Gates**:
- [ ] All US2 tests passing (T008: ≥8 tests)
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0

**Manual Gates**:
- [ ] Code review approved for T009–T011
- [ ] Manual QA: nav bar background is dark teal on every tab
- [ ] Manual QA: active tab is green with dark legible text (not white text on green)
- [ ] Manual QA: connection status dots (green/red/gray) are visually identical to pre-branding baseline
- [ ] Manual QA: Analyze button uses brand green; filter buttons highlight in brand green

**Documentation**: Create `specs/001-sn-branding/us2-validation.md`

**Checkpoint**: Both user stories independently functional

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final quality pass before sign-off.

- [X] T012 [P] `npx tsc --noEmit` — no new type errors across all changed files
- [X] T013 [P] `npm run lint` — all changed source files lint clean (0 errors, 0 warnings)
- [X] T014 Full Vitest suite — all new tests passing; pre-existing failures unchanged from baseline
- [ ] T015 Execute manual QA acceptance checklist from `specs/001-sn-branding/quickstart.md` and document results in `specs/001-sn-branding/production-validation.md`

### Final Validation Gates

**Automated Gates**:
- [ ] New tests passing (T004: ≥5 tests, T008: ≥8 tests)
- [ ] `npx tsc --noEmit` exits 0 on changed files
- [ ] `npm run lint` exits 0 on all changed files

**Manual Gates**:
- [ ] All acceptance criteria in `quickstart.md` checked off
- [ ] Code review approved for all phases
- [ ] Full system manual QA (every tab, logo, colors, status dots) documented

**Documentation**: `specs/001-sn-branding/production-validation.md` with sign-off

**Production Ready**: Pending manual QA sign-off

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS both US1 and US2 (both need `SN_THEME`)
- **Phase 3 (US1)**: Depends on Phase 2; T005 and T006/T007 can run in parallel after T003
- **Phase 4 (US2)**: Depends on Phase 2 only — can run in parallel with Phase 3 (different files)
- **Phase 5 (Polish)**: Depends on both US1 and US2 complete

### User Story Dependencies

- **US1 (P1)**: Requires `SN_THEME` (T003). Touches `App.tsx`, `tauri.conf.json`, `main/index.ts`
- **US2 (P2)**: Requires `SN_THEME` (T003). Touches `App.tsx` (different lines), `ConversationList.tsx`, `IncidentListPanel.tsx`
- **Note**: Both US1 and US2 touch `App.tsx` — if run in parallel, coordinate the `App.tsx` edits

### Parallel Opportunities

- T004 (US1 tests) and T008 (US2 tests) can be written in parallel (different files)
- T006 and T007 are parallel (different files)
- T010 and T011 are parallel (different component files)

---

## Notes

- [P] tasks target different files — safe to run in parallel with no merge conflicts
- `SN_THEME.navActiveText` (`#293e40`) on `SN_THEME.navActiveBackground` (`#62d84e`) → WCAG AA contrast ~7.3:1 ✓
- White (`#ffffff`) on `SN_THEME.navBackground` (`#293e40`) → WCAG AA contrast ~10.1:1 ✓
- Do NOT change `StatusIndicator.tsx` `STATUS_COLORS` — those are semantic, not brand
- Do NOT change `WorkflowProgress.tsx` done/progress colors — semantic completion indicators
- Inactive nav button text: use `SN_THEME.navText` (`#ffffff`) with `opacity: 0.8` for subtle distinction from active
