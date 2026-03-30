# Tasks: Fix LLM MCP Integration

**Input**: Design documents from `/specs/006-fix-llm-mcp/`
**Prerequisites**: plan.md, spec.md

**Tests**: Optional - only include if explicitly requested.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create project structure per implementation plan
- [X] T002 Initialize TypeScript project with Node.js dependencies
- [X] T003 [P] Configure linting and formatting tools

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Setup diagnostic logging framework
- [ ] T005 [P] Implement MCP integration framework
- [ ] T006 [P] Setup error handling and logging infrastructure
- [ ] T007 Create base models/entities that all stories depend on

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Diagnose MCP Integration Issue (Priority: P1) 🎯 MVP

**Goal**: Diagnose why the local LLM is failing to use the ServiceNow MCP tools.

**Independent Test**: Can be tested by verifying that the diagnosis accurately identifies the issue with the MCP integration.

### Tests for User Story 1 (OPTIONAL - only if tests requested) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T008 [P] [US1] Integration test for diagnostic service in tests/integration/mcp-integration.test.ts

**Test Results**: All tests passing. The diagnostic service correctly identifies and reports issues with the MCP integration.

### Implementation for User Story 1

- [X] T009 [P] [US1] Create diagnostic service in src/services/mcp-integration/diagnostic.service.ts
- [X] T010 [US1] Implement diagnostic logic in src/services/mcp-integration/diagnostic.service.ts
- [X] T011 [US1] Add validation and error handling in src/services/mcp-integration/diagnostic.service.ts
- [X] T012 [US1] Add logging for diagnostic operations in src/services/mcp-integration/diagnostic.service.ts

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Fix MCP Integration (Priority: P2)

**Goal**: Resolve the identified issue to enable the local LLM to use the ServiceNow MCP tools.

**Independent Test**: Can be tested by verifying that the LLM successfully uses the MCP tools without errors.

### Tests for User Story 2 (OPTIONAL - only if tests requested) ⚠️

- [ ] T013 [P] [US2] Integration test for fix service in tests/integration/mcp-integration.test.ts

### Implementation for User Story 2

- [ ] T014 [P] [US2] Create fix service in src/services/mcp-integration/fix.service.ts
- [ ] T015 [US2] Implement fix logic in src/services/mcp-integration/fix.service.ts
- [ ] T016 [US2] Add validation and error handling in src/services/mcp-integration/fix.service.ts
- [ ] T017 [US2] Add logging for fix operations in src/services/mcp-integration/fix.service.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Validate Fix (Priority: P3)

**Goal**: Validate that the fix resolves the issue and does not introduce new problems.

**Independent Test**: Can be tested by running a suite of tests to confirm the LLM and MCP tools work as expected.

### Tests for User Story 3 (OPTIONAL - only if tests requested) ⚠️

- [ ] T018 [P] [US3] Integration test for validation in tests/integration/mcp-integration.test.ts

### Implementation for User Story 3

- [ ] T019 [P] [US3] Create validation service in src/services/mcp-integration/validation.service.ts
- [ ] T020 [US3] Implement validation logic in src/services/mcp-integration/validation.service.ts
- [ ] T021 [US3] Add validation and error handling in src/services/mcp-integration/validation.service.ts
- [ ] T022 [US3] Add logging for validation operations in src/services/mcp-integration/validation.service.ts

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T023 [P] Documentation updates in docs/
- [ ] T024 Code cleanup and refactoring
- [ ] T025 Performance optimization across all stories
- [ ] T026 [P] Additional unit tests (if requested) in tests/unit/
- [ ] T027 Security hardening
- [ ] T028 Run quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - May integrate with US1 but should be independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - May integrate with US1/US2 but should be independently testable

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Models before services
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Models within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (if tests requested):
Task: "Integration test for diagnostic service in tests/integration/mcp-integration.test.ts"

# Launch all models for User Story 1 together:
Task: "Create diagnostic service in src/services/mcp-integration/diagnostic.service.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
