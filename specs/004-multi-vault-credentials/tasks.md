# Tasks: Multi-Vault Credential Provider

**Input**: Design documents from `/specs/004-multi-vault-credentials/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/tauri-commands.md ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Add new dependencies, DB migration, shared types — required before any user story

- [x] T001 Add `which = "6"` to `src-tauri/Cargo.toml` dependencies
- [x] T002 [P] Create SQLite migration `src/core/storage/migrations/0004_provider_config.sql` with `provider_configuration` and `credential_provider_item_ids` tables (see data-model.md)
- [x] T003 [P] Add `providerConfiguration` and `credentialProviderItemIds` Drizzle tables to `src/core/storage/schema.ts`
- [x] T004 Create `src/core/services/credential-provider.ts` defining `ProviderId`, `ProviderStatus`, `ProviderConfiguration`, `CREDENTIAL_KEYS`, and `CredentialKey` types (see contracts/tauri-commands.md)

### Phase 1 Validation Gates

**Automated Gates**:
- [ ] `cargo build` passes with new `which` dependency
- [ ] Migration SQL is valid (no syntax errors)
- [ ] `npm run lint` passes on new TS types file

**Manual Gates**:
- [ ] Migration reviewed: tables match data-model.md schema
- [ ] Setup complete — no blocking issues before Phase 2

**Documentation**: Create `specs/004-multi-vault-credentials/phase1-validation.md`

---

## Phase 2: Foundational (Blocking)

**Purpose**: Core provider abstraction layer that all user stories depend on

⚠️ **CRITICAL**: No user story work begins until this phase is complete

- [x] T005 Create `src-tauri/src/integrations/one_password.rs` with: `is_installed()` (via `which`), `is_authenticated()` (via `op whoami`), `read_secret(key)` (via `op read`), `write_secret(key, value)` (via stdin JSON), `delete_secret(key)` (via `op item delete`), `check_version()` — all using `tokio::process::Command` with per-arg `.arg()` calls and 10s timeout
- [x] T006 Create `src-tauri/src/integrations/bitwarden.rs` with: `is_installed()`, `get_session_status()` (parse `bw status` JSON `.status` field), `read_secret(key, session)` (via `bw list items --search` + exact-name filter), `write_secret(key, value, session)` (Secure Note via stdin + cache UUID), `update_secret(uuid, value, session)`, `delete_secret(uuid, session)` — all with `tokio::process::Command` and `BW_SESSION` via `.env()`
- [x] T007 [P] Create `src/core/storage/repositories/provider-config.ts` with: `getDefaultProvider()`, `setDefaultProvider(id)`, `getOverride(credentialKey)`, `setOverride(credentialKey, providerId)`, `removeOverride(credentialKey)`, `getAllOverrides()` — all using existing `getDatabase()` pattern
- [x] T008 [P] Create `src/core/services/credential-router.ts` — thin TS wrapper exposing: `getAvailableProviders()`, `getProviderConfig()`, `setDefaultProvider()`, `setCredentialProviderOverride()`, `removeCredentialProviderOverride()`, `migrateCredentials()` — each calls the corresponding Tauri `invoke()`
- [x] T009 Create `src-tauri/src/commands/provider.rs` implementing all 5 new Tauri commands: `get_available_providers`, `get_provider_configuration`, `set_default_provider`, `set_credential_provider_override`, `remove_credential_provider_override` — using integrations from T005/T006 and DB from T007 (see contracts/tauri-commands.md for request/response types)
- [x] T010 Register new commands in `src-tauri/src/lib.rs`: add `commands::provider::get_available_providers`, `get_provider_configuration`, `set_default_provider`, `set_credential_provider_override`, `remove_credential_provider_override` to `generate_handler!` macro

### Phase 2 Validation Gates

**Automated Gates**:
- [ ] `cargo build` and `cargo clippy` pass with T005, T006, T009, T010
- [ ] `npm run test:unit` passes for T007, T008
- [ ] `npm run lint` passes

**Manual Gates**:
- [ ] `get_available_providers` tested via Tauri devtools — all 3 providers returned
- [ ] Architecture review: provider routing layer approved before user story work begins

**Documentation**: Create `specs/004-multi-vault-credentials/phase2-validation.md`

**Checkpoint**: Provider abstraction layer ready — user story phases can now begin

---

## Phase 3: User Story 1 — Select Active Credential Provider (P1) 🎯 MVP

**Goal**: User can select a global default credential provider in Settings; all credential ops route through it

**Independent Test**: Open Settings → select 1Password → save ServiceNow URL → confirm it appears in `op item list` and NOT in OS keychain; restart app → provider still active; credentials still load

### Implementation

- [x] T011 [US1] Modify `src-tauri/src/commands/credentials.rs` — update `store_credential`, `get_credential`, `delete_credential`, `has_credential` to: (1) look up active provider via `provider_configuration` table, (2) route to the correct integration (`keychain` / `one_password` / `bitwarden`), (3) re-check provider availability on each call and return `PROVIDER_LOCKED` error if unavailable
- [x] T012 [P] [US1] Add `providerConfig` slice to `src/renderer/store/index.ts`: state `{ defaultProvider, overrides, providerStatuses }`, actions `setDefaultProvider`, `setOverride`, `removeOverride`, `setProviderStatuses` — use `useShallow` for object selectors
- [x] T013 [P] [US1] Create `src/renderer/components/CredentialStoragePanel.tsx` — displays 3 provider cards (name, status icon, "installed/locked/ready" badge), radio selection for active provider, Save button; calls `credential-router.ts` on save; shows detection loading state
- [x] T014 [US1] Add "Credential Storage" collapsible section to `src/renderer/pages/Settings.tsx` using existing `<details>`/`<summary>` pattern — renders `<CredentialStoragePanel />`; fetches provider statuses on mount via `getAvailableProviders()`

### Unit Tests

- [x] T015 [P] [US1] Add unit tests in `tests/unit/services/credential-router.test.ts` — mock `invoke`, verify `getAvailableProviders()` maps response correctly, `setDefaultProvider()` calls correct command with correct payload, error cases
- [x] T016 [P] [US1] Add unit tests in `tests/unit/repositories/provider-config.test.ts` — mock `getDatabase()`, verify `getDefaultProvider()` returns `"keychain"` when no row exists, `setDefaultProvider()` upserts correctly, `getOverride()` returns undefined when no override

### User Story 1 Validation Gates

**Automated Gates**:
- [ ] `cargo test` passes for `commands::credentials` (routing tests)
- [ ] `npm run test:unit` passes for T015, T016
- [ ] `npm run lint` and `cargo clippy` pass

**Manual Gates**:
- [ ] quickstart.md Scenario 1 (Provider Detection) executed and passes
- [ ] quickstart.md Scenario 2 (Switch to 1Password) executed and passes
- [ ] quickstart.md Scenario 5 (Mid-Session Vault Lock) executed and passes

**Documentation**: Create `specs/004-multi-vault-credentials/us1-validation.md`

**Checkpoint**: US1 fully functional — user can select provider and all credentials route through it

---

## Phase 4: User Story 2 — Per-Credential Provider Override (P2)

**Goal**: User can override the provider for a specific credential independently of the global default

**Independent Test**: Set Bitwarden as default → override `llm_openai` to OS Keychain → save OpenAI key → confirm key in OS keychain (`security find-generic-password` on macOS or equivalent) while another key goes to Bitwarden; remove override → key next-save goes to Bitwarden

### Implementation

- [x] T017 [US2] Create `src-tauri/src/commands/provider.rs` `set_credential_provider_override` and `remove_credential_provider_override` Tauri commands (already stubbed in T009 — implement fully here with validation: reject unknown `credential_key` values not in `CREDENTIAL_KEYS` list)
- [x] T018 [P] [US2] Create `src/renderer/components/CredentialProviderOverrideSelect.tsx` — a small dropdown component (Provider: [OS Keychain ▾]) that appears on each individual credential field in Settings; shows "(default)" when no override; calls `setCredentialProviderOverride` / `removeCredentialProviderOverride`
- [x] T019 [US2] Add override selectors to each credential field in `src/renderer/pages/Settings.tsx` (ServiceNow credentials, OAuth token display, API key fields) using `<CredentialProviderOverrideSelect credentialKey="llm_openai" />`

### Unit Tests

- [x] T020 [P] [US2] Add unit tests in `tests/unit/services/credential-router.test.ts` (extend file) — verify `setCredentialProviderOverride()` calls correct command, `removeCredentialProviderOverride()` calls correct command, override is reflected in subsequent `getProviderConfig()` response

### User Story 2 Validation Gates

**Automated Gates**:
- [ ] `npm run test:unit` passes (T020 + regression on T015/T016)
- [ ] `cargo test` and `cargo clippy` pass
- [ ] `npm run lint` passes

**Manual Gates**:
- [ ] quickstart.md Scenario 3 (Per-Credential Override) executed and passes
- [ ] Regression: Scenario 1 and 2 still pass
- [ ] US1 + US2 combined flow validated (switch global provider, override one key)

**Documentation**: Create `specs/004-multi-vault-credentials/us2-validation.md`

**Checkpoint**: US2 functional — per-credential overrides work independently of global default

---

## Phase 5: User Story 3 — Credential Migration (P3)

**Goal**: User switching providers can migrate all credentials in one step; partial failures roll back

**Independent Test**: Pre-populate OS Keychain with credentials → switch to 1Password → confirm migration → all keys in `op item list` + none in OS keychain → restart → all features work

### Implementation

- [x] - [ ] T021 [US3] Create `migrate_credentials` Tauri command in `src-tauri/src/commands/provider.rs`: (1) read all known credential keys from current provider, (2) write each to target provider, (3) on all-success: update `default_provider` + delete originals, (4) on any failure: delete partially-written items from target + return error list (no provider change)
- [x] - [ ] T022 [P] [US3] Create `src/renderer/components/CredentialMigrationModal.tsx` — confirmation dialog shown when user changes global provider in `CredentialStoragePanel`; shows: "X credentials will be migrated from [Old] to [New]", Confirm / Cancel buttons; shows per-credential progress during migration; shows success/failure summary
- [x] - [ ] T023 [US3] Wire migration modal into `src/renderer/components/CredentialStoragePanel.tsx` — when user saves a new default provider (different from current), open `CredentialMigrationModal` before committing the provider change

### Unit Tests

- [x] - [ ] T024 [P] [US3] Add unit tests in `tests/unit/services/credential-router.test.ts` (extend) — mock `invoke`, verify `migrateCredentials()` calls correct command, success response maps `migrated` array, partial failure response maps `failed` array

### User Story 3 Validation Gates

**Automated Gates**:
- [ ] `cargo test` passes for `migrate_credentials` (including rollback path)
- [ ] `npm run test:unit` passes (T024 + full regression)
- [ ] `npm run lint` and `cargo clippy` pass

**Manual Gates**:
- [ ] quickstart.md Scenario 4 (Credential Migration) executed and passes
- [ ] quickstart.md Scenario 6 (Migration Rollback on Failure) executed and passes
- [ ] Full regression: Scenarios 1–6 all pass

**Documentation**: Create `specs/004-multi-vault-credentials/us3-validation.md`

**Checkpoint**: All user stories complete — full feature functional

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] - [ ] T025 [P] Update `CLAUDE.md` — add multi-vault credential provider patterns: provider routing layer location, `which` crate usage, Bitwarden session detection gotcha (`bw status` not `bw unlock --check`)
- [x] - [ ] T026 [P] Add CHANGELOG entry for feature 004-multi-vault-credentials
- [x] - [ ] T027 Run `quickstart.md` full validation — all 6 scenarios must pass end-to-end on macOS; document Linux/Windows as "CLI tool installation required"
- [x] - [ ] T028 [P] Add integration test `tests/integration/provider-config-persistence.test.ts` — write provider config → restart DB connection → verify config persists
- [x] - [ ] T029 Security hardening review: confirm no credential values in log output (`src-tauri/src/integrations/one_password.rs` and `bitwarden.rs`) — audit all `log::info!` / `println!` calls in new files

### Final Validation Gates

**Automated Gates**:
- [ ] `npm run test:unit` all passing (94+ tests, 0 regressions)
- [ ] `npm run test:integration` passes
- [ ] `cargo test` all passing
- [ ] `cargo clippy` 0 warnings introduced
- [ ] `npm run lint` 0 warnings
- [ ] `npm run test:coverage` ≥80% for new code

**Manual Gates**:
- [ ] Full system test: all 6 quickstart.md scenarios pass
- [ ] Security review: credential values confirmed absent from all logs
- [ ] Final code review approved
- [ ] CHANGELOG entry complete

**Documentation**: Create `specs/004-multi-vault-credentials/production-validation.md`

**Production Ready**: Feature meets all constitution requirements

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundation)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2 — no other story dependencies
- **Phase 4 (US2)**: Depends on Phase 2 — independent of US1 (but US1 recommended first for testing)
- **Phase 5 (US3)**: Depends on Phase 2 — uses US1/US2 provider routing, integrates with both
- **Phase 6 (Polish)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Foundational only — pure MVP
- **US2 (P2)**: Foundational only — independent of US1, but US1 needed for end-to-end test
- **US3 (P3)**: Foundational + US1 (needs provider switching) + US2 (should include override-aware migration)

### Parallel Opportunities per Phase

**Phase 2**: T005 (1Password integration) ‖ T006 (Bitwarden integration) ‖ T007 (provider-config repo) ‖ T008 (credential-router TS)

**Phase 3**: T012 (Zustand slice) ‖ T013 (CredentialStoragePanel) ‖ T015 (router tests) ‖ T016 (repo tests)

**Phase 4**: T018 (CredentialProviderOverrideSelect) ‖ T020 (unit tests)

**Phase 5**: T022 (MigrationModal) ‖ T024 (unit tests)

---

## Implementation Strategy

### MVP (User Story 1 only)

1. Phase 1: Setup (T001–T004)
2. Phase 2: Foundation (T005–T010)
3. Phase 3: US1 (T011–T016)
4. **STOP — validate**: All credentials route through 1Password/Bitwarden on real device
5. Deploy if ready

### Full Delivery (incremental)

1. Phases 1–2 → Foundation ready
2. Phase 3 → US1 complete → 1Password/Bitwarden selectable globally ✅
3. Phase 4 → US2 complete → Per-credential overrides ✅
4. Phase 5 → US3 complete → Migration workflow ✅
5. Phase 6 → Polish + production-ready ✅

### Parallel Strategy (2 developers)

After Phase 2:
- Dev A → Phase 3 (US1: provider routing + Settings UI)
- Dev B → Phase 4 (US2: per-credential override UI)
- Dev A/B merge → Phase 5 (US3: migration, needs both)
