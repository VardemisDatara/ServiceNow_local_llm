# Production Validation: Release UI Polish — Home Dashboard & Security Tab

**Feature**: 003-release-ui-polish
**Branch**: `003-release-ui-polish`
**Date**: 2026-03-06
**Validator**: Claude Sonnet 4.6 (automated gates) + Manual QA (pending)

---

## Automated Gate Results

### Test Suite

| Test File | Tests | Result |
|-----------|-------|--------|
| `tests/unit/components/home-connection-status.test.tsx` | 14 | PASS |
| `tests/unit/components/analysis-report-xml-panels.test.tsx` | 17 | PASS |
| `tests/integration/home-refresh-probe.test.tsx` | 3 | PASS |
| **Total new tests** | **34** | **PASS** |

Pre-existing failures (now-assist-mcp-client, chat-service-now-assist, now-assist-integration): unchanged from baseline — not caused by this feature.

### TypeScript

`npx tsc --noEmit` — no new type errors in changed files.

Pre-existing errors in `playwright.config.ts`, `src/core/integrations/servicenow.ts`, `src/renderer/store/index.ts`, `src/utils/logger.ts` remain and are excluded per project constitution.

### ESLint

`npm run lint` — all 4 changed source files lint clean (0 errors, 0 warnings).

Changed files:
- `src/main/index.ts`
- `src/renderer/components/StatusIndicator.tsx`
- `src/App.tsx`
- `src/renderer/components/AnalysisReport.tsx`

---

## Implementation Summary

### US1 — Home Tab Connection Status + Refresh

- `probeAllConnections()` exported from `src/main/index.ts`; reads active profile from Zustand store, calls `reconnect()`, never rejects
- `ConnectionStatusPanel` extended with `nowAssistMcpStatus` and `nowAssistMcpLatencyMs` props; renders "ServiceNow MCP" row between ServiceNow and Search rows
- `App.tsx` home page:
  - `deriveStatus(connected, hasEndpoint)` helper maps booleans to `ConnectionStatus`
  - All 5 statuses passed to `ConnectionStatusPanel` (Ollama, ServiceNow, Now Assist MCP, Search, LLM)
  - Refresh button (`↻`) with spin animation, disabled during probe, hidden when no `activeProfile`
  - `lastCheck` timestamp displayed below panel

### US2 — Quick Start Guide

- "Phase Progress" `<div>` removed from `App.tsx`
- Static "Quick Start" section added with 3 steps:
  1. Configure your connections (with conditional amber badge when `initialized && !connectionStatus.fullyConnected`)
  2. Start a chat
  3. Run a security analysis

### US3 — Expandable XML Panels on Security Tab

- `isXmlPayloadField(key, value)` pure helper exported from `AnalysisReport.tsx`; requires BOTH `_xml` suffix (or known-field list) AND value starting with `<`
- `ResultCard` splits result data into XML entries (`<details>` panels, collapsed by default) and non-XML data (JSON block)
- `<summary>` has `aria-label` for accessibility; no JS state required (native HTML)

---

## Manual QA Checklist

The following items require visual verification with `npm run tauri dev`:

### Home Tab

- [ ] 5 connection indicators render: Ollama, ServiceNow, ServiceNow MCP, Search, LLM
- [ ] "Not Configured" (grey dot) shown for integrations with no endpoint/key set
- [ ] "Unreachable" (red dot) shown when probe fails (e.g. stop Ollama, click Refresh)
- [ ] "Connected" (green dot) shown for active connections
- [ ] Refresh button (`↻`) visible when a profile is configured
- [ ] Refresh button hidden when no profile exists
- [ ] Refresh button shows spin animation and "Checking..." text while probing
- [ ] Refresh button re-enables and timestamp updates after probe completes
- [ ] No "Phase Progress", "Phase 1", "Phase 2" text visible anywhere on Home tab
- [ ] "Quick Start" section visible with exactly 3 numbered steps
- [ ] Amber badge on step 1 when not fully connected; badge absent when fully connected
- [ ] No sensitive credential values visible in status panel

### Security Tab

- [ ] Run any security analysis on a SIR or INC incident
- [ ] XML payload fields in results are collapsed by default
- [ ] Clicking a panel header expands and shows full XML content inline
- [ ] Clicking again collapses the panel
- [ ] Expanding one panel does not affect other panels
- [ ] Malformed/non-XML string values are NOT rendered as collapsible panels (shown in JSON block instead)
- [ ] Non-XML result fields render normally in JSON block below any XML panels

---

## Sign-off

| Gate | Status | Notes |
|------|--------|-------|
| Automated tests (34 new) | PASS | Run 2026-03-06 |
| TypeScript clean | PASS | No new errors in changed files |
| ESLint clean | PASS | 4 changed files, 0 errors |
| Checklist requirements.md | PASS | All 12 items |
| Manual QA — Home tab | PENDING | Requires `npm run tauri dev` |
| Manual QA — Security tab | PENDING | Requires live security analysis run |
| Code review | PENDING | All 4 changed files |

**Status: Automated gates PASS — awaiting manual QA sign-off to declare production-ready.**
