# Feature Specification: Multi-Vault Credential Provider

**Feature Branch**: `004-multi-vault-credentials`
**Created**: 2026-03-10
**Status**: Draft
**Input**: User description: "I want to add the possibility to use the 1password and bitwarden on top of keychain and also to choose the default one and which one to use"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Select Active Credential Provider (Priority: P1)

A user who already uses 1Password or Bitwarden as their primary password manager wants to store and retrieve the app's credentials (ServiceNow URL, OAuth tokens, API keys) inside their existing vault instead of the OS keychain. They open Settings, navigate to a "Credential Storage" section, pick their preferred provider, and save. From that point on, all credential reads and writes go through the chosen provider.

**Why this priority**: This is the core of the feature. Without it, no other user story is possible. Users who manage credentials centrally in 1Password or Bitwarden cannot integrate this app into their security workflow.

**Independent Test**: Fully testable by opening Settings → Credential Storage, selecting 1Password, saving, then storing a ServiceNow URL — the value must appear in the 1Password vault (or mock) and be readable back into the app without using the OS keychain.

**Acceptance Scenarios**:

1. **Given** the Settings page is open, **When** the user opens the "Credential Storage" section, **Then** three providers are shown: OS Keychain, 1Password, and Bitwarden, with the current active provider indicated.
2. **Given** the user selects 1Password and saves, **When** the app stores any credential, **Then** the value is written to 1Password and NOT to the OS keychain.
3. **Given** a provider is selected, **When** the app restarts, **Then** the same provider is still active (selection persists across sessions).

---

### User Story 2 — Per-Credential Provider Override (Priority: P2)

A user who has set Bitwarden as the default wants one specific credential (e.g., the Perplexity search API key) stored in the OS keychain instead. They open the credential detail, choose "Override provider → OS Keychain" for that entry, and save. All other credentials continue to use Bitwarden.

**Why this priority**: Some credentials may be shared across machines (in a vault) while others are machine-local (keychain). Per-credential overrides enable that separation without forcing a global decision.

**Independent Test**: Testable by setting Bitwarden as default, overriding one credential entry to OS Keychain, storing a value in it, and confirming the value goes to the OS keychain while a separate credential goes to Bitwarden.

**Acceptance Scenarios**:

1. **Given** Bitwarden is the default provider, **When** the user overrides a specific credential's provider to OS Keychain and saves, **Then** that credential is stored in the OS keychain and all others in Bitwarden.
2. **Given** a per-credential override exists, **When** the user removes the override, **Then** the credential falls back to the default provider.
3. **Given** a per-credential override exists, **When** the app restarts, **Then** the override is still active.

---

### User Story 3 — Migrate Existing Credentials Between Providers (Priority: P3)

A user switching from OS Keychain to 1Password wants their existing credentials moved automatically so they do not have to re-enter them. When they change the default provider, the app offers a "Migrate existing credentials" option. They confirm, and the values are read from the current provider and written to the new one.

**Why this priority**: Without migration, users must re-authenticate with ServiceNow after switching providers — a significant friction point. The feature works without migration, but adoption is greatly improved by it.

**Independent Test**: Testable by pre-populating OS Keychain with credentials, switching the provider to Bitwarden, triggering migration, then verifying the values appear in Bitwarden and the OS keychain entries are cleared.

**Acceptance Scenarios**:

1. **Given** OS Keychain is the current provider with credentials stored, **When** the user switches to 1Password and confirms migration, **Then** all credentials appear in 1Password and are no longer in the OS keychain.
2. **Given** migration is triggered, **When** one credential fails to migrate (e.g., 1Password vault locked), **Then** the app reports which credentials failed and rolls back the provider change (does not clear the originals).
3. **Given** migration completes successfully, **When** the user opens any credential-requiring feature, **Then** all features work without the user re-entering credentials.

---

### Edge Cases

- What happens when the selected provider is unavailable (e.g., 1Password app not running, Bitwarden vault locked)? → The app must show a clear, actionable error and prompt the user to unlock the vault or switch provider; it must NOT silently fail or fall back to the OS keychain without informing the user.
- What happens if the user selects 1Password or Bitwarden but has not installed the required CLI? → The provider option is shown with an "installation required" status indicator; the user cannot activate it until prerequisites are met.
- What happens when a credential write to the active provider fails mid-operation? → The app must report the failure; it must NOT partially store credentials across two providers.
- What happens when a per-credential override points to a provider that is later disabled or uninstalled? → The app must warn the user at startup and prompt them to re-map the affected credentials.
- What happens when a user has multiple vaults in 1Password or Bitwarden? → The app always uses the CLI's default vault/collection. No vault picker is provided. Users who need a specific vault should set it as the CLI default outside the app.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST support three credential storage providers on all three target platforms (macOS, Windows, Linux): OS Keychain (native per-platform: macOS Keychain, Windows Credential Manager, Linux Secret Service), 1Password CLI integration, and Bitwarden CLI integration.
- **FR-002**: Users MUST be able to select one provider as the global default through the Settings UI.
- **FR-003**: The selected default provider MUST persist across app restarts.
- **FR-004**: Users MUST be able to override the provider for any individual credential entry independently of the global default.
- **FR-005**: Per-credential provider overrides MUST persist across app restarts.
- **FR-006**: The app MUST detect whether each provider's prerequisite tooling is installed (OS Keychain: always available; 1Password: `op` CLI; Bitwarden: `bw` CLI) and indicate availability status in the Settings UI.
- **FR-007**: The Settings UI MUST prevent the user from activating a provider whose prerequisites are not installed or not authenticated.
- **FR-007a**: For Bitwarden specifically, the app MUST detect whether an active unlocked session exists (via the Bitwarden CLI) and treat a missing or expired session as "not authenticated". The app MUST NOT prompt for or store the Bitwarden master password.
- **FR-008**: The app MUST re-check provider availability on every credential read/write operation (not only at startup). If the provider has become unavailable mid-session (e.g., vault auto-locked), the operation MUST fail immediately with a clear, actionable error identifying the provider and the remediation step (e.g., "Bitwarden vault is locked — run `bw unlock` and retry").
- **FR-009**: The app MUST offer a credential migration workflow when the user changes the global default provider, allowing them to copy ALL credential types (ServiceNow URL + auth, OAuth tokens, all API keys) from the old provider to the new one in a single confirmed step.
- **FR-010**: If credential migration fails for any entry, the app MUST report which entries failed and MUST NOT commit the provider change or clear credentials from the original provider.
- **FR-011**: All credential read and write operations MUST be routed through the active provider (global default or per-credential override) with no silent fallback to a different provider.
- **FR-012**: The provider selection and per-credential override configuration MUST be stored in app local settings (not inside any credential vault) so it survives provider changes.
- **FR-013**: All credentials written by this app to any provider MUST use a consistent namespace prefix (e.g., `servicenow-mcp-bridge/`) to avoid collisions in shared vaults.

### Key Entities

- **CredentialProvider**: Represents a storage backend. Attributes: identifier (`keychain` | `1password` | `bitwarden`), display name, availability status, prerequisites-met flag.
- **CredentialEntry**: A named secret the app manages. Covers all credential types: ServiceNow instance URL and credentials, Now Assist OAuth tokens, and all LLM/search API keys (OpenAI, Mistral, Perplexity). Attributes: key name, credential type, provider override (optional — inherits global default if absent).
- **ProviderConfiguration**: The user's global provider selection and per-entry overrides. Persisted in app local settings. Attributes: default provider identifier, map of credential key → provider override.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can switch from OS Keychain to 1Password or Bitwarden and complete the change (including migration if desired) in under 2 minutes without consulting external documentation.
- **SC-002**: After switching providers with migration, all existing app features that rely on credentials work without the user re-entering any values (100% credential continuity when prerequisites are met).
- **SC-003**: When a provider is unavailable (vault locked, CLI not installed), the user receives an error message that tells them exactly what to do — no trial-and-error required.
- **SC-004**: Provider availability detection at Settings open completes within 2 seconds. Per-operation availability checks (on each credential read/write) complete within 200ms so they do not noticeably delay credential-dependent operations.
- **SC-005**: Zero credentials are silently lost or written to the wrong provider during any provider switch, migration, or override operation.

### Performance & Quality Targets

Per constitution requirements (`.specify/memory/constitution.md`):

- **Response Times**: Credential read/write operations complete within 500ms p95 (including CLI invocations); UI feedback within 100ms of user action; provider detection within 2 seconds.
- **Resource Limits**: <500MB memory per instance, <70% CPU at peak.
- **Test Coverage**: ≥80% code coverage across unit/integration/contract tests.
- **Accessibility**: WCAG 2.1 Level AA compliance.
- **Security**: OWASP Top 10 compliance; credentials MUST NOT be logged or stored in plaintext at any point; CLI invocations MUST be protected against argument injection.

## Clarifications

### Session 2026-03-10

- Q: Should users be able to specify a target vault/collection within 1Password or Bitwarden, or should the app always use the CLI's default vault/collection? → A: Always use CLI default — no vault picker; users configure their default vault externally if needed.
- Q: How does the app obtain an active Bitwarden session — does it handle unlocking itself or require the user to unlock externally? → A: User unlocks Bitwarden externally (`bw unlock`); app detects whether a valid session is active and surfaces an actionable error if not — the app never handles the master password.
- Q: Which platforms must this feature support? → A: All three — macOS, Windows, and Linux.
- Q: Which credential types are managed by the selected provider — all of them, or only ServiceNow credentials? → A: All credential types: ServiceNow URL + auth, OAuth tokens (Now Assist), and all API keys (OpenAI, Mistral, Perplexity).
- Q: Should provider availability be checked once at startup/Settings open, or re-checked on every credential operation? → A: Re-check on each credential read/write operation; surface a specific "vault locked" error immediately if the provider becomes unavailable mid-session.

## Assumptions

- **1Password integration** uses the [1Password CLI (`op`)](https://developer.1password.com/docs/cli/) which must be installed and signed in on the machine. The app does not bundle or manage the CLI.
- **Bitwarden integration** uses the [Bitwarden CLI (`bw`)](https://bitwarden.com/help/cli/) which must be installed and unlocked by the user before use (`bw unlock`). The app detects session status but does not manage, store, or prompt for the master password or session token.
- **No direct cloud API calls**: The app delegates all vault operations to the respective local CLIs; it does not call 1Password or Bitwarden cloud APIs directly.
- **Single vault/collection (default)**: The app always uses the CLI's default vault/collection for both 1Password and Bitwarden. No vault picker is provided; users who require a specific vault must configure it as their CLI default externally.
- **Cross-platform scope**: This feature must work on macOS, Windows, and Linux. The OS Keychain provider maps to the native credential store on each platform (macOS Keychain, Windows Credential Manager, Linux Secret Service via the existing `tauri-plugin-keyring` abstraction). The 1Password (`op`) and Bitwarden (`bw`) CLIs both support all three platforms.
- **OS Keychain always available**: The OS keychain requires no prerequisites and is always selectable on all platforms, ensuring users are never locked out.
