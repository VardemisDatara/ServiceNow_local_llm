# Feature Specification: ServiceNow Branding & Visual Identity

**Feature Branch**: `001-sn-branding`
**Created**: 2026-03-06
**Status**: Draft
**Input**: User description: "on this sprint I want to add the servicenow logo and change the name 'servicenow MCP bridge' to 'ServiceNow Local LLM app' on the home page, I also want the app to be themed on servicenow also."

## Clarifications

### Session 2026-03-06

- Q: Should "app" be included in the display name ("ServiceNow Local LLM app" vs "ServiceNow Local LLM")? → A: No — display name is **ServiceNow Local LLM** without the "app" suffix. Confirmed as Option A.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — App Rename & Logo (Priority: P1)

As a user opening the app, I see the correct product name "ServiceNow Local LLM" and the ServiceNow logo in the navigation bar and window title, replacing the previous "ServiceNow MCP Bridge" name.

**Why this priority**: The product name and logo are the first thing users see. Correcting the name and adding the logo establishes brand identity and is the most visible and self-contained change.

**Independent Test**: Open the app → navigation bar shows the ServiceNow logo and the label "ServiceNow Local LLM". The OS window title also reflects the new name. Search the entire UI for "MCP Bridge" → zero results.

**Acceptance Scenarios**:

1. **Given** the app is launched, **When** the home tab is displayed, **Then** the navigation bar shows the ServiceNow logo and the text "ServiceNow Local LLM" — not "ServiceNow MCP Bridge".
2. **Given** the app is running, **When** the user switches between all five tabs, **Then** the logo and name remain consistently visible in the nav bar on every page.
3. **Given** the app window, **When** the user looks at the OS title bar or taskbar, **Then** it reads "ServiceNow Local LLM".
4. **Given** a network or asset-loading issue, **When** the logo image fails to load, **Then** the nav bar continues to display the app name in text without a broken image icon.

---

### User Story 2 — ServiceNow Brand Theme (Priority: P2)

As a user, the app's visual design reflects the ServiceNow brand: the ServiceNow color palette is applied consistently across navigation, buttons, active states, and accent elements throughout the entire app.

**Why this priority**: Brand coherence strengthens product identity and makes the app feel like a natural extension of the ServiceNow ecosystem. It complements US1 but can be evaluated independently.

**Independent Test**: Open the app → navigation bar background, active tab highlight, and primary action buttons all use ServiceNow brand colors. No generic green (`#10b981`) or plain gray remains on brand-relevant elements. Connection status dot colors (green/red/gray) are unchanged.

**Acceptance Scenarios**:

1. **Given** any page of the app, **When** the user views the navigation bar, **Then** the background and active tab highlight use ServiceNow brand colors.
2. **Given** the Home tab, **When** the user sees the "Refresh" button and connection panel, **Then** they visually align with the ServiceNow color palette.
3. **Given** any page, **When** primary action buttons are displayed, **Then** they use the ServiceNow primary color as background with legible white text.
4. **Given** the connection status panel, **When** statuses are displayed, **Then** the semantic indicator colors (green = connected, red = unreachable, gray = unknown) are preserved unchanged — they are functional, not brand elements.
5. **Given** the app is used at different screen sizes, **When** the layout reflows, **Then** brand colors remain consistent with no visual regressions.

---

### Edge Cases

- What happens if the ServiceNow logo asset cannot load? The nav bar must fall back to text-only "ServiceNow Local LLM" with no broken image placeholder visible.
- How are connection status indicator colors handled? They must remain semantically correct (green/red/gray) and must not be overridden by brand theming.
- Does the theme need to support dark mode? Assumption: light mode only for this sprint; dark mode is out of scope.
- Are there any pages where the old name "ServiceNow MCP Bridge" appears in non-nav-bar locations (e.g., Settings, error messages, window title)? All occurrences must be updated.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application name MUST be displayed as "ServiceNow Local LLM" everywhere it currently reads "ServiceNow MCP Bridge" — including the nav bar heading, the OS window title, and any other visible location.
- **FR-002**: The ServiceNow logo MUST appear in the top navigation bar, to the left of or alongside the application name.
- **FR-003**: The logo MUST render at a size appropriate for the nav bar and MUST be crisp on retina/HiDPI displays (vector format preferred).
- **FR-004**: If the logo asset fails to load, the nav bar MUST continue to show the application name text without a broken image placeholder.
- **FR-005**: The ServiceNow brand color palette MUST be applied to: navigation bar background and active tab states, primary action buttons, and heading accent elements.
- **FR-006**: Semantic status colors used in connection indicators (green = connected, red = failed/unreachable, gray = unknown) MUST remain unchanged — they are functional indicators, not brand decoration.
- **FR-007**: The theme MUST be visually consistent across all five tabs: Home, Chat, History, Security, Settings.
- **FR-008**: The logo asset MUST be bundled with the application and MUST NOT be fetched from an external URL at runtime.

### Assumptions

- The ServiceNow brand colors to use are: dark navy/teal (`#293e40` or equivalent) for nav background, and bright green (`#62d84e` or equivalent) for active/accent states — consistent with the ServiceNow Now Platform visual identity.
- The logo asset will be an SVG sourced from ServiceNow's official brand assets; a high-resolution PNG is an acceptable fallback.
- Dark mode theming is out of scope for this sprint.
- No per-profile or per-user customisation of branding is required — the theme is global and static.
- The window/taskbar title is controlled via the Tauri application configuration, not only the React navigation bar.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero occurrences of "MCP Bridge" visible anywhere in the app UI after the change is applied.
- **SC-002**: The ServiceNow logo is visible in the nav bar on every tab with no loading flash or broken state.
- **SC-003**: All primary interactive elements that previously used the default green (`#10b981`) on nav/button brand surfaces now use ServiceNow brand colors instead.
- **SC-004**: Connection status indicator colors (green/red/gray dots) remain visually identical to the pre-branding baseline — confirmed by visual diff.
- **SC-005**: Logo and name render correctly on both standard and HiDPI displays without pixelation.

### Performance & Quality Targets

Per constitution requirements (`.specify/memory/constitution.md`):

- **Response Times**: UI feedback <100ms; theme applies on initial render with no flash of unstyled content
- **Resource Limits**: Logo asset <50KB (SVG preferred)
- **Test Coverage**: ≥80% on changed components
- **Accessibility**: Logo MUST have descriptive `alt` text; all text on brand-colored backgrounds MUST meet WCAG 2.1 AA contrast ratios
- **Security**: Logo asset bundled at build time — no runtime external fetches
