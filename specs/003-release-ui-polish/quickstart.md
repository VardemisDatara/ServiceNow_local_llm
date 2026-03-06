# Developer Quickstart: Release UI Polish

**Feature**: 003-release-ui-polish
**Branch**: `003-release-ui-polish`
**Date**: 2026-03-06

## What This Feature Does

Three targeted UI polish changes for the release version:

1. **Home tab** — Full connection status dashboard (Ollama, ServiceNow, ServiceNow MCP, Search/LLM) with a live-probe refresh button, replacing the development "Phase Progress" list with a user-friendly Quick Start guide.
2. **Security tab** — XML payload fields in analysis results are collapsed by default and expandable on demand.

## Files to Touch

| File | What changes |
|------|-------------|
| `src/App.tsx` | Remove Phase Progress; add refresh button + Quick Start; wire all 5 connection statuses |
| `src/main/index.ts` | Export `probeAllConnections()` |
| `src/renderer/components/StatusIndicator.tsx` | Add `nowAssistMcpStatus` prop + row to `ConnectionStatusPanel` |
| `src/renderer/components/AnalysisReport.tsx` | Add `isXmlPayloadField()` helper + `<details>` rendering in `ResultCard` |

**No Rust changes. No DB migrations. No new dependencies.**

## Implementation Order (TDD — write tests first)

### Story 1: Home Connection Status + Refresh (P1)

1. **Write tests** for `ConnectionStatusPanel` with `nowAssistMcpStatus` prop (`tests/unit/components/home-connection-status.test.tsx`)
2. **Write integration test** for refresh button probe trigger (`tests/integration/home-refresh-probe.test.tsx`)
3. Verify tests fail
4. Implement `probeAllConnections()` export in `src/main/index.ts`
5. Extend `ConnectionStatusPanel` with `nowAssistMcpStatus` prop
6. Update `App.tsx` home page: wire refresh button + all 5 status props
7. Verify tests pass

### Story 2: Quick Start Guide (P2)

1. **Write test** verifying Phase Progress content is absent and Quick Start content is present
2. Verify test fails
3. Remove Phase Progress `<div>` from `App.tsx`
4. Add Quick Start section below connection status panel
5. Verify tests pass

### Story 3: Expandable XML Panels (P3)

1. **Write unit tests** for `isXmlPayloadField()` helper (pure function — easy to test)
2. **Write component tests** for `ResultCard` XML panel rendering (`tests/unit/components/analysis-report-xml-panels.test.tsx`)
3. Verify tests fail
4. Implement `isXmlPayloadField()` and update `ResultCard` rendering in `AnalysisReport.tsx`
5. Verify tests pass

## Key Contracts

See `contracts/component-interfaces.md` for full prop/behaviour definitions.

## Running Tests

```bash
# Unit + integration tests
npm run test

# Specific test files
npx vitest run tests/unit/components/home-connection-status.test.tsx
npx vitest run tests/unit/components/analysis-report-xml-panels.test.tsx
npx vitest run tests/integration/home-refresh-probe.test.tsx

# Full lint pass
npm run lint
```

## Acceptance Checklist

- [ ] Home tab shows 5 connection indicators (Ollama, ServiceNow, ServiceNow MCP, Search, LLM)
- [ ] "Not Configured" (grey) shown when endpoint/key not set; "Unreachable" (red) when probe fails
- [ ] Refresh button (↻) triggers live probes and shows loading state while running
- [ ] No "Phase Progress" text visible anywhere on Home tab
- [ ] "Quick Start" section visible with 3 steps; step 1 has amber badge when not fully configured
- [ ] Security tab XML fields collapsed by default; click to expand; multiple panels toggle independently
- [ ] All tests passing; coverage ≥ 80% on changed files
- [ ] No TypeScript errors on changed files

## Gotchas

- `ConnectionStatus` type already has `unknown`, `connecting`, `connected`, `failed`, `degraded` — no new literals needed.
- `nowAssistConnected` from the Zustand store is already tracked by the MCP client — just read it, no extra probe needed.
- Search and LLM show "Connected" when a provider + key is stored (no live API ping — avoids cost/rate-limit on status check).
- `<details>` / `<summary>` is the chosen HTML pattern for collapsible XML — no third-party component library needed.
- `isXmlPayloadField()` must check BOTH the field name convention AND that the value starts with `<`. Field name alone is insufficient.
