# Tasks: ServiceNow MCP Bridge Application

**Input**: Design documents from `/specs/001-servicenow-mcp-app/`
**Prerequisites**: plan.md (required), spec.md (required), data-model.md, contracts/, research.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Desktop app structure**: `src/` (TypeScript/React), `src-tauri/src/` (Rust backend), `tests/`
- Tauri project: Rust backend + TypeScript/React frontend
- Test structure: unit (fast, isolated) → integration (external deps) → contract (MCP schemas) → e2e (full user journeys)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Initialize Tauri project with TypeScript and React template
- [X] T002 Configure TypeScript strict mode in tsconfig.json
- [X] T003 Configure Rust toolchain and Cargo.toml dependencies (tauri, mcp-protocol-sdk, sqlx, reqwest, serde, tokio)
- [X] T004 [P] Set up ESLint and Prettier for TypeScript in .eslintrc.json and .prettierrc
- [X] T005 [P] Set up Clippy for Rust in src-tauri/Cargo.toml
- [X] T006 [P] Create project directory structure per plan.md (src/main, src/renderer, src/core, src/models, tests/)
- [X] T007 Install npm dependencies (@modelcontextprotocol/sdk, zod, react, @tanstack/react-query, zustand)
- [X] T008 Configure Drizzle ORM in src/core/storage/drizzle.config.ts
- [X] T009 Set up Vitest test runner in vitest.config.ts
- [X] T010 Set up Playwright for E2E tests in playwright.config.ts
- [X] T011 Create .env.example file with required environment variables (OLLAMA_ENDPOINT, LOG_LEVEL, DB_PATH)
- [X] T012 Create README.md with quick start instructions

### Phase 1 Validation Gates *(Constitution Requirement)*

**Automated Gates**:
- [X] Linting/formatting checks configured and passing (ESLint, Prettier, Clippy)
- [X] Project builds successfully (npm run build, cargo build)
- [X] Basic project structure validated against plan.md

**Manual Gates**:
- [X] Setup checklist reviewed and approved
- [X] Project structure aligns with plan.md
- [X] All developers can successfully run development environment

**Documentation**: ✅ Created `specs/001-servicenow-mcp-app/phase1-validation.md` documenting gate results

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T013 Create Drizzle schema in src/core/storage/schema.ts for ConfigurationProfile entity
- [X] T014 Generate initial database migration with Drizzle Kit (npx drizzle-kit generate)
- [X] T015 Create database initialization in src/core/storage/database.ts (SQLite connection with WAL mode)
- [X] T016 Implement ConfigurationProfile repository in src/core/storage/repositories/configuration.ts (CRUD operations)
- [X] T017 Implement keychain service in src-tauri/src/keychain.rs using tauri-plugin-keyring
- [X] T018 Create Tauri command for storing credentials in src-tauri/src/commands/credentials.rs
- [X] T019 Create Tauri command for retrieving credentials in src-tauri/src/commands/credentials.rs
- [X] T020 [P] Implement logger utility in src/utils/logger.ts
- [X] T021 [P] Implement error types in src/utils/errors.ts
- [X] T022 Create Tauri IPC handlers in src/main/ipc.ts for frontend-backend communication
- [X] T023 Create global state management with Zustand in src/renderer/store/index.ts
- [X] T024 Implement Ollama client in src/core/integrations/ollama.ts (connection, model detection)
- [X] T025 Implement ServiceNow REST API client in src/core/integrations/servicenow.ts (authentication, basic API calls)
- [X] T026 Create Rust module for Ollama integration in src-tauri/src/integrations/ollama.rs
- [X] T027 Create Rust module for ServiceNow integration in src-tauri/src/integrations/servicenow.rs

### Phase 2 Validation Gates *(Constitution Requirement - CRITICAL)*

**Automated Gates**:
- [ ] All foundation tests passing (unit + integration for database, keychain, clients)
- [ ] Security scan passed (cargo audit, npm audit - no critical/high vulnerabilities)
- [ ] Code coverage ≥80% for foundation code
- [ ] Linting/formatting checks passing (ESLint, Clippy)
- [ ] Database migrations apply successfully
- [ ] Keychain integration works on all target platforms (Windows, macOS, Linux)

**Manual Gates**:
- [ ] Code review approved by at least one peer
- [ ] Manual infrastructure validation complete (database CRUD, keychain store/retrieve, API clients)
- [ ] Architecture review approved
- [ ] Foundation smoke test executed and documented (connect to test Ollama, test ServiceNow, store/retrieve credentials)

**Documentation**: Create `specs/001-servicenow-mcp-app/phase2-validation.md` documenting gate results

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Configure AI Bridge Connections (Priority: P1) 🎯 MVP

**Goal**: Users can configure and validate connections to ServiceNow and Ollama through the web UI, with credentials securely stored in OS keychain.

**Independent Test**: User opens configuration tab, enters ServiceNow URL + credentials and Ollama endpoint, clicks test connection, sees green status indicators, saves settings, restarts app, and sees connections auto-reconnect.

### Implementation for User Story 1

- [X] T028 [P] [US1] Create ConfigurationProfile TypeScript model in src/models/Configuration.ts
- [X] T029 [P] [US1] Create Configuration UI component in src/renderer/components/Configuration.tsx
- [X] T030 [P] [US1] Create status indicator component in src/renderer/components/StatusIndicator.tsx
- [X] T031 [US1] Implement connection test service in src/core/services/connection-test.ts (validates ServiceNow + Ollama connectivity)
- [X] T032 [US1] Create Tauri command for testing ServiceNow connection in src-tauri/src/commands/test_servicenow.rs
- [X] T033 [US1] Create Tauri command for testing Ollama connection and listing models in src-tauri/src/commands/test_ollama.rs
- [X] T034 [US1] Implement configuration save logic in src/renderer/pages/Settings.tsx
- [X] T035 [US1] Implement auto-reconnect on app startup in src/main/index.ts (load active config, attempt connections)
- [X] T036 [US1] Add validation for ServiceNow URL format and Ollama endpoint in src/core/services/validation.ts
- [X] T037 [US1] Implement error handling and user-friendly error messages for connection failures in src/renderer/components/Configuration.tsx
- [X] T038 [US1] Add configuration profile switching in src/renderer/components/ProfileSelector.tsx

### User Story 1 Validation Gates *(Constitution Requirement)*

**Automated Gates**:
- [ ] All tests passing for US1 (unit tests for validation, integration tests for connection testing)
- [ ] Code coverage ≥80% for US1 code
- [ ] Security scan passed (credentials never logged, encrypted in keychain)
- [ ] Linting/formatting checks passing

**Manual Gates**:
- [ ] Code review approved for US1 changes
- [ ] Manual test plan executed: Configure ServiceNow (valid + invalid credentials), Configure Ollama (valid + invalid endpoint), Test connections, Save, Restart app, Verify auto-reconnect
- [ ] UX review approved (clear error messages, intuitive flow, status indicators visible)
- [ ] Accessibility tested (keyboard navigation, screen reader)

**Documentation**: Create `specs/001-servicenow-mcp-app/us1-validation.md` documenting gate results

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently - configuration and connection validation work end-to-end

---

## Phase 4: User Story 2 - Chat with Ollama AI (Priority: P2)

**Goal**: Users can interact with Ollama AI through a conversational web interface, with web search augmentation when Ollama lacks knowledge.

**Independent Test**: User types "What is ServiceNow?" in chat, receives response from Ollama within 5 seconds. User asks about recent event (post-training cutoff), system automatically triggers web search, and response includes both Ollama analysis and search results with citations.

### Database Schema for User Story 2

- [X] T039 [P] [US2] Add AISession schema to Drizzle in src/core/storage/schema.ts
- [X] T040 [P] [US2] Add ConversationMessage schema to Drizzle in src/core/storage/schema.ts
- [X] T041 [P] [US2] Add WebSearchResult schema to Drizzle in src/core/storage/schema.ts
- [X] T042 [US2] Generate database migration for US2 entities (npx drizzle-kit generate)

### Implementation for User Story 2

- [X] T043 [P] [US2] Create AISession repository in src/core/storage/repositories/session.ts
- [X] T044 [P] [US2] Create ConversationMessage repository in src/core/storage/repositories/message.ts
- [X] T045 [P] [US2] Create Chat UI component in src/renderer/components/Chat.tsx
- [X] T046 [P] [US2] Create Message component in src/renderer/components/Message.tsx
- [X] T047 [P] [US2] Create ConversationList component in src/renderer/components/ConversationList.tsx
- [X] T048 [US2] Implement chat service in src/core/services/chat.ts (send message, receive response, manage context)
- [X] T049 [US2] Implement Ollama streaming response handling in src/core/integrations/ollama.ts
- [X] T050 [US2] Create Tauri command for sending chat messages in src-tauri/src/commands/chat.rs
- [X] T051 [US2] Implement DuckDuckGo search provider in src/core/integrations/search/duckduckgo.ts
- [X] T052 [US2] Implement web search detection logic in src/core/services/search-augmentation.ts (detect knowledge gaps from Ollama response)
- [X] T053 [US2] Integrate web search results into Ollama responses with citations in src/core/services/chat.ts
- [X] T054 [US2] Implement conversation persistence (save conversation button) in src/renderer/components/Chat.tsx
- [X] T055 [US2] Implement session timeout logic in src/core/services/session-manager.ts (configurable timeout, auto-cleanup)
- [X] T056 [US2] Add progress indicator for long AI operations (>3s) in src/renderer/components/ProgressIndicator.tsx
- [X] T057 [US2] Implement conversation history review in src/renderer/pages/History.tsx
- [X] T058 [US2] Add error recovery (connection lost, retry) in src/core/services/error-recovery.ts

### User Story 2 Validation Gates *(Constitution Requirement)*

**Automated Gates**:
- [ ] All tests passing for US2 (unit, integration for Ollama client, search integration, database operations)
- [ ] Code coverage ≥80% for US2 code
- [ ] Performance benchmarks met (chat responses <5s 95%, web search <2s)
- [ ] Regression tests passing (US1 + US2 still work)
- [ ] Security scan passed

**Manual Gates**:
- [ ] Code review approved for US2 changes
- [ ] Manual test plan executed: Send message, receive response, ask about recent event, verify web search triggers, verify citations, save conversation, verify persistence, test session timeout, test connection loss recovery
- [ ] UX review approved (chat interface intuitive, progress indicators visible, error messages clear)
- [ ] Accessibility tested (keyboard navigation, screen reader for messages)

**Documentation**: Create `specs/001-servicenow-mcp-app/us2-validation.md` documenting gate results

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - configuration + basic chat with search augmentation work end-to-end

---

## Phase 5: User Story 3 - Bidirectional AI Communication (Priority: P3)

**Goal**: Enable Ollama and ServiceNow Now Assist to communicate bidirectionally via MCP, calling each other's tools to solve complex problems collaboratively.

**Independent Test**: User asks Ollama "What are my open ServiceNow incidents?", observes Ollama invoke MCP client to query ServiceNow, and receives aggregated incident list. User creates test incident in ServiceNow with security indicator, observes Now Assist call Ollama MCP server for threat analysis, and sees combined analysis results.

### MCP Infrastructure for User Story 3

- [X] T059 [P] [US3] Add MCPTool schema to Drizzle in src/core/storage/schema.ts
- [X] T060 [US3] Generate database migration for MCPTool entity (npx drizzle-kit generate)
- [X] T061 [P] [US3] Create MCP protocol types in src/core/mcp/protocol.ts
- [X] T062 [P] [US3] Implement MCP server in src-tauri/src/mcp/server.rs (stdio transport, tool registry)
- [X] T063 [P] [US3] Implement MCP client in src/core/mcp/client.ts (HTTP transport to ServiceNow)
- [X] T064 [US3] Create tool registry service in src/core/services/tool-registry.ts (dynamic tool loading)

### MCP Tool Implementation for User Story 3 (Basic Tools)

- [X] T065 [P] [US3] Define analyze_threat_indicator Zod schema in src/core/mcp/tools/analyze_threat.ts
- [X] T066 [P] [US3] Define assess_vulnerability Zod schema in src/core/mcp/tools/assess_vulnerability.ts
- [X] T067 [US3] Implement analyze_threat_indicator handler in src/core/mcp/tools/analyze_threat.ts (IOC analysis against threat intelligence)
- [X] T068 [US3] Implement assess_vulnerability handler in src/core/mcp/tools/assess_vulnerability.ts (CVE assessment with CVSS)
- [X] T069 [US3] Register MCP tools in server in src-tauri/src/mcp/server.rs
- [X] T070 [US3] Implement MCP client ServiceNow tool invocation in src/core/mcp/client.ts (call Now Assist tools from Ollama)

### Bidirectional Communication Integration for User Story 3

- [X] T071 [US3] Integrate MCP client into Ollama chat flow in src/core/services/chat.ts (detect when to call ServiceNow tools)
- [X] T072 [US3] Implement AI attribution display in src/renderer/components/Message.tsx (show which AI provided which info)
- [X] T073 [US3] Implement error handling for MCP communication failures in src/core/mcp/error-handler.ts
- [X] T074 [US3] Add logging for AI-to-AI communications in src/utils/logger.ts (audit trail per FR-021)
- [X] T075 [US3] Implement retry logic with exponential backoff for MCP calls in src/core/mcp/retry.ts

### User Story 3 Validation Gates *(Constitution Requirement)*

**Automated Gates**:
- [ ] All tests passing for US3 (unit tests for MCP protocol, contract tests for tool schemas, integration tests for bidirectional communication)
- [ ] Code coverage ≥80% for US3 code
- [ ] MCP contract tests validate all tool schemas (Zod validation)
- [ ] Performance benchmarks met (AI-to-AI communication completes 95% of workflows successfully)
- [ ] Full regression suite passing (US1 + US2 + US3)
- [ ] Security scan passed

**Manual Gates**:
- [ ] Code review approved for US3 changes
- [ ] Manual test plan executed: Ask Ollama to query ServiceNow, verify MCP client call, verify results, create ServiceNow incident, trigger Now Assist call to Ollama MCP server, verify analysis, test error scenarios (timeout, network failure)
- [ ] UX review approved (AI attribution clear, MCP calls transparent to user)
- [ ] Architecture review approved (MCP implementation follows protocol spec)

**Documentation**: Create `specs/001-servicenow-mcp-app/us3-validation.md` documenting gate results

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should all work independently - configuration + chat + bidirectional AI collaboration work end-to-end

---

## Phase 6: User Story 4 - Security Incident Analysis Workflow (Priority: P4)

**Goal**: Users can trigger security workflows where Ollama and Now Assist collaborate on threat detection, vulnerability assessment, incident correlation, and remediation planning.

**Independent Test**: User creates test security incident in ServiceNow with phishing indicators, clicks "Analyze with AI", observes Ollama analyze sender reputation and content patterns, Now Assist checks historical patterns, system auto-blocks confirmed threat, and combined report appears within 30 seconds.

### Database Schema for User Story 4

- [X] T076 [P] [US4] Add SecurityIncident schema to Drizzle in src/core/storage/schema.ts
- [X] T077 [P] [US4] Add AnalysisResult schema to Drizzle in src/core/storage/schema.ts
- [X] T078 [US4] Generate database migration for US4 entities (npx drizzle-kit generate)

### MCP Tools for User Story 4 (Security-Specific)

- [X] T079 [P] [US4] Define correlate_security_incidents Zod schema in src/core/mcp/tools/correlate_incidents.ts
- [X] T080 [P] [US4] Define generate_remediation_plan Zod schema in src/core/mcp/tools/generate_remediation.ts
- [X] T081 [P] [US4] Define analyze_attack_surface Zod schema in src/core/mcp/tools/analyze_attack_surface.ts
- [X] T082 [P] [US4] Define audit_security_compliance Zod schema in src/core/mcp/tools/audit_compliance.ts
- [X] T083 [US4] Implement correlate_security_incidents handler in src/core/mcp/tools/correlate_incidents.ts
- [X] T084 [US4] Implement generate_remediation_plan handler in src/core/mcp/tools/generate_remediation.ts
- [X] T085 [US4] Implement analyze_attack_surface handler in src/core/mcp/tools/analyze_attack_surface.ts
- [X] T086 [US4] Implement audit_security_compliance handler in src/core/mcp/tools/audit_compliance.ts
- [X] T087 [US4] Register all 6 security tools in MCP server in src-tauri/src/mcp/server.rs

### Security Workflow UI for User Story 4

- [X] T088 [P] [US4] Create SecurityIncident repository in src/core/storage/repositories/incident.ts
- [X] T089 [P] [US4] Create AnalysisResult repository in src/core/storage/repositories/analysis.ts
- [X] T090 [P] [US4] Create SecurityWorkflow UI component in src/renderer/components/SecurityWorkflow.tsx
- [X] T091 [P] [US4] Create IncidentList component in src/renderer/components/IncidentList.tsx
- [X] T092 [P] [US4] Create AnalysisReport component in src/renderer/components/AnalysisReport.tsx
- [X] T093 [US4] Implement security workflow orchestration in src/core/services/security-workflow.ts (coordinates Ollama + Now Assist analysis)
- [X] T094 [US4] Implement phishing analysis workflow in src/core/workflows/phishing.ts
- [X] T095 [US4] Implement vulnerability assessment workflow in src/core/workflows/vulnerability.ts
- [X] T096 [US4] Implement compliance audit workflow in src/core/workflows/compliance.ts
- [X] T097 [US4] Add real-time workflow progress display in src/renderer/components/WorkflowProgress.tsx
- [X] T098 [US4] Implement workflow result storage in src/core/services/security-workflow.ts (save analysis to database)

### User Story 4 Validation Gates *(Constitution Requirement)*

**Automated Gates**:
- [ ] All tests passing for US4 (unit, integration, contract tests for all 6 security tools)
- [ ] Code coverage ≥80% for US4 code
- [ ] Performance benchmarks met (security analysis <30s from initiation to report)
- [ ] All security tool schemas validated via contract tests
- [ ] Full regression suite passing (US1 + US2 + US3 + US4)
- [ ] Security scan passed

**Manual Gates**:
- [ ] Code review approved for US4 changes
- [ ] Manual test plan executed: Create phishing incident, trigger analysis, verify both AIs contribute, verify report within 30s, test vulnerability workflow, test compliance audit, test remediation plan generation
- [ ] UX review approved (workflow progress clear, analysis report readable, tools discoverable)
- [ ] Security review approved (no sensitive data in logs, secure tool invocation)

**Documentation**: Create `specs/001-servicenow-mcp-app/us4-validation.md` documenting gate results

**Checkpoint**: All core security workflows should now be functional - P1-P4 user stories complete and independently testable

---

## Phase 7: User Story 5 - Web Search Knowledge Augmentation (Priority: P5)

**Goal**: Enhance web search capabilities with configurable providers (DuckDuckGo, Perplexity, Google) for better knowledge augmentation.

**Independent Test**: User asks Ollama about CVE details not in training data, system detects knowledge gap, automatically searches vulnerability databases via configured provider (DuckDuckGo by default), and returns threat intelligence with citations.

### Implementation for User Story 5

- [X] T099 [P] [US5] Create search provider interface in src/core/integrations/search/provider.ts
- [X] T100 [P] [US5] Implement Perplexity API client in src/core/integrations/search/perplexity.ts
- [X] T101 [P] [US5] Implement Google search API client in src/core/integrations/search/google.ts
- [X] T102 [US5] Implement search provider selection logic in src/core/services/search-augmentation.ts
- [X] T103 [US5] Add search provider configuration UI in src/renderer/components/SearchProviderConfig.tsx
- [X] T104 [US5] Update ConfigurationProfile to include search provider selection in src/core/storage/schema.ts
- [X] T105 [US5] Generate migration for search provider config (npx drizzle-kit generate)
- [X] T106 [US5] Implement API key validation for Perplexity/Google in src/core/services/validation.ts
- [X] T107 [US5] Add search provider status indicators in src/renderer/components/StatusIndicator.tsx
- [X] T108 [US5] Implement fallback logic (Perplexity fails → DuckDuckGo) in src/core/services/search-augmentation.ts

### User Story 5 Validation Gates *(Constitution Requirement)*

**Automated Gates**:
- [ ] All tests passing for US5 (unit tests for search providers, integration tests for API clients)
- [ ] Code coverage ≥80% for US5 code
- [ ] Performance benchmarks met (web search <2s regardless of provider)
- [ ] Full regression suite passing (US1-US5)
- [ ] Security scan passed (API keys stored securely in keychain)

**Manual Gates**:
- [ ] Code review approved for US5 changes
- [ ] Manual test plan executed: Configure Perplexity API key, test Perplexity search, switch to DuckDuckGo, test DuckDuckGo search, test fallback behavior (simulate Perplexity failure)
- [ ] UX review approved (provider selection clear, API key entry secure)

**Documentation**: Create `specs/001-servicenow-mcp-app/us5-validation.md` documenting gate results

**Checkpoint**: Web search providers configurable and working with all three options (DuckDuckGo, Perplexity, Google)

---

## Phase 8: User Story 6 - Multi-LLM API Integration (Priority: P6)

**Goal**: Support multiple LLM providers (OpenAI, Mistral, etc.) as alternatives to Ollama, with seamless provider switching.

**Independent Test**: User adds OpenAI API key in configuration, selects OpenAI as AI provider from dropdown, asks question in chat, receives response from OpenAI API with provider attribution, switches back to Ollama, and conversation history is preserved.

### Implementation for User Story 6

- [X] T109 [P] [US6] Create LLM provider interface in src/core/integrations/llm/provider.ts
- [X] T110 [P] [US6] Implement OpenAI API client in src/core/integrations/llm/openai.ts
- [X] T111 [P] [US6] Implement Mistral API client in src/core/integrations/llm/mistral.ts
- [X] T112 [US6] Implement LLM provider selection logic in src/core/services/chat.ts
- [X] T113 [US6] Add LLM provider configuration UI in src/renderer/components/LLMProviderConfig.tsx
- [X] T114 [US6] Update ConfigurationProfile to include LLM provider selection in src/core/storage/schema.ts
- [X] T115 [US6] Generate migration for LLM provider config (npx drizzle-kit generate)
- [X] T116 [US6] Implement API key validation for OpenAI/Mistral in src/core/services/validation.ts
- [X] T117 [US6] Add provider attribution to message display in src/renderer/components/Message.tsx
- [X] T118 [US6] Implement provider switching without losing conversation history in src/core/services/chat.ts
- [X] T119 [US6] Handle API quota exceeded errors in src/core/integrations/llm/error-handler.ts
- [X] T120 [US6] Add provider status indicators in src/renderer/components/StatusIndicator.tsx

### User Story 6 Validation Gates *(Constitution Requirement)*

**Automated Gates**:
- [ ] All tests passing for US6 (unit tests for LLM providers, integration tests for API clients)
- [ ] Code coverage ≥80% for US6 code
- [ ] Full regression suite passing (US1-US6)
- [ ] Security scan passed (API keys stored securely)

**Manual Gates**:
- [ ] Code review approved for US6 changes
- [ ] Manual test plan executed: Add OpenAI key, select OpenAI, send message, verify response, switch to Ollama, verify conversation preserved, test quota exceeded handling
- [ ] UX review approved (provider switching intuitive, attribution clear)

**Documentation**: Create `specs/001-servicenow-mcp-app/us6-validation.md` documenting gate results

**Checkpoint**: All user stories complete and independently functional - P1-P6 delivered incrementally

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T121 [P] Add comprehensive logging throughout application in all src/core/ modules
- [X] T122 [P] Implement performance monitoring in src/utils/performance.ts
- [X] T123 [P] Add analytics for tool usage in src/core/services/analytics.ts
- [X] T124 [P] Create user documentation in docs/user-guide.md
- [X] T125 [P] Create API documentation in docs/api-reference.md
- [X] T126 Code cleanup and refactoring for consistency across all modules
- [X] T127 Performance optimization (lazy loading, caching) in src/renderer/
- [X] T128 Accessibility audit and fixes (keyboard navigation, ARIA labels, screen reader support)
- [X] T129 Security hardening (input sanitization audit, dependency updates)
- [X] T130 Create demo video and screenshots for README.md
- [X] T131 Run quickstart.md validation (ensure new developers can set up in 30 minutes)

### Final Validation Gates *(Constitution Requirement - Production Readiness)*

**Automated Gates**:
- [ ] Full regression suite passing (all tests: unit, integration, contract, E2E)
- [ ] Load tests passing (10 concurrent conversations, memory <500MB, CPU <70%)
- [ ] Security scan passed (cargo audit, npm audit - zero critical/high vulnerabilities)
- [ ] Code coverage ≥80% across entire feature
- [ ] All linting/formatting checks passing (ESLint, Prettier, Clippy)
- [ ] Production build succeeds for all platforms (Windows, macOS, Linux)

**Manual Gates**:
- [ ] Full system manual test complete (all P1-P6 user stories tested end-to-end)
- [ ] User acceptance testing (UAT) complete and signed off
- [ ] Final architecture/security review approved
- [ ] Documentation complete (user guide, API docs, quickstart, CHANGELOG)
- [ ] Deployment checklist reviewed (installation instructions, system requirements)
- [ ] Accessibility validation complete (WCAG 2.1 Level AA compliance verified)

**Documentation**: Create `specs/001-servicenow-mcp-app/production-validation.md` documenting gate results and production readiness sign-off

**Production Ready**: Feature meets all constitution requirements and is ready for release

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phases 3-8)**: All depend on Foundational phase completion
  - User Story 1 (P1): Can start after Foundational - No dependencies on other stories
  - User Story 2 (P2): Can start after Foundational - Independent from US1 but builds on similar patterns
  - User Story 3 (P3): Can start after Foundational - Independent but recommended after US2 (uses chat infrastructure)
  - User Story 4 (P4): Depends on US3 completion (requires MCP infrastructure)
  - User Story 5 (P5): Can start after Foundational - Independent, enhances US2 search
  - User Story 6 (P6): Depends on US2 completion (requires chat infrastructure)
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent from US1
- **User Story 3 (P3)**: Recommended after US2 (uses chat service), but can start after Foundational
- **User Story 4 (P4)**: MUST complete US3 first (requires MCP server/client infrastructure)
- **User Story 5 (P5)**: Can start after Foundational - Independent, enhances US2
- **User Story 6 (P6)**: MUST complete US2 first (requires chat service)

### Within Each User Story

- Database schema migrations MUST complete before repositories
- Repositories MUST complete before services using them
- Services MUST complete before UI components using them
- UI components can be developed in parallel (marked with [P])
- Integration points (MCP, chat, workflows) completed after foundational pieces

### Parallel Opportunities

- **Setup (Phase 1)**: All tasks marked [P] can run in parallel (T004, T005, T006, T007)
- **Foundational (Phase 2)**: Tasks T020, T021 can run in parallel with database tasks
- **Within User Stories**: All tasks marked [P] can run in parallel within their story phase
  - Example US1: T028, T029, T030 (models and UI components)
  - Example US2: T039, T040, T041 (database schemas), T043, T044 (repositories), T045, T046, T047 (UI components)
- **Across User Stories**: US1, US2, US5 can be worked on in parallel by different developers after Foundational phase
- Different user stories can be worked on in parallel by different team members after Foundational completes

---

## Parallel Example: User Story 2

```bash
# After Foundational phase completes, launch US2 database tasks in parallel:
Task: "T039 [P] [US2] Add AISession schema to Drizzle"
Task: "T040 [P] [US2] Add ConversationMessage schema to Drizzle"
Task: "T041 [P] [US2] Add WebSearchResult schema to Drizzle"

# After schemas complete, launch US2 repositories in parallel:
Task: "T043 [P] [US2] Create AISession repository"
Task: "T044 [P] [US2] Create ConversationMessage repository"

# After repositories complete, launch US2 UI components in parallel:
Task: "T045 [P] [US2] Create Chat UI component"
Task: "T046 [P] [US2] Create Message component"
Task: "T047 [P] [US2] Create ConversationList component"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Configure AI Bridge Connections)
4. **STOP and VALIDATE**: Test User Story 1 independently - configuration, credential storage, connection testing
5. Deploy/demo if ready - users can now configure ServiceNow + Ollama connections

**Timeline Estimate**: 2-3 weeks for MVP (P1 only)

### Incremental Delivery (Recommended)

1. Complete Setup + Foundational → Foundation ready (~1 week)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)  (~1 week)
3. Add User Story 2 → Test independently → Deploy/Demo (MVP + Chat)  (~1 week)
4. Add User Story 3 → Test independently → Deploy/Demo (MVP + Chat + MCP)  (~2 weeks)
5. Add User Story 4 → Test independently → Deploy/Demo (Full security workflows)  (~2 weeks)
6. Add User Story 5 → Test independently → Deploy/Demo (Enhanced search)  (~1 week)
7. Add User Story 6 → Test independently → Deploy/Demo (Multi-LLM)  (~1 week)
8. Polish → Production release  (~1 week)

**Total Timeline Estimate**: 10-11 weeks for full P1-P6 delivery with incremental validation

Each story adds value without breaking previous stories - continuous delivery model

### Parallel Team Strategy

With multiple developers after Foundational phase:

- **Developer A**: User Story 1 (Configuration) → 1 week
- **Developer B**: User Story 2 (Chat) → 1 week (parallel with A)
- **Developer C**: User Story 5 (Search Providers) → 1 week (parallel with A, B)

Then sequential for dependent stories:
- **Team**: User Story 3 (MCP) → 2 weeks (requires chat from US2)
- **Team**: User Story 4 (Security Workflows) → 2 weeks (requires MCP from US3)
- **Team**: User Story 6 (Multi-LLM) → 1 week (requires chat from US2)
- **Team**: Polish → 1 week

**Parallel Timeline Estimate**: 8-9 weeks with 3 developers

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- Constitution gates MUST pass before proceeding to next phase

---

## Task Summary

- **Total Tasks**: 131
- **Setup (Phase 1)**: 12 tasks
- **Foundational (Phase 2)**: 15 tasks (CRITICAL - blocks all user stories)
- **User Story 1 (P1 - MVP)**: 11 tasks
- **User Story 2 (P2)**: 20 tasks
- **User Story 3 (P3)**: 17 tasks
- **User Story 4 (P4)**: 23 tasks
- **User Story 5 (P5)**: 10 tasks
- **User Story 6 (P6)**: 12 tasks
- **Polish (Phase 9)**: 11 tasks

**Parallel Opportunities Identified**: 45+ tasks marked [P] for parallel execution

**Independent Test Criteria**: Each user story (P1-P6) has clear independent test criteria documented

**Suggested MVP Scope**: Phase 1 + Phase 2 + Phase 3 (User Story 1 only) = 38 tasks, ~2-3 weeks

All tasks follow the strict checklist format (checkbox, ID, labels, file paths) per constitution requirements.
