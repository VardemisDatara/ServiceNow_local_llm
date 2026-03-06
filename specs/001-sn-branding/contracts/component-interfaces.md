# Component Contracts: ServiceNow Branding & Visual Identity

**Feature**: 001-sn-branding
**Date**: 2026-03-06

---

## New Module: `src/renderer/theme.ts`

### Export Contract

```typescript
export const SN_THEME: {
  // Brand tokens
  navBackground: string;        // '#293e40'
  navBackgroundHover: string;   // '#3d5a5c'
  navText: string;              // '#ffffff'
  navActiveBackground: string;  // '#62d84e'
  navActiveText: string;        // '#293e40'
  primaryButton: string;        // '#62d84e'
  primaryButtonText: string;    // '#293e40'
  // Semantic tokens (immutable)
  statusConnected: string;      // '#10b981'
  statusFailed: string;         // '#ef4444'
  statusUnknown: string;        // '#9ca3af'
  statusConnecting: string;     // '#f59e0b'
  statusDegraded: string;       // '#f97316'
};
```

**Constraints**:
- `as const` — all values are string literals, not mutable
- No external dependencies
- Exported as a named export (not default)

---

## Modified Component: `src/App.tsx` — Nav Bar

### Before

```tsx
<nav style={{ backgroundColor: '#ffffff', ... }}>
  <h1 style={{ color: '#111827' }}>ServiceNow MCP Bridge</h1>
  <button style={{
    backgroundColor: active ? '#10b981' : 'transparent',
    color: active ? '#ffffff' : '#374151',
  }}>
    {tabName}
  </button>
</nav>
```

### After

```tsx
<nav style={{ backgroundColor: SN_THEME.navBackground, ... }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
    <img
      src={servicenowLogoUrl}
      alt="ServiceNow"
      height={28}
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
      style={{ display: 'block' }}
    />
    <h1 style={{ color: SN_THEME.navText }}>ServiceNow Local LLM</h1>
  </div>
  <button style={{
    backgroundColor: active ? SN_THEME.navActiveBackground : 'transparent',
    color: active ? SN_THEME.navActiveText : SN_THEME.navText,
  }}>
    {tabName}
  </button>
</nav>
```

### Invariants
- Logo `alt="ServiceNow"` is mandatory (accessibility, FR-003)
- `onError` hides the `<img>` element — does NOT show a broken image icon (FR-004)
- App name text "ServiceNow Local LLM" is always visible regardless of logo load state
- Active tab text uses `SN_THEME.navActiveText` (`#293e40`) — dark on green background, WCAG AA ✓

---

## Modified Component: `src/renderer/components/ConversationList.tsx`

### Change
Active conversation indicator dot: `#10b981` → `SN_THEME.navActiveBackground`

```tsx
// Before
{session.isSaved && <span style={{ color: '#10b981' }}>●</span>}

// After
{session.isSaved && <span style={{ color: SN_THEME.navActiveBackground }}>●</span>}
```

---

## Modified Component: `src/renderer/components/IncidentListPanel.tsx`

### Changes
Three locations use `#10b981` as an interactive/brand color (not semantic status):

1. **Active filter button** (Open/Closed/All + interval buttons):
```tsx
// Before
border: filterStatus === s ? '1px solid #10b981' : '1px solid #d1d5db',
color: filterStatus === s ? '#065f46' : '#374151',

// After
border: filterStatus === s ? `1px solid ${SN_THEME.navActiveBackground}` : '1px solid #d1d5db',
color: filterStatus === s ? SN_THEME.navActiveText : '#374151',
```

2. **Selected incident left border**:
```tsx
// Before
borderLeft: '3px solid #10b981',

// After
borderLeft: `3px solid ${SN_THEME.navActiveBackground}`,
```

3. **"Analyze" action button**:
```tsx
// Before
backgroundColor: '#10b981',

// After
backgroundColor: SN_THEME.primaryButton,
color: SN_THEME.primaryButtonText,
```

---

## Unchanged Components (semantic colors preserved)

| Component | Color | Semantic meaning | Action |
|-----------|-------|-----------------|--------|
| `StatusIndicator.tsx` | `#10b981` | "Connected" status | No change |
| `WorkflowProgress.tsx` | `#10b981` | Workflow step "done" | No change |
| `AnalysisReport.tsx` | `#10b981` | Tool result success tick | No change |
| `StatusIndicator.tsx` | `#ef4444` | Failed/unreachable | No change |
| All | `#9ca3af` | Unknown/pending | No change |
