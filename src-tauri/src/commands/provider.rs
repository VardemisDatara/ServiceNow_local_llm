use crate::integrations::{bitwarden, one_password};

// ── Credential migration ──────────────────────────────────────────────────────

/// All credential keys the app manages — mirrors TypeScript's `CREDENTIAL_KEYS`.
const ALL_CREDENTIAL_KEYS: &[&str] = &[
    "servicenow_url",
    "servicenow_username",
    "servicenow_password",
    "oauth_access_token",
    "oauth_refresh_token",
    "oauth_id_token",
    "llm_openai",
    "llm_mistral",
    "perplexity",
    "google",
];

#[derive(serde::Serialize)]
pub struct FailedMigration {
    pub credential_key: String,
    pub error: String,
}

#[derive(serde::Serialize)]
pub struct MigrateCredentialsResult {
    pub success: bool,
    pub migrated: Vec<String>,
    pub failed: Vec<FailedMigration>,
    pub provider_changed: bool,
}

/// Migrate all credentials from OS keychain to the specified target provider.
///
/// Algorithm:
/// 1. Read each key from the OS keychain (the source of truth before migration).
/// 2. Write the value to the target provider.
/// 3. If all writes succeed → return success.
/// 4. If any write fails → roll back successfully-written items and return failure.
///
/// # Tauri Command
/// `invoke('migrate_credentials', { targetProviderId, bwSession? })`
#[tauri::command]
pub async fn migrate_credentials(
    target_provider_id: String,
    bw_session: Option<String>,
) -> Result<MigrateCredentialsResult, String> {
    // Validate target provider
    match target_provider_id.as_str() {
        "keychain" | "1password" | "bitwarden" => {}
        other => {
            return Err(format!(
                "Invalid provider id '{other}' — must be 'keychain', '1password', or 'bitwarden'"
            ));
        }
    }

    // Guard: migration always reads from the OS keychain as the source.
    // Migrating to keychain when it is already the source is a no-op.
    if target_provider_id == "keychain" {
        return Err(
            "Cannot migrate to OS Keychain: credentials are already stored in the OS Keychain"
                .to_string(),
        );
    }

    let session = bw_session.as_deref().unwrap_or("");

    let mut migrated: Vec<String> = Vec::new();
    let mut failed: Vec<FailedMigration> = Vec::new();

    for &key in ALL_CREDENTIAL_KEYS {
        // Step 1 — read from OS keychain
        let entry = keyring::Entry::new("servicenow-mcp-bridge", key)
            .map_err(|e| format!("Failed to create keyring entry for '{key}': {e}"))?;

        let value = match entry.get_password() {
            Ok(v) => v,
            Err(keyring::Error::NoEntry) => {
                // Key not in keychain — skip (not an error)
                log::info!("migrate_credentials: key '{}' not in keychain — skipping", key);
                continue;
            }
            Err(e) => {
                log::info!("migrate_credentials: could not read key '{}' from keychain: {}", key, e);
                failed.push(FailedMigration {
                    credential_key: key.to_string(),
                    error: format!("Could not read from keychain: {e}"),
                });
                continue;
            }
        };

        // Step 2 — write to target provider
        let write_result = match target_provider_id.as_str() {
            "1password" => one_password::write_secret(key, &value).await,
            "bitwarden" => bitwarden::write_secret(key, &value, session)
                .await
                .map(|_uuid| ()),
            _ => {
                // "keychain" — write using keyring
                let target_entry = keyring::Entry::new("servicenow-mcp-bridge", key)
                    .map_err(|e| format!("Failed to create keyring entry for '{key}': {e}"))?;
                target_entry
                    .set_password(&value)
                    .map_err(|e| format!("Failed to write to keychain: {e}"))
            }
        };

        match write_result {
            Ok(()) => {
                log::info!("migrate_credentials: migrated key '{}'", key);
                migrated.push(key.to_string());
            }
            Err(e) => {
                log::info!("migrate_credentials: failed to write key '{}': {}", key, e);
                failed.push(FailedMigration {
                    credential_key: key.to_string(),
                    error: e,
                });
            }
        }
    }

    if failed.is_empty() {
        Ok(MigrateCredentialsResult {
            success: true,
            migrated,
            failed,
            provider_changed: true,
        })
    } else {
        // Rollback: delete successfully-written items from target
        for key in &migrated {
            let rollback_result = match target_provider_id.as_str() {
                "1password" => one_password::delete_secret(key).await,
                "bitwarden" => bitwarden::delete_secret(key, session).await,
                _ => {
                    // keychain → keychain: no meaningful rollback needed (same store)
                    Ok(())
                }
            };
            if let Err(e) = rollback_result {
                log::info!("migrate_credentials: rollback failed for key '{}': {}", key, e);
            }
        }

        Ok(MigrateCredentialsResult {
            success: false,
            migrated,
            failed,
            provider_changed: false,
        })
    }
}

// ── Response types ────────────────────────────────────────────────────────────

/// Serialisable status for a single credential provider.
#[derive(serde::Serialize)]
pub struct ProviderStatusResponse {
    pub id: String,
    pub display_name: String,
    pub is_installed: bool,
    pub is_authenticated: bool,
    pub error_message: Option<String>,
}

/// Serialisable provider configuration snapshot.
#[derive(serde::Serialize)]
pub struct ProviderConfigResponse {
    pub default_provider: String,
    pub overrides: std::collections::HashMap<String, String>,
}

// ── Commands ──────────────────────────────────────────────────────────────────

/// Probe all three credential backends in parallel and return their status.
///
/// # Tauri Command
/// `invoke('get_available_providers')`
#[tauri::command]
pub async fn get_available_providers() -> Result<Vec<ProviderStatusResponse>, String> {
    // Run all checks concurrently
    let (op_installed, op_authenticated, bw_installed, bw_status) = tokio::join!(
        one_password::is_installed(),
        one_password::is_authenticated(),
        bitwarden::is_installed(),
        bitwarden::get_session_status(),
    );

    let bw_unlocked = bw_status == bitwarden::BwStatus::Unlocked;

    let keychain = ProviderStatusResponse {
        id: "keychain".to_string(),
        display_name: "OS Keychain".to_string(),
        is_installed: true,
        is_authenticated: true,
        error_message: None,
    };

    let op_error = if !op_installed {
        Some("1Password CLI (op) not installed".to_string())
    } else if !op_authenticated {
        Some("1Password session expired — run `op signin` and retry".to_string())
    } else {
        None
    };

    let one_password = ProviderStatusResponse {
        id: "1password".to_string(),
        display_name: "1Password".to_string(),
        is_installed: op_installed,
        is_authenticated: op_authenticated,
        error_message: op_error,
    };

    let bw_error = if !bw_installed {
        Some("Bitwarden CLI (bw) not installed".to_string())
    } else if !bw_unlocked {
        Some("Bitwarden vault is locked — run `bw unlock` and retry".to_string())
    } else {
        None
    };

    let bitwarden_provider = ProviderStatusResponse {
        id: "bitwarden".to_string(),
        display_name: "Bitwarden".to_string(),
        is_installed: bw_installed,
        is_authenticated: bw_unlocked,
        error_message: bw_error,
    };

    Ok(vec![keychain, one_password, bitwarden_provider])
}
