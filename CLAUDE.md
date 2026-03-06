# servicenow_mcp_handling Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-13

## Active Technologies
- TypeScript 5.x (renderer/core) + Rust 1.75+ (Tauri commands — no new Rust needed for this feature) + React 18, Tauri v2.0, `@modelcontextprotocol/sdk` (already installed — `streamableHttp.js` confirmed present), Zustand 5.x, Drizzle ORM + `tauri-plugin-sql`, `tauri-plugin-keyring` (002-security-nowassist-docs)
- SQLite via `tauri-plugin-sql` + `drizzle-orm/sqlite-proxy` — migration 0002 adds 2 nullable TEXT columns to `configuration_profiles` (002-security-nowassist-docs)
- TypeScript 5.x (renderer), React 18 + React 18, Zustand 5.x (already installed), native HTML `<details>` / `<summary>` for collapsible panels — no new packages (003-release-ui-polish)
- N/A — no database changes (003-release-ui-polish)

- TypeScript 5.x (frontend/UI) + Rust 1.75+ (backend/Tauri main process) - Hybrid approach for DX + performance + Tauri v2.0 (desktop framework), @modelcontextprotocol/sdk (MCP client), mcp-protocol-sdk (MCP server), better-sqlite3 + Drizzle ORM (database), tauri-plugin-keyring (credentials), reqwest (HTTP client), React 18+ (UI), Vitest (unit/integration tests), Playwright (E2E tests) (001-servicenow-mcp-app)

## Project Structure

```text
src/
tests/
```

## Commands

cargo test [ONLY COMMANDS FOR ACTIVE TECHNOLOGIES][ONLY COMMANDS FOR ACTIVE TECHNOLOGIES] cargo clippy

## Code Style

TypeScript 5.x (frontend/UI) + Rust 1.75+ (backend/Tauri main process) - Hybrid approach for DX + performance: Follow standard conventions

## Recent Changes
- 003-release-ui-polish: Added TypeScript 5.x (renderer), React 18 + React 18, Zustand 5.x (already installed), native HTML `<details>` / `<summary>` for collapsible panels — no new packages
- 002-security-nowassist-docs: Added TypeScript 5.x (renderer/core) + Rust 1.75+ (Tauri commands — no new Rust needed for this feature) + React 18, Tauri v2.0, `@modelcontextprotocol/sdk` (already installed — `streamableHttp.js` confirmed present), Zustand 5.x, Drizzle ORM + `tauri-plugin-sql`, `tauri-plugin-keyring`

- 001-servicenow-mcp-app: Added TypeScript 5.x (frontend/UI) + Rust 1.75+ (backend/Tauri main process) - Hybrid approach for DX + performance + Tauri v2.0 (desktop framework), @modelcontextprotocol/sdk (MCP client), mcp-protocol-sdk (MCP server), better-sqlite3 + Drizzle ORM (database), tauri-plugin-keyring (credentials), reqwest (HTTP client), React 18+ (UI), Vitest (unit/integration tests), Playwright (E2E tests)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
