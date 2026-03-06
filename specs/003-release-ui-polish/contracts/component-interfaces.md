# Component Interface Contracts: Release UI Polish

**Feature**: 003-release-ui-polish
**Phase**: 1 — Design
**Date**: 2026-03-06

---

## Contract 1: `ConnectionStatusPanel` (Extended)

**File**: `src/renderer/components/StatusIndicator.tsx`

### Current Interface

```typescript
interface ConnectionStatusPanelProps {
  ollamaStatus: ConnectionStatus;
  servicenowStatus: ConnectionStatus;
  ollamaLatencyMs?: number | undefined;
  servicenowLatencyMs?: number | undefined;
  searchProviderName?: string | undefined;
  searchProviderStatus?: ConnectionStatus | undefined;
  llmProviderName?: string | undefined;
  llmProviderStatus?: ConnectionStatus | undefined;
}
```

### Extended Interface (this feature)

```typescript
interface ConnectionStatusPanelProps {
  ollamaStatus: ConnectionStatus;
  servicenowStatus: ConnectionStatus;
  ollamaLatencyMs?: number | undefined;
  servicenowLatencyMs?: number | undefined;
  searchProviderName?: string | undefined;
  searchProviderStatus?: ConnectionStatus | undefined;
  llmProviderName?: string | undefined;
  llmProviderStatus?: ConnectionStatus | undefined;
  // NEW: Now Assist MCP connection
  nowAssistMcpStatus?: ConnectionStatus | undefined;
  nowAssistMcpLatencyMs?: number | undefined;
}
```

### Rendering Contract

Row order (top to bottom):
1. Ollama
2. ServiceNow
3. ServiceNow MCP (Now Assist) — rendered only when `nowAssistMcpStatus !== undefined`
4. Search provider — rendered only when both `searchProviderName` and `searchProviderStatus` are defined
5. LLM provider — rendered only when both `llmProviderName` and `llmProviderStatus` are defined

### Status Display Mapping

| `ConnectionStatus` | Label | Colour |
|-------------------|-------|--------|
| `connected` | Connected | Green (#10b981) |
| `failed` | Unreachable | Red (#ef4444) |
| `degraded` | Degraded | Orange (#f97316) |
| `connecting` | Connecting… | Amber (#f59e0b) |
| `unknown` | Not Configured | Grey (#9ca3af) |

---

## Contract 2: Home Tab Refresh Button

**Location**: `src/App.tsx` — within the `page === 'home'` render branch

### Behaviour Contract

| State | Button appearance | Clickable |
|-------|------------------|-----------|
| Idle | `↻` icon, standard cursor | Yes |
| Probing | `⟳` icon with rotation animation, `disabled` attribute | No |
| Complete | Returns to idle | Yes |

### Accessibility

- `aria-label="Refresh connection status"`
- `disabled` when `isRefreshing === true`
- Positioned adjacent to (right of) the "Connection Status" `<h2>` heading

### Probe behaviour

On click:
1. Set `isRefreshing = true`
2. Call `probeAllConnections(activeProfile.id, activeProfile.ollamaEndpoint, activeProfile.servicenowUrl)`
3. On resolve or reject → set `isRefreshing = false`

If `activeProfile` is null, button is hidden (no connections to probe).

---

## Contract 3: Quick Start Section

**Location**: `src/App.tsx` — within the `page === 'home'` render branch, below the connection status panel

### Content Contract

Static section with heading "Quick Start" and exactly 3 numbered steps:

| Step | Heading | Body |
|------|---------|------|
| 1 | Configure your connections | "Open Settings to add your Ollama endpoint, ServiceNow URL, and optional search or LLM provider keys." |
| 2 | Start a chat | "Go to Chat to ask questions about your ServiceNow incidents, correlate events, or get AI-powered answers." |
| 3 | Run a security analysis | "Go to Security to launch automated analysis workflows on any SIR or INC incident." |

### Conditional Badge on Step 1

When `!fullyConnected && initialized`, step 1 displays an amber inline badge: `⚠ Complete setup in Settings`

### No Phase Progress Content

The existing "Phase Progress" `<div>` block in `App.tsx` (lines ~141–154) is removed entirely and replaced by the Quick Start section.

---

## Contract 4: XML Collapsible Panels in `ResultCard`

**File**: `src/renderer/components/AnalysisReport.tsx`

### Identification Contract

```typescript
function isXmlPayloadField(key: string, value: unknown): boolean {
  if (typeof value !== 'string' || value.length === 0) return false;
  const isNamedXmlField =
    key.endsWith('_xml') ||
    ['raw_xml', 'xml_payload', 'work_notes_xml', 'description_xml'].includes(key);
  return isNamedXmlField && value.trimStart().startsWith('<');
}
```

### Rendering Contract

For each key-value pair in the parsed `result` object of a `ResultCard`:

- **If** `isXmlPayloadField(key, value)` → render as `<details>` panel (collapsed by default)
- **Else** → include in the catch-all `JSON.stringify` output as before

### `<details>` Panel Structure

```html
<details>
  <summary aria-label="{humanLabel} — click to expand or collapse">
    {humanLabel}
  </summary>
  <pre>{value}</pre>
</details>
```

Where `humanLabel` is derived from the field key via a simple humanisation:
- `raw_xml` → "Raw XML"
- `xml_payload` → "XML Payload"
- `work_notes_xml` → "Work Notes XML"
- `description_xml` → "Description XML"
- Any other `_xml` suffix → title-case of key with underscores replaced by spaces

### Collapse Default

`<details>` elements have no `open` attribute → collapsed by default.
Each panel's open/closed state is independent (native browser behaviour).

### Empty / Absent Field

If `isXmlPayloadField` returns `false` for all keys (including when the field is absent or empty), no `<details>` panel is rendered.

---

## Contract 5: `probeAllConnections` Export

**File**: `src/main/index.ts`

```typescript
/**
 * Probe all configured connections (Ollama + ServiceNow) and update the Zustand store.
 * Exported for use by the Home tab refresh button.
 * Now Assist MCP state is managed by the MCP client singleton and excluded from this probe.
 */
export async function probeAllConnections(): Promise<void>
```

**Pre-condition**: Active profile must be set in the Zustand store before calling. If no active profile, function returns immediately without error.

**Side-effects**: Updates `ollamaConnected` and `servicenowConnected` in the Zustand store (same as startup `reconnect()`).

**Error handling**: All errors caught internally and logged; store is updated to `false` on failure. The function never rejects.
