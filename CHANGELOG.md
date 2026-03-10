# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

---

## [1.1.0] - 2026-03-10

### Added
- Multi-vault credential provider support (004-multi-vault-credentials)
  - Store app credentials in 1Password CLI or Bitwarden CLI instead of OS keychain
  - Global default provider selection in Settings → Credential Storage
  - Per-credential provider override — set a different vault per credential key
  - Credential migration wizard when switching providers (atomic: rolls back on any failure)
  - Re-checks provider availability on every credential operation; returns `PROVIDER_LOCKED` if vault locks mid-session
  - Supports macOS, Windows, and Linux

### Fixed
- `edit_secret` in 1Password integration: secret value was exposed as a CLI argument; replaced with delete-then-recreate via stdin JSON
- `delete_secret` in Bitwarden integration: now resolves item UUID via `bw list items --search` before calling `bw delete item` (which requires UUID, not name)
- `migrate_credentials`: migrating to OS Keychain (the source provider) was a silent no-op; now returns an explicit error

### Security
- Credential values are never passed as CLI arguments to `op` or `bw` — all writes and updates use stdin JSON

---

## [0.3.0] - 2026-02-13

### Added
- Collapsible analysis result cards using native HTML `<details>` / `<summary>`
- UI polish pass: improved layout consistency across pages
- ServiceNow branding and app rename with updated logo

---

## [0.2.0] - 2026-01-30

### Added
- Now Assist MCP integration with JWT authentication (OAuth browser login)
- Security incident summarization via Now Assist tool calling
- Security Dashboard with 5-step analysis workflow (fetch, correlate, IOC, attack surface, remediation)
- AI plain-English summary generated after workflow completion
- `get_incident_details` for full SIR/INC fetch via REST API
- Token format warning in Configuration UI (amber warning if token is not JWT)
- SQLite migration adding nullable columns to `configuration_profiles`

### Fixed
- HMR singleton reset: `callTool` now syncs Zustand store on NOT_CONNECTED error
- SIR guard: `incident_summarization` skipped for SIR numbers (wrong table)
- `query_incidents` Rust fn: `args["query"]` now correctly appended to `sysparm_query`

---

## [0.1.0] - 2025-12-20

### Added
- Initial release of the ServiceNow MCP Handling desktop app (Tauri v2 + React 18)
- MCP client/server integration via `@modelcontextprotocol/sdk`
- Multi-provider LLM chat (Ollama, OpenAI, Mistral) with streaming responses
- Web search integration (Perplexity, DuckDuckGo) with proactive search detection
- MCP tool calling: list/filter security incidents (`sn_si_incident`, `incident`)
- Credential storage via `tauri-plugin-keyring`
- SQLite persistence with Drizzle ORM (`tauri-plugin-sql`)
- Resizable sidebar, full-height layout, conversation history
- Configuration profiles with per-profile API key management
