# Implementation Plan: Release UI Polish — Home Dashboard & Security Tab

**Branch**: `003-release-ui-polish` | **Date**: 2026-03-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-release-ui-polish/spec.md`

## Summary

Polish the Home tab and Security tab for release. The Home tab gets a live five-connection status dashboard (Ollama, ServiceNow, Now Assist MCP, Search, LLM) with a refresh button, and replaces the internal development "Phase Progress" list with a user-facing Quick Start guide. The Security tab makes XML payload fields in analysis results collapsible by default, reducing visual noise. No backend changes, no DB migrations, no new dependencies.

## Technical Context

**Language/Version**: TypeScript 5.x (renderer), React 18
**Primary Dependencies**: React 18, Zustand 5.x (already installed), native HTML `<details>` / `<summary>` for collapsible panels — no new packages
**Storage**: N/A — no database changes
**Testing**: Vitest + React Testing Library (existing setup)
**Target Platform**: Tauri v2.0 desktop app (macOS primary)
**Performance Goals**: Refresh probe completes within 2s; XML collapse/expand transition under 300ms
**Constraints**: On-demand probes only (no background polling); no new Rust/Tauri commands
**Scale/Scope**: 4 files changed; 3 new test files; ~3 user stories

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Code Quality Standards
- [x] Type safety strategy defined — TypeScript strict mode throughout; `ConnectionStatus` type reused unchanged; `isXmlPayloadField` is fully typed
- [x] Error handling documented — `probeAllConnections()` catches all errors internally; never rejects; logs failures
- [x] Security considerations documented — No credentials displayed in Home tab status panel (FR-009); no new input validation boundaries
- [x] Dependency justification documented — Zero new dependencies; native `<details>` used for collapsible panels

### II. Testing First
- [x] TDD workflow planned — tests written before implementation per story order in quickstart.md
- [x] Test types identified: Unit (component props/rendering), Integration (refresh button triggers probe), Manual (visual QA of all three stories)
- [x] Test coverage target: ≥80% on all changed files
- [x] Manual test plan documented in quickstart.md acceptance checklist

### III. User Experience Consistency
- [x] UI/UX patterns identified — existing `StatusIndicator` / `ConnectionStatusPanel` pattern extended; native `<details>` for XML panels
- [x] Feedback mechanisms defined — refresh button shows loading state; probe renders within 2s
- [x] Accessibility documented — refresh button has `aria-label`; `<details>` is natively keyboard-accessible and announces state to screen readers; WCAG 2.1 AA
- [x] Error recovery defined — probe failure shows "Unreachable" (red); user can retry via refresh button

### IV. Performance Standards
- [x] Response time targets defined — probes within 2s; XML collapse/expand under 300ms
- [x] Resource limits documented — on-demand probes only; no background polling
- [x] Scalability — N/A (single-user desktop app)
- [x] Monitoring — existing app logger captures probe results

### V. Phase Validation Gates
- [x] Automated gates — Vitest (all tests passing), TypeScript compiler (no errors), ESLint
- [x] Manual gates — visual QA per acceptance checklist in quickstart.md
- [x] Gate documentation — test results and sign-off stored in specs/003-release-ui-polish/

**No constitution violations.** Complexity Tracking table not required.

## Project Structure

### Documentation (this feature)

```text
specs/003-release-ui-polish/
├── plan.md                        # This file
├── spec.md                        # Feature specification
├── research.md                    # Phase 0 output
├── data-model.md                  # Phase 1 output
├── quickstart.md                  # Phase 1 output
├── contracts/
│   └── component-interfaces.md   # Phase 1 output
├── checklists/
│   └── requirements.md
└── tasks.md                       # Phase 2 output (/speckit.tasks — not yet created)
```

### Source Code Changes

```text
src/
├── App.tsx                                          # Home tab: refresh button, Quick Start, 5 statuses
├── main/
│   └── index.ts                                     # Export probeAllConnections()
└── renderer/
    └── components/
        ├── StatusIndicator.tsx                      # Add nowAssistMcpStatus prop + row
        └── AnalysisReport.tsx                       # XML collapsible panels in ResultCard

tests/
├── unit/
│   └── components/
│       ├── home-connection-status.test.tsx          # NEW: ConnectionStatusPanel with all 5 rows
│       └── analysis-report-xml-panels.test.tsx      # NEW: isXmlPayloadField + ResultCard XML rendering
└── integration/
    └── home-refresh-probe.test.tsx                  # NEW: refresh button triggers probeAllConnections
```

**Structure Decision**: Single project layout (existing). All changes are in `src/` renderer layer and `tests/`. No new directories required.

## Implementation Phases

### Phase 1 Foundation — Shared Utilities (Blocking)

**Deliverables**:
- `probeAllConnections()` exported from `src/main/index.ts`
- `ConnectionStatusPanel` extended with `nowAssistMcpStatus` prop in `StatusIndicator.tsx`
- Unit tests for the extended `ConnectionStatusPanel` passing

**Gate**: TypeScript compiler clean on changed files; unit tests for `ConnectionStatusPanel` passing.

### Phase 2 Story Implementation

#### Story 1 (P1) — Home Tab Connection Status + Refresh

**Changes**: `src/App.tsx`
- Wire all 5 connection statuses into `ConnectionStatusPanel` (Ollama, ServiceNow, Now Assist MCP, Search, LLM)
- Add `isRefreshing` local state; refresh `↻` button calls `probeAllConnections()` and sets loading state
- Derive "Not Configured" / "Unreachable" / "Connected" from store state + `activeProfile`

**Gate**: Unit + integration tests passing; manual QA (all 5 indicators render; refresh button disables during probe).

#### Story 2 (P2) — Quick Start Guide

**Changes**: `src/App.tsx`
- Remove Phase Progress `<div>` block (lines ~141–154)
- Add Quick Start section with 3 static steps below the connection status panel
- Step 1 shows amber badge when `!fullyConnected && initialized`

**Gate**: Test verifying Phase Progress content absent and Quick Start content present; manual QA.

#### Story 3 (P3) — Expandable XML Panels

**Changes**: `src/renderer/components/AnalysisReport.tsx`
- Add `isXmlPayloadField(key, value)` pure helper function
- Update `ResultCard` to render matching fields as `<details>` panels instead of inline JSON

**Gate**: Unit tests for `isXmlPayloadField` (all boundary cases); `ResultCard` render tests; manual QA with real analysis result.

### Phase 3 Integration & Polish

- Full regression test run (`npm run test`)
- TypeScript and ESLint clean pass
- Manual QA of all three stories end-to-end
- Update `checklists/requirements.md` with final pass/fail status
