use serde::Serialize;
use crate::keychain::{self, ServiceNowCredentials};
use crate::integrations::{bitwarden, one_password};

/// Fixed localhost port for the OAuth Authorization Code callback server.
/// Must match the redirect_uri registered in the ServiceNow OAuth Application Registry:
///   http://localhost:7823/oauth
const OAUTH_CALLBACK_PORT: u16 = 7823;

/// Response for credential existence check
#[derive(Debug, Serialize)]
pub struct CredentialExistsResponse {
    pub exists: bool,
}

/// Response for ServiceNow credentials retrieval
#[derive(Debug, Serialize)]
pub struct ServiceNowCredentialsResponse {
    pub username: String,
    pub password: String,
}

// ── Provider routing helpers ──────────────────────────────────────────────────

/// Resolve the effective credential backend from the `provider_id` parameter.
/// Empty string or `"keychain"` both map to the OS keychain (backward-compatible).
fn resolve_provider(provider_id: &str) -> &str {
    if provider_id.is_empty() {
        "keychain"
    } else {
        provider_id
    }
}

/// Build the PROVIDER_LOCKED error string for 1Password when the session has expired.
async fn check_op_available() -> Result<(), String> {
    if !one_password::is_installed().await {
        return Err("PROVIDER_LOCKED: 1Password CLI (op) not installed".to_string());
    }
    if !one_password::is_authenticated().await {
        return Err(
            "PROVIDER_LOCKED: 1Password session expired — re-authenticate and retry".to_string(),
        );
    }
    Ok(())
}

/// Build the PROVIDER_LOCKED error string for Bitwarden when the vault is locked.
async fn check_bw_available(bw_session: &str) -> Result<(), String> {
    if !bitwarden::is_installed().await {
        return Err("PROVIDER_LOCKED: Bitwarden CLI (bw) not installed".to_string());
    }
    if bw_session.is_empty()
        || bitwarden::get_session_status().await != bitwarden::BwStatus::Unlocked
    {
        return Err(
            "PROVIDER_LOCKED: Bitwarden vault is locked — run bw unlock and retry".to_string(),
        );
    }
    Ok(())
}

// ── ServiceNow credential commands ───────────────────────────────────────────

/// Store ServiceNow credentials via the selected provider backend.
///
/// # Tauri Command
/// Called from frontend: `invoke('store_servicenow_credentials', { profileId, username, password, providerId?, bwSession? })`
///
/// `provider_id`: `""` / `"keychain"` (default), `"1password"`, or `"bitwarden"`.
/// `bw_session`: Bitwarden session token — required when `provider_id` is `"bitwarden"`.
#[tauri::command]
pub async fn store_servicenow_credentials(
    profile_id: String,
    username: String,
    password: String,
    provider_id: Option<String>,
    bw_session: Option<String>,
) -> Result<(), String> {
    let provider = resolve_provider(provider_id.as_deref().unwrap_or(""));
    let key = format!("servicenow_{}", profile_id);
    let value = serde_json::json!({ "username": username, "password": password }).to_string();

    match provider {
        "1password" => {
            check_op_available().await?;
            one_password::write_secret(&key, &value).await
        }
        "bitwarden" => {
            let session = bw_session.as_deref().unwrap_or("");
            check_bw_available(session).await?;
            bitwarden::write_secret(&key, &value, session)
                .await
                .map(|_uuid| ())
        }
        _ => {
            let credentials = ServiceNowCredentials { username, password };
            keychain::store_servicenow_credentials(&profile_id, &credentials)
                .map_err(|e| e.to_string())
        }
    }
}

/// Retrieve ServiceNow credentials via the selected provider backend.
///
/// # Tauri Command
/// Called from frontend: `invoke('get_servicenow_credentials', { profileId, providerId?, bwSession? })`
#[tauri::command]
pub async fn get_servicenow_credentials(
    profile_id: String,
    provider_id: Option<String>,
    bw_session: Option<String>,
) -> Result<ServiceNowCredentialsResponse, String> {
    let provider = resolve_provider(provider_id.as_deref().unwrap_or(""));
    let key = format!("servicenow_{}", profile_id);

    match provider {
        "1password" => {
            check_op_available().await?;
            let json_str = one_password::read_secret(&key).await?;
            let v: serde_json::Value = serde_json::from_str(&json_str)
                .map_err(|e| format!("Failed to parse stored credentials: {e}"))?;
            Ok(ServiceNowCredentialsResponse {
                username: v["username"].as_str().unwrap_or("").to_string(),
                password: v["password"].as_str().unwrap_or("").to_string(),
            })
        }
        "bitwarden" => {
            let session = bw_session.as_deref().unwrap_or("");
            check_bw_available(session).await?;
            let json_str = bitwarden::read_secret(&key, session).await?;
            let v: serde_json::Value = serde_json::from_str(&json_str)
                .map_err(|e| format!("Failed to parse stored credentials: {e}"))?;
            Ok(ServiceNowCredentialsResponse {
                username: v["username"].as_str().unwrap_or("").to_string(),
                password: v["password"].as_str().unwrap_or("").to_string(),
            })
        }
        _ => keychain::get_servicenow_credentials(&profile_id)
            .map(|creds| ServiceNowCredentialsResponse {
                username: creds.username,
                password: creds.password,
            })
            .map_err(|e| e.to_string()),
    }
}

/// Delete ServiceNow credentials via the selected provider backend.
///
/// # Tauri Command
/// Called from frontend: `invoke('delete_servicenow_credentials', { profileId, providerId?, bwSession? })`
#[tauri::command]
pub async fn delete_servicenow_credentials(
    profile_id: String,
    provider_id: Option<String>,
    bw_session: Option<String>,
) -> Result<(), String> {
    let provider = resolve_provider(provider_id.as_deref().unwrap_or(""));
    let key = format!("servicenow_{}", profile_id);

    match provider {
        "1password" => {
            check_op_available().await?;
            one_password::delete_secret(&key).await
        }
        "bitwarden" => {
            let session = bw_session.as_deref().unwrap_or("");
            check_bw_available(session).await?;
            // Bitwarden delete needs the UUID; read first to get it, then delete by searching
            // For simplicity we attempt a search-and-delete via the list approach
            bitwarden::delete_secret(&key, session).await
        }
        _ => keychain::delete_servicenow_credentials(&profile_id).map_err(|e| e.to_string()),
    }
}

/// Check if ServiceNow credentials exist for a profile.
///
/// # Tauri Command
/// Called from frontend: `invoke('has_servicenow_credentials', { profileId, providerId?, bwSession? })`
#[tauri::command]
pub async fn has_servicenow_credentials(
    profile_id: String,
    provider_id: Option<String>,
    bw_session: Option<String>,
) -> Result<CredentialExistsResponse, String> {
    let provider = resolve_provider(provider_id.as_deref().unwrap_or(""));
    let key = format!("servicenow_{}", profile_id);

    match provider {
        "1password" => {
            if check_op_available().await.is_err() {
                return Ok(CredentialExistsResponse { exists: false });
            }
            Ok(CredentialExistsResponse {
                exists: one_password::read_secret(&key).await.is_ok(),
            })
        }
        "bitwarden" => {
            let session = bw_session.as_deref().unwrap_or("");
            if check_bw_available(session).await.is_err() {
                return Ok(CredentialExistsResponse { exists: false });
            }
            Ok(CredentialExistsResponse {
                exists: bitwarden::read_secret(&key, session).await.is_ok(),
            })
        }
        _ => Ok(CredentialExistsResponse {
            exists: keychain::has_servicenow_credentials(&profile_id),
        }),
    }
}

// ── API key commands ──────────────────────────────────────────────────────────

/// Store API key via the selected provider backend.
///
/// # Tauri Command
/// Called from frontend: `invoke('store_api_key', { provider, profileId, apiKey, providerId?, bwSession? })`
#[tauri::command]
pub async fn store_api_key(
    provider: String,
    profile_id: String,
    api_key: String,
    provider_id: Option<String>,
    bw_session: Option<String>,
) -> Result<(), String> {
    let backend = resolve_provider(provider_id.as_deref().unwrap_or(""));
    let key = format!("{}_{}", provider, profile_id);

    match backend {
        "1password" => {
            check_op_available().await?;
            one_password::write_secret(&key, &api_key).await
        }
        "bitwarden" => {
            let session = bw_session.as_deref().unwrap_or("");
            check_bw_available(session).await?;
            bitwarden::write_secret(&key, &api_key, session)
                .await
                .map(|_uuid| ())
        }
        _ => keychain::store_api_key(&provider, &profile_id, &api_key).map_err(|e| e.to_string()),
    }
}

/// Retrieve API key via the selected provider backend.
///
/// # Tauri Command
/// Called from frontend: `invoke('get_api_key', { provider, profileId, providerId?, bwSession? })`
#[tauri::command]
pub async fn get_api_key(
    provider: String,
    profile_id: String,
    provider_id: Option<String>,
    bw_session: Option<String>,
) -> Result<String, String> {
    let backend = resolve_provider(provider_id.as_deref().unwrap_or(""));
    let key = format!("{}_{}", provider, profile_id);

    match backend {
        "1password" => {
            check_op_available().await?;
            one_password::read_secret(&key).await
        }
        "bitwarden" => {
            let session = bw_session.as_deref().unwrap_or("");
            check_bw_available(session).await?;
            bitwarden::read_secret(&key, session).await
        }
        _ => keychain::get_api_key(&provider, &profile_id).map_err(|e| e.to_string()),
    }
}

/// Delete API key via the selected provider backend.
///
/// # Tauri Command
/// Called from frontend: `invoke('delete_api_key', { provider, profileId, providerId?, bwSession? })`
#[tauri::command]
pub async fn delete_api_key(
    provider: String,
    profile_id: String,
    provider_id: Option<String>,
    bw_session: Option<String>,
) -> Result<(), String> {
    let backend = resolve_provider(provider_id.as_deref().unwrap_or(""));
    let key = format!("{}_{}", provider, profile_id);

    match backend {
        "1password" => {
            check_op_available().await?;
            one_password::delete_secret(&key).await
        }
        "bitwarden" => {
            let session = bw_session.as_deref().unwrap_or("");
            check_bw_available(session).await?;
            bitwarden::delete_secret(&key, session).await
        }
        _ => keychain::delete_api_key(&provider, &profile_id).map_err(|e| e.to_string()),
    }
}

/// Check if API key exists for a provider via the selected backend.
///
/// # Tauri Command
/// Called from frontend: `invoke('has_api_key', { provider, profileId, providerId?, bwSession? })`
#[tauri::command]
pub async fn has_api_key(
    provider: String,
    profile_id: String,
    provider_id: Option<String>,
    bw_session: Option<String>,
) -> Result<CredentialExistsResponse, String> {
    let backend = resolve_provider(provider_id.as_deref().unwrap_or(""));
    let key = format!("{}_{}", provider, profile_id);

    match backend {
        "1password" => {
            if check_op_available().await.is_err() {
                return Ok(CredentialExistsResponse { exists: false });
            }
            Ok(CredentialExistsResponse {
                exists: one_password::read_secret(&key).await.is_ok(),
            })
        }
        "bitwarden" => {
            let session = bw_session.as_deref().unwrap_or("");
            if check_bw_available(session).await.is_err() {
                return Ok(CredentialExistsResponse { exists: false });
            }
            Ok(CredentialExistsResponse {
                exists: bitwarden::read_secret(&key, session).await.is_ok(),
            })
        }
        _ => Ok(CredentialExistsResponse {
            exists: keychain::has_api_key(&provider, &profile_id),
        }),
    }
}

/// Fetch a ServiceNow OAuth 2.0 Bearer token using the Resource Owner Password flow.
///
/// Calls `POST {instance_url}/oauth_token.do` via reqwest (no CORS restrictions).
///
/// # Tauri Command
/// Called from frontend: `invoke('get_now_assist_oauth_token', { instanceUrl, clientId, clientSecret, username, password })`
#[tauri::command]
pub async fn get_now_assist_oauth_token(
    instance_url: String,
    client_id: String,
    client_secret: String,
    username: String,
    password: String,
) -> Result<String, String> {
    let url = format!("{}/oauth_token.do", instance_url.trim_end_matches('/'));
    log::info!("Fetching Now Assist OAuth token from: {}", url);

    let params = [
        ("grant_type", "password"),
        ("client_id", &client_id),
        ("client_secret", &client_secret),
        ("username", &username),
        ("password", &password),
    ];

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = resp.status();
    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    if !status.is_success() {
        let error_code = body["error"].as_str().unwrap_or("unknown_error");
        let error_desc = body["error_description"].as_str().unwrap_or("");
        let detail = if error_desc.is_empty() {
            error_code.to_string()
        } else {
            format!("{}: {}", error_code, error_desc)
        };
        log::warn!("OAuth token request failed: HTTP {} — {}", status, detail);
        return Err(format!("HTTP {}: {}", status, detail));
    }

    body["access_token"]
        .as_str()
        .map(|t| t.to_string())
        .ok_or_else(|| "No access_token in response".to_string())
}

// ─── OAuth Authorization Code flow ───────────────────────────────────────────

/// URL-encode a string using percent-encoding (RFC 3986 unreserved chars only).
fn percent_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 3);
    for byte in s.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9'
            | b'-' | b'_' | b'.' | b'~' => out.push(byte as char),
            _ => out.push_str(&format!("%{:02X}", byte)),
        }
    }
    out
}

/// URL-decode a percent-encoded string.
fn percent_decode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut bytes = s.bytes();
    while let Some(b) = bytes.next() {
        if b == b'%' {
            let hi = bytes.next().unwrap_or(b'0') as char;
            let lo = bytes.next().unwrap_or(b'0') as char;
            if let Ok(byte) = u8::from_str_radix(&format!("{}{}", hi, lo), 16) {
                out.push(byte as char);
            } else {
                out.push('%');
                out.push(hi);
                out.push(lo);
            }
        } else if b == b'+' {
            out.push(' ');
        } else {
            out.push(b as char);
        }
    }
    out
}

/// Extract a query parameter value from an HTTP request line.
/// E.g. `GET /oauth?code=ABC&state=XYZ HTTP/1.1` → `extract_query_param(req, "code")` = `"ABC"`
fn extract_query_param(request: &str, param: &str) -> Option<String> {
    let path = request.lines().next()?.split_whitespace().nth(1)?;
    let query = path.split('?').nth(1)?;
    for pair in query.split('&') {
        let mut kv = pair.splitn(2, '=');
        if let (Some(key), Some(val)) = (kv.next(), kv.next()) {
            if key == param {
                return Some(percent_decode(val));
            }
        }
    }
    None
}

/// Initiate a ServiceNow OAuth 2.0 Authorization Code flow.
///
/// 1. Starts a local HTTP callback server on port 7823.
/// 2. Opens the ServiceNow OAuth authorization URL in the default browser.
/// 3. Waits (up to 5 min) for ServiceNow to redirect to `http://localhost:7823/oauth`.
/// 4. Exchanges the authorization code for an access token via `POST /oauth_token.do`.
/// 5. Returns the `access_token` string.
///
/// The redirect URI `http://localhost:7823/oauth` must be registered in the
/// ServiceNow OAuth Application Registry record (System OAuth → Application Registry).
///
/// # Tauri Command
/// `invoke('now_assist_oauth_login', { instanceUrl, clientId, clientSecret })`
#[tauri::command]
pub async fn now_assist_oauth_login(
    app: tauri::AppHandle,
    instance_url: String,
    client_id: String,
    client_secret: String,
) -> Result<String, String> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    let base = instance_url.trim_end_matches('/');
    let redirect_uri = format!("http://localhost:{}/oauth", OAUTH_CALLBACK_PORT);

    // ── 1. Bind callback server ───────────────────────────────────────────────
    let listener = TcpListener::bind(format!("127.0.0.1:{}", OAUTH_CALLBACK_PORT))
        .await
        .map_err(|e| {
            format!(
                "Port {} already in use — close any other app using it and retry. ({})",
                OAUTH_CALLBACK_PORT, e
            )
        })?;

    // ── 2. Generate PKCE code_verifier + code_challenge (S256) ───────────────
    // ServiceNow OAuth requires PKCE (RFC 7636) on the Authorization Code flow.
    use rand::RngCore;
    use rand::rngs::OsRng;
    use sha2::{Digest, Sha256};
    use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};

    let mut verifier_bytes = [0u8; 32];
    OsRng.fill_bytes(&mut verifier_bytes);
    let code_verifier = URL_SAFE_NO_PAD.encode(verifier_bytes);

    let challenge_hash = Sha256::digest(code_verifier.as_bytes());
    let code_challenge = URL_SAFE_NO_PAD.encode(challenge_hash);

    // ── 3. Build the authorization URL ────────────────────────────────────────
    let mut state_bytes = [0u8; 32];
    OsRng.fill_bytes(&mut state_bytes);
    let state = URL_SAFE_NO_PAD.encode(state_bytes);

    // Request `openid` scope so ServiceNow includes an `id_token` (JWT) in the
    // token exchange response.  The MCP endpoint requires a JWT Bearer token;
    // the default OAuth `access_token` is an opaque string and will be rejected
    // with "Invalid token: Not enough segments".
    let auth_url = format!(
        "{}/oauth_auth.do?response_type=code&client_id={}&redirect_uri={}&state={}&scope=openid&code_challenge={}&code_challenge_method=S256",
        base,
        percent_encode(&client_id),
        percent_encode(&redirect_uri),
        percent_encode(&state),
        percent_encode(&code_challenge),
    );

    log::info!("now_assist_oauth_login: opening browser → {}", base);

    // ── 3. Open the authorization URL in the system browser ───────────────────
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(&auth_url, None::<&str>)
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    // ── 4. Wait for the OAuth callback (5-minute timeout) ─────────────────────
    let (mut socket, _) = tokio::time::timeout(
        std::time::Duration::from_secs(300),
        listener.accept(),
    )
    .await
    .map_err(|_| "Browser login timed out after 5 minutes. Please try again.".to_string())?
    .map_err(|e| format!("Callback connection error: {}", e))?;

    // ── 5. Read the browser's HTTP request ────────────────────────────────────
    let mut buf = vec![0u8; 8192];
    let n = tokio::time::timeout(
        std::time::Duration::from_secs(15),
        socket.read(&mut buf),
    )
    .await
    .map_err(|_| "Timed out reading OAuth callback request.".to_string())?
    .map_err(|e| format!("Failed to read callback: {}", e))?;

    let request = String::from_utf8_lossy(&buf[..n]).to_string();

    // Guard against oversized or malformed request lines (no newline within first 2048 bytes).
    let first_line_end = request.find('\n').unwrap_or(request.len());
    if first_line_end > 2048 {
        return Err("OAuth callback request too large".to_string());
    }

    // ── 6. Respond to the browser with a success page ─────────────────────────
    let html = concat!(
        "HTTP/1.1 200 OK\r\n",
        "Content-Type: text/html; charset=utf-8\r\n",
        "Cache-Control: no-store\r\n\r\n",
        "<!DOCTYPE html><html><head><title>Authenticated</title>",
        "<style>body{font-family:sans-serif;display:flex;align-items:center;",
        "justify-content:center;height:100vh;margin:0;background:#f0fdf4}</style></head>",
        "<body><div style='text-align:center'>",
        "<h2 style='color:#16a34a'>&#10003; Authentication Successful</h2>",
        "<p>You can close this browser tab and return to the app.</p>",
        "</div></body></html>",
    );
    let _ = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        socket.write_all(html.as_bytes()),
    )
    .await;

    // ── 7. Parse code and state from the callback URL ─────────────────────────
    let code = extract_query_param(&request, "code").ok_or_else(|| {
        let error = extract_query_param(&request, "error")
            .unwrap_or_else(|| "unknown".to_string());
        format!("Authorization was denied or failed: {}", error)
    })?;

    let returned_state = extract_query_param(&request, "state").unwrap_or_default();
    if returned_state != state {
        return Err(
            "Security check failed: OAuth state mismatch. Please try again.".to_string()
        );
    }

    log::info!("now_assist_oauth_login: got code, exchanging for token");

    // ── 8. Exchange the code for an access token ──────────────────────────────
    let token_url = format!("{}/oauth_token.do", base);
    let params = [
        ("grant_type", "authorization_code"),
        ("client_id", client_id.as_str()),
        ("client_secret", client_secret.as_str()),
        ("redirect_uri", redirect_uri.as_str()),
        ("code", code.as_str()),
        ("code_verifier", code_verifier.as_str()),
    ];

    let http_client = reqwest::Client::new();
    let resp = http_client
        .post(&token_url)
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Token exchange request failed: {}", e))?;

    let status = resp.status();
    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse token response: {}", e))?;

    if !status.is_success() {
        let error_code = body["error"].as_str().unwrap_or("unknown_error");
        let error_desc = body["error_description"].as_str().unwrap_or("");
        let detail = if error_desc.is_empty() {
            error_code.to_string()
        } else {
            format!("{}: {}", error_code, error_desc)
        };
        log::warn!("now_assist_oauth_login: token exchange failed: HTTP {} — {}", status, detail);
        return Err(format!("Token exchange failed: HTTP {}: {}", status, detail));
    }

    // Log the fields present in the response to help diagnose token-format issues.
    let response_keys: Vec<&str> = body.as_object()
        .map(|m| m.keys().map(|k| k.as_str()).collect())
        .unwrap_or_default();
    log::info!("now_assist_oauth_login: token response fields: {:?}", response_keys);

    let access_token = body["access_token"]
        .as_str()
        .map(|t| t.trim().to_string())
        .ok_or_else(|| "No access_token in token exchange response".to_string())?;

    let access_token_dots = access_token.chars().filter(|&c| c == '.').count();
    log::info!(
        "now_assist_oauth_login: access_token length={} dots={} (JWT={})",
        access_token.len(),
        access_token_dots,
        access_token_dots == 2
    );

    // If the OAuth response includes an `id_token` (OIDC), prefer it — it is a
    // signed JWT and is what ServiceNow's MCP endpoint accepts as Bearer token.
    // The plain `access_token` is typically an opaque string on ServiceNow and
    // will be rejected by the MCP endpoint with "Invalid token: Not enough segments".
    if let Some(id_token) = body["id_token"].as_str().map(|t| t.trim().to_string()) {
        let id_token_dots = id_token.chars().filter(|&c| c == '.').count();
        log::info!(
            "now_assist_oauth_login: id_token found — length={} dots={} (JWT={})",
            id_token.len(),
            id_token_dots,
            id_token_dots == 2
        );
        if id_token_dots == 2 {
            log::info!("now_assist_oauth_login: using id_token (JWT) as Bearer credential");
            return Ok(id_token);
        }
    }

    if access_token_dots != 2 {
        log::warn!(
            "now_assist_oauth_login: access_token is NOT a JWT ({} dot(s)). \
             The MCP endpoint requires a JWT. \
             Configure the OAuth Application Registry record to use JWT token type, \
             or enable OpenID Connect (OIDC) scopes on the application.",
            access_token_dots
        );
    }

    log::info!("now_assist_oauth_login: access token obtained successfully via browser flow");
    Ok(access_token)
}

/// Test all credential commands (for development/debugging)
///
/// # Tauri Command
/// Called from frontend: `invoke('test_credentials')`
#[cfg(debug_assertions)]
#[tauri::command]
pub fn test_credentials() -> Result<String, String> {
    let test_profile = "test_profile_dev";
    let test_provider = "test_provider_dev";

    // Test ServiceNow credentials
    let sn_creds = ServiceNowCredentials {
        username: "test_user".to_string(),
        password: "test_pass".to_string(),
    };

    keychain::store_servicenow_credentials(test_profile, &sn_creds)
        .map_err(|e| format!("Store failed: {}", e))?;

    let retrieved = keychain::get_servicenow_credentials(test_profile)
        .map_err(|e| format!("Retrieve failed: {}", e))?;

    keychain::delete_servicenow_credentials(test_profile)
        .map_err(|e| format!("Delete failed: {}", e))?;

    // Test API key
    keychain::store_api_key(test_provider, test_profile, "test-key-123")
        .map_err(|e| format!("Store API key failed: {}", e))?;

    let api_key = keychain::get_api_key(test_provider, test_profile)
        .map_err(|e| format!("Get API key failed: {}", e))?;

    keychain::delete_api_key(test_provider, test_profile)
        .map_err(|e| format!("Delete API key failed: {}", e))?;

    Ok(format!(
        "✓ All credential tests passed\nServiceNow: {}\nAPI Key: {}",
        retrieved.username, api_key
    ))
}
