# US3 — Credential Migration: Manual Validation Checklist

**Status**: Automated test gates passing. Manual sign-off required before production release.

## Automated Gates (CI)

| Gate | Status |
|------|--------|
| `cargo build` (no errors) | Required |
| `cargo clippy` (no errors) | Required |
| `npm run lint` (0 warnings) | Required |
| `npm run test:unit` (all pass) | Required |
| Unit: `credential-router-migrate.test.ts` | Required |
| Unit: `credential-router.test.ts` | Required |
| Unit: `credential-router-overrides.test.ts` | Required |
| Integration: `provider-config-persistence.test.ts` | Required |

## Manual Quickstart Scenarios

All 6 scenarios below must be verified manually before production sign-off.

### Scenario 1: OS Keychain → 1Password (happy path)

1. Start app with some credentials stored in OS keychain (e.g. a ServiceNow password).
2. Open Settings → Credential Storage.
3. Select **1Password** (must show "Ready").
4. Click **Migrate & Save**.
5. Confirm migration modal opens, shows source = "OS Keychain", target = "1Password".
6. Click **Migrate**.
7. Verify: success summary shows migrated credential count.
8. Verify: `op item list --vault Private` contains `servicenow-mcp-bridge/*` items.
9. Verify: provider selection in Settings now shows "1Password" as active.

### Scenario 2: OS Keychain → Bitwarden (requires session token)

1. Unlock Bitwarden: `bw unlock --raw` — copy the session token.
2. Open Settings → Credential Storage.
3. Select **Bitwarden** (must show "Ready").
4. Click **Migrate & Save**.
5. Verify: migration modal shows a "Bitwarden session token" input field.
6. Paste session token, click **Migrate**.
7. Verify: success summary.
8. Verify: `bw list items --search servicenow-mcp-bridge` shows items.

### Scenario 3: Migration with no credentials in keychain

1. Ensure OS keychain has no `servicenow-mcp-bridge/*` entries (fresh install).
2. Attempt migration to 1Password.
3. Verify: modal reports 0 credentials migrated (not an error).
4. Verify: provider is updated to 1Password.

### Scenario 4: Migration failure → rollback

1. Disconnect 1Password (sign out: `op signout`).
2. Attempt migration to 1Password.
3. Verify: modal reports failure, lists which credentials failed.
4. Verify: no orphaned items exist in 1Password.
5. Verify: provider is NOT changed — still shows previous provider.

### Scenario 5: Cancel migration

1. Open migration modal (select different provider, click Migrate & Save).
2. Click **Cancel**.
3. Verify: provider selection reverts to the currently-active provider.
4. Verify: no credentials were moved.

### Scenario 6: Bitwarden modal requires session token

1. Select Bitwarden as target.
2. Open migration modal.
3. Verify: **Migrate** button is disabled until session token is entered.
4. Enter a session token.
5. Verify: **Migrate** button becomes enabled.
