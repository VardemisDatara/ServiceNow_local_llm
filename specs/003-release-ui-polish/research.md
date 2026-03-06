# Research: Release UI Polish — Home Dashboard & Security Tab

**Feature**: 003-release-ui-polish
**Phase**: 0 — Research
**Date**: 2026-03-06

## Summary

This feature is a pure frontend UI polish task with no new backend, storage, or protocol changes. All research focuses on existing codebase patterns and component interface decisions.

---

## Decision 1: Connection Status — Live Probe Mechanism

**Decision**: Reuse `reconnect()` from `src/main/index.ts` as the probe function, exposed as a callable from the Home tab refresh button.

**Rationale**: `reconnect()` already calls `testOllamaConnection`, `reconnectServiceNow`, and the Now Assist auto-connect in parallel, updating the Zustand store on completion. Exposing it as a standalone export means zero duplication and the refresh button has identical behaviour to app startup.

**Current gap**: `reconnect()` is not exported. It must be exported or a thin wrapper `probeAllConnections()` must be created. The latter is preferred to allow adding the Search/LLM probe without touching the existing reconnect signature.

**Now Assist MCP probe**: `nowAssistConnected` is already tracked in the Zustand store via `useNowAssistConnected`. The home tab reads this value directly — no extra probe needed since the MCP client maintains its own connected state. If not connected and endpoint is configured, the indicator shows "Disconnected".

**Search/LLM status**: No live probe exists yet for the search provider or cloud LLM. For V1, these will show:
  - "Not Configured" if no key/provider is stored in `activeProfile`
  - "Configured" (green) if a key is stored — a live API call is deferred to avoid cost/rate-limit concerns for a status check

**Alternatives considered**:
  - Polling interval: Rejected — continuous polling would waste resources and the spec explicitly requires on-demand only.
  - Separate probe per indicator: Rejected — all-at-once probe is simpler and matches the spec's "all connections" framing.

---

## Decision 2: "Not Configured" vs "Disconnected" State Mapping

**Decision**: Map the existing `ConnectionStatus` type states to three display buckets:

| Display | ConnectionStatus value(s) | Colour |
|---------|--------------------------|--------|
| Connected | `connected` | green |
| Disconnected / Unreachable | `failed`, `degraded` | red |
| Not Configured | `unknown` (when no endpoint/key stored) | grey |
| Probing… | `connecting` | amber (existing) |

**Rationale**: The existing `ConnectionStatus` type already has `unknown`, `connecting`, `connected`, `failed`, `degraded`. No type changes needed. The Home tab simply needs to detect "no endpoint configured" before initiating a probe and render `unknown` for those rows.

**Alternatives considered**:
  - Adding a new `not_configured` literal to `ConnectionStatus`: Rejected — changes a shared type and risks touching more files than necessary for a polish task.

---

## Decision 3: XML Panel Identification in AnalysisReport

**Decision**: XML collapsible panels are triggered by a fixed set of known field names within the `result` JSON blob of each `AnalysisResult`. An initial set of fields to treat as XML panels:

- `raw_xml`
- `xml_payload`
- `work_notes_xml`
- `description_xml`
- Any field whose name ends in `_xml` or `_raw` and whose string value starts with `<`

A helper `isXmlPayloadField(key: string, value: unknown): boolean` checks both conditions. This is implemented in `AnalysisReport.tsx` inside `ResultCard`.

**Rationale**: Matches the spec clarification (Option B — named fields only). The `_xml` suffix convention is consistent with ServiceNow API field naming. The secondary `startsWith('<')` guard prevents false positives for other `_raw` fields that contain plain text.

**Alternatives considered**:
  - Any field starting with `<`: Rejected per spec clarification.
  - Character length threshold: Rejected per spec clarification.

---

## Decision 4: Expandable XML — HTML Pattern

**Decision**: Use native HTML `<details>` / `<summary>` elements for the collapsible XML panels. No third-party library needed.

**Rationale**: `<details>` / `<summary>` is natively accessible (keyboard-accessible, announces expanded/collapsed to screen readers via the `open` attribute), requires zero JS for toggle behaviour, and is consistent with the existing inline-style React pattern used throughout the codebase.

**Alternatives considered**:
  - Controlled `useState` boolean toggle with `div`: Would require JS state management and manual ARIA attributes. Rejected in favour of the simpler native solution.

---

## Decision 5: Refresh Button Placement & Loading State

**Decision**: Place a circular refresh icon button (`↻`) to the right of the "Connection Status" heading in the Home tab. During probing, the button is `disabled` and shows a spinner character (`⟳` with CSS rotation animation), preventing double-clicks.

**Rationale**: Matches FR-010/FR-011. Icon-only button with `aria-label="Refresh connection status"` satisfies accessibility requirements without adding text clutter.

---

## Decision 6: Quick Start Content

**Decision**: Static JSX section below the connection status panel with 3 numbered steps:

1. **Configure** — "Open Settings to add your Ollama endpoint, ServiceNow URL, and optional search/LLM keys."
2. **Chat** — "Go to Chat to ask questions about your ServiceNow incidents, correlate events, or get AI-powered answers."
3. **Analyze** — "Go to Security to run automated security analysis workflows on any SIR or INC incident."

A conditional badge on step 1 shows "⚠ Not all connections configured" when `!fullyConnected`.

**Rationale**: Satisfies FR-004 and SC-003. Static content is easy to test and maintain. The conditional badge on step 1 links connection status to the quick start without making the guide dynamic.

---

## Files Affected (No New Files Required for Core Logic)

| File | Change |
|------|--------|
| `src/App.tsx` | Remove Phase Progress section; add refresh button; add Quick Start; pass MCP/search/LLM status to `ConnectionStatusPanel`; wire refresh to `probeAllConnections()` |
| `src/main/index.ts` | Export `probeAllConnections()` wrapper |
| `src/renderer/components/StatusIndicator.tsx` | Add `nowAssistMcpStatus` prop to `ConnectionStatusPanel`; add corresponding `StatusIndicator` row |
| `src/renderer/components/AnalysisReport.tsx` | Add `isXmlPayloadField()` helper; render matching fields as `<details>` panels in `ResultCard` |

**New test files**:
- `tests/unit/components/analysis-report-xml-panels.test.tsx`
- `tests/unit/components/home-connection-status.test.tsx`
- `tests/integration/home-refresh-probe.test.tsx`
