# Data Model: Release UI Polish — Home Dashboard & Security Tab

**Feature**: 003-release-ui-polish
**Phase**: 1 — Design
**Date**: 2026-03-06

## Overview

This feature introduces **no new persistent data entities** and **no database migrations**. All changes are confined to UI state and component interfaces. This document describes the UI state model and component prop contracts that are introduced or extended.

---

## UI State: Connection Status

### Existing Store Fields (unchanged)

| Field | Type | Source |
|-------|------|--------|
| `ollamaConnected` | `boolean` | Zustand store, set by `reconnect()` |
| `servicenowConnected` | `boolean` | Zustand store, set by `reconnect()` |
| `nowAssistConnected` | `boolean` | Zustand store, set by Now Assist MCP client |
| `activeProfile` | `ConfigurationProfile \| null` | Zustand store |

### Derived Display State (computed in component, not stored)

| Display field | Derivation |
|--------------|-----------|
| Ollama status | `ollamaConnected ? 'connected' : (activeProfile?.ollamaEndpoint ? 'failed' : 'unknown')` |
| ServiceNow status | `servicenowConnected ? 'connected' : (activeProfile?.servicenowUrl ? 'failed' : 'unknown')` |
| Now Assist MCP status | `nowAssistConnected ? 'connected' : (activeProfile?.nowAssistEndpoint ? 'failed' : 'unknown')` |
| Search provider status | `activeProfile?.searchProvider && activeProfile.searchProvider !== 'none' ? 'connected' : 'unknown'` |
| LLM provider status | `activeProfile?.llmProvider !== 'ollama' && activeProfile?.cloudLlmModel ? 'connected' : 'unknown'` |

> Note: Search and LLM show `'connected'` when configured (key stored) — no live API probe to avoid cost/rate-limit on a status check. See research.md Decision 2.

### New UI-only State (in `App.tsx` local state)

| Field | Type | Purpose |
|-------|------|---------|
| `isRefreshing` | `boolean` | Controls refresh button disabled/loading state |

---

## Component Interface Changes

### `ConnectionStatusPanel` (extended)

**File**: `src/renderer/components/StatusIndicator.tsx`

New optional prop added:

| Prop | Type | Description |
|------|------|-------------|
| `nowAssistMcpStatus` | `ConnectionStatus \| undefined` | Status of the Now Assist MCP connection |
| `nowAssistMcpLatencyMs` | `number \| undefined` | Optional latency for Now Assist MCP probe |

The existing optional props `searchProviderName`, `searchProviderStatus`, `llmProviderName`, `llmProviderStatus` are already present — they just need to be wired up from `App.tsx`.

### `AnalysisReport` / `ResultCard` (internal change)

**File**: `src/renderer/components/AnalysisReport.tsx`

No prop interface change. Internal `ResultCard` rendering logic changes:

- Fields identified by `isXmlPayloadField(key, value)` are rendered as `<details><summary>…</summary><pre>…</pre></details>` instead of inline in the catch-all `JSON.stringify` block.

### Helper: `isXmlPayloadField`

**Location**: `src/renderer/components/AnalysisReport.tsx` (module-level pure function)

```
isXmlPayloadField(key: string, value: unknown) → boolean
```

**Logic**:
1. Value must be a non-empty string
2. Either: key ends with `_xml` or key is in the explicit list `['raw_xml', 'xml_payload', 'work_notes_xml', 'description_xml']`
3. AND: value string starts with `<` (XML guard)

Returns `true` only when both conditions pass.

---

## New Function: `probeAllConnections`

**File**: `src/main/index.ts`

```
probeAllConnections(profileId: string, ollamaEndpoint: string, servicenowUrl: string) → Promise<void>
```

A thin wrapper around the existing `reconnect()` call, exported for use by the Home tab refresh button. Updates the same Zustand store fields as the startup reconnect. Now Assist MCP is intentionally excluded from the probe (its state is managed by the MCP client singleton).

---

## No Changes To

- Database schema (`src/core/storage/schema.ts`) — no migrations
- Rust/Tauri commands (`src-tauri/src/`) — no backend changes
- Zustand store fields — no new persistent state
- `AnalysisResult` data shape — no changes to what the workflows produce
