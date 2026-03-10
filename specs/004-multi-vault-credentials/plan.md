# Implementation Plan: Multi-Vault Credential Provider

**Branch**: `004-multi-vault-credentials` | **Date**: 2026-03-10 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-multi-vault-credentials/spec.md`

## Summary

Add support for 1Password CLI and Bitwarden CLI as credential storage backends alongside the existing OS keychain, with a user-selectable global default and per-credential overrides. All existing credential read/write operations are routed through a new provider abstraction layer. A migration workflow copies credentials between providers. All three platforms (macOS, Windows, Linux) are supported. The feature integrates at the Rust/Tauri command layer using `tokio::process::Command` for CLI invocations and adds two SQLite tables for configuration and UUID caching.

## Technical Context

**Language/Version**: TypeScript 5.x (renderer/core) + Rust 1.75+ (Tauri commands)
**Primary Dependencies**:
- Existing: `tauri-plugin-keyring` (OS keychain), `tauri-plugin-sql` + `drizzle-orm/sqlite-proxy`, Zustand 5.x, React 18
- New (Rust): `which = "6"` (binary detection), `tokio::process::Command` (already in tokio, no new dep), `serde_json` (already present)
- New (TS): None — uses existing `invoke` + Zustand patterns
- External tools (user-installed): `op` CLI v2+ (1Password), `bw` CLI (Bitwarden)

**Storage**: SQLite — 2 new tables: `provider_configuration` (key/value config), `credential_provider_item_ids` (UUID cache for Bitwarden/1Password). Migration: `0003_provider_config.sql`

**Testing**: Vitest (unit/integration/contract), cargo test, Playwright (E2E)

**Target Platform**: macOS + Windows + Linux (all three platforms required per spec clarification Q3)

**Project Type**: Tauri desktop app (hybrid Rust backend + React frontend)

**Performance Goals**:
- Provider availability detection: < 2s at Settings open (SC-004)
- Per-operation availability re-check: < 200ms (SC-004 clarified)
- Credential read/write including CLI invocation: < 500ms p95

**Constraints**:
- App MUST NOT handle Bitwarden master password — session managed externally by user
- Secrets MUST NOT be passed as CLI arguments — use stdin
- Secrets MUST NOT be logged at any point
- All CLI invocations use `.arg()` per-argument (no shell string) — injection prevention

**Scale/Scope**: ~10 credential keys per profile; 3 providers; ~5 new Tauri commands; 2 DB tables; 1 new Rust module; 2 new TS services; Settings UI additions

## Constitution Check

### I. Code Quality Standards
- [x] Type safety: TypeScript strict mode already enforced; Rust `#[deny(warnings)]` in place; new `ProviderId` enum is exhaustive
- [x] Error handling: All CLI subprocess calls wrapped in `Result`; Tauri commands return `Result<T, String>`; user-facing errors are actionable (specify provider + remediation step)
- [x] Security: Secrets passed via stdin not CLI args; `BW_SESSION` injected via `.env()` not global env; no logging of credential values; `which` crate prevents PATH injection; argument arrays bypass shell
- [x] Dependencies: `which` crate is minimal and widely used; no other new dependencies added

### II. Testing First
- [x] TDD workflow: Tests written before implementation per constitution
- [x] Test types: Unit (provider routing logic, CLI output parsing), Integration (DB migration, provider config persistence), Contract (Tauri command schemas), Manual (quickstart.md scenarios)
- [x] Coverage target: ≥80%
- [x] Manual test plan: `quickstart.md` documents 6 test scenarios

### III. User Experience Consistency
- [x] UI patterns: Settings page — consistent with existing Settings panels; provider cards with status indicators; confirmation modal for migration
- [x] Feedback: Provider detection spinner < 2s; migration progress indicator; immediate error on vault lock mid-session
- [x] Accessibility: WCAG 2.1 AA — provider selection via keyboard; status communicated via text not color alone
- [x] Error recovery: Migration rolls back completely on partial failure; mid-session lock shows actionable error with retry option

### IV. Performance Standards
- [x] Response times: per-op check < 200ms; full credential op < 500ms p95; detection at Settings open < 2s
- [x] Resource limits: CLI subprocess is short-lived; no persistent background processes; < 500MB memory
- [x] Scalability: ~10 credential keys, 3 providers — no scaling concerns
- [x] Monitoring: Credential ops logged at info level (key name + provider, never the value)

### V. Phase Validation Gates
- [x] Automated: `npm run test:unit`, `npm run test:integration`, `cargo test`, `cargo clippy`, `npm run lint`
- [x] Manual: 6 quickstart scenarios executed before each phase sign-off
- [x] Gate documentation: phase validation files created in `specs/004-multi-vault-credentials/`

**Violations**: None. All constitution principles met.

## Project Structure

### Documentation (this feature)

```text
specs/004-multi-vault-credentials/
├── plan.md              ✅ this file
├── research.md          ✅ Phase 0 complete
├── data-model.md        ✅ Phase 1 complete
├── quickstart.md        ✅ Phase 1 complete
├── contracts/
│   └── tauri-commands.md ✅ Phase 1 complete
└── tasks.md             (Phase 2 — /speckit.tasks output)
```

### Source Code

```text
src-tauri/src/
├── commands/
│   ├── credentials.rs        MODIFY — route all ops through provider
│   └── provider.rs           NEW — get_available_providers, get_provider_configuration,
│                                   set_default_provider, set_credential_provider_override,
│                                   remove_credential_provider_override, migrate_credentials
├── integrations/
│   ├── one_password.rs       NEW — op CLI wrapper (detect, read, write, delete, session check)
│   └── bitwarden.rs          NEW — bw CLI wrapper (detect, session, read, write, update, delete)
└── lib.rs                    MODIFY — register new commands in generate_handler!

src/core/
├── services/
│   ├── credential-provider.ts  NEW — ProviderId types, CREDENTIAL_KEYS, ProviderConfiguration
│   └── credential-router.ts    NEW — resolveProvider(), thin TS wrapper over Tauri invoke calls
└── storage/
    ├── schema.ts               MODIFY — add providerConfiguration + credentialProviderItemIds tables
    ├── migrations/
    │   └── 0003_provider_config.sql  NEW
    └── repositories/
        └── provider-config.ts  NEW — read/write ProviderConfiguration from SQLite

src/renderer/
├── pages/
│   └── Settings.tsx          MODIFY — add "Credential Storage" panel
├── components/
│   └── CredentialStoragePanel.tsx  NEW — provider cards, detection status, migration modal
└── store/
    └── index.ts              MODIFY — add providerConfig slice (defaultProvider, overrides, providerStatuses)
```

**Structure Decision**: Extends existing single-project layout. New Rust modules under `integrations/` follow existing `servicenow.rs` pattern. New TS service under `core/services/` follows existing `chat.ts` pattern. Settings panel extends existing `Settings.tsx` page.

## Complexity Tracking

> No violations — all constitution principles met without exceptions.
