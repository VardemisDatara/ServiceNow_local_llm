# Research: Multi-Vault Credential Provider

**Branch**: `004-multi-vault-credentials` | **Date**: 2026-03-10

---

## Decision 1: 1Password CLI Integration

**Decision**: Use `op` CLI v2 only. Detect via `op --version`, require `>= 2.0.0`. Session check via `op whoami --format json`. Read via `op read "op://Vault/Title/field"` (raw stdout). Write via `op item create` with JSON on stdin (never pass secrets as CLI args). Namespace items as `servicenow-mcp-bridge/<key-name>` titles. Always pass `--vault` explicitly — never rely on default.

**Rationale**: v1 and v2 have incompatible command structures; v2 is the current standard. `op read` returns the raw secret value directly with no JSON parsing needed for reads. Passing secrets via stdin prevents them appearing in `ps` output.

**Alternatives considered**:
- 1Password SDK (Go/Python only, no Rust) — ruled out, no native Rust support
- Direct API calls — requires service accounts, not available for personal vaults

**Key implementation notes**:
- Session active: `op whoami --format json` exits 0 with JSON → signed in
- Read: `op read "op://Private/servicenow-mcp-bridge%2F{key}/password"` (URL-encode `/` in title as `%2F`)
- Create: stdin JSON `{"category":"PASSWORD","title":"servicenow-mcp-bridge/{key}","fields":[{"id":"password","type":"CONCEALED","value":"{val}"}]}`
- Update: `op item edit "servicenow-mcp-bridge/{key}" --vault Private "password[concealed]={val}"` (or stdin)
- Delete: `op item delete "servicenow-mcp-bridge/{key}" --vault Private`
- Minimum version: `2.0.0`

---

## Decision 2: Bitwarden CLI Integration

**Decision**: Use `bw` CLI. Detect via `bw --version`. Session check via `bw status` JSON → `.status === "unlocked"`. App never handles master password — user must run `bw unlock` externally. Pass `BW_SESSION` token via `.env("BW_SESSION", token)` on each subprocess call. Use Secure Note type (type 2) for secrets; store item UUIDs in SQLite after creation for efficient subsequent access. Exact-match reads via `bw list items --search "servicenow-mcp-bridge/{key}"` + client-side filter.

**Rationale**: `bw status` is the only reliable lock detection method (`bw unlock --check` has a known bug reporting locked even with valid session). UUIDs are required for edit/delete and avoid fuzzy-match issues with `bw get item`. Secure Notes store arbitrary string values cleanly without the login-specific field structure. Never log or persist the `BW_SESSION` token — pass it fresh on each operation.

**Alternatives considered**:
- Bitwarden Secrets Manager SDK — for machine secrets/CI only, not personal vaults
- Storing `BW_SESSION` in OS keychain — avoids, session token should be ephemeral

**Key implementation notes**:
- Session active: `bw status` → parse `.status` field; `"unlocked"` = ready
- Do NOT use `bw unlock --check` — known bug, unreliable
- Read: `bw list items --search "servicenow-mcp-bridge/{key}" --session {token}` → filter array for exact `.name` match → get `.notes` field
- Create: `bw encode <<< '{"type":2,"name":"servicenow-mcp-bridge/{key}","notes":"{val}"}' | bw create item --session {token}` → save returned `.id` UUID to SQLite
- Update: `bw get item {uuid} --session {token}` → mutate `.notes` → `bw encode | bw edit item {uuid} --session {token}`
- Delete: `bw delete item {uuid} --permanent --session {token}` (use UUID from SQLite)
- Pass `BW_SESSION` via `Command::new("bw").env("BW_SESSION", &session_token)`, never as a shell env
- Minimum version: `>= 2023.1.0` (ensures `bw status` JSON + `--raw` support)

---

## Decision 3: Rust Subprocess Execution

**Decision**: Use `tokio::process::Command` for all CLI invocations (async Tauri command context). Pass every argument as a discrete `.arg()` call — never construct a shell string. Secrets passed via stdin using `.stdin(Stdio::piped())`. Wrap all subprocess calls with `tokio::time::timeout(Duration::from_secs(10), ...)`. Detect binary availability via `which` crate (`which::which("op")`). Classify errors by `io::ErrorKind::NotFound` (not installed) vs non-zero exit code (operational error).

**Rationale**: `tokio::process::Command` is non-blocking and integrates cleanly with `async fn` Tauri commands. Discrete `.arg()` calls bypass the shell entirely — no injection possible. `which` crate provides cross-platform binary path resolution without shelling out to `which`/`where`.

**Alternatives considered**:
- `std::process::Command` (blocking) — blocks Tauri async runtime, not suitable
- Shell string with `sh -c "..."` — injection risk, rejected
- Spawning a persistent background process — unnecessary complexity for infrequent credential ops

**Additional findings**:
- **CVE-2024-24576** (fixed Rust 1.77.2): argument escaping bug when invoking `.bat`/`.cmd` files on Windows via `Command`. Does NOT affect native EXE binaries (`bw.exe`, `op.exe`). Keep Rust toolchain at ≥ 1.77.2.
- **`kill_on_drop(true)`**: Set on `Command` before `spawn()` as a safety net — if the `Child` handle is dropped (e.g., future cancelled), the OS process is also killed. Does not replace explicit timeout+kill but prevents zombie processes.
- **`tauri::async_runtime::spawn`**: Use instead of `tokio::spawn` when spawning background tasks from Tauri event listener callbacks (not from `#[tauri::command]` handlers) to avoid "no reactor running" panic.
- **No Tauri capability/permission required** for Rust-side subprocess spawning — `tauri-plugin-shell` and capability entries are only needed when exposing subprocess spawning to the WebView frontend.

**Key implementation notes**:
- Binary check: `which::which("op").is_ok()` — cross-platform, no subprocess needed
- Async call pattern:
  ```rust
  tokio::time::timeout(
      Duration::from_secs(10),
      tokio::process::Command::new("op")
          .args(["item", "get", title, "--vault", vault, "--format", "json"])
          .output()
  ).await??
  ```
- Error classification:
  - `Err(e)` where `e.kind() == ErrorKind::NotFound` → CLI not installed
  - `output.status.success() == false` + stderr contains "not signed in" → session expired
  - `output.status.success() == false` (other) → operational error (parse stderr for message)
- Stdin for secrets:
  ```rust
  let mut child = Command::new("bw").args(["encode"]).stdin(Stdio::piped()).stdout(Stdio::piped()).spawn()?;
  child.stdin.take().unwrap().write_all(json.as_bytes()).await?;
  ```
- Tauri v2: No additional capability/permission configuration needed for spawning local processes

---

## Decision 4: UUID Caching for Bitwarden

**Decision**: Add a `credential_provider_item_ids` table to SQLite (via Drizzle migration) that maps `(provider, credential_key)` → `external_item_id`. Used to store Bitwarden item UUIDs post-create so subsequent reads/updates/deletes use the UUID directly rather than name-based lookup.

**Rationale**: Bitwarden item names are not unique; edit and delete require UUIDs. Name lookup (`bw list items --search`) works for creation/initial lookup but is slower and fragile (fuzzy matching) for hot-path operations. 1Password uses title-based exact matching which is reliable, so UUID caching is only critical for Bitwarden.

---

## Decision 5: ProviderConfiguration Storage

**Decision**: Store the global default provider and per-credential overrides in SQLite via a new `provider_configuration` table (single-row config pattern: key/value store). This table is separate from credential vaults so it survives provider changes without being inaccessible.

**Rationale**: Must be stored somewhere independent of any vault so switching providers doesn't create a bootstrapping problem (can't read config from a locked vault). SQLite via existing Drizzle ORM is the natural choice given the project's storage layer.

---

## Decision 6: Cross-Platform Binary Paths

**Decision**: Use the `which` crate for binary detection on all platforms. No hardcoded paths.

| Platform | `op` typical location | `bw` typical location |
|----------|-----------------------|-----------------------|
| macOS | `/usr/local/bin/op` or `/opt/homebrew/bin/op` | `/usr/local/bin/bw` |
| Windows | `C:\Program Files\1Password CLI\op.exe` | npm global install |
| Linux | `/usr/local/bin/op` | `/usr/local/bin/bw` or snap |

`which::which("op")` resolves the correct path on all platforms without hardcoding.
