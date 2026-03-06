# Feature Specification: Security Incidents Dashboard, Now Assist Integration & App Documentation

**Feature Branch**: `002-security-nowassist-docs`
**Created**: 2026-03-02
**Status**: Draft
**Input**: User description: "Add security incidents tab, Now Assist LLM integration via MCP, and full app documentation"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Security Incidents Dashboard in Security Tab (Priority: P1)

A security analyst opens the Security tab and immediately sees a side-by-side view: an incident list panel on the left and the chat interface on the right. The left panel shows a live list of security incidents from their connected ServiceNow instance. They can filter by status (open/closed/all), sort by priority or date, and click any incident to expand its full details. The incidents refresh on demand without requiring a manual chat query. The divider between the two panels is resizable.

**Why this priority**: This is the most tangible, self-contained enhancement — it transforms the Security tab from a query-driven interface into a proactive incident monitoring dashboard. A security analyst can triage incidents without typing natural-language queries.

**Independent Test**: Can be fully tested by navigating to the Security tab with a valid ServiceNow profile configured, verifying that the incident list appears automatically, and confirming that filters update the displayed list correctly.

**Acceptance Scenarios**:

1. **Given** the user has a ServiceNow profile configured and navigates to the Security tab, **When** the tab loads, **Then** the system displays a list of security incidents retrieved from the ServiceNow instance within 5 seconds, showing at minimum: incident number, title, severity, status, and last updated date.
2. **Given** the Security tab is showing incidents, **When** the user selects the "Open" filter, **Then** only open incidents are shown and the displayed count updates accordingly.
3. **Given** the Security tab is showing incidents, **When** the user clicks on a specific incident, **Then** a detail view expands showing the full incident description, assignment group, affected assets, and any associated comments.
4. **Given** the ServiceNow connection is unavailable, **When** the Security tab loads, **Then** the system displays a clear error message with guidance to check connection settings, rather than an empty or broken state.
5. **Given** the incident list is displayed, **When** more than 50 incidents are returned, **Then** the list is paginated or virtualized so that UI performance is not degraded.
6. **Given** the incident list is open, **When** the auto-refresh interval elapses (default 5 minutes), **Then** the list reloads silently in the background and the "last refreshed" timestamp updates — without interrupting any in-progress user interaction.
7. **Given** the user wants to change the refresh interval, **When** they adjust the interval control in the Security tab, **Then** the new interval (between 5 and 15 minutes) takes effect immediately for subsequent refreshes.

---

### User Story 2 - Local LLM ↔ Now Assist Exchange via MCP (Priority: P2)

A user chatting with the local AI model about a security incident can trigger Now Assist capabilities from ServiceNow. The local model acts as an orchestrator: it discovers and calls Now Assist tools (exposed via the ServiceNow MCP server) as part of answering the user's question. The response combines local model reasoning with Now Assist's contextual knowledge of the ServiceNow instance. The user sees clear attribution showing which parts of the answer came from Now Assist vs. the local model.

**Why this priority**: This is the most architecturally novel feature of this release. It enables the app to bridge local AI capabilities with enterprise AI (Now Assist), significantly expanding the analytical value available during a security investigation. It depends on a working ServiceNow MCP server endpoint.

**Independent Test**: Can be tested by asking the chat interface a question that triggers a Now Assist tool invocation (e.g., "Summarize incident INC0012345 using Now Assist"), confirming that the response includes Now Assist-sourced content attributed accordingly in the UI.

**Acceptance Scenarios**:

1. **Given** a ServiceNow MCP server is configured in Settings with valid credentials, **When** the user asks a question in the chat, **Then** the local model can invoke Now Assist skills as tools and incorporate the results into its response.
2. **Given** the user asks a question that the local model routes to Now Assist, **When** the response is displayed, **Then** the UI clearly attributes which portions of the answer came from Now Assist vs. the local model.
3. **Given** the Now Assist MCP connection is configured, **When** the user views available tools in settings, **Then** the Now Assist tools are listed alongside other MCP tools with their names and descriptions.
4. **Given** the Now Assist MCP server is unreachable, **When** the local model attempts to invoke a Now Assist tool, **Then** the system gracefully degrades — the local model answers without Now Assist and informs the user that Now Assist is unavailable.
5. **Given** valid ServiceNow MCP credentials are provided, **When** the system connects to the ServiceNow MCP server, **Then** authentication succeeds and available Now Assist tools are discovered without exposing credentials in logs or the UI.

---

### User Story 3 - Full Application Documentation (Priority: P3)

A new user opens the application for the first time (or visits the documentation) and finds clear, step-by-step guidance covering: initial setup, connecting to a ServiceNow instance, configuring AI providers, using the chat interface, understanding the Security tab, configuring Now Assist, and troubleshooting common issues. An existing user can reference specific sections quickly.

**Why this priority**: Documentation is essential for adoption and long-term support but does not block the functional features. It should be completed alongside or after the functional features so it accurately reflects the final state of the application.

**Independent Test**: Can be fully tested by following the setup guide from scratch on a clean machine and verifying that each step leads to a working application without needing external support.

**Acceptance Scenarios**:

1. **Given** a new user reads the Getting Started guide, **When** they follow all setup steps, **Then** they can successfully connect to a ServiceNow instance and send a chat message within 15 minutes.
2. **Given** the documentation covers the Security tab, **When** a user reads it, **Then** they understand how to view incidents, apply filters, and interpret the displayed fields.
3. **Given** the documentation covers Now Assist integration, **When** a user reads it, **Then** they know the prerequisites, how to configure the ServiceNow MCP connection, and what to expect from the AI exchange.
4. **Given** a user encounters a common error, **When** they consult the Troubleshooting section, **Then** they find the error described with its cause and resolution without needing external help.
5. **Given** the documentation is complete, **When** it is reviewed against the working application, **Then** every documented feature and setting corresponds to something that actually exists in the application.

---

### Edge Cases

- What happens when the ServiceNow session token expires while the Security tab is open and auto-refreshing?
- How does the system behave when Now Assist returns a partial or malformed tool response?
- What if the ServiceNow instance has no security incidents matching the current filter (empty state)?
- What if the MCP server returns more Now Assist tools than the local model's context can accommodate?
- What happens when the user navigates away from the Security tab during an active data fetch?
- How does the system handle a user sending a chat message while the incident list is simultaneously refreshing?

## Requirements *(mandatory)*

### Functional Requirements

#### Security Incidents Dashboard

- **FR-001**: The Security tab MUST use a side-by-side split layout: the incident list panel occupies the left side and the existing chat interface occupies the right side, with both visible simultaneously. The divider between the two panels MUST be resizable by the user.
- **FR-001a**: The Security tab MUST display a list of security incidents retrieved from the connected ServiceNow instance when the tab is opened.
- **FR-002**: Each incident in the list MUST show at minimum: incident number, short description/title, severity/priority, current status, and last updated timestamp.
- **FR-003**: Users MUST be able to filter the incident list by status (open, closed, all) and by severity/priority level.
- **FR-004**: Users MUST be able to click an incident row to expand its full details, including description, assignment group, affected configuration items, and comments/work notes.
- **FR-005**: The system MUST display a meaningful error state with actionable guidance when the ServiceNow connection is unavailable or returns an error — never a blank or broken UI.
- **FR-006**: The incident list MUST support pagination or on-demand loading when more than 50 incidents are returned to prevent UI performance degradation.
- **FR-007**: The Security tab MUST provide a manual refresh control so users can force an immediate data reload from ServiceNow.
- **FR-007a**: The incident list MUST auto-refresh silently in the background at a configurable interval. The default interval is 5 minutes. Users MUST be able to adjust the interval to any value between 5 and 15 minutes from within the Security tab. The panel MUST display a "last refreshed" timestamp so users always know how current the data is.

#### Now Assist MCP Integration

- **FR-008**: The application Settings MUST include a configuration section for the ServiceNow MCP server, allowing users to enter the server endpoint URL and a Bearer Token (Personal Access Token) for authentication. The token MUST be stored in the application's secure credential storage alongside other API keys.
- **FR-009**: When a ServiceNow MCP server is configured, the local AI model MUST autonomously detect when a user's query warrants a Now Assist tool call (using keyword/intent detection consistent with existing tool-calling behavior) and invoke the appropriate tool transparently — no explicit user command required.
- **FR-010**: The Settings page MUST display the list of discovered Now Assist tools once a valid MCP connection is established.
- **FR-011**: Chat responses that incorporate Now Assist output MUST display an inline "Now Assist" badge/tag directly adjacent to the portion of the response generated by Now Assist, so users can always distinguish Now Assist contributions from local model output at a glance.
- **FR-012**: When a Now Assist tool invocation fails or the MCP server is unreachable, the system MUST gracefully degrade: the local model continues to answer the user's query independently and the user is informed that Now Assist was unavailable for that response.
- **FR-013**: Credentials used to authenticate with the ServiceNow MCP server MUST be stored using the application's secure credential storage and MUST NOT appear in application logs, chat history, or any exported data.

#### Application Documentation

- **FR-014**: The application MUST be accompanied by written documentation covering: installation and first-time setup, ServiceNow connection configuration, AI provider selection and configuration, chat interface usage, Security tab usage, Now Assist integration setup and usage, and troubleshooting.
- **FR-015**: The documentation MUST include a Getting Started section that takes a new user from zero to a working application in a single reading session (targeting under 15 minutes).
- **FR-016**: The documentation MUST include a Troubleshooting section covering at least 5 common error conditions with their likely causes and step-by-step resolutions.
- **FR-017**: Every setting, button, and feature described in the documentation MUST exist in the application at time of release — no documentation of planned or future features.

### Key Entities *(include if feature involves data)*

- **Security Incident**: A security event record from ServiceNow. Key attributes: incident number, short description, severity, priority, state, assignment group, affected assets/CIs, opened date, last updated date, comments and work notes.
- **Now Assist Tool**: A callable AI skill exposed by the ServiceNow MCP server. Key attributes: tool name, description, input parameters schema, output schema.
- **MCP Server Connection**: Configuration for connecting the application to a ServiceNow MCP endpoint. Key attributes: server URL, authentication credentials (stored securely), connection status, list of discovered tools.
- **Incident Detail View**: The expanded view of a single security incident within the Security tab. Contains all available fields from the incident record.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Security analysts can view their current open security incidents within 5 seconds of navigating to the Security tab, without typing any query.
- **SC-002**: Users can filter and locate a specific incident from a list of 100+ incidents in under 30 seconds using the available filter controls.
- **SC-003**: A user with no prior experience can configure the Now Assist MCP connection and successfully invoke a Now Assist tool from the chat interface within 10 minutes of reading the documentation.
- **SC-004**: 100% of successful Now Assist tool invocations result in attributed responses — users always know when Now Assist contributed to an answer.
- **SC-005**: When the Now Assist connection is unavailable, users still receive a useful local-model response 100% of the time — the system never returns an empty or error-only answer due to Now Assist unavailability.
- **SC-006**: A new user following the Getting Started guide can set up the application and connect to a ServiceNow instance without needing external support in a single session.
- **SC-007**: The Troubleshooting section covers at least 80% of common setup and runtime errors as validated by a review against known failure modes.

### Performance & Quality Targets

Per constitution requirements (`.specify/memory/constitution.md`):

- **Response Times**: Security incident list loads within 5 seconds on a standard broadband connection; individual incident detail renders within 1 second of click; Now Assist tool invocations complete within the overall chat response time; auto-refresh completes silently without blocking user interaction.
- **Auto-refresh**: Default interval 5 minutes, user-configurable between 5–15 minutes; "last refreshed" timestamp always visible in the incident panel.
- **Resource Limits**: Incident list pagination ensures no single render cycle processes more than 50 incidents; overall memory stays within application limits.
- **Test Coverage**: ≥80% code coverage across unit/integration/contract tests for all new components and services.
- **Accessibility**: WCAG 2.1 Level AA compliance for all new UI elements in the Security tab and Settings.
- **Security**: MCP server credentials never appear in logs; OWASP Top 10 compliance; input validation at all ServiceNow data boundaries.

## Clarifications

### Session 2026-03-02

- Q: What authentication method should the app use to connect to the ServiceNow MCP server? → A: Bearer Token / Personal Access Token (stored in secure credential storage, consistent with how other API keys are handled in the app).
- Q: How should Now Assist tool invocations be triggered during a chat session? → A: Auto-detect by local model — the local model autonomously decides when a query warrants calling a Now Assist tool, using the same keyword/intent-detection pattern as the existing Phase 5 MCP tool calling.
- Q: How should the incident list panel and the existing chat interface be arranged in the Security tab? → A: Side-by-side split — incident list panel on the left, existing chat interface on the right; both visible simultaneously.
- Q: How should Now Assist attribution be presented in a chat response? → A: Inline badge/tag — a small "Now Assist" label appears inline next to the portion of the response that came from Now Assist, consistent with the existing message card design.
- Q: Should the incident list auto-refresh periodically in addition to the manual refresh button? → A: Yes — auto-refresh every 5 minutes by default; user can configure the interval between 5 and 15 minutes from the Security tab settings. A "last refreshed" timestamp is shown in the panel.

## Assumptions

- The existing ServiceNow profile and credential system (established in Phases 1–8) is reused to authenticate the incident list requests — no new credential storage mechanism is needed for FR-001 through FR-007.
- The ServiceNow MCP server uses Streamable HTTP or Server-Sent Events (SSE) transport, as per ServiceNow's documented support for the Yokohama release. Stdio transport is not supported by ServiceNow.
- Now Assist tools exposed via the ServiceNow MCP server follow the standard MCP tool schema and are discoverable via the standard `tools/list` MCP method.
- The documentation will be authored in Markdown format and placed in a `docs/` directory within the repository.
- The existing local LLM tool-calling infrastructure (implemented in Phase 5) will be extended to support Now Assist tools without requiring a complete rewrite.
- Now Assist API consumption costs (assists) are the responsibility of the ServiceNow instance owner; the application will surface tool names but will not track or report consumption counts.
- The "Security tab" refers to the existing Security Incident Analysis page introduced in Phase 6 — this feature enhances it with a proactive incident list panel, not a new tab.

## Scope

### In Scope

- A proactive incident list panel within the existing Security tab, loading automatically on tab open
- Incident filtering by status and severity, and detail expansion per incident
- ServiceNow MCP server configuration UI added to application Settings
- Now Assist tool discovery and invocation from the local chat interface
- Visual attribution in chat responses when Now Assist contributes
- Graceful degradation when Now Assist is unavailable
- Written Markdown documentation covering setup, all features, and troubleshooting

### Out of Scope

- Making Now Assist a standalone selectable LLM provider (replacing the local model entirely)
- Real-time push/streaming notifications for new security incidents (polling and on-demand only)
- Write operations from the incident list panel (e.g., closing, reassigning, or commenting on incidents directly — this remains chat-driven)
- In-app interactive documentation, tooltips, or guided tours
- Support for ServiceNow releases prior to Yokohama (which introduced MCP server support)
- Multi-instance ServiceNow connections (single active profile assumed)
