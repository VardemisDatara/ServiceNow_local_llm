# Technical Research: ServiceNow MCP Bridge Application

**Date**: 2026-02-12
**Feature**: 001-servicenow-mcp-app
**Research Phase**: Phase 0 (Technology Selection)

This document consolidates all technical research findings used to resolve NEEDS CLARIFICATION items from the implementation plan.

---

## 1. Desktop Framework Selection

### Decision: Tauri v2.0

**Rationale:**
- **Performance**: Meets <500MB memory and <70% CPU constraints (30-50 MB idle vs Electron's 200-300 MB)
- **Security**: Best-in-class security model with Tauri v2.0's explicit permission system (deny-by-default), encrypted IPC, process isolation
- **Bundle Size**: 3-10 MB vs Electron's 80-150 MB, significantly better user experience for downloads/updates
- **OS Integration**: Excellent keychain support via multiple plugins (tauri-plugin-keyring, tauri-plugin-keychain, Stronghold)
- **SQLite**: Official tauri-plugin-sql with built-in migrations and sqlx backend
- **MCP Compatibility**: Official Rust SDK available, can use TypeScript SDK on frontend for hybrid approach
- **Developer Experience**: Excellent setup (`npx create-tauri-app`), built-in hot reload, growing community (17,700+ Discord members)
- **Long-term Viability**: 35% YoY growth post-v2.0 release, production apps emerging, strong community momentum

**Alternatives Considered:**
- **Electron** (TypeScript/Node.js):
  - Pros: Largest ecosystem, native TypeScript, mature tooling, lowest learning curve
  - Cons: Exceeds memory budget (500+ MB under load), large bundles (80-150 MB), requires manual security lockdown
  - Rejected because: Cannot meet <500MB memory requirement under moderate load
- **Neutralino** (Lightweight):
  - Pros: Extremely small bundle (0.5-2 MB), minimal footprint
  - Cons: No keychain support, minimal SQLite support, unclear MCP integration, small community, uncertain viability
  - Rejected because: Missing critical security requirement (OS keychain) and immature ecosystem

### Implementation Strategy:
- **Phase 1**: Frontend development (pure TypeScript/React) against mock APIs
- **Phase 2**: Rust backend integration (SQLite, keychain, MCP server/client)
- **Phase 3**: Performance optimization, move critical paths to Rust
- **Learning Curve**: Frontend remains pure TypeScript; Rust required only for backend system integration

---

## 2. MCP SDK Selection

### Decision: Hybrid Approach - TypeScript SDK (@modelcontextprotocol/sdk) for Frontend + Rust SDK for Backend

**Rationale:**
- **TypeScript SDK**:
  - Official Anthropic support, 5.6M weekly downloads, production-ready
  - Native integration with Tauri frontend (React/TypeScript)
  - Excellent type safety with Zod validation
  - Rich ecosystem of example servers (35+ security-focused examples)
- **Rust SDK**:
  - Performance-critical MCP server operations run in Rust backend
  - Native Tauri integration, zero-cost abstractions
  - Type-safe protocol implementation
- **Hybrid Benefits**:
  - Frontend developers work in familiar TypeScript
  - Backend leverages Rust performance for AI orchestration
  - Best of both worlds: TypeScript DX + Rust performance

**Alternatives Considered:**
- **Python MCP SDK**:
  - Pros: Excellent for rapid prototyping, large ecosystem
  - Cons: Slower than Rust, harder to integrate with Tauri/Electron
  - Rejected because: Performance overhead and desktop integration complexity
- **Pure Rust**:
  - Pros: Maximum performance throughout
  - Cons: Steep learning curve for entire team
  - Rejected because: TypeScript frontend provides faster development velocity

### MCP Architecture:
```
Desktop App
├── Frontend (TypeScript)
│   └── @modelcontextprotocol/sdk (HTTP client → ServiceNow)
└── Backend (Rust)
    └── mcp-protocol-sdk (MCP server exposing Ollama tools)
```

### Transport Strategy:
- **Desktop → ServiceNow** (MCP Client): HTTP Streamable transport (remote cloud service)
- **ServiceNow → Desktop** (MCP Server): stdio for MVP, upgrade to HTTP if bidirectional remote access needed

### Authentication:
- **OAuth 2.1 with PKCE**: Industry standard for enterprise integrations, eliminates client secrets (critical for desktop apps)
- **Fallback**: API keys for local/demo setups

---

## 3. MCP Tools Definition

### Decision: 6 Security-Focused MCP Tools with Zod Schema Validation

**Tools Defined:**

1. **analyze_threat_indicator** - IOC analysis against threat intelligence feeds
   - Parameters: indicator (string), indicator_type (ip/domain/url/hash), context
   - Returns: threat_level, reputation_score, associated_campaigns, recommendations

2. **assess_vulnerability** - CVE assessment with CVSS scoring and exploitability
   - Parameters: cve_id (string), system_context (optional)
   - Returns: cvss_score, exploitability, affected_systems, patch_availability

3. **correlate_security_incidents** - Multi-incident correlation for attack patterns
   - Parameters: incident_ids (array), time_window (hours)
   - Returns: correlation_score, common_indicators, attack_pattern, timeline

4. **generate_remediation_plan** - Prioritized remediation with business context
   - Parameters: vulnerability_data, business_impact_level
   - Returns: prioritized_steps, estimated_effort, prerequisites, rollback_plan

5. **analyze_attack_surface** - External attack surface scanning (exposed services)
   - Parameters: target_scope (IP ranges, domains), scan_depth
   - Returns: exposed_services, vulnerabilities, risk_assessment, hardening_recommendations

6. **audit_security_compliance** - Framework compliance auditing (CIS, NIST, PCI-DSS)
   - Parameters: framework (string), system_inventory
   - Returns: compliance_score, failed_controls, remediation_priorities, evidence_gaps

**Rationale:**
- Covers all security workflows from spec (threat analysis, vulnerability assessment, incident response, remediation, compliance)
- Each tool follows MCP best practices: descriptive names, strong typing, structured responses
- Zod schemas provide runtime validation and TypeScript types
- Error handling with structured responses for graceful degradation
- Progress reporting for long operations (>3 seconds) per constitution requirements

---

## 4. Database Selection

### Decision: SQLite with better-sqlite3 + Drizzle ORM

**Rationale:**
- **better-sqlite3**:
  - Performance: 2000+ queries/second, <10ms reads with proper indexing (meets FR-026 requirements)
  - FTS5: Production-grade full-text search with relevance ranking for conversation history
  - ACID: Full guarantees with WAL mode (unlimited concurrent readers, single writer)
  - Adoption: 2.3M weekly downloads, actively maintained (v12.6.2+)
  - Benchmarks: 100x faster than alternatives for some queries
- **Drizzle ORM**:
  - Minimal overhead, near-native better-sqlite3 speed
  - Automatic SQL migration generation via drizzle-kit
  - Native TypeScript implementation with excellent type inference
  - Balance of ORM convenience with SQL-like control
  - Active development, growing community

**Alternatives Considered:**
- **Prisma**:
  - Pros: Best developer experience, Prisma Studio GUI, excellent docs
  - Cons: 10-20% slower than raw better-sqlite3, heavier abstractions
  - Rejected because: Performance overhead not justified for this use case
- **Kysely** (Query Builder):
  - Pros: Best type inference, explicit SQL control
  - Cons: Manual migration management, steeper learning curve
  - Rejected because: Drizzle provides better DX for migrations
- **Dexie.js** (IndexedDB):
  - Pros: Browser-native
  - Cons: No full-text search, weaker query capabilities, storage quotas
  - Rejected because: Desktop app doesn't need browser constraints
- **LevelDB**:
  - Pros: Fast key-value operations
  - Cons: No relational model, no full-text search
  - Rejected because: Poor fit for structured conversation data

### Database Configuration:
```sql
PRAGMA journal_mode=WAL;         -- Concurrent reads, reliable writes
PRAGMA synchronous=NORMAL;        -- Balance safety vs performance
PRAGMA cache_size=-64000;         -- 64MB cache
PRAGMA wal_autocheckpoint=1000;   -- Checkpoint every 1000 pages
```

### Migration Strategy: Drizzle Kit
- Define schema in TypeScript → `drizzle-kit generate` → Review SQL → Apply migrations
- Supports dev (`push`) and production (`migrate`) workflows
- Human-readable SQL output for review and version control

### Backup Strategy:
- **Scheduled**: SQLite Online Backup API (daily/weekly/monthly rotating backups)
- **User-Triggered**: SQL export (human-readable, portable)
- **On-Exit**: Last session backup
- **Never**: Direct file copy (produces corrupted backups with active WAL)

---

## 5. Credential Storage

### Decision: Tauri Keychain Plugin (tauri-plugin-keyring)

**Rationale:**
- **Platform-Native**: macOS Keychain, Windows Credential Vault, Linux Secret Service
- **Security**: OS-level encryption, app isolation (macOS), user-scoped (Windows)
- **Integration**: Native Tauri plugin with Rust bindings
- **Maintenance**: Community-maintained by HuakunShen, actively updated
- **Zero Exposure**: Credentials never in logs, memory cleared after use, meets SC-010 requirement

**Alternatives Considered:**
- **Electron safeStorage API**:
  - Pros: Built-in, no dependencies, battle-tested (VS Code, Signal Desktop)
  - Cons: Only available in Electron (not applicable for Tauri choice)
  - Rejected because: Framework choice is Tauri
- **cross-keychain**:
  - Pros: @napi-rs/keyring bindings, good for Node.js apps
  - Cons: Less documentation, smaller community than Tauri plugin
  - Rejected because: Tauri plugin is better integrated
- **keytar**:
  - Pros: Previously popular
  - Cons: Deprecated/archived by Atom in 2026
  - Rejected because: No longer maintained
- **Application-level encryption** (keyring library):
  - Pros: Simple implementation
  - Cons: Less secure than OS-native stores
  - Rejected because: Security requirement demands OS keychain

### Security Best Practices:
- Never log decrypted credentials
- Clear sensitive data from memory after use
- Verify keychain backend is OS-native (not basic_text fallback on Linux)
- Use parameterized queries to prevent SQL injection of credentials
- File permissions: 600 (Unix) for database files
- Audit logging for credential access events

---

## 6. Testing Framework

### Decision: Vitest + Playwright

**Rationale:**
- **Vitest**:
  - Native TypeScript/ESM support
  - Faster than Jest (Vite-powered)
  - Compatible with Tauri Rust testing via cargo test
  - Built-in coverage (c8)
  - UI mode for debugging
- **Playwright**:
  - E2E testing for desktop apps
  - Cross-browser/platform support
  - Auto-wait, reliable test execution
  - Excellent debugging tools (trace viewer)
  - Native TypeScript support

**Test Structure:**
```
tests/
├── unit/          # Vitest - business logic, MCP protocol
├── integration/   # Vitest - Ollama/ServiceNow APIs, database
├── contract/      # Vitest - MCP tool schemas (Zod validation)
└── e2e/           # Playwright - full user journeys
```

**Coverage Targets:**
- Unit: >90% (fast, isolated tests)
- Integration: >80% (external dependencies)
- Contract: 100% (MCP schemas critical)
- E2E: Critical paths (P1-P4 user stories)
- Overall: ≥80% (constitution requirement)

**Alternatives Considered:**
- **Jest**:
  - Pros: Mature, large ecosystem
  - Cons: Slower than Vitest, ESM support issues
  - Rejected because: Vitest is faster and more modern
- **Cypress**:
  - Pros: Excellent DX for web testing
  - Cons: Not designed for desktop apps
  - Rejected because: Playwright better for desktop

---

## 7. Language/Version

### Final Decision: TypeScript 5.x (Frontend) + Rust 1.75+ (Backend)

**Rationale:**
- TypeScript for frontend web UI (React)
- Rust for Tauri backend (main process, system integration)
- Hybrid approach balances developer velocity (TypeScript) with performance (Rust)
- Both support strict type checking per constitution requirements
- MCP SDKs available for both languages

**TypeScript Configuration:**
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

**Rust Configuration:**
```toml
[profile.release]
opt-level = "z"     # Optimize for size
lto = true          # Link-time optimization
codegen-units = 1   # Better optimization
```

---

## 8. Primary Dependencies

### Decision: Consolidated Dependency List

**Frontend (TypeScript/React):**
- `@tauri-apps/api` - Tauri JavaScript API
- `@modelcontextprotocol/sdk` - MCP client
- `zod` - Schema validation
- `react` + `react-dom` - UI framework
- `@tanstack/react-query` - Data fetching/caching
- `zustand` - State management (lightweight)

**Backend (Rust):**
- `tauri` - Desktop framework
- `mcp-protocol-sdk` - MCP server
- `sqlx` - SQLite async driver
- `serde` + `serde_json` - Serialization
- `reqwest` - HTTP client (ServiceNow, search APIs)
- `tokio` - Async runtime

**Development:**
- `vitest` - Test runner
- `playwright` - E2E testing
- `drizzle-kit` - Database migrations
- `eslint` + `prettier` - Linting/formatting
- `clippy` - Rust linting

**Justification:**
- All dependencies serve specific requirements from spec
- Mature libraries with active maintenance
- Security audits via `cargo audit` and npm security scans
- Minimal dependency tree to reduce attack surface

---

## Summary of Technical Decisions

| Category | Decision | Rationale |
|----------|----------|-----------|
| **Desktop Framework** | Tauri v2.0 | Performance (<500MB), security (v2.0 model), small bundles (3-10 MB) |
| **MCP SDK** | TypeScript + Rust hybrid | TypeScript DX, Rust performance, official SDKs for both |
| **Database** | SQLite + better-sqlite3 + Drizzle | <10ms reads, FTS5 search, ACID, 2000+ queries/sec |
| **Credential Storage** | tauri-plugin-keyring | OS-native, secure, Tauri-integrated |
| **Testing** | Vitest + Playwright | Fast unit tests, reliable E2E, native TypeScript |
| **Language** | TypeScript 5.x + Rust 1.75+ | Hybrid approach balances DX and performance |
| **Transport** | HTTP (client), stdio (server) | Remote ServiceNow access, local Ollama access |
| **Authentication** | OAuth 2.1 with PKCE | Industry standard, secure for desktop apps |

All decisions meet or exceed constitution requirements for performance, security, testing, and quality standards.

---

## Next Steps

1. **Phase 1 Execution**: Generate data-model.md, contracts/, quickstart.md
2. **Dependency Installation**: Set up Tauri project with all dependencies
3. **Proof of Concept**: Minimal Tauri app with keychain and SQLite integration
4. **MCP Tool Contracts**: Finalize Zod schemas for 6 security tools
5. **Architecture Review**: Validate technical decisions with team before implementation
