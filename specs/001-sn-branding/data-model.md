# Data Model: ServiceNow Branding & Visual Identity

**Feature**: 001-sn-branding
**Date**: 2026-03-06

---

## Overview

This feature has **no persistent data entities** — it is a pure UI/visual change with no database schema modifications, no new Zustand store state, and no new IPC calls.

The "data" of this feature is the theme token set, defined as a compile-time constant.

---

## Theme Token Set (compile-time constant, not persisted)

**File**: `src/renderer/theme.ts`

### Brand Tokens (mutable — this sprint)

| Token | Type | Value | Usage |
|-------|------|-------|-------|
| `navBackground` | `string` | `#293e40` | Nav bar background |
| `navBackgroundHover` | `string` | `#3d5a5c` | Nav item hover background |
| `navText` | `string` | `#ffffff` | Nav bar text (inactive) |
| `navActiveBackground` | `string` | `#62d84e` | Active nav tab background; active filter/selection highlight |
| `navActiveText` | `string` | `#293e40` | Text on active (green) background |
| `primaryButton` | `string` | `#62d84e` | Primary action button background |
| `primaryButtonText` | `string` | `#293e40` | Text on primary action buttons |

### Semantic Tokens (immutable — must NOT be changed by branding)

| Token | Type | Value | Usage |
|-------|------|-------|-------|
| `statusConnected` | `string` | `#10b981` | Connection status: connected |
| `statusFailed` | `string` | `#ef4444` | Connection status: failed/unreachable |
| `statusUnknown` | `string` | `#9ca3af` | Connection status: unknown/not configured |
| `statusConnecting` | `string` | `#f59e0b` | Connection status: connecting |
| `statusDegraded` | `string` | `#f97316` | Connection status: degraded |

### Invariant: Semantic colors are also registered in `StatusIndicator.tsx`

`StatusIndicator.tsx` maintains its own `STATUS_COLORS` record independently. These two definitions must remain in sync. The theme file documents the canonical values; `StatusIndicator.tsx` is the authoritative source for status rendering.

---

## Asset: Logo File

**Path**: `src/assets/servicenow-logo.svg`
**Type**: Static file asset (bundled by Vite at build time)
**Constraints**:
- Format: SVG (preferred) or PNG fallback
- Max size: 50KB
- Must render at 28px height without pixelation
- Must NOT be fetched from an external URL at runtime

This is a static asset, not a data entity. It has no lifecycle, no versioning, and no storage requirements.

---

## Configuration Fields Modified

### `src-tauri/tauri.conf.json`

| Field | Path | Old Value | New Value |
|-------|------|-----------|-----------|
| Product name | `productName` | `servicenow-mcp-bridge` | `servicenow-local-llm` |
| Window title | `app.windows[0].title` | `ServiceNow MCP Bridge` | `ServiceNow Local LLM` |

These are build-time configuration fields, not runtime data.
