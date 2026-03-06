# Feature Specification: ServiceNow MCP Bridge Application

**Feature Branch**: `001-servicenow-mcp-app`
**Created**: 2026-02-12
**Status**: Draft
**Input**: User description: "I wish to create an app with a webinterface that use the MCP capabilities of a ServiceNow Instances (you'll find pdf documents in the docs directory of the project, there is also exemple here : https://www.servicenow.com/community/developer-articles/how-to-create-your-own-servicenow-mcp-server/ta-p/3298144 and https://www.servicenow.com/community/developer-articles/agentic-ai-create-mcp-client-and-access-it-from-virtual-agent/ta-p/3301689). The app will use an ollma model that will be able to do websearch if he can't answer because of knowledge cut off date or any other reason. The interface need to be user friendly and have a configuration tab to input servicenow configuration informatin and credential, any potential api and credential if this is required in the futur of the project (like LLM api : Perplexity, openai, mistral, etc). I wish that both ollama and ServiceNow AI: Now assit can discuss and access to each other capabilities. You'll also find a tsx document in the doc repository developp with claude desktop that have some starting userstory and capabilities of the app that I want to be implemented I also want the app to be evolutive from the start in order to be able easily to add capabilities once version 1 is ready."

## Clarifications

### Session 2026-02-12

- Q: What is the deployment architecture for this application? → A: Local desktop application with embedded web UI (Electron-style) - runs on user's machine with Ollama
- Q: Should conversation history be persisted across sessions or only kept in memory? → A: Optional persistence - user chooses per conversation whether to save
- Q: How should inactive conversation sessions be managed and cleaned up from memory? → A: User-configurable timeout - let users set their own preference (default 24 hours)
- Q: What web search implementation should be used for knowledge augmentation? → A: Configurable search provider - DuckDuckGo free default, optional upgrade to Perplexity/Google with API keys
- Q: Which Ollama model should be used by default? → A: User selects from available models - auto-detect installed Ollama models during setup, let user choose

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure AI Bridge Connections (Priority: P1)

Users need to configure connections to both ServiceNow instances and local Ollama AI models through a web interface before any AI collaboration can occur.

**Why this priority**: This is the foundational capability - without successful configuration and connection establishment, no other features can function. It delivers immediate value by validating connectivity and storing credentials securely.

**Independent Test**: Can be fully tested by entering ServiceNow credentials and Ollama endpoint, verifying connection status indicators turn green, and confirming configurations are persisted across sessions.

**Acceptance Scenarios**:

1. **Given** no existing configuration, **When** user opens configuration tab and enters ServiceNow instance URL, username, and password, **Then** system validates connection and displays success indicator
2. **Given** valid ServiceNow credentials, **When** user enters Ollama endpoint URL and tests connection, **Then** system detects installed Ollama models and prompts user to select default model
3. **Given** valid configurations, **When** user saves settings and restarts application, **Then** system automatically reconnects to both services without re-entering credentials
4. **Given** invalid credentials, **When** user attempts connection, **Then** system displays clear error messages explaining what failed and how to fix it
5. **Given** configuration tab open, **When** user adds API keys for future services (Perplexity, OpenAI, Mistral), **Then** system securely stores credentials and marks them as configured

---

### User Story 2 - Chat with Ollama AI (Priority: P2)

Users can interact with the local Ollama AI model through a conversational web interface to ask questions and receive responses.

**Why this priority**: Establishes basic AI interaction capability and validates the Ollama integration works independently before introducing complex multi-AI orchestration.

**Independent Test**: Can be fully tested by typing a question in the chat interface and receiving a coherent response from Ollama within 5 seconds, confirming basic AI query-response functionality.

**Acceptance Scenarios**:

1. **Given** connected Ollama instance, **When** user types "What is ServiceNow?" and submits, **Then** Ollama responds with relevant information within 5 seconds
2. **Given** Ollama lacks knowledge, **When** user asks about recent events beyond training data, **Then** system automatically triggers web search and supplements response with current information
3. **Given** ongoing conversation, **When** user asks follow-up questions, **Then** system maintains conversation context across multiple exchanges
4. **Given** active chat session, **When** network connection to Ollama is lost, **Then** system displays connection error and allows retry without losing conversation history
5. **Given** chat in progress, **When** Ollama response takes longer than 10 seconds, **Then** system displays progress indicator showing AI is working
6. **Given** active conversation, **When** user chooses to save conversation, **Then** system persists conversation to local database and allows retrieval in future sessions

---

### User Story 3 - Bidirectional AI Communication (Priority: P3)

Ollama and ServiceNow Now Assist can communicate with each other, requesting capabilities and information from one another to solve complex problems collaboratively.

**Why this priority**: This is the core value proposition - enabling two AI systems to work together. Depends on both systems being individually operational (P1, P2) but can be tested independently by observing AI-to-AI interactions.

**Independent Test**: Can be fully tested by asking Ollama to "check ServiceNow for open security incidents", observing Ollama invoke MCP tools to query ServiceNow, and receiving aggregated results showing data from both AIs.

**Acceptance Scenarios**:

1. **Given** both AIs connected, **When** user asks Ollama "What are my open ServiceNow incidents?", **Then** Ollama uses MCP protocol to query Now Assist and returns current incident list
2. **Given** ServiceNow detects security incident, **When** Now Assist needs threat analysis, **Then** Now Assist calls Ollama via MCP for threat intelligence correlation and receives enriched analysis
3. **Given** Ollama analyzing security patterns, **When** Ollama needs business impact context, **Then** Ollama requests ServiceNow data about affected systems and user populations
4. **Given** AI-to-AI communication in progress, **When** either AI returns results, **Then** system displays clear attribution showing which AI provided which information
5. **Given** multi-AI workflow executing, **When** any step fails, **Then** system displays which AI failed and provides actionable error message

---

### User Story 4 - Security Incident Analysis Workflow (Priority: P4)

Users can trigger security incident analysis workflows where Ollama and Now Assist collaborate on threat detection, analysis, vulnerability assessment, and remediation planning.

**Why this priority**: Delivers high-value security use cases but depends on core AI communication being stable (P3). Demonstrates the platform's practical enterprise value.

**Independent Test**: Can be fully tested by creating a test security incident in ServiceNow, triggering the analysis workflow, and verifying both AIs contribute analysis with threat intelligence correlation and business impact assessment.

**Acceptance Scenarios**:

1. **Given** new security incident in ServiceNow, **When** user initiates incident analysis, **Then** Ollama analyzes threat indicators and CVEs while Now Assist assesses business impact, returning combined report within 30 seconds
2. **Given** vulnerability scan results, **When** user requests remediation plan, **Then** Ollama generates fix recommendations while Now Assist creates prioritized remediation tasks in ServiceNow
3. **Given** phishing email reported, **When** user submits email for analysis, **Then** Ollama analyzes sender reputation and content while Now Assist checks historical patterns and auto-blocks if confirmed threat
4. **Given** compliance scan scheduled, **When** scan completes, **Then** Ollama identifies security gaps and Now Assist creates compliance tickets with assigned owners
5. **Given** active incident response, **When** AIs collaborate on investigation, **Then** system displays real-time workflow progress showing which AI is working on which analysis step

---

### User Story 5 - Web Search Knowledge Augmentation (Priority: P5)

When Ollama encounters questions beyond its training data, the system automatically performs web searches to supplement responses with current information.

**Why this priority**: Enhances Ollama's utility but is not critical for core MCP bridging functionality. Can be added after core workflows are stable.

**Independent Test**: Can be fully tested by asking Ollama a question about recent events (post-training cutoff), verifying web search is triggered, and confirming response includes both Ollama's analysis and search results.

**Acceptance Scenarios**:

1. **Given** Ollama receives question about recent events, **When** Ollama determines knowledge gap, **Then** system automatically searches web and integrates findings into response
2. **Given** web search triggered, **When** search returns results, **Then** Ollama synthesizes information and cites sources used
3. **Given** security vulnerability inquiry, **When** Ollama lacks CVE details, **Then** system searches vulnerability databases and returns latest threat intelligence
4. **Given** web search in progress, **When** search takes longer than 10 seconds, **Then** system displays "searching web" indicator
5. **Given** web search fails, **When** no results found or network error, **Then** Ollama responds with available knowledge and explains search limitation

---

### User Story 6 - Multi-LLM API Integration (Priority: P6)

Users can configure and switch between multiple LLM providers (Perplexity, OpenAI, Mistral, etc.) as alternatives or complements to Ollama.

**Why this priority**: Provides future extensibility but not required for MVP. Demonstrates platform's evolutionary design.

**Independent Test**: Can be fully tested by adding OpenAI API key in configuration, selecting OpenAI as AI provider, and verifying chat interactions work identically to Ollama mode.

**Acceptance Scenarios**:

1. **Given** configuration tab open, **When** user adds OpenAI API key and saves, **Then** system validates key and marks OpenAI as available provider
2. **Given** multiple LLM providers configured, **When** user selects different provider from dropdown, **Then** system switches chat context to new provider without losing conversation history
3. **Given** active OpenAI session, **When** user asks question, **Then** system routes request to OpenAI API and displays response with provider attribution
4. **Given** Perplexity API configured, **When** user selects Perplexity as search provider, **Then** system uses Perplexity instead of DuckDuckGo for knowledge augmentation
5. **Given** API quota exceeded, **When** user attempts query, **Then** system displays quota error and suggests alternative configured providers

---

### Edge Cases

- What happens when ServiceNow instance is unreachable mid-conversation?
- How does system handle Ollama model switching during active analysis?
- What occurs if user saves configuration with partial credentials (e.g., URL but no password)?
- How does system behave when both AIs return conflicting information?
- What happens if MCP protocol communication times out during AI-to-AI exchange?
- How does system handle multiple simultaneous chat conversations from the same user?
- What occurs when user deletes API credentials that are currently in use?
- How does system manage conversation history when switching between LLM providers?
- What happens if web search returns zero results for knowledge augmentation?
- How does system handle malformed responses from external AI APIs?
- What occurs when session timeout is reached but user is actively typing a message?
- How does system handle session cleanup if persisted conversations are manually deleted from disk?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST be packaged as local desktop application with embedded web UI that runs on user's machine (single-user mode)
- **FR-002**: System MUST allow users to configure ServiceNow instance URL, username, and password through configuration interface
- **FR-003**: System MUST validate ServiceNow credentials by attempting connection and report success or failure with specific error messages
- **FR-004**: System MUST allow users to configure Ollama endpoint URL and test connectivity
- **FR-005**: System MUST auto-detect installed Ollama models and allow users to select default model during initial setup
- **FR-006**: System MUST securely store credentials locally on user's machine (encrypted at rest using OS keychain/credential manager, not exposed in logs or UI)
- **FR-007**: System MUST persist configuration settings across application restarts
- **FR-008**: System MUST provide conversational chat interface for interacting with Ollama AI
- **FR-009**: System MUST maintain conversation context across multiple exchanges in a session
- **FR-010**: System MUST implement MCP server capabilities to expose Ollama tools to ServiceNow Now Assist
- **FR-011**: System MUST implement MCP client capabilities to call ServiceNow Now Assist tools from Ollama
- **FR-012**: System MUST enable bidirectional communication where either AI can initiate requests to the other
- **FR-013**: System MUST display clear attribution showing which AI provided which information in responses
- **FR-014**: System MUST automatically trigger web search when Ollama indicates knowledge limitations using configured search provider (DuckDuckGo by default)
- **FR-015**: System MUST integrate web search results into Ollama responses with source citations
- **FR-016**: System MUST allow users to configure search provider (DuckDuckGo free default, optional Perplexity/Google/Custom with API keys)
- **FR-017**: System MUST support security incident analysis workflow orchestrating Ollama and Now Assist
- **FR-018**: System MUST implement threat analysis tools (CVE lookup, threat intelligence correlation, pattern analysis)
- **FR-019**: System MUST implement vulnerability assessment tools (scan result correlation, risk scoring, remediation generation)
- **FR-020**: System MUST allow users to add API keys for future LLM providers (Perplexity, OpenAI, Mistral)
- **FR-021**: System MUST provide extensible architecture allowing new MCP tools to be added without core system changes
- **FR-022**: System MUST display real-time status indicators for ServiceNow and Ollama connection health
- **FR-023**: System MUST log all AI-to-AI communications for debugging and audit purposes
- **FR-024**: System MUST handle connection failures gracefully with retry mechanisms and user notifications
- **FR-025**: System MUST display progress indicators during long-running AI operations (>3 seconds)
- **FR-026**: System MUST preserve conversation history within active sessions and allow users to review past exchanges
- **FR-027**: System MUST allow users to choose whether to save conversations permanently (opt-in per conversation)
- **FR-028**: System MUST provide interface for users to browse, search, and delete saved conversations
- **FR-029**: System MUST allow users to configure session inactivity timeout (default 24 hours) for automatic memory cleanup
- **FR-030**: System MUST warn users before automatically cleaning up inactive conversations and offer option to keep active
- **FR-031**: System MUST support configuration profiles allowing users to switch between different ServiceNow instances

### Key Entities

- **Configuration Profile**: Represents stored connection settings including ServiceNow instance details (URL, credentials), Ollama endpoint and selected model, optional API keys for third-party LLM and search services, connection validation status, selected search provider (DuckDuckGo default), and user preferences (session timeout, persistence defaults)
- **AI Session**: Represents a conversation session containing message history, current AI provider, conversation context, participant AIs involved, and persistence flag (whether user chose to save permanently)
- **MCP Tool**: Represents a callable capability exposed via Model Context Protocol including tool name, description, parameters, and implementation binding to either Ollama or ServiceNow
- **Security Incident**: Represents a security event from ServiceNow including incident ID, severity, description, affected systems, and analysis results from AI collaboration
- **Analysis Result**: Represents output from AI analysis including threat assessment, vulnerability correlation, remediation recommendations, and attribution to source AI
- **Conversation Message**: Represents a single exchange in chat including sender (user, Ollama, Now Assist), message content, timestamp, and any attached metadata (tool calls, search results)
- **Web Search Result**: Represents information retrieved from web searches including query terms, source URLs, summary content, and relevance scores

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can successfully configure and validate ServiceNow + Ollama connections in under 3 minutes on first use
- **SC-002**: Chat responses from Ollama appear within 5 seconds for 95% of queries
- **SC-003**: AI-to-AI communication completes successfully for 95% of multi-step workflows without manual intervention
- **SC-004**: Security incident analysis workflow completes within 30 seconds from initiation to combined report delivery
- **SC-005**: System handles at least 10 concurrent chat conversation windows (single user) without performance degradation
- **SC-006**: Web search augmentation triggers automatically within 2 seconds when Ollama indicates knowledge gap
- **SC-007**: Users successfully complete their first AI-assisted security analysis on first attempt 90% of the time
- **SC-008**: Configuration changes (adding new API keys, switching providers) take less than 1 minute
- **SC-009**: System maintains 99.5% uptime for core chat and configuration features
- **SC-010**: Zero credential exposure incidents (no credentials in logs, error messages, or UI source code)

### Performance & Quality Targets

Per constitution requirements (`.specify/memory/constitution.md`):

- **Response Times**: API reads <200ms p95, writes <500ms p95; UI feedback <100ms, transitions <1s
- **Resource Limits**: <500MB memory per instance, <70% CPU at peak
- **Test Coverage**: ≥80% code coverage across unit/integration/contract tests
- **Accessibility**: WCAG 2.1 Level AA compliance
- **Security**: OWASP Top 10 compliance, input validation at all boundaries

### Additional Quality Targets

- **Extensibility**: Adding new MCP tool requires modifying fewer than 3 files and takes less than 1 hour for experienced developer
- **Error Recovery**: System automatically recovers from transient connection failures within 30 seconds without user intervention
- **Conversation Context**: System maintains conversation context for minimum 50 message exchanges before requiring context refresh
- **Search Accuracy**: Web search results relevant to query at least 80% of the time based on user feedback
- **Multi-AI Coordination**: AI-to-AI workflows complete successfully on first attempt 90% of the time without retry logic triggering
