# Implementation Plan: ServiceNow MCP Bridge Application

**Branch**: `001-servicenow-mcp-app` | **Date**: 2026-02-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-servicenow-mcp-app/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build a local desktop application with embedded web UI that enables bidirectional AI collaboration between Ollama (local AI) and ServiceNow Now Assist via Model Context Protocol (MCP). The application provides a conversational interface, configuration management for credentials, optional conversation persistence, web search augmentation, and extensible security workflow automation. Single-user deployment running alongside Ollama on user's machine with credentials stored securely in OS keychain.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend/UI) + Rust 1.75+ (backend/Tauri main process) - Hybrid approach for DX + performance
**Primary Dependencies**: Tauri v2.0 (desktop framework), @modelcontextprotocol/sdk (MCP client), mcp-protocol-sdk (MCP server), better-sqlite3 + Drizzle ORM (database), tauri-plugin-keyring (credentials), reqwest (HTTP client), React 18+ (UI), Vitest (unit/integration tests), Playwright (E2E tests)
**Storage**: SQLite with better-sqlite3 driver (2000+ queries/sec, <10ms reads) + Drizzle ORM for migrations; FTS5 for full-text search; WAL mode for concurrent access
**Testing**: Vitest (unit, integration, contract tests) + cargo test (Rust backend) + Playwright (E2E desktop UI tests); ≥80% coverage enforced
**Target Platform**: Desktop - Windows 10+, macOS 11+, Linux (major distributions); Uses system WebView (WKWebView/WebView2/WebKitGTK)
**Project Type**: Desktop application (Tauri single project: Rust backend + TypeScript/React frontend)
**Performance Goals**: UI feedback <100ms, AI responses <5 seconds (95th percentile), web search <2 seconds, support 10 concurrent conversation windows, startup <3 seconds, <500MB memory (Tauri: 30-50 MB idle, 80-150 MB under load)
**Constraints**: <500MB memory per instance, <70% CPU at peak, local-only storage (no cloud sync), offline-capable for cached conversations, credential security via OS keychain (macOS Keychain, Windows Credential Vault, Linux Secret Service)
**Scale/Scope**: Single-user application, unlimited saved conversations (user-managed cleanup), multiple ServiceNow instance profiles, extensible MCP tool registry (initial 6 security tools: threat analysis, vulnerability assessment, incident correlation, remediation planning, attack surface analysis, compliance auditing)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This feature must comply with all Core Principles defined in `.specify/memory/constitution.md`:

### I. Code Quality Standards
- [X] Type safety strategy defined - TypeScript strict mode (if Electron) or Rust ownership system (if Tauri) enforces type safety throughout
- [X] Error handling approach documented - All external calls (Ollama, ServiceNow, search APIs) wrapped with typed error handling; user-facing errors provide actionable messages
- [X] Security considerations documented - Input sanitization at all boundaries, credentials stored in OS keychain, no hardcoded secrets, OWASP Top 10 compliance validated in security scan gate
- [ ] Dependency justification documented - Pending desktop framework research (Phase 0); will document all dependencies with security audit results

### II. Testing First
- [X] TDD workflow planned - Tests written before implementation for all business logic; user approval on test plans before implementation begins
- [X] Test types identified: Unit (business logic, MCP protocol), Integration (ServiceNow/Ollama APIs, database operations), Contract (MCP tool schemas), Manual (user journeys, security workflows)
- [X] Test coverage target: ≥80% - Enforced via automated gate before phase sign-off
- [X] Manual test plan approach documented - Critical path scenarios (P1-P4 user stories) tested manually with documented results in phase validation artifacts

### III. User Experience Consistency
- [X] UI/UX patterns identified - Modern desktop app patterns; consistent navigation, status indicators, progress feedback; follows platform guidelines (macOS HIG, Windows Fluent, Linux GNOME/KDE standards)
- [X] Feedback mechanisms defined - <100ms input feedback, <1s transitions, progress indicators for >3s operations, connection health indicators, error toasts with retry actions
- [X] Accessibility requirements documented - WCAG 2.1 Level AA compliance: keyboard navigation, screen reader support, color contrast ratios, focus management
- [X] Error recovery approach defined - Graceful degradation (offline mode), automatic reconnection with exponential backoff, conversation state preserved across crashes, user-triggered retry mechanisms

### IV. Performance Standards
- [X] Response time targets defined - UI <100ms feedback, API reads <200ms p95, writes <500ms p95, AI responses <5s (95%), web search <2s
- [X] Resource limits documented - <500MB memory, <70% CPU at peak (10 concurrent conversations), local SQLite storage (unlimited but user-managed)
- [X] Scalability approach - Single-user model eliminates multi-tenant complexity; horizontal scaling N/A; vertical scaling via conversation cleanup (configurable 24hr timeout)
- [X] Monitoring/instrumentation plan defined - Application-level metrics logged locally: response times, error rates, conversation counts; exported to local log files for user debugging

### V. Phase Validation Gates
- [X] Automated gates identified - All tests pass (unit/integration/contract), ESLint/Clippy lint pass, OWASP Dependency Check security scan pass, coverage ≥80%, build succeeds all platforms
- [X] Manual gates identified - Code review (peer approval), manual test execution (documented results), UX review (accessibility audit), architecture review (Phase 1 design)
- [X] Gate documentation strategy defined - Phase validation artifacts stored in `specs/001-servicenow-mcp-app/phase{N}-validation.md` with test results, review sign-offs, and blocker resolution

**Violations Requiring Justification**: If any principle cannot be met, document in the Complexity Tracking section below with rationale and simpler alternatives considered.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── main/                  # Desktop app main process
│   ├── index.ts          # Application entry point
│   ├── window.ts         # Window management
│   └── ipc.ts            # IPC handlers for renderer communication
├── renderer/              # Web UI (runs in browser context)
│   ├── components/       # React/Vue components
│   │   ├── Chat.tsx
│   │   ├── Configuration.tsx
│   │   ├── ConversationList.tsx
│   │   └── StatusIndicator.tsx
│   ├── pages/
│   │   ├── Home.tsx
│   │   └── Settings.tsx
│   ├── services/         # Frontend API clients
│   │   ├── ipc.ts
│   │   └── api.ts
│   └── styles/
├── core/                  # Shared business logic
│   ├── mcp/              # MCP protocol implementation
│   │   ├── server.ts     # MCP server (exposes Ollama tools to ServiceNow)
│   │   ├── client.ts     # MCP client (calls ServiceNow tools from Ollama)
│   │   ├── tools/        # MCP tool definitions
│   │   │   ├── analyze_threat.ts
│   │   │   ├── enrich_incident.ts
│   │   │   ├── correlate_vulnerabilities.ts
│   │   │   ├── generate_remediation.ts
│   │   │   ├── assess_risk.ts
│   │   │   └── create_playbook.ts
│   │   └── protocol.ts   # MCP protocol types
│   ├── integrations/     # External service clients
│   │   ├── ollama.ts
│   │   ├── servicenow.ts
│   │   └── search/
│   │       ├── duckduckgo.ts
│   │       ├── perplexity.ts
│   │       └── provider.ts
│   ├── storage/          # Data persistence layer
│   │   ├── database.ts   # SQLite connection
│   │   ├── repositories/
│   │   │   ├── conversation.ts
│   │   │   ├── configuration.ts
│   │   │   └── session.ts
│   │   └── migrations/
│   └── security/         # Credential management
│       ├── keychain.ts   # OS keychain integration
│       └── encryption.ts
├── models/               # Data models/types
│   ├── Configuration.ts
│   ├── Conversation.ts
│   ├── Message.ts
│   ├── MCPTool.ts
│   └── SearchResult.ts
└── utils/
    ├── logger.ts
    └── errors.ts

tests/
├── unit/                 # Fast isolated tests
│   ├── mcp/
│   ├── integrations/
│   └── storage/
├── integration/          # Tests with external dependencies
│   ├── ollama.test.ts
│   ├── servicenow.test.ts
│   └── database.test.ts
├── contract/             # MCP protocol contract tests
│   ├── tools.test.ts
│   └── schemas.test.ts
└── e2e/                  # End-to-end UI tests
    ├── configuration.spec.ts
    ├── chat.spec.ts
    └── workflows.spec.ts

docs/
└── (existing ServiceNow PDFs)
```

**Structure Decision**: Desktop application with embedded web UI follows a hybrid architecture:
- `src/main/` contains the desktop app process (Node.js/Electron or Rust/Tauri)
- `src/renderer/` contains the web UI (React/Vue/Svelte) served within the app
- `src/core/` contains shared business logic accessible from both contexts
- MCP server/client implementation in `src/core/mcp/` enables bidirectional AI communication
- SQLite database managed in `src/core/storage/` for optional conversation persistence
- OS keychain integration in `src/core/security/` for credential storage
- Test structure follows test pyramid: unit (fast, isolated) → integration (external deps) → contract (MCP schemas) → e2e (full user journeys)

## Complexity Tracking

**Status**: No constitution violations requiring justification.

All constitution principles are satisfied:
- Type safety: TypeScript strict mode + Rust ownership system
- Testing: TDD workflow with ≥80% coverage target
- UX: WCAG 2.1 Level AA compliance, <100ms feedback
- Performance: <500MB memory (Tauri delivers 30-50 MB idle), <70% CPU
- Phase gates: Automated (tests, linting, security) + Manual (code review, UAT) defined

**Dependency Justification**: All dependencies documented in [research.md](./research.md) with security audit strategy.
