// SECURITY: credential values are never logged — only key names and operation results
use std::process::Stdio;
use tokio::process::Command;
use tokio::time::{timeout, Duration};

/// Check whether the 1Password CLI (`op`) is installed and on PATH.
pub async fn is_installed() -> bool {
    which::which("op").is_ok()
}

/// Return the installed `op` version string (e.g. `"2.29.0"`), or `None`.
pub async fn get_version() -> Option<String> {
    let output = timeout(Duration::from_secs(10), Command::new("op").arg("--version").output())
        .await
        .ok()?
        .ok()?;
    if output.status.success() {
        Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        None
    }
}

/// Returns `true` if the current 1Password session is active (`op whoami` exits 0).
pub async fn is_authenticated() -> bool {
    if !is_installed().await {
        return false;
    }
    matches!(
        timeout(
            Duration::from_secs(10),
            Command::new("op")
                .args(["whoami", "--format", "json"])
                .output(),
        )
        .await,
        Ok(Ok(out)) if out.status.success()
    )
}

/// Read a secret value stored under `servicenow-mcp-bridge/{key}` in the Private vault.
pub async fn read_secret(key: &str) -> Result<String, String> {
    ensure_installed_and_authenticated().await?;

    let title = format!("servicenow-mcp-bridge/{key}");
    let result = timeout(
        Duration::from_secs(10),
        Command::new("op")
            .args(["item", "get", &title, "--format", "json"])
            .output(),
    )
    .await
    .map_err(|_| "1Password CLI timed out".to_string())?
    .map_err(|e| format!("Failed to run op: {e}"))?;

    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        if auth_error(&stderr) {
            return Err(
                "1Password session expired — run `op signin` and retry".to_string(),
            );
        }
        return Err(format!("op item get failed: {stderr}"));
    }

    let json: serde_json::Value = serde_json::from_slice(&result.stdout)
        .map_err(|e| format!("Failed to parse op output: {e}"))?;

    // Look for a field with id == "password" in the fields array
    if let Some(fields) = json["fields"].as_array() {
        for field in fields {
            if field["id"].as_str() == Some("password") {
                return field["value"]
                    .as_str()
                    .map(|v| v.to_string())
                    .ok_or_else(|| "Password field has no value".to_string());
            }
        }
    }

    Err(format!("No password field found for item '{title}'"))
}

/// Write a secret. Creates a new item or updates an existing one.
///
/// The value is passed via stdin — never as a CLI argument.
pub async fn write_secret(key: &str, value: &str) -> Result<(), String> {
    ensure_installed_and_authenticated().await?;

    let title = format!("servicenow-mcp-bridge/{key}");

    // Build the JSON template via stdin to avoid putting the secret in process args
    let item_json = serde_json::json!({
        "category": "PASSWORD",
        "title": title,
        "fields": [
            {
                "id": "password",
                "type": "CONCEALED",
                "value": value
            }
        ]
    })
    .to_string();

    let create_result = timeout(
        Duration::from_secs(10),
        async {
            let mut child = Command::new("op")
                .args(["item", "create", "--vault", "Private", "-"])
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| format!("Failed to spawn op: {e}"))?;

            if let Some(mut stdin) = child.stdin.take() {
                use tokio::io::AsyncWriteExt;
                stdin
                    .write_all(item_json.as_bytes())
                    .await
                    .map_err(|e| format!("Failed to write to op stdin: {e}"))?;
            }

            child.wait_with_output().await.map_err(|e| e.to_string())
        },
    )
    .await
    .map_err(|_| "1Password CLI timed out".to_string())?;

    let output = create_result?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    if auth_error(&stderr) {
        return Err("1Password session expired — run `op signin` and retry".to_string());
    }

    // If item already exists, fall back to editing it
    if stderr.contains("already exists") || stderr.contains("already an item") {
        return edit_secret(key, value).await;
    }

    Err(format!("op item create failed: {stderr}"))
}

/// Update an existing 1Password item's password field.
///
/// Implemented as delete-then-recreate via stdin so the secret value is
/// never passed as a CLI argument (field-assignment syntax `password=value`
/// would expose the secret in the process argument list).
async fn edit_secret(key: &str, value: &str) -> Result<(), String> {
    let title = format!("servicenow-mcp-bridge/{key}");

    // Step 1 — delete the existing item
    let delete_result = timeout(
        Duration::from_secs(10),
        Command::new("op")
            .args(["item", "delete", &title, "--vault", "Private"])
            .output(),
    )
    .await
    .map_err(|_| "1Password CLI timed out".to_string())?
    .map_err(|e| format!("Failed to run op item delete: {e}"))?;

    if !delete_result.status.success() {
        let stderr = String::from_utf8_lossy(&delete_result.stderr);
        if auth_error(&stderr) {
            return Err("1Password session expired — run `op signin` and retry".to_string());
        }
        return Err(format!("op item delete failed during update: {stderr}"));
    }

    // Step 2 — recreate via stdin JSON so the secret is never in process args
    let item_json = serde_json::json!({
        "category": "PASSWORD",
        "title": title,
        "fields": [
            {
                "id": "password",
                "type": "CONCEALED",
                "value": value
            }
        ]
    })
    .to_string();

    let create_result = timeout(
        Duration::from_secs(10),
        async {
            let mut child = Command::new("op")
                .args(["item", "create", "--vault", "Private", "-"])
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| format!("Failed to spawn op: {e}"))?;

            if let Some(mut stdin) = child.stdin.take() {
                use tokio::io::AsyncWriteExt;
                stdin
                    .write_all(item_json.as_bytes())
                    .await
                    .map_err(|e| format!("Failed to write to op stdin: {e}"))?;
            }

            child.wait_with_output().await.map_err(|e| e.to_string())
        },
    )
    .await
    .map_err(|_| "1Password CLI timed out".to_string())?;

    let output = create_result?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    if auth_error(&stderr) {
        return Err("1Password session expired — run `op signin` and retry".to_string());
    }
    Err(format!("op item create failed during update: {stderr}"))
}

/// Delete the 1Password item for `key`.
pub async fn delete_secret(key: &str) -> Result<(), String> {
    ensure_installed_and_authenticated().await?;

    let title = format!("servicenow-mcp-bridge/{key}");
    let result = timeout(
        Duration::from_secs(10),
        Command::new("op")
            .args(["item", "delete", &title, "--vault", "Private"])
            .output(),
    )
    .await
    .map_err(|_| "1Password CLI timed out".to_string())?
    .map_err(|e| format!("Failed to run op: {e}"))?;

    if result.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&result.stderr);
    if auth_error(&stderr) {
        return Err("1Password session expired — run `op signin` and retry".to_string());
    }
    Err(format!("op item delete failed: {stderr}"))
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/// Validate that `op` is installed and the version is ≥ 2.x.
async fn ensure_installed_and_authenticated() -> Result<(), String> {
    if !is_installed().await {
        return Err("1Password CLI not installed".to_string());
    }

    // Require version 2+: check that the first character is not '1'
    if let Some(version) = get_version().await {
        if version.starts_with('1') {
            return Err(format!(
                "1Password CLI version {version} is too old — version 2.0.0 or later required"
            ));
        }
    }

    if !is_authenticated().await {
        return Err("1Password session expired — run `op signin` and retry".to_string());
    }

    Ok(())
}

/// Returns `true` when the `op` stderr output indicates an authentication failure.
fn auth_error(stderr: &str) -> bool {
    stderr.contains("not currently signed in")
        || stderr.contains("session expired")
        || stderr.contains("sign in")
        || stderr.contains("unauthorized")
        || stderr.contains("Authentication required")
}
