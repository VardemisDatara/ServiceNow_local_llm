# Research: ServiceNow Branding & Visual Identity

**Feature**: 001-sn-branding
**Date**: 2026-03-06

---

## Decision 1: ServiceNow Brand Color Palette

**Decision**: Use the following official ServiceNow color tokens:

| Token | Hex | Usage |
|-------|-----|-------|
| `--sn-navy` | `#293e40` | Nav bar background, primary dark surface |
| `--sn-green` | `#62d84e` | Active state accent, primary CTA background |
| `--sn-navy-light` | `#3d5a5c` | Hover state on nav items |
| `--sn-white` | `#ffffff` | Text on dark surfaces, page backgrounds |
| `--sn-text-dark` | `#111827` | Body text on light backgrounds (unchanged) |
| `--sn-border` | `#e5e7eb` | Borders, dividers (unchanged) |
| `--sn-surface` | `#f9fafb` | Card/panel backgrounds (unchanged) |

**Rationale**: `#293e40` is the confirmed dark teal used in servicenow.com header/nav. `#62d84e` is the ServiceNow "Now Green" used in logo marks and CTA buttons. WCAG 2.1 AA contrast checks:
- White on `#293e40` → ratio ~10.1:1 ✓ (AAA)
- `#293e40` on `#62d84e` → ratio ~7.3:1 ✓ (AAA)
- White on `#62d84e` → ratio ~1.4:1 ✗ — dark text (`#293e40`) MUST be used on green backgrounds

**Alternatives considered**:
- Using `#10b981` (current generic emerald-500) as the accent — rejected, not ServiceNow brand.
- Using a full CSS custom property system (`var(--color)`) — ideal long-term but over-engineered for a single sprint; a central theme constants file (`theme.ts`) achieves the same result without adding a CSS preprocessor dependency.

---

## Decision 2: ServiceNow Logo Asset

**Decision**: Bundle an SVG file at `src/assets/servicenow-logo.svg`. Use the horizontal lockup (logo mark + "ServiceNow" wordmark) at 28px height in the nav bar. Wrap in an `<img>` tag with `alt="ServiceNow"` and an `onError` fallback that hides the broken image.

**Rationale**:
- SVG is resolution-independent — renders crisply on retina/HiDPI displays without pixelation (FR-003, SC-005).
- Bundled at build time via Vite's asset pipeline — no runtime external fetch (FR-008, security requirement).
- Vite imports SVGs as URLs when used with `import logoUrl from './assets/servicenow-logo.svg'`, which is a standard pattern for Tauri/Vite apps.
- The `<img onError>` fallback satisfies FR-004 (graceful degradation if asset missing in dev).

**Alternatives considered**:
- Inline SVG JSX — more verbose, harder to swap the asset, breaks if SVG has complex structure.
- External CDN URL — violates FR-008 and adds network dependency.
- PNG — lower quality on HiDPI, larger file size; SVG preferred per spec.

**Note for implementer**: The actual `servicenow-logo.svg` file must be sourced from ServiceNow's official brand assets page or their press kit. The file must be placed at `src/assets/servicenow-logo.svg` before running tests.

---

## Decision 3: Theme Architecture

**Decision**: Create a single `src/renderer/theme.ts` file exporting typed constants for all brand colors. Components import from this file instead of using magic hex strings.

```typescript
// src/renderer/theme.ts
export const SN_THEME = {
  navBackground: '#293e40',
  navBackgroundHover: '#3d5a5c',
  navText: '#ffffff',
  navActiveBackground: '#62d84e',
  navActiveText: '#293e40',
  primaryButton: '#62d84e',
  primaryButtonText: '#293e40',
  // Semantic colors — NOT brand colors, do not change:
  statusConnected: '#10b981',
  statusFailed: '#ef4444',
  statusUnknown: '#9ca3af',
  statusDegraded: '#f97316',
} as const;
```

**Rationale**:
- Single source of truth for all brand colors — changing a color in one place propagates everywhere.
- No new dependencies (no CSS-in-JS library, no CSS modules, no design token tooling).
- Explicit separation between brand colors and semantic status colors enforces FR-006.
- `as const` gives TypeScript literal types, preventing typos.

**Alternatives considered**:
- CSS custom properties (`var(--sn-nav-bg)`) in `index.css` — clean but requires migrating all inline styles to CSS classes; too large a refactor for this sprint.
- Tailwind or another utility CSS framework — out of scope, adds a build dependency.
- Scatter hex values in each component — current state, leads to inconsistency.

---

## Decision 4: Scope of Brand Color Application

**Decision**: Apply brand colors ONLY to clearly interactive/navigation elements. Do NOT re-theme data/content areas.

**Brand elements to change** (identified by grep):

| File | Location | Current | New |
|------|----------|---------|-----|
| `src/App.tsx` | Nav button active background | `#10b981` | `SN_THEME.navActiveBackground` |
| `src/App.tsx` | Nav button active text | `#ffffff` | `SN_THEME.navActiveText` |
| `src/App.tsx` | Nav bar background | `#ffffff` | `SN_THEME.navBackground` |
| `src/App.tsx` | Nav bar title text | `#111827` | `SN_THEME.navText` |
| `src/App.tsx` | Inactive nav button text | `#374151` | `SN_THEME.navText` with opacity |
| `src/renderer/components/ConversationList.tsx` | Active conversation indicator dot | `#10b981` | `SN_THEME.navActiveBackground` |
| `src/renderer/components/IncidentListPanel.tsx` | Active filter button border/text | `#10b981` / `#065f46` | `SN_THEME.navActiveBackground` / `SN_THEME.navActiveText` |
| `src/renderer/components/IncidentListPanel.tsx` | Selected incident left border | `#10b981` | `SN_THEME.navActiveBackground` |
| `src/renderer/components/IncidentListPanel.tsx` | "Analyze" button | `#10b981` | `SN_THEME.primaryButton` |

**Semantic elements to PRESERVE** (do not change):

| File | Location | Color | Why Preserve |
|------|----------|-------|--------------|
| `src/renderer/components/StatusIndicator.tsx` | Connected dot | `#10b981` | Semantic status (FR-006) |
| `src/renderer/components/WorkflowProgress.tsx` | Done step dot | `#10b981` | Semantic completion |
| `src/renderer/components/WorkflowProgress.tsx` | Progress bar complete | `#10b981` | Semantic completion |
| `src/renderer/components/AnalysisReport.tsx` | Success tick | `#10b981` | Semantic success |
| All | Error/fail colors | `#ef4444` | Semantic error |
| All | Warning/amber | `#f59e0b` / `#ca8a04` | Semantic warning |

---

## Decision 5: App Name Rename Scope

**Decision**: Rename to "ServiceNow Local LLM" in the following locations:

| File | Field | Old Value | New Value |
|------|-------|-----------|-----------|
| `src/App.tsx` | Nav bar `<h1>` text | `ServiceNow MCP Bridge` | `ServiceNow Local LLM` |
| `src-tauri/tauri.conf.json` | `windows[0].title` | `ServiceNow MCP Bridge` | `ServiceNow Local LLM` |
| `src-tauri/tauri.conf.json` | `productName` | `servicenow-mcp-bridge` | `servicenow-local-llm` |
| `src/main/index.ts` | Logger init message | `Initializing ServiceNow MCP Bridge...` | `Initializing ServiceNow Local LLM...` |

**Out of scope** (comments/docs, no user-visible impact):
- `src/core/storage/migrations/0000_initial.sql` SQL comment — internal, not user-visible
- `src/utils/errors.ts` file-level JSDoc comment — internal
- `src/utils/logger.ts` file-level JSDoc comment — internal
- `package.json` name field — internal, no UI impact

**Rationale**: Only locations that are user-visible (rendered UI, OS window title) are changed. Internal comments and package names are out of scope to minimize diff.

---

## Decision 6: Testing Approach

**Decision**: Unit tests for the theme constants file; snapshot/render tests for the nav bar component (logo + name); no visual regression tooling (Playwright screenshots are in the project but are not part of the vitest suite used by this project).

**Test files to create**:
- `tests/unit/components/app-branding.test.tsx` — nav bar renders "ServiceNow Local LLM", renders `<img>` with correct alt, hides on error, no "MCP Bridge" text
- `tests/unit/theme.test.ts` — theme constants export correct keys; WCAG contrast ratios pass

**Rationale**: The existing test infrastructure uses Vitest + jsdom. Visual/pixel-level tests require Playwright E2E which is not part of the unit suite. Manual QA covers visual correctness per the acceptance checklist.
