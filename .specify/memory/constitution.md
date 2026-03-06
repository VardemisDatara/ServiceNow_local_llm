<!--
Sync Impact Report:
Version change: Initial → 1.0.0
Modified principles: N/A (initial creation)
Added sections:
  - Core Principles: Code Quality Standards, Testing First, UX Consistency, Performance Standards, Phase Validation Gates
  - Quality Gates
  - Development Workflow
  - Governance
Templates requiring updates:
  ✅ plan-template.md - Constitution Check section already present
  ✅ spec-template.md - User scenarios and requirements align with constitution
  ✅ tasks-template.md - Phase structure supports validation gates
Follow-up TODOs: None - all placeholders resolved
-->

# ServiceNow MCP Handling Constitution

## Core Principles

### I. Code Quality Standards

All code contributions MUST meet the following non-negotiable quality criteria:

- **Clean Code**: Functions are single-purpose, descriptive naming (no abbreviations except domain standards), maximum 50 lines per function
- **Type Safety**: Strict type checking enabled; all function signatures explicitly typed; no `any` types without documented justification
- **Error Handling**: All external calls wrapped in try-catch; errors logged with context; user-facing errors are actionable
- **Documentation**: Public APIs documented with purpose, parameters, return values, and examples; complex logic includes inline comments explaining "why" not "what"
- **Security First**: Input validation at all boundaries; no hardcoded credentials; sanitize all user input; follow OWASP Top 10 prevention guidelines
- **Dependency Management**: Minimize external dependencies; document rationale for each dependency; pin versions; regular security audits

**Rationale**: High-quality code reduces bugs, improves maintainability, and accelerates onboarding. Security vulnerabilities can compromise the entire system and user trust.

### II. Testing First (NON-NEGOTIABLE)

Test-Driven Development is mandatory for all feature work:

- **TDD Workflow**: Write tests → Get user approval → Verify tests fail → Implement → Verify tests pass
- **Test Types Required**:
  - **Unit Tests**: All business logic; minimum 80% code coverage; fast execution (<100ms per test)
  - **Integration Tests**: All API endpoints; all database operations; all external service interactions
  - **Contract Tests**: All public APIs; verify request/response schemas; validate error codes
  - **Manual Tests**: Critical user journeys documented in test plans; executed before phase sign-off
- **Test Quality**: Tests are deterministic (no flaky tests); tests are isolated (no shared state); descriptive test names follow Given-When-Then pattern
- **Red-Green-Refactor**: Tests must fail initially, pass after implementation, code refactored for clarity

**Rationale**: Tests are living documentation, catch regressions early, enable confident refactoring, and verify features meet requirements before deployment.

### III. User Experience Consistency

All user-facing features MUST maintain consistent, intuitive experiences:

- **Interface Standards**: Follow established design patterns; consistent terminology across all interfaces; predictable behavior (similar actions produce similar results)
- **Feedback & Visibility**: Every user action receives immediate feedback (<200ms); long operations show progress; errors explain what happened and how to fix
- **Accessibility**: WCAG 2.1 Level AA compliance; keyboard navigation support; screen reader compatible; color contrast ratios meet standards
- **Error Recovery**: Users can undo destructive actions; autosave prevents data loss; graceful degradation when services unavailable
- **Documentation**: User-facing documentation written from user perspective; includes quickstart, common tasks, troubleshooting; kept in sync with implementation

**Rationale**: Consistent UX reduces cognitive load, minimizes training needs, decreases support burden, and improves user satisfaction and productivity.

### IV. Performance Standards

All features MUST meet the following performance benchmarks:

- **Response Times**:
  - API responses: <200ms p95 for reads, <500ms p95 for writes
  - UI interactions: <100ms for input feedback, <1s for page transitions
  - Background jobs: process time proportional to data size with documented big-O complexity
- **Resource Limits**:
  - Memory: <500MB per service instance under normal load
  - CPU: <70% sustained usage per core at peak load
  - Network: Efficient payloads, compression enabled, minimize round-trips
- **Scalability**: Horizontal scaling supported; no single points of contention; database queries optimized with proper indexing
- **Monitoring**: All critical paths instrumented; latency histograms tracked; SLOs defined and monitored; alerts on threshold breaches

**Rationale**: Performance directly impacts user satisfaction, operational costs, and system reliability. Performance issues compound as systems scale.

### V. Phase Validation Gates (NON-NEGOTIABLE)

Each development phase MUST pass both automated and manual validation before proceeding:

- **Automated Gates** (must pass before phase sign-off):
  - All tests passing (unit, integration, contract)
  - Linting/formatting checks pass
  - Security scans pass (no critical/high vulnerabilities)
  - Performance benchmarks met (load tests for API changes)
  - Code coverage thresholds met (80% minimum)
- **Manual Gates** (must pass before phase sign-off):
  - Code review approved by at least one peer
  - Manual test plan executed and documented
  - User acceptance testing completed for user-facing changes
  - Security review for authentication/authorization changes
  - Architecture review for cross-cutting concerns
- **Gate Documentation**: Each gate creates artifact (test reports, review approvals, sign-off logs) stored in specs/[feature]/ directory
- **No Exceptions**: Gates cannot be skipped; blocking issues must be resolved before proceeding; technical debt requires documented paydown plan

**Rationale**: Validation gates prevent defects from cascading into later phases, ensure quality is built-in not bolted-on, and create clear checkpoints for progress tracking.

## Quality Gates

### Definition of Done (DoD)

A task is "done" only when ALL of the following criteria are met:

1. **Code Complete**: Implementation matches spec; no TODO comments; no debug code
2. **Tests Written & Passing**: All required test types written; all tests passing; no skipped tests without documented reason
3. **Automated Checks Pass**: CI pipeline green (linting, tests, security scans)
4. **Manual Validation Complete**: Manual test plan executed; results documented; sign-off obtained
5. **Code Reviewed**: At least one peer review; all comments addressed; approval granted
6. **Documentation Updated**: API docs updated; user docs updated if user-facing; CHANGELOG entry added
7. **Performance Validated**: Benchmarks run; meets performance standards; no regressions
8. **Deployed to Staging**: Successfully deployed; smoke tests passing; ready for user acceptance

### Quality Checklist

Before requesting phase sign-off, verify:

- [ ] All automated tests passing (unit, integration, contract)
- [ ] Manual test plan executed and results documented
- [ ] Code coverage ≥80% for new code
- [ ] Performance benchmarks met (API latency, resource usage)
- [ ] Security scan passed (no critical/high vulnerabilities)
- [ ] Linting/formatting checks passed
- [ ] Code review approved by peer
- [ ] Documentation updated (API docs, user docs, CHANGELOG)
- [ ] Deployed to staging and smoke tested
- [ ] User acceptance sign-off obtained (for user-facing changes)

## Development Workflow

### Phase Progression

Development follows a strict phase progression with mandatory validation gates between phases:

**Phase 0: Planning & Design**
- Input: Feature specification, user requirements
- Activities: Technical design, API contracts, data models, architecture decisions
- Automated Gate: Design review checklist complete
- Manual Gate: Architecture review approved, design sign-off
- Output: Implementation plan, contracts defined, tasks generated

**Phase 1: Foundation (Blocking)**
- Input: Implementation plan, design artifacts
- Activities: Core infrastructure, shared utilities, database schemas, authentication framework
- Automated Gate: Foundation tests passing (unit + integration), security scan passed
- Manual Gate: Code review approved, manual infrastructure validation
- Output: Foundation code deployed to dev, ready for feature development
- **CRITICAL**: No feature work begins until this phase complete and gates passed

**Phase 2: Feature Implementation (by User Story)**
- Input: Foundation code, user story requirements
- Activities: Implement user story (TDD: tests → fail → implement → pass)
- Automated Gate: All tests passing for story, code coverage met, performance benchmarks met
- Manual Gate: Code review approved, manual test plan executed, UX review (if applicable)
- Output: User story complete, independently testable, deployed to staging
- **Checkpoint**: Each user story validated independently before next story begins

**Phase 3: Integration & Polish**
- Input: All user stories complete
- Activities: Cross-story integration, performance optimization, documentation finalization
- Automated Gate: Full regression suite passing, load tests passing, security scan passed
- Manual Gate: Full system manual test, user acceptance testing, final review
- Output: Feature complete, production-ready

**Phase 4: Deployment & Validation**
- Input: Production-ready feature
- Activities: Production deployment, smoke testing, monitoring validation
- Automated Gate: Production smoke tests passing, monitoring alerts functioning
- Manual Gate: Production validation checklist complete, sign-off obtained
- Output: Feature live in production, monitored, documented

### Review Standards

All code reviews must verify:

1. **Constitution Compliance**: Code follows all principles (quality, testing, UX, performance)
2. **Test Coverage**: New code has tests; tests are meaningful (not just coverage padding)
3. **Security**: No vulnerabilities introduced; inputs validated; errors handled safely
4. **Performance**: No obvious performance issues; efficient algorithms; proper indexing
5. **Readability**: Code is self-documenting; complex logic explained; consistent style
6. **Documentation**: Public APIs documented; user-facing changes documented; CHANGELOG updated

Reviews cannot be approved until all comments addressed and all review standards met.

## Governance

This constitution supersedes all other development practices and procedures.

### Amendment Process

1. **Proposal**: Document proposed change with rationale and impact analysis
2. **Review**: Constitution changes require review by project maintainers
3. **Approval**: Constitution changes require consensus approval
4. **Migration**: Breaking changes require migration plan and affected artifact updates
5. **Documentation**: All amendments documented with version bump and changelog

### Versioning Policy

Constitution versions follow semantic versioning (MAJOR.MINOR.PATCH):

- **MAJOR**: Breaking changes (principle removals, incompatible governance changes)
- **MINOR**: Additive changes (new principles, new sections, expanded guidance)
- **PATCH**: Non-breaking clarifications (wording improvements, typo fixes)

### Compliance

- All pull requests MUST verify constitution compliance before merge
- Phase gates MUST verify constitution compliance before phase sign-off
- Complexity that violates principles MUST be explicitly justified in plan.md Complexity Tracking table
- Technical debt that violates principles requires documented paydown plan with timeline

### Runtime Guidance

For day-to-day development guidance and agent-specific instructions, refer to `.specify/templates/agent-file-template.md` (when populated) or project-specific guidance documents. This constitution defines the non-negotiable principles; runtime guidance provides tactical implementation details.

**Version**: 1.0.0 | **Ratified**: 2026-02-12 | **Last Amended**: 2026-02-12
