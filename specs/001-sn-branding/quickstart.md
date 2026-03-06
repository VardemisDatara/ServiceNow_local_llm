# Developer Quickstart: ServiceNow Branding & Visual Identity

**Feature**: 001-sn-branding
**Branch**: `001-sn-branding`
**Date**: 2026-03-06

---

## What This Feature Does

Two targeted visual changes:

1. **US1 — Rename & Logo**: Replace "ServiceNow MCP Bridge" with "ServiceNow Local LLM" everywhere it appears in the UI + OS title bar. Add the ServiceNow logo SVG to the nav bar with a graceful fallback.
2. **US2 — Brand Theme**: Apply the ServiceNow color palette (`#293e40` navy nav, `#62d84e` green accent) to all interactive/navigation elements. Preserve semantic status colors (green/red/gray dots) unchanged.

## Files to Touch

| File | What changes |
|------|-------------|
| `src/renderer/theme.ts` | **NEW** — central brand color constants |
| `src/assets/servicenow-logo.svg` | **NEW** — logo asset (must be sourced from ServiceNow brand assets) |
| `src/App.tsx` | Nav bar: name, logo, colors |
| `src-tauri/tauri.conf.json` | `productName` + `windows[0].title` |
| `src/main/index.ts` | Logger init message |
| `src/renderer/components/ConversationList.tsx` | Active indicator dot color |
| `src/renderer/components/IncidentListPanel.tsx` | Filter buttons, selected border, Analyze button |

**No Rust changes. No DB migrations. No new npm dependencies.**

## Prerequisites

**Before writing any code**, obtain the ServiceNow logo SVG:
1. Go to the ServiceNow brand/press assets page
2. Download the horizontal lockup SVG (logo mark + wordmark)
3. Place it at `src/assets/servicenow-logo.svg`
4. Verify it renders cleanly at 28px height

If the SVG is not yet available, use a placeholder text file at that path — tests will still pass (the `onError` handler will hide a missing/broken image).

## Implementation Order (TDD — write tests first)

### Story 1: Rename & Logo (P1)

1. **Write tests** in `tests/unit/components/app-branding.test.tsx`:
   - Nav bar renders "ServiceNow Local LLM" (not "MCP Bridge")
   - Nav bar renders `<img alt="ServiceNow">`
   - `onError` handler hides the img element
   - No occurrence of "MCP Bridge" in rendered output
2. Verify tests FAIL (red)
3. Create `src/renderer/theme.ts` with `SN_THEME` constants
4. Add logo import in `App.tsx`, update nav bar JSX
5. Update `tauri.conf.json` title and productName
6. Update logger init message in `src/main/index.ts`
7. Verify tests PASS (green)

### Story 2: Brand Theme (P2)

1. **Write tests** in `tests/unit/theme.test.ts`:
   - `SN_THEME` exports all required keys
   - WCAG contrast: white text on `navBackground` ≥ 4.5:1
   - WCAG contrast: `navActiveText` on `navActiveBackground` ≥ 4.5:1
   - Semantic colors (`statusConnected` etc.) are still `#10b981` / `#ef4444` / `#9ca3af`
2. Verify tests FAIL (red)  ← the theme file doesn't exist yet
3. Implement `src/renderer/theme.ts`
4. Update `App.tsx` nav button styles to use `SN_THEME`
5. Update `ConversationList.tsx` active dot
6. Update `IncidentListPanel.tsx` filter buttons, selected border, Analyze button
7. Verify tests PASS (green)

## Key Contracts

See `contracts/component-interfaces.md` for exact before/after JSX for each component.

## Running Tests

```bash
# All new tests
npx vitest run tests/unit/components/app-branding.test.tsx
npx vitest run tests/unit/theme.test.ts

# Full suite
npm run test

# Lint changed files
npm run lint

# TypeScript check
npx tsc --noEmit
```

## Acceptance Checklist (manual QA with `npm run tauri dev`)

- [ ] Nav bar background is dark teal (`#293e40`), not white
- [ ] ServiceNow logo appears to the left of the app name
- [ ] App name reads "ServiceNow Local LLM" — not "MCP Bridge"
- [ ] Active tab has green (`#62d84e`) background with dark text
- [ ] OS window/title bar reads "ServiceNow Local LLM"
- [ ] Stopping Ollama → red dot still shows (semantic status preserved)
- [ ] Connection status dots (green/red/gray) colors are unchanged
- [ ] ConversationList active bullet is green
- [ ] IncidentListPanel filter buttons highlight in green
- [ ] Closing the logo SVG path → no broken image shown; name text still visible
- [ ] No "MCP Bridge" text visible anywhere in the entire UI

## Gotchas

- `#62d84e` is a light/bright green — NEVER put white text on it. Use `#293e40` (dark) for text on green backgrounds.
- The `navButtonStyle` function in `App.tsx` is called per-render. Replace the hardcoded hex values with `SN_THEME` refs — the function signature does not change.
- `tauri.conf.json` `productName` must be kebab-case (no spaces); the `title` field is the human-readable window title.
- Vite imports SVG files as URLs when using `import logoUrl from '../assets/servicenow-logo.svg?url'` or just `import logoUrl from '../assets/servicenow-logo.svg'` (Vite resolves static assets to a URL string automatically for `<img src>`).
- Pre-existing TypeScript errors in `store/index.ts`, `logger.ts`, `vitest.config.ts` — do not attribute new tsc errors to this feature.
