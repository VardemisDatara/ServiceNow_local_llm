/// MCP Proxy commands — bypass WebView CORS restrictions
///
/// The MCP SDK (`@modelcontextprotocol/sdk`) runs in the Tauri renderer WebView
/// and makes `fetch()` calls that are blocked by CORS when the ServiceNow
/// endpoint does not return `Access-Control-Allow-Origin` for `localhost:5173`.
///
/// These commands replicate the MCP JSON-RPC-over-HTTP protocol (StreamableHTTP)
/// using `reqwest`, which runs in the Rust main process and is not subject to
/// browser CORS policies.
///
/// Protocol summary (per MCP spec 2024-11-05):
///   1. POST {endpoint}  → `initialize`          (gets Mcp-Session-Id header)
///   2. POST {endpoint}  → `notifications/initialized`  (fire-and-forget)
///   3. POST {endpoint}  → `tools/list` or `tools/call`
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Instant;

// ─── Public result types ───────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct McpToolInfo {
    pub name: String,
    pub description: String,
    pub input_schema: Value,
}

#[derive(Debug, Serialize)]
pub struct NowAssistConnectResult {
    pub tools: Vec<McpToolInfo>,
    pub tool_count: usize,
}

#[derive(Debug, Serialize)]
pub struct NowAssistCallToolResult {
    pub content: String,
    pub is_error: bool,
    pub latency_ms: u64,
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

/// Returns `(header_name, header_value)` for the chosen auth mode.
///
/// ServiceNow's MCP endpoint (`/sncapps/mcp-server/mcp/…`) requires
/// `Authorization: Bearer <token>` for both OAuth tokens and API keys.
/// The `x-sn-apikey` header is not accepted on this endpoint — the server
/// returns `{"error":"Authorization header not found"}` when it is used.
fn auth_header(token: &str, _auth_mode: &str) -> (&'static str, String) {
    // Both "bearer" and "apikey" modes use Authorization: Bearer on MCP endpoints.
    ("Authorization", format!("Bearer {}", token))
}

/// Send a JSON-RPC request and return `(response_json, Option<session_id>)`.
///
/// Handles both `application/json` and `text/event-stream` response bodies.
async fn mcp_request(
    client: &reqwest::Client,
    endpoint: &str,
    token: &str,
    auth_mode: &str,
    session_id: Option<&str>,
    body: Value,
) -> Result<(Value, Option<String>), String> {
    let (h_name, h_value) = auth_header(token, auth_mode);

    let mut builder = client
        .post(endpoint)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json, text/event-stream")
        .header(h_name, &h_value)
        .json(&body);

    if let Some(sid) = session_id {
        builder = builder.header("Mcp-Session-Id", sid);
    }

    let response = builder
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status();

    // Capture session ID header before consuming the response body
    let new_session_id = response
        .headers()
        .get("mcp-session-id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    let body_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    if !status.is_success() {
        return Err(format!(
            "HTTP {}: {}",
            status,
            body_text.chars().take(500).collect::<String>()
        ));
    }

    if content_type.contains("text/event-stream") {
        // StreamableHTTP may respond with an SSE stream for async results.
        // Extract the first `data:` line that contains a JSON-RPC response.
        for line in body_text.lines() {
            if let Some(data) = line.strip_prefix("data: ") {
                if data.trim() == "[DONE]" {
                    continue;
                }
                if let Ok(val) = serde_json::from_str::<Value>(data) {
                    if val.get("result").is_some() || val.get("error").is_some() {
                        return Ok((val, new_session_id));
                    }
                }
            }
        }
        return Err("No JSON-RPC response found in SSE stream".to_string());
    }

    // Plain JSON response
    if body_text.is_empty() {
        // 200/202 with empty body (e.g. notification ack) — return empty object
        return Ok((json!({}), new_session_id));
    }

    let val = serde_json::from_str::<Value>(&body_text).map_err(|e| {
        format!(
            "Failed to parse JSON: {} (body: {})",
            e,
            body_text.chars().take(200).collect::<String>()
        )
    })?;

    Ok((val, new_session_id))
}

/// Send a JSON-RPC notification (no ID, no response expected). Fire-and-forget.
async fn mcp_notify(
    client: &reqwest::Client,
    endpoint: &str,
    token: &str,
    auth_mode: &str,
    session_id: Option<&str>,
    method: &str,
) {
    let (h_name, h_value) = auth_header(token, auth_mode);
    let body = json!({ "jsonrpc": "2.0", "method": method });

    let mut builder = client
        .post(endpoint)
        .header("Content-Type", "application/json")
        .header(h_name, &h_value)
        .json(&body);

    if let Some(sid) = session_id {
        builder = builder.header("Mcp-Session-Id", sid);
    }

    // Intentionally ignoring result — notifications are one-way
    let _ = builder.send().await;
}

/// Perform the MCP handshake (`initialize` + `notifications/initialized`).
/// Returns the `Mcp-Session-Id` header value if the server provides one.
async fn mcp_initialize(
    client: &reqwest::Client,
    endpoint: &str,
    token: &str,
    auth_mode: &str,
) -> Result<Option<String>, String> {
    let init_body = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "servicenow-mcp-bridge",
                "version": "1.0.0"
            }
        }
    });

    let (resp, session_id) =
        mcp_request(client, endpoint, token, auth_mode, None, init_body).await?;

    if let Some(error) = resp.get("error") {
        return Err(format!("MCP initialize failed: {}", error));
    }

    // Send `notifications/initialized` — required by spec, no response expected
    mcp_notify(
        client,
        endpoint,
        token,
        auth_mode,
        session_id.as_deref(),
        "notifications/initialized",
    )
    .await;

    Ok(session_id)
}

/// Extract text content from an MCP tool result's `content` array.
fn extract_mcp_content(result: &Value) -> String {
    if let Some(arr) = result.get("content").and_then(|c| c.as_array()) {
        arr.iter()
            .map(|item| {
                item.get("text")
                    .and_then(|t| t.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| item.to_string())
            })
            .collect::<Vec<_>>()
            .join("\n")
    } else if result.is_string() {
        result.as_str().unwrap_or("").to_string()
    } else {
        result.to_string()
    }
}

// ─── Tauri Commands ───────────────────────────────────────────────────────────

/// Connect to a Now Assist MCP server and discover its tools.
///
/// Performs `initialize` → `notifications/initialized` → `tools/list`.
/// All HTTP requests go through `reqwest` in the main process, bypassing
/// the WebView CORS policy that blocks the MCP SDK's browser `fetch()`.
///
/// # Tauri Command
/// `invoke('now_assist_connect', { endpoint, token, authMode })`
#[tauri::command]
pub async fn now_assist_connect(
    endpoint: String,
    token: String,
    auth_mode: String,
) -> Result<NowAssistConnectResult, String> {
    let token_dots = token.chars().filter(|&c| c == '.').count();
    log::info!(
        "now_assist_connect: connecting to {} — token length={} dots={} (JWT={})",
        endpoint, token.len(), token_dots, token_dots == 2
    );

    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let session_id = mcp_initialize(&client, &endpoint, &token, &auth_mode).await?;

    let list_body = json!({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/list"
    });

    let (list_resp, _) = mcp_request(
        &client,
        &endpoint,
        &token,
        &auth_mode,
        session_id.as_deref(),
        list_body,
    )
    .await?;

    if let Some(error) = list_resp.get("error") {
        return Err(format!("MCP tools/list failed: {}", error));
    }

    let empty_vec = vec![];
    let tools_raw = list_resp
        .get("result")
        .and_then(|r| r.get("tools"))
        .and_then(|t| t.as_array())
        .unwrap_or(&empty_vec);

    let tools: Vec<McpToolInfo> = tools_raw
        .iter()
        .filter_map(|tool| {
            let name = tool.get("name")?.as_str()?.to_string();
            let description = tool
                .get("description")
                .and_then(|d| d.as_str())
                .unwrap_or("")
                .to_string();
            let input_schema = tool
                .get("inputSchema")
                .cloned()
                .unwrap_or(json!({"type": "object", "properties": {}}));
            Some(McpToolInfo {
                name,
                description,
                input_schema,
            })
        })
        .collect();

    let tool_count = tools.len();
    log::info!("now_assist_connect: discovered {} tools", tool_count);

    Ok(NowAssistConnectResult { tools, tool_count })
}

/// Call a Now Assist MCP tool by name with the given JSON arguments.
///
/// Each invocation performs a fresh `initialize` → `notifications/initialized`
/// → `tools/call` sequence. This is stateless by design — session persistence
/// is not required for individual tool calls and avoids stale-session issues
/// in the `sn_mcp_client_server_session_mapping` table.
///
/// # Tauri Command
/// `invoke('now_assist_call_tool', { endpoint, token, authMode, toolName, arguments })`
/// where `arguments` is a JSON-encoded string (e.g. `"{\"query\":\"hello\"}"`)
#[tauri::command]
pub async fn now_assist_call_tool(
    endpoint: String,
    token: String,
    auth_mode: String,
    tool_name: String,
    arguments: String,
) -> Result<NowAssistCallToolResult, String> {
    log::info!("now_assist_call_tool: invoking tool '{}'", tool_name);

    let start = Instant::now();

    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let args: Value = serde_json::from_str(&arguments).unwrap_or(json!({}));

    let session_id = mcp_initialize(&client, &endpoint, &token, &auth_mode).await?;

    let call_body = json!({
        "jsonrpc": "2.0",
        "id": 3,
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": args
        }
    });

    let (call_resp, _) = mcp_request(
        &client,
        &endpoint,
        &token,
        &auth_mode,
        session_id.as_deref(),
        call_body,
    )
    .await?;

    let latency_ms = start.elapsed().as_millis() as u64;

    // JSON-RPC application-level error (not an HTTP error)
    if let Some(error) = call_resp.get("error") {
        return Ok(NowAssistCallToolResult {
            content: format!("MCP error: {}", error),
            is_error: true,
            latency_ms,
        });
    }

    let result = call_resp
        .get("result")
        .cloned()
        .unwrap_or(json!(null));
    let is_error = result
        .get("isError")
        .and_then(|e| e.as_bool())
        .unwrap_or(false);
    let content = extract_mcp_content(&result);

    log::info!(
        "now_assist_call_tool: tool '{}' completed in {}ms (error={})",
        tool_name,
        latency_ms,
        is_error
    );

    Ok(NowAssistCallToolResult {
        content,
        is_error,
        latency_ms,
    })
}
