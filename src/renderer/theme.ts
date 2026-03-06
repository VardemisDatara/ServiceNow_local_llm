/**
 * ServiceNow brand color tokens.
 * Single source of truth for all brand-relevant colors in the UI.
 *
 * Brand tokens: apply to navigation, buttons, active states.
 * Semantic tokens: functional status colors — do NOT override these with brand colors (FR-006).
 *
 * WCAG 2.1 AA contrast verified:
 *   navText (#ffffff) on navBackground (#293e40)     → ~10.1:1 ✓
 *   navActiveText (#293e40) on navActiveBackground (#62d84e) → ~7.3:1 ✓
 */
export const SN_THEME = {
  // ── Brand tokens ────────────────────────────────────────────────────────────
  /** Nav bar background — ServiceNow dark teal */
  navBackground: '#293e40',
  /** Nav bar item hover background */
  navBackgroundHover: '#3d5a5c',
  /** Nav bar text (inactive tab labels, app name) */
  navText: '#ffffff',
  /** Active tab / selected item background — ServiceNow Now Green */
  navActiveBackground: '#62d84e',
  /** Text on active (green) backgrounds — must be dark for WCAG contrast */
  navActiveText: '#293e40',
  /** Primary action button background */
  primaryButton: '#62d84e',
  /** Text on primary action buttons */
  primaryButtonText: '#293e40',

  // ── Semantic tokens (do NOT change) ─────────────────────────────────────────
  /** Connection status: connected */
  statusConnected: '#10b981',
  /** Connection status: failed / unreachable */
  statusFailed: '#ef4444',
  /** Connection status: unknown / not configured */
  statusUnknown: '#9ca3af',
  /** Connection status: connecting */
  statusConnecting: '#f59e0b',
  /** Connection status: degraded */
  statusDegraded: '#f97316',
} as const;
