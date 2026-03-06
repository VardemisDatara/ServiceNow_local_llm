# Feature Specification: Release UI Polish — Home Dashboard & Security Tab

**Feature Branch**: `003-release-ui-polish`
**Created**: 2026-03-06
**Status**: Draft
**Input**: User description: "for the release version, let iron some little things, first I want the home tab to be clean and informative, so I want the state of all the configure connection (ollma, servicenow, servicenow mcp, search LLM etc.) can you also get rid of the phasing information and create a small quick start / quick use information to replace it. on the security tab can you make the xml part expandable instead to showing all of them it will help to understand what is going on."

## Clarifications

### Session 2026-03-06

- Q: Should the connection check be a live network probe or a credential presence check? → A: Live network probe — actually ping each service on tab open; show real reachability.
- Q: How should the user trigger a manual re-probe of all connections? → A: Explicit refresh button on the Home tab (e.g., a refresh icon next to the status panel title).
- Q: How should the app identify which content blocks to treat as expandable XML panels? → A: Only explicitly named fields from the workflow result (known payload fields) are treated as XML panels — not any arbitrary angle-bracket content.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Home Tab Connection Status Overview (Priority: P1)

A user opens the application and immediately sees the live connection status for every integration in one place — Ollama, ServiceNow, ServiceNow MCP, and the Search/LLM provider. Each connection shows a clear visual indicator (connected / disconnected / not configured) so the user knows at a glance which services are ready before starting work. A refresh button allows the user to re-probe all connections at any time without leaving the tab.

**Why this priority**: This is the primary value of the home tab for release — users need immediate confidence that their environment is healthy before they start an analysis. Without this, the home tab offers no actionable information.

**Independent Test**: Can be tested fully by opening the app with various combinations of configured/unconfigured connections and verifying the home tab reflects each state correctly. Delivers a useful operational status dashboard independently of the other stories.

**Acceptance Scenarios**:

1. **Given** all connections are configured and reachable, **When** the user opens the Home tab, **Then** all connection indicators show a green "Connected" state with the integration name clearly labeled.
2. **Given** Ollama is not running, **When** the user opens the Home tab, **Then** the Ollama indicator shows a red "Disconnected" or "Unreachable" state without affecting other indicators.
3. **Given** a connection is not configured (no credentials entered), **When** the user views the Home tab, **Then** that connection shows a grey "Not Configured" state with a hint to go to Settings.
4. **Given** the user clicks the refresh button on the connection status panel, **When** the re-probe completes, **Then** all indicators update to reflect the current live state of each service.

---

### User Story 2 - Quick Start / Quick Use Guide (Priority: P2)

A user — especially one opening the app for the first time or returning after a break — sees a concise quick-start section on the Home tab that explains what the app does and the key actions they can take: starting a chat, running a security analysis, and configuring connections.

The existing "phasing information" (development phase labels and progress markers) is removed entirely from the home tab, replaced by this practical guide.

**Why this priority**: For a release version the UI must communicate purpose, not internal development state. A quick-start guide is the standard replacement and greatly improves first-run experience.

**Independent Test**: Can be tested by verifying no phase/development text appears anywhere on the Home tab, and that the quick-start section is present and readable. Delivers a clean release-ready home screen independently.

**Acceptance Scenarios**:

1. **Given** the user opens the Home tab, **When** they scan the page, **Then** no development-phase labels, milestone markers, or internal progress information are visible.
2. **Given** the user opens the Home tab, **When** they look for guidance, **Then** a "Quick Start" section is visible with 3-5 concise steps or tips covering: configuring connections, starting a chat, and running a security analysis.
3. **Given** a first-time user with no connections configured, **When** they view the quick-start section, **Then** the first step directs them to Settings to configure their connections.

---

### User Story 3 - Expandable XML Sections on Security Tab (Priority: P3)

On the Security tab, explicitly named XML payload fields from security workflow results (such as raw incident payloads and work-note bodies returned by ServiceNow) are shown in collapsible / expandable panels rather than fully expanded by default. Each panel is collapsed by default with a label identifying the field, and the user can expand any individual panel to inspect its contents.

**Why this priority**: XML payloads can be very large and noisy. Hiding them by default reduces cognitive load and makes the security workflow results readable at a glance. Users who need the raw data can still access it.

**Independent Test**: Can be tested by running a security analysis on any incident, then verifying that the known XML payload fields in the results are collapsed by default. Expanding one panel should reveal the full content. Delivers improved readability independently.

**Acceptance Scenarios**:

1. **Given** a security analysis has completed and the results contain named XML payload fields, **When** the user views the Security tab results, **Then** each XML payload field is collapsed by default and shows only a header/label (e.g., "Raw Incident XML — click to expand").
2. **Given** an XML panel is collapsed, **When** the user clicks the panel header, **Then** the full XML content is revealed inline beneath the header.
3. **Given** an XML panel is expanded, **When** the user clicks the header again, **Then** the panel collapses back to the header-only view.
4. **Given** multiple XML panels exist in the results, **When** the user expands one, **Then** other panels remain in their current state (independent toggling).

---

### Edge Cases

- What happens when a connection check on the Home tab times out? Show "Unreachable" state rather than indefinitely loading.
- What happens when the user clicks the refresh button while a probe is already in progress? The button shows a loading state and ignores subsequent clicks until the probe completes.
- How does the system handle a connection that flips between states rapidly? Debounce status updates to avoid flickering indicators.
- What if there is no XML data in a security analysis result? The expandable XML section is not rendered at all (no empty collapsed panel).
- What if the XML payload is malformed? Display the raw text as-is inside the expanded panel without attempting to parse or pretty-print it.
- What if a known XML payload field is present but empty? Do not render a panel for that field.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Home tab MUST display a connection-status indicator for each integration: Ollama, ServiceNow REST API, ServiceNow MCP, and the configured Search/LLM provider.
- **FR-002**: Each connection indicator MUST show one of three states: Connected (green), Disconnected/Unreachable (red), or Not Configured (grey). The "Connected" state MUST only be shown when a live network probe to the service succeeds.
- **FR-003**: The Home tab MUST NOT display any development-phase labels, milestone markers, or internal build-progress information.
- **FR-004**: The Home tab MUST include a "Quick Start" section with 3-5 concise steps guiding the user through: configuring connections, starting a chat conversation, and launching a security analysis.
- **FR-005**: Connection status on the Home tab MUST be determined by a live network probe to each service on tab open. A connection with stored credentials that fails the live probe MUST show "Unreachable", not "Connected".
- **FR-010**: The Home tab connection status panel MUST include an explicit refresh button (or refresh icon) that triggers a new live probe of all connections simultaneously when clicked.
- **FR-011**: The refresh button MUST display a loading state while probes are in progress and MUST ignore additional clicks until all probes complete.
- **FR-006**: On the Security tab, every explicitly named XML payload field in a workflow result MUST be rendered in a collapsible panel that is collapsed by default. Generic text content that happens to contain angle brackets MUST NOT be treated as an XML panel.
- **FR-007**: Each collapsed XML panel MUST display a descriptive label identifying the specific named field it contains (e.g., "Incident XML Payload", "Work Notes XML").
- **FR-008**: Users MUST be able to expand and collapse any XML panel independently by clicking its header.
- **FR-009**: If a named XML payload field is absent or empty in a security analysis result, no panel MUST be rendered for that field.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can identify the live reachability status of all configured connections within 5 seconds of opening the Home tab, without navigating to Settings.
- **SC-006**: A user can manually re-probe all connections with a single click of the refresh button, and see updated statuses within 5 seconds.
- **SC-002**: The Home tab contains zero references to development phases or internal milestone information after this change.
- **SC-003**: The Quick Start section is present and covers at minimum 3 distinct user actions (configure, chat, analyze).
- **SC-004**: On a security analysis result containing named XML payload fields, the initial view of the Security tab shows all XML panels collapsed — none are expanded by default.
- **SC-005**: A user can expand and read any individual XML panel within 2 interactions without the page scrolling or reloading.

### Performance & Quality Targets

Per constitution requirements (`.specify/memory/constitution.md`):

- **Response Times**: Live connection probes complete and indicators render within 2 seconds of tab open; refresh button re-probe completes within 5 seconds; XML expand/collapse transitions complete under 300ms.
- **Resource Limits**: Connection status probes are on-demand (tab open or explicit refresh button click) — no continuous background polling.
- **Test Coverage**: >=80% code coverage across unit/integration/contract tests.
- **Accessibility**: WCAG 2.1 Level AA compliance — refresh button must be keyboard-accessible; expandable XML panels must announce expanded/collapsed state to screen readers.
- **Security**: No sensitive credential data is displayed on the Home tab connection status panel.

## Assumptions

- "Phasing information" refers to development-phase UI elements (e.g., "Phase 1 complete", feature milestone labels) currently rendered on the Home tab, not user-facing workflow stages.
- The existing Settings page already stores which connections are configured; the Home tab reads from that stored state to know which services to probe.
- "XML payload fields" on the Security tab refers to specific named fields in the security workflow result data structure (e.g., raw incident payload, work notes body) — not arbitrary text content.
- Connection status live probes reuse existing connectivity logic already implemented in the app (Ollama health check, ServiceNow ping) — no new authentication flows are needed.
- The Quick Start guide is static content; it may highlight the first unconfigured step if connections are missing, but does not dynamically generate steps.
