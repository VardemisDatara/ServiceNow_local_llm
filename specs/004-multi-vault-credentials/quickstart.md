# Quickstart: Multi-Vault Credential Provider

**Branch**: `004-multi-vault-credentials` | **Date**: 2026-03-10

## Prerequisites

- 1Password CLI v2+ installed: `op --version` (should show `2.x.x`)
- Bitwarden CLI installed: `bw --version`
- Bitwarden unlocked: `bw unlock` (copy the session token shown)
- App running in dev mode: `npm run tauri:dev`

---

## Manual Test Scenarios

### Scenario 1: Provider Detection (US1 — P1)

1. Open Settings → Credential Storage section
2. **Expected**: Three providers listed — "OS Keychain", "1Password", "Bitwarden"
3. **Expected**: OS Keychain shows as available (no prerequisites)
4. If `op` CLI not installed: 1Password shows "Not installed" status — cannot be selected
5. If `bw` vault is locked: Bitwarden shows "Vault locked — run `bw unlock`" — cannot be selected
6. **Expected**: Detection completes within 2 seconds (no spinner visible after that)

---

### Scenario 2: Switch to 1Password (US1 — P1)

1. Ensure `op` is installed and signed in (`op whoami` returns account info)
2. Open Settings → Credential Storage → Select "1Password" → Save
3. Go to Settings → ServiceNow → Enter instance URL + credentials → Save
4. **Verify**: Run `op item list --vault Private --format json | grep servicenow-mcp-bridge` — items should appear
5. Restart the app
6. **Expected**: Settings → Credential Storage still shows 1Password as active
7. **Expected**: ServiceNow credentials pre-populated (loaded from 1Password)

---

### Scenario 3: Per-Credential Override (US2 — P2)

1. Set Bitwarden as default provider (vault must be unlocked)
2. Open Settings → API Keys → OpenAI → Provider Override → Select "OS Keychain" → Save
3. Enter OpenAI API key → Save
4. **Verify**: OpenAI key appears in OS Keychain (`security find-generic-password -s "servicenow-mcp-bridge/llm_openai"` on macOS)
5. **Verify**: A different credential (e.g., Perplexity key) still goes to Bitwarden (`bw list items --search "servicenow-mcp-bridge/perplexity"`)
6. Remove the override → the field should now redirect to Bitwarden on next save

---

### Scenario 4: Credential Migration (US3 — P3)

1. Set OS Keychain as active provider; enter ServiceNow credentials, at least one API key
2. Open Settings → Credential Storage → Select "1Password" → a "Migrate existing credentials" prompt appears
3. Confirm migration
4. **Expected**: All credentials listed as "Migrated successfully"
5. **Verify**: `op item list --vault Private | grep servicenow-mcp-bridge` shows all keys
6. **Verify**: Old keychain entries removed (`security find-generic-password -s "servicenow-mcp-bridge/servicenow_url"` returns error)
7. Restart app — all features work without re-entering credentials

---

### Scenario 5: Mid-Session Vault Lock (Edge Case)

1. Set 1Password as active provider with credentials stored
2. Start a chat conversation
3. Lock 1Password: `op signout`
4. Send a message that triggers a tool call requiring credentials
5. **Expected**: Clear error message: "1Password session expired — re-authenticate and retry"
6. **Expected**: App does NOT silently fall back to OS keychain
7. Re-authenticate: `op signin` → retry → works

---

### Scenario 6: Migration Rollback on Failure (Edge Case)

1. Set OS Keychain as active provider with credentials stored
2. Lock Bitwarden: `bw lock`
3. Open Settings → Credential Storage → Select "Bitwarden" → confirm migration
4. **Expected**: Migration fails cleanly with list of failed credentials
5. **Expected**: Provider remains OS Keychain (no switch occurred)
6. **Expected**: All original keychain credentials still present and readable

---

## Development Smoke Tests

```bash
# Unit tests
npm run test:unit -- --reporter=verbose 2>&1 | grep -E "provider|credential|vault"

# Rust tests
cd src-tauri && cargo test credential_provider 2>&1

# Lint
npm run lint && cd src-tauri && cargo clippy
```
