// SECURITY: credential values are never logged — only key names and operation results
use std::process::Stdio;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use tokio::time::{timeout, Duration};

/// Session status for the Bitwarden CLI.
#[derive(Debug, PartialEq)]
pub enum BwStatus {
    Unauthenticated,
    Locked,
    Unlocked,
}

/// Check whether the Bitwarden CLI (`bw`) is installed and on PATH.
pub async fn is_installed() -> bool {
    which::which("bw").is_ok()
}

/// Query the current vault session status.
///
/// Uses `bw status` and parses the JSON `.status` field.
/// **Does not** use `bw unlock --check` (known bug in some versions).
pub async fn get_session_status() -> BwStatus {
    if !is_installed().await {
        return BwStatus::Unauthenticated;
    }

    let output = match timeout(
        Duration::from_secs(10),
        Command::new("bw").arg("status").output(),
    )
    .await
    {
        Ok(Ok(out)) => out,
        _ => return BwStatus::Unauthenticated,
    };

    if !output.status.success() {
        return BwStatus::Unauthenticated;
    }

    let json: serde_json::Value =
        match serde_json::from_slice(&output.stdout) {
            Ok(v) => v,
            Err(_) => return BwStatus::Unauthenticated,
        };

    match json["status"].as_str() {
        Some("unlocked") => BwStatus::Unlocked,
        Some("locked") => BwStatus::Locked,
        _ => BwStatus::Unauthenticated,
    }
}

/// Read the notes field of the Bitwarden Secure Note named
/// `servicenow-mcp-bridge/{key}`.
pub async fn read_secret(key: &str, session_token: &str) -> Result<String, String> {
    ensure_unlocked(session_token).await?;

    let search_name = format!("servicenow-mcp-bridge/{key}");
    let result = timeout(
        Duration::from_secs(10),
        Command::new("bw")
            .args(["list", "items", "--search", &search_name])
            .env("BW_SESSION", session_token)
            .output(),
    )
    .await
    .map_err(|_| "Bitwarden CLI timed out".to_string())?
    .map_err(|e| format!("Failed to run bw: {e}"))?;

    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        return Err(format!("bw list items failed: {stderr}"));
    }

    let items: serde_json::Value = serde_json::from_slice(&result.stdout)
        .map_err(|e| format!("Failed to parse bw output: {e}"))?;

    let array = items
        .as_array()
        .ok_or_else(|| "bw list items did not return an array".to_string())?;

    // Find an exact name match
    for item in array {
        if item["name"].as_str() == Some(&search_name) {
            return item["notes"]
                .as_str()
                .map(|s| s.to_string())
                .ok_or_else(|| "Item has no notes field".to_string());
        }
    }

    Err("Credential not found".to_string())
}

/// Create a new Bitwarden Secure Note and return its UUID.
///
/// The item JSON is piped through `bw encode` then `bw create item` so the
/// secret value is never passed as a CLI argument.
pub async fn write_secret(
    key: &str,
    value: &str,
    session_token: &str,
) -> Result<String, String> {
    ensure_unlocked(session_token).await?;

    let item_json = serde_json::json!({
        "type": 2,
        "name": format!("servicenow-mcp-bridge/{key}"),
        "notes": value,
    })
    .to_string();

    // Step 1 — bw encode (stdin → base64 stdout)
    let encoded = run_bw_encode(&item_json, session_token).await?;

    // Step 2 — bw create item (encoded stdin → JSON stdout with new item)
    let create_output = timeout(
        Duration::from_secs(10),
        async {
            let mut child = Command::new("bw")
                .args(["create", "item"])
                .env("BW_SESSION", session_token)
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| format!("Failed to spawn bw: {e}"))?;

            if let Some(mut stdin) = child.stdin.take() {
                stdin
                    .write_all(encoded.as_bytes())
                    .await
                    .map_err(|e| format!("Failed to write to bw stdin: {e}"))?;
            }

            child.wait_with_output().await.map_err(|e| e.to_string())
        },
    )
    .await
    .map_err(|_| "Bitwarden CLI timed out".to_string())?;

    let output = create_output?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("bw create item failed: {stderr}"));
    }

    let item: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse bw create output: {e}"))?;

    item["id"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "bw create item did not return an id".to_string())
}

/// Update an existing Bitwarden item's notes field via its UUID.
pub async fn update_secret(
    uuid: &str,
    value: &str,
    session_token: &str,
) -> Result<(), String> {
    ensure_unlocked(session_token).await?;

    // Fetch the current item JSON
    let get_output = timeout(
        Duration::from_secs(10),
        Command::new("bw")
            .args(["get", "item", uuid])
            .env("BW_SESSION", session_token)
            .output(),
    )
    .await
    .map_err(|_| "Bitwarden CLI timed out".to_string())?
    .map_err(|e| format!("Failed to run bw get item: {e}"))?;

    if !get_output.status.success() {
        let stderr = String::from_utf8_lossy(&get_output.stderr);
        return Err(format!("bw get item failed: {stderr}"));
    }

    let mut item: serde_json::Value = serde_json::from_slice(&get_output.stdout)
        .map_err(|e| format!("Failed to parse bw get item output: {e}"))?;

    // Mutate the notes field
    if let Some(obj) = item.as_object_mut() {
        obj.insert("notes".to_string(), serde_json::Value::String(value.to_string()));
    }

    let updated_json = serde_json::to_string(&item)
        .map_err(|e| format!("Failed to serialize updated item: {e}"))?;

    // Encode and edit
    let encoded = run_bw_encode(&updated_json, session_token).await?;

    let edit_output = timeout(
        Duration::from_secs(10),
        async {
            let mut child = Command::new("bw")
                .args(["edit", "item", uuid])
                .env("BW_SESSION", session_token)
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| format!("Failed to spawn bw edit: {e}"))?;

            if let Some(mut stdin) = child.stdin.take() {
                stdin
                    .write_all(encoded.as_bytes())
                    .await
                    .map_err(|e| format!("Failed to write to bw stdin: {e}"))?;
            }

            child.wait_with_output().await.map_err(|e| e.to_string())
        },
    )
    .await
    .map_err(|_| "Bitwarden CLI timed out".to_string())?;

    let output = edit_output?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("bw edit item failed: {stderr}"))
    }
}

/// Permanently delete a Bitwarden item by key name.
///
/// Looks up the item UUID via `bw list items --search` first because
/// `bw delete item` requires a UUID, not an item name.
pub async fn delete_secret(key: &str, session_token: &str) -> Result<(), String> {
    ensure_unlocked(session_token).await?;

    let search_name = format!("servicenow-mcp-bridge/{key}");

    // Step 1 — find the item UUID by exact name match
    let list_result = timeout(
        Duration::from_secs(10),
        Command::new("bw")
            .args(["list", "items", "--search", &search_name])
            .env("BW_SESSION", session_token)
            .output(),
    )
    .await
    .map_err(|_| "Bitwarden CLI timed out".to_string())?
    .map_err(|e| format!("Failed to run bw list: {e}"))?;

    if !list_result.status.success() {
        let stderr = String::from_utf8_lossy(&list_result.stderr);
        return Err(format!("bw list items failed: {stderr}"));
    }

    let items: serde_json::Value = serde_json::from_slice(&list_result.stdout)
        .map_err(|e| format!("Failed to parse bw list output: {e}"))?;

    let uuid = items
        .as_array()
        .ok_or_else(|| "bw list items did not return an array".to_string())?
        .iter()
        .find(|item| item["name"].as_str() == Some(&search_name))
        .and_then(|item| item["id"].as_str().map(|s| s.to_string()))
        .ok_or_else(|| format!("Credential '{}' not found in Bitwarden", key))?;

    // Step 2 — delete by UUID (required by bw CLI)
    let result = timeout(
        Duration::from_secs(10),
        Command::new("bw")
            .args(["delete", "item", &uuid, "--permanent"])
            .env("BW_SESSION", session_token)
            .output(),
    )
    .await
    .map_err(|_| "Bitwarden CLI timed out".to_string())?
    .map_err(|e| format!("Failed to run bw delete: {e}"))?;

    if result.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&result.stderr);
        Err(format!("bw delete item failed: {stderr}"))
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/// Guard: return an error if the vault is not unlocked or the session token is absent.
async fn ensure_unlocked(session_token: &str) -> Result<(), String> {
    if session_token.is_empty() {
        return Err(
            "Bitwarden vault is locked — run `bw unlock` and retry".to_string(),
        );
    }
    if !is_installed().await {
        return Err("Bitwarden CLI not installed".to_string());
    }
    if get_session_status().await != BwStatus::Unlocked {
        return Err(
            "Bitwarden vault is locked — run `bw unlock` and retry".to_string(),
        );
    }
    Ok(())
}

/// Pipe `input` through `bw encode` and return the base64-encoded output.
async fn run_bw_encode(input: &str, session_token: &str) -> Result<String, String> {
    let output = timeout(
        Duration::from_secs(10),
        async {
            let mut child = Command::new("bw")
                .arg("encode")
                .env("BW_SESSION", session_token)
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| format!("Failed to spawn bw encode: {e}"))?;

            if let Some(mut stdin) = child.stdin.take() {
                stdin
                    .write_all(input.as_bytes())
                    .await
                    .map_err(|e| format!("Failed to write to bw encode stdin: {e}"))?;
            }

            child.wait_with_output().await.map_err(|e| e.to_string())
        },
    )
    .await
    .map_err(|_| "bw encode timed out".to_string())?;

    let out = output?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Err(format!("bw encode failed: {stderr}"));
    }

    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}
