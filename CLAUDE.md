# servicenow_mcp_handling

ServiceNow desktop app (Tauri v2) — MCP integration, AI chat, security workflows.

## Stack
- **Frontend**: TypeScript 5.x, React 18, Zustand 5.x, Vite
- **Backend**: Rust 1.75+ (Tauri commands), Drizzle ORM + SQLite (`tauri-plugin-sql`)
- **AI/MCP**: `@modelcontextprotocol/sdk`, Ollama streaming via Tauri Channel
- **Auth**: `tauri-plugin-keyring` for credential storage

## Commands

```bash
npm run tauri:dev       # Start full app (Vite + Tauri)
npm run tauri:build     # Production build
npm run dev             # Vite only (renderer)
npm run test            # Vitest (watch)
npm run test:unit       # Unit tests only
npm run test:integration
npm run test:e2e        # Playwright
npm run test:coverage
npm run lint            # ESLint (0 warnings allowed)
npm run format          # Prettier
cd src-tauri && cargo build
cd src-tauri && cargo test
cd src-tauri && cargo clippy
```

## Project Structure

```
src/
  core/
    integrations/     # ServiceNow REST client
    mcp/              # MCP client/server
    security/         # Security analysis
    services/         # Chat, tool-calling logic
    storage/          # DB schema, repositories
    workflows/        # Security analysis workflows
  renderer/
    components/       # React components
    pages/            # React pages
    store/            # Zustand store (index.ts)
src-tauri/src/
  commands/           # Tauri command handlers
  mcp/                # MCP Rust side
tests/
  unit/ integration/ contract/
```

## Key Files
- Rust commands: `src-tauri/src/commands/`
- TS chat service: `src/core/services/chat.ts`
- Zustand store: `src/renderer/store/index.ts`
- DB schema: `src/core/storage/schema.ts`
- DB connection: `src/core/storage/database.ts`

## Gotchas

**Tauri `generate_handler!`**: Re-exports via `pub use` do NOT work — use full path:
`commands::credentials::store_fn`, not a re-export.

**Zustand selectors**: Object-returning selectors MUST use `useShallow` from `zustand/react/shallow`.
Otherwise `{} !== {}` triggers infinite re-render (max update depth exceeded).

**Tauri Channel streaming**: DB persistence happens AFTER the streaming promise resolves.
Never reload from DB inside `onDone`; do it after `await sendMessage()`.

**SQLite migrations**: Cannot modify CHECK constraints — must drop + recreate table.
FTS5 tables must be dropped + rebuilt after table recreation.

**Layout**: Replace Vite default `index.css`. Use `height: 100%` on `html/body/#root`, not `minHeight: 100vh`.

## Environment
- Node 18+, Rust 1.75+, Tauri CLI v2 (`cargo install tauri-cli`)
- For Ollama: install locally, use Mistral:7b or larger (phi3:mini too small for RAG/tools)

**Multi-vault credential provider patterns**:
- Provider routing layer: `src-tauri/src/integrations/one_password.rs` + `bitwarden.rs`; credential commands accept optional `provider_id` param (empty = keychain)
- `which` crate used for binary detection — no subprocess needed
- **Bitwarden session detection**: use `bw status` JSON `.status` field — NOT `bw unlock --check` (known bug: reports locked even with valid session)
- Bitwarden `BW_SESSION` passed via `.env("BW_SESSION", token)` on Command, never as CLI arg
- Provider config stored in SQLite `provider_configuration` table; per-credential overrides keyed as `override:{credential_key}`
- Bitwarden item UUIDs cached in `credential_provider_item_ids` table to avoid name-based fuzzy lookup
- `migrate_credentials` Rust command migrates FROM OS keychain to target provider; TypeScript calls `setDefaultProvider()` after `result.providerChanged === true`
- Migration modal (`CredentialMigrationModal`) lives in `src/renderer/components/`; wired in `CredentialStoragePanel` via `isProviderChange` guard on Save

## Active Technologies
- TypeScript 5.x (renderer/core) + Rust 1.75+ (Tauri commands) (004-multi-vault-credentials)
- SQLite — 2 new tables: `provider_configuration` (key/value config), `credential_provider_item_ids` (UUID cache for Bitwarden/1Password). Migration: `0003_provider_config.sql` (004-multi-vault-credentials)

## Recent Changes
- 004-multi-vault-credentials: Added TypeScript 5.x (renderer/core) + Rust 1.75+ (Tauri commands)
