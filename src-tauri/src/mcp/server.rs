use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Instant;

static HTTP_CLIENT: std::sync::OnceLock<reqwest::Client> = std::sync::OnceLock::new();

fn get_http_client() -> &'static reqwest::Client {
    HTTP_CLIENT.get_or_init(reqwest::Client::new)
}

/// Returns true when the IP string belongs to a private / non-routable range:
/// RFC 1918 (10.x, 172.16–31.x, 192.168.x), loopback (127.x), link-local (169.254.x).
fn is_private_ip(ip: &str) -> bool {
    if ip.starts_with("10.") || ip.starts_with("192.168.") || ip.starts_with("127.") || ip.starts_with("169.254.") {
        return true;
    }
    // 172.16.0.0 – 172.31.255.255
    if let Some(rest) = ip.strip_prefix("172.") {
        let second_octet: u8 = rest
            .split('.')
            .next()
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);
        if (16..=31).contains(&second_octet) {
            return true;
        }
    }
    false
}

/// Sanitize a value before embedding it in a ServiceNow sysparm_query string.
/// Removes `^` (query logic operator), `&` (URL separator), and control chars
/// that could inject additional query conditions.
fn sanitize_sn_param(value: &str) -> String {
    value
        .chars()
        .filter(|&c| c != '^' && c != '&' && c != '\n' && c != '\r')
        .take(200)
        .collect()
}

/// Validate a ServiceNow record number (e.g. INC0001234, SIR0012345, CHG0000001).
/// Accepts: 2-8 uppercase ASCII letters followed by 4-10 ASCII digits.
fn validate_record_number(number: &str) -> Result<String, String> {
    let upper = number.trim().to_uppercase();
    let prefix_len = upper.chars().take_while(|c| c.is_ascii_uppercase()).count();
    let suffix_len = upper.chars().skip_while(|c| c.is_ascii_uppercase()).count();
    let is_all_digits = upper.chars().skip(prefix_len).all(|c| c.is_ascii_digit());
    if prefix_len >= 2
        && prefix_len <= 8
        && suffix_len >= 4
        && suffix_len <= 10
        && is_all_digits
        && upper.len() == prefix_len + suffix_len
    {
        Ok(upper)
    } else {
        Err(format!("Invalid record number format: '{number}'"))
    }
}

/// Validate a CVE identifier (CVE-YYYY-NNNNN format).
fn validate_cve_id(cve: &str) -> Result<String, String> {
    let upper = cve.trim().to_uppercase();
    let parts: Vec<&str> = upper.splitn(3, '-').collect();
    if parts.len() == 3
        && parts[0] == "CVE"
        && parts[1].len() == 4
        && parts[1].chars().all(|c| c.is_ascii_digit())
        && !parts[2].is_empty()
        && parts[2].chars().all(|c| c.is_ascii_digit())
    {
        Ok(upper)
    } else {
        Err(format!("Invalid CVE ID format: '{cve}' (expected CVE-YYYY-NNNNN)"))
    }
}

/// A function definition passed to Ollama for tool calling
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct OllamaFunction {
    pub name: String,
    pub description: String,
    pub parameters: Value,
}

/// An Ollama tool definition (wraps a function)
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct OllamaToolDefinition {
    #[serde(rename = "type")]
    pub tool_type: String, // always "function"
    pub function: OllamaFunction,
}

/// The function part of a tool call returned by Ollama
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct OllamaToolCallFunction {
    pub name: String,
    pub arguments: Value,
}

/// A tool call returned by Ollama in its response message
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct OllamaToolCall {
    pub function: OllamaToolCallFunction,
}

/// Result from the check_ollama_tool_calls command
#[derive(Serialize, Debug)]
pub struct OllamaToolCheckResult {
    pub tool_calls: Option<Vec<OllamaToolCall>>,
    pub content: Option<String>,
}

/// Chat message input for MCP tool check
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct McpMessageInput {
    pub role: String,
    pub content: String,
}

/// Result from the execute_mcp_tool command
#[derive(Serialize, Debug)]
pub struct MCPToolResult {
    pub tool_name: String,
    pub success: bool,
    pub result: Option<Value>,
    pub error: Option<String>,
    pub latency_ms: u64,
}

// Internal response structures for Ollama non-streaming API

#[derive(Deserialize, Debug)]
struct OllamaToolCheckResponse {
    message: OllamaResponseMessage,
}

#[derive(Deserialize, Debug)]
struct OllamaResponseMessage {
    content: Option<String>,
    tool_calls: Option<Vec<OllamaToolCall>>,
}

/// T062/T069: Check if Ollama wants to call any tools for the given messages.
///
/// Makes a non-streaming request to Ollama's /api/chat with a tools list.
/// Returns any tool_calls Ollama requests, or null if none were requested.
#[tauri::command]
pub async fn check_ollama_tool_calls(
    endpoint: String,
    model: String,
    messages: Vec<McpMessageInput>,
    tools: Vec<OllamaToolDefinition>,
) -> Result<OllamaToolCheckResult, String> {
    let client = get_http_client();

    let request_body = serde_json::json!({
        "model": model,
        "messages": messages,
        "tools": tools,
        "stream": false,
    });

    let url = format!("{}/api/chat", endpoint.trim_end_matches('/'));
    log::info!(
        "Checking Ollama tool calls: {} model={} tools={}",
        url,
        model,
        tools.len()
    );

    let response = client
        .post(&url)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("Ollama returned HTTP {}", response.status()));
    }

    let resp: OllamaToolCheckResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama tool response: {e}"))?;

    let tool_calls = resp.message.tool_calls;
    let content = resp.message.content.filter(|s| !s.is_empty());

    if let Some(ref calls) = tool_calls {
        log::info!("Ollama requested {} tool call(s)", calls.len());
    } else {
        log::debug!("Ollama did not request any tool calls");
    }

    Ok(OllamaToolCheckResult { tool_calls, content })
}

/// T062/T070: Execute an MCP tool against ServiceNow and return the result.
///
/// Loads ServiceNow credentials from the OS keychain using profile_id,
/// then dispatches to the appropriate ServiceNow REST API handler.
#[tauri::command]
pub async fn execute_mcp_tool(
    tool_name: String,
    arguments: Value,
    servicenow_url: String,
    profile_id: String,
) -> Result<MCPToolResult, String> {
    if tool_name.len() > 64 || !tool_name.chars().all(|c| c.is_alphanumeric() || c == '_') {
        return Err(format!("Invalid tool name: {}", tool_name));
    }

    let start = Instant::now();

    // Load credentials from keychain — no IPC round-trip needed
    let credentials = crate::keychain::get_servicenow_credentials(&profile_id)
        .map_err(|e| format!("Failed to get credentials: {e}"))?;

    log::info!(
        "Executing MCP tool: {} against {}",
        tool_name,
        servicenow_url
    );

    let result = dispatch_tool(
        &tool_name,
        &arguments,
        &servicenow_url,
        &credentials.username,
        &credentials.password,
    )
    .await;

    let latency_ms = start.elapsed().as_millis() as u64;

    match result {
        Ok(data) => {
            log::info!("MCP tool {} succeeded in {}ms", tool_name, latency_ms);
            Ok(MCPToolResult {
                tool_name,
                success: true,
                result: Some(data),
                error: None,
                latency_ms,
            })
        }
        Err(e) => {
            log::error!("MCP tool {} failed in {}ms: {}", tool_name, latency_ms, e);
            Ok(MCPToolResult {
                tool_name,
                success: false,
                result: None,
                error: Some(e),
                latency_ms,
            })
        }
    }
}

/// Dispatches a tool call to the appropriate ServiceNow handler
async fn dispatch_tool(
    tool_name: &str,
    arguments: &Value,
    servicenow_url: &str,
    username: &str,
    password: &str,
) -> Result<Value, String> {
    match tool_name {
        "analyze_threat_indicator" => {
            analyze_threat_indicator(arguments, servicenow_url, username, password).await
        }
        "assess_vulnerability" => {
            assess_vulnerability(arguments, servicenow_url, username, password).await
        }
        "query_incidents" => {
            query_incidents(arguments, servicenow_url, username, password).await
        }
        "correlate_security_incidents" => {
            correlate_security_incidents(arguments, servicenow_url, username, password).await
        }
        "get_incident_details" => {
            get_incident_details(arguments, servicenow_url, username, password).await
        }
        "generate_remediation_plan" => {
            generate_remediation_plan(arguments, servicenow_url, username, password).await
        }
        "analyze_attack_surface" => {
            analyze_attack_surface(arguments, servicenow_url, username, password).await
        }
        "audit_security_compliance" => {
            audit_security_compliance(arguments, servicenow_url, username, password).await
        }
        _ => Err(format!("Unknown tool: {tool_name}")),
    }
}

/// T067: Analyze a threat indicator (IP, hash, domain, URL) via ServiceNow Threat Intelligence
async fn analyze_threat_indicator(
    args: &Value,
    servicenow_url: &str,
    username: &str,
    password: &str,
) -> Result<Value, String> {
    let indicator_raw = args["indicator"]
        .as_str()
        .ok_or("Missing 'indicator' argument")?;
    let indicator_type_raw = args["indicator_type"]
        .as_str()
        .ok_or("Missing 'indicator_type' argument")?;
    let indicator = sanitize_sn_param(indicator_raw);
    let indicator_type = match indicator_type_raw {
        "ip" | "domain" | "hash" | "url" | "email" => indicator_type_raw.to_string(),
        other => return Err(format!("Invalid indicator_type: '{other}'")),
    };

    let client = get_http_client();

    let base_url = servicenow_url.trim_end_matches('/');
    let url = format!("{base_url}/api/now/table/sn_ti_observable");
    let query = format!("value={indicator}^type={indicator_type}");

    let response = client
        .get(&url)
        .basic_auth(username, Some(password))
        .query(&[
            ("sysparm_query", query.as_str()),
            ("sysparm_limit", "5"),
            (
                "sysparm_fields",
                "value,type,risk_score,threat_type,first_seen,last_seen",
            ),
        ])
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("ServiceNow request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        if status.as_u16() == 404 {
            return Ok(serde_json::json!({
                "indicator": indicator,
                "indicator_type": indicator_type,
                "found": false,
                "message": "No threat intelligence records found for this indicator"
            }));
        }
        return Err(format!("ServiceNow returned HTTP {status}"));
    }

    let body: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {e}"))?;

    let records = body["result"].as_array().cloned().unwrap_or_default();

    if records.is_empty() {
        return Ok(serde_json::json!({
            "indicator": indicator,
            "indicator_type": indicator_type,
            "found": false,
            "message": "No threat intelligence records found for this indicator"
        }));
    }

    let record = &records[0];
    Ok(serde_json::json!({
        "indicator": indicator,
        "indicator_type": indicator_type,
        "found": true,
        "risk_score": record["risk_score"],
        "threat_type": record["threat_type"],
        "first_seen": record["first_seen"],
        "last_seen": record["last_seen"],
        "total_records": records.len()
    }))
}

/// T068: Assess a vulnerability (CVE) via ServiceNow Vulnerability Management
async fn assess_vulnerability(
    args: &Value,
    servicenow_url: &str,
    username: &str,
    password: &str,
) -> Result<Value, String> {
    let cve_id_raw = args["cve_id"].as_str().ok_or("Missing 'cve_id' argument")?;
    let cve_id = validate_cve_id(cve_id_raw)?;

    let client = get_http_client();

    let base_url = servicenow_url.trim_end_matches('/');
    let url = format!("{base_url}/api/now/table/sn_vul_entry");
    let query = format!("source_id={cve_id}");

    let response = client
        .get(&url)
        .basic_auth(username, Some(password))
        .query(&[
            ("sysparm_query", query.as_str()),
            ("sysparm_limit", "5"),
            (
                "sysparm_fields",
                "source_id,cvss_score,severity,state,category,first_found,last_found,affected_items",
            ),
        ])
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("ServiceNow request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        if status.as_u16() == 404 {
            return Ok(serde_json::json!({
                "cve_id": cve_id,
                "found": false,
                "message": "Vulnerability not found in ServiceNow"
            }));
        }
        return Err(format!("ServiceNow returned HTTP {status}"));
    }

    let body: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {e}"))?;

    let records = body["result"].as_array().cloned().unwrap_or_default();

    if records.is_empty() {
        return Ok(serde_json::json!({
            "cve_id": cve_id,
            "found": false,
            "message": "Vulnerability not found in ServiceNow"
        }));
    }

    let record = &records[0];
    Ok(serde_json::json!({
        "cve_id": cve_id,
        "found": true,
        "cvss_score": record["cvss_score"],
        "severity": record["severity"],
        "state": record["state"],
        "category": record["category"],
        "first_found": record["first_found"],
        "last_found": record["last_found"],
        "affected_items": record["affected_items"],
        "total_entries": records.len()
    }))
}

/// Extract the human-readable display label from a ServiceNow field value.
///
/// ServiceNow REST API can return choice/reference fields in two forms depending on
/// the instance version and configuration:
///   - Plain string:  `"state": "Closed"`
///   - Object form:   `"state": {"value": "7", "display_value": "Closed"}`
///
/// This function normalises both into a plain String so callers don't need to care.
fn sn_display_label(val: &Value) -> String {
    if let Some(s) = val.as_str() {
        return s.to_string();
    }
    // Object form — prefer display_value, fall back to raw value
    if let Some(dv) = val.get("display_value").and_then(|v| v.as_str()) {
        return dv.to_string();
    }
    if let Some(v) = val.get("value").and_then(|v| v.as_str()) {
        return v.to_string();
    }
    String::new()
}

/// Query incidents from ServiceNow (security incidents first, falls back to regular incidents).
///
/// For sn_si_incident we cannot reliably predict the instance's numeric state values, so we
/// fetch a larger batch with no server-side state filter and filter client-side using the
/// display-value label of the state field (e.g. "Closed", "Analysis", "Contain", …).
async fn query_incidents(
    args: &Value,
    servicenow_url: &str,
    username: &str,
    password: &str,
) -> Result<Value, String> {
    let state = args["state"].as_str().unwrap_or("open");
    let limit = args["limit"].as_u64().unwrap_or(50).min(100) as usize;
    // Optional free-form filter appended to the sysparm_query (e.g. "number=SIR0015003")
    let extra_filter_raw = args["query"].as_str().unwrap_or("");
    let extra_filter = sanitize_sn_param(extra_filter_raw.trim());

    let client = get_http_client();

    let base_url = servicenow_url.trim_end_matches('/');

    // Fetch 6× the requested limit — the table may have many closed records mixed in,
    // and we filter client-side, so we need a generous buffer.
    let fetch_limit = ((limit * 6) as u64).min(500);

    // Build the sysparm_query: prepend extra_filter when provided so that callers can
    // narrow by number, assigned_to, etc.  e.g. "number=SIR0015003^ORDERBYDESCopened_at"
    let si_query = if extra_filter.is_empty() {
        "ORDERBYDESCopened_at".to_string()
    } else {
        format!("{extra_filter}^ORDERBYDESCopened_at")
    };

    // Try security incidents first — no server-side state filter; we filter below.
    let si_raw = fetch_raw_records(
        &client,
        base_url,
        "sn_si_incident",
        &si_query,
        fetch_limit,
        username,
        password,
    )
    .await;

    let (raw_records, table_used) = match si_raw {
        Ok(recs) => (recs, "sn_si_incident"),
        Err(_) => {
            log::info!("sn_si_incident not available, falling back to incident table");
            // Regular incident table has a reliable active field
            let incident_query = match state {
                "open" => "active=true^ORDERBYDESCopened_at",
                "closed" => "active=false^ORDERBYDESCopened_at",
                _ => "ORDERBYDESCopened_at",
            };
            let recs = fetch_raw_records(
                &client,
                base_url,
                "incident",
                incident_query,
                fetch_limit,
                username,
                password,
            )
            .await?;
            (recs, "incident")
        }
    };

    // For sn_si_incident, state numbering varies by instance — filter on the display label.
    // sn_display_label() handles both plain-string and object-form field values.
    let filtered: Vec<&Value> = if table_used == "sn_si_incident" {
        raw_records
            .iter()
            .filter(|r| {
                let label = sn_display_label(&r["state"]).to_lowercase();
                log::debug!("sn_si_incident record state raw={:?} label={:?}", &r["state"], label);
                match state {
                    "open" => !label.contains("closed"),
                    "closed" => label.contains("closed"),
                    _ => true,
                }
            })
            .take(limit)
            .collect()
    } else {
        raw_records.iter().take(limit).collect()
    };

    log::info!(
        "query_incidents: state={} table={} fetched={} returned={}",
        state,
        table_used,
        raw_records.len(),
        filtered.len()
    );

    let incidents: Vec<Value> = filtered
        .iter()
        .map(|r| {
            serde_json::json!({
                "number":            sn_display_label(&r["number"]),
                "short_description": sn_display_label(&r["short_description"]),
                "state":             sn_display_label(&r["state"]),
                "priority":          sn_display_label(&r["priority"]),
                "category":          sn_display_label(&r["category"]),
                "assigned_to":       sn_display_label(&r["assigned_to"]),
                "opened_at":         sn_display_label(&r["opened_at"]),
            })
        })
        .collect();

    Ok(serde_json::json!({
        "incidents": incidents,
        "total": incidents.len(),
        "table": table_used,
    }))
}

/// Fetch full details for a specific security incident (SIR) or regular incident (INC)
/// by record number. Used when Now Assist's `incident_summarization` tool cannot access
/// the sn_si_incident table.
async fn get_incident_details(
    args: &Value,
    servicenow_url: &str,
    username: &str,
    password: &str,
) -> Result<Value, String> {
    let number_raw = args["number"]
        .as_str()
        .ok_or("Missing 'number' argument")?;
    let number = validate_record_number(number_raw)?;

    let client = get_http_client();

    let base_url = servicenow_url.trim_end_matches('/');

    // Determine which table to query based on record prefix
    let table = if number.starts_with("SIR") {
        "sn_si_incident"
    } else {
        "incident"
    };

    let url = format!("{base_url}/api/now/table/{table}");
    let query = format!("number={number}");
    let fields = "number,short_description,description,state,priority,category,\
                  assigned_to,opened_at,close_notes,work_notes,comments,\
                  resolution_code,close_code,resolved_at,severity,impact,urgency,\
                  cmdb_ci,caller_id,location,company";

    let response = client
        .get(&url)
        .basic_auth(username, Some(password))
        .query(&[
            ("sysparm_query", query.as_str()),
            ("sysparm_limit", "1"),
            ("sysparm_fields", fields),
            ("sysparm_display_value", "true"),
        ])
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("ServiceNow request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        return Err(format!("ServiceNow table {table} returned HTTP {status}"));
    }

    let body: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {e}"))?;

    let records = body["result"].as_array().cloned().unwrap_or_default();
    if records.is_empty() {
        return Err(format!("No record found with number '{number}' in table '{table}'"));
    }

    let r = &records[0];
    log::info!("get_incident_details: found {} in {}", number, table);

    Ok(serde_json::json!({
        "number":              sn_display_label(&r["number"]),
        "table":               table,
        "short_description":   sn_display_label(&r["short_description"]),
        "description":         sn_display_label(&r["description"]),
        "state":               sn_display_label(&r["state"]),
        "priority":            sn_display_label(&r["priority"]),
        "severity":            sn_display_label(&r["severity"]),
        "impact":              sn_display_label(&r["impact"]),
        "urgency":             sn_display_label(&r["urgency"]),
        "category":            sn_display_label(&r["category"]),
        "assigned_to":         sn_display_label(&r["assigned_to"]),
        "caller_id":           sn_display_label(&r["caller_id"]),
        "cmdb_ci":             sn_display_label(&r["cmdb_ci"]),
        "opened_at":           sn_display_label(&r["opened_at"]),
        "resolved_at":         sn_display_label(&r["resolved_at"]),
        "resolution_code":     sn_display_label(&r["resolution_code"]),
        "close_notes":         sn_display_label(&r["close_notes"]),
        "work_notes":          sn_display_label(&r["work_notes"]),
        "comments":            sn_display_label(&r["comments"]),
    }))
}

/// Fetch raw JSON records from a ServiceNow table without any post-processing.
async fn fetch_raw_records(
    client: &Client,
    base_url: &str,
    table: &str,
    query: &str,
    limit: u64,
    username: &str,
    password: &str,
) -> Result<Vec<Value>, String> {
    let url = format!("{base_url}/api/now/table/{table}");

    let response = client
        .get(&url)
        .basic_auth(username, Some(password))
        .query(&[
            ("sysparm_query", query),
            ("sysparm_limit", &limit.to_string()),
            (
                "sysparm_fields",
                "number,short_description,state,priority,category,assigned_to,opened_at",
            ),
            ("sysparm_display_value", "true"),
        ])
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("ServiceNow request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        return Err(format!("ServiceNow table {table} returned HTTP {status}"));
    }

    let body: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {e}"))?;

    Ok(body["result"].as_array().cloned().unwrap_or_default())
}

/// Helper: query a ServiceNow table and return normalised incident records
#[allow(dead_code)]
async fn try_query_table(
    client: &Client,
    base_url: &str,
    table: &str,
    state_query: &str,
    limit: u64,
    username: &str,
    password: &str,
) -> Result<Value, String> {
    let url = format!("{base_url}/api/now/table/{table}");

    let response = client
        .get(&url)
        .basic_auth(username, Some(password))
        .query(&[
            ("sysparm_query", state_query),
            ("sysparm_limit", &limit.to_string()),
            (
                "sysparm_fields",
                "number,short_description,state,priority,category,assigned_to,opened_at",
            ),
            ("sysparm_display_value", "true"),
        ])
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("ServiceNow request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        return Err(format!("ServiceNow table {table} returned HTTP {status}"));
    }

    let body: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {e}"))?;

    let records = body["result"].as_array().cloned().unwrap_or_default();

    let incidents: Vec<Value> = records
        .iter()
        .map(|r| {
            serde_json::json!({
                "number": r["number"],
                "short_description": r["short_description"],
                "state": r["state"],
                "priority": r["priority"],
                "category": r["category"],
                "assigned_to": r["assigned_to"],
                "opened_at": r["opened_at"],
            })
        })
        .collect();

    log::info!(
        "Queried {} records from ServiceNow table {}",
        incidents.len(),
        table
    );

    Ok(serde_json::json!({
        "incidents": incidents,
        "total": incidents.len(),
        "table": table,
    }))
}

/// T083: Correlate multiple security incidents by fetching them from ServiceNow
/// and analyzing shared fields (category, assigned_to, priority).
async fn correlate_security_incidents(
    args: &Value,
    servicenow_url: &str,
    username: &str,
    password: &str,
) -> Result<Value, String> {
    let incident_ids = args["incident_ids"]
        .as_array()
        .ok_or("Missing 'incident_ids' argument")?;

    if incident_ids.len() < 2 {
        return Err("At least 2 incident IDs are required for correlation".to_string());
    }

    let client = get_http_client();

    let base_url = servicenow_url.trim_end_matches('/');
    let mut fetched: Vec<Value> = Vec::new();

    for id_val in incident_ids.iter().take(10) {
        let id_raw = id_val.as_str().unwrap_or("");
        if id_raw.is_empty() {
            continue;
        }
        let id = match validate_record_number(id_raw) {
            Ok(n) => n,
            Err(e) => {
                log::warn!("correlate_security_incidents: skipping invalid id '{}': {}", id_raw, e);
                continue;
            }
        };

        // Try sn_si_incident first, then fall back to incident
        for table in &["sn_si_incident", "incident"] {
            let url = format!("{base_url}/api/now/table/{table}");
            let query = format!("number={id}");

            let resp = client
                .get(&url)
                .basic_auth(username, Some(password))
                .query(&[
                    ("sysparm_query", query.as_str()),
                    ("sysparm_limit", "1"),
                    (
                        "sysparm_fields",
                        "number,short_description,state,priority,category,assigned_to,opened_at",
                    ),
                    ("sysparm_display_value", "true"),
                ])
                .header("Accept", "application/json")
                .send()
                .await;

            if let Ok(response) = resp {
                if response.status().is_success() {
                    if let Ok(body) = response.json::<Value>().await {
                        let records = body["result"].as_array().cloned().unwrap_or_default();
                        if !records.is_empty() {
                            fetched.push(records[0].clone());
                            break;
                        }
                    }
                }
            }
        }
    }

    let incidents_analyzed = fetched.len();

    // Compute correlation based on shared fields
    let categories: Vec<String> = fetched
        .iter()
        .map(|r| sn_display_label(&r["category"]))
        .filter(|s| !s.is_empty())
        .collect();

    let priorities: Vec<String> = fetched
        .iter()
        .map(|r| sn_display_label(&r["priority"]))
        .filter(|s| !s.is_empty())
        .collect();

    // Count how many share the same category or priority
    let shared_categories = if !categories.is_empty() {
        let first = &categories[0];
        categories.iter().filter(|c| c == &first).count()
    } else {
        0
    };

    let correlation_score = if incidents_analyzed < 2 {
        0.0_f64
    } else {
        let shared_ratio = shared_categories as f64 / incidents_analyzed as f64;
        (shared_ratio * 0.7 + 0.3).min(1.0)
    };

    let correlation_type = if correlation_score >= 0.7 {
        "direct"
    } else if correlation_score >= 0.4 {
        "indirect"
    } else {
        "none"
    };

    let dominant_category = categories.first().cloned().unwrap_or_default();
    let dominant_priority = priorities.first().cloned().unwrap_or_default();

    log::info!(
        "correlate_security_incidents: analyzed={} score={:.2} type={}",
        incidents_analyzed,
        correlation_score,
        correlation_type
    );

    Ok(serde_json::json!({
        "correlation_score": correlation_score,
        "correlation_type": correlation_type,
        "common_indicators": {
            "ip_addresses": [],
            "domains": [],
            "user_accounts": [],
            "affected_systems": [],
            "attack_vectors": if !dominant_category.is_empty() { vec![dominant_category] } else { vec![] }
        },
        "attack_pattern": {
            "name": format!("Multi-incident pattern (priority: {})", dominant_priority),
            "mitre_attack_ids": [],
            "confidence": correlation_score
        },
        "incidents_analyzed": incidents_analyzed,
        "message": format!("Analyzed {} incident(s) from ServiceNow", incidents_analyzed)
    }))
}

/// T084: Generate a remediation plan by querying ServiceNow Vulnerability Management
/// for CVE context, then constructing prioritized remediation steps.
async fn generate_remediation_plan(
    args: &Value,
    servicenow_url: &str,
    username: &str,
    password: &str,
) -> Result<Value, String> {
    let vuln_data = &args["vulnerability_data"];
    let business_ctx = &args["business_context"];

    let environment = business_ctx["environment"].as_str().unwrap_or("production");
    let criticality = business_ctx["business_criticality"].as_str().unwrap_or("high");
    let maintenance_window = business_ctx["maintenance_window_available"]
        .as_bool()
        .unwrap_or(false);

    // Fetch CVE context from ServiceNow if CVE IDs provided
    let mut cve_entries: Vec<Value> = Vec::new();
    if let Some(cve_ids) = vuln_data["cve_ids"].as_array() {
        let client = get_http_client();

        let base_url = servicenow_url.trim_end_matches('/');

        for cve_val in cve_ids.iter().take(5) {
            let cve_raw = cve_val.as_str().unwrap_or("");
            if cve_raw.is_empty() {
                continue;
            }
            let cve = match validate_cve_id(cve_raw) {
                Ok(c) => c,
                Err(e) => {
                    log::warn!("generate_remediation_plan: skipping invalid CVE '{}': {}", cve_raw, e);
                    continue;
                }
            };

            let url = format!("{base_url}/api/now/table/sn_vul_entry");
            let query = format!("source_id={cve}");

            if let Ok(response) = client
                .get(&url)
                .basic_auth(username, Some(password))
                .query(&[
                    ("sysparm_query", query.as_str()),
                    ("sysparm_limit", "1"),
                    ("sysparm_fields", "source_id,cvss_score,severity,state,affected_items"),
                ])
                .header("Accept", "application/json")
                .send()
                .await
            {
                if response.status().is_success() {
                    if let Ok(body) = response.json::<Value>().await {
                        let records = body["result"].as_array().cloned().unwrap_or_default();
                        if !records.is_empty() {
                            cve_entries.push(records[0].clone());
                        }
                    }
                }
            }
        }
    }

    let total_steps = cve_entries.len().max(1) + 2; // patch steps + validate + monitor
    let estimated_hours = total_steps as f64 * (if criticality == "critical" { 4.0 } else { 2.0 });
    let timeline = if maintenance_window {
        "Schedule during next maintenance window"
    } else {
        "Apply emergency patch process"
    };

    let mut steps: Vec<Value> = Vec::new();

    // Step 1: Assessment
    steps.push(serde_json::json!({
        "step_number": 1,
        "title": "Vulnerability Assessment & Prioritization",
        "description": format!("Assess all identified vulnerabilities in {} environment and prioritize by CVSS score and business impact", environment),
        "priority": criticality,
        "estimated_effort_hours": 2,
        "requires_downtime": false,
        "success_criteria": ["All CVEs documented", "Risk scores assigned", "Affected systems inventoried"],
        "rollback_plan": "No changes made in this step"
    }));

    // Dynamic steps per CVE
    for (i, entry) in cve_entries.iter().enumerate() {
        let cve_id = entry["source_id"].as_str().unwrap_or("CVE-UNKNOWN");
        let severity = sn_display_label(&entry["severity"]);
        let step_priority = if severity.to_lowercase().contains("critical") {
            "critical"
        } else if severity.to_lowercase().contains("high") {
            "high"
        } else {
            "medium"
        };

        steps.push(serde_json::json!({
            "step_number": i + 2,
            "title": format!("Patch {}", cve_id),
            "description": format!("Apply security patch for {} (severity: {}) on all affected systems", cve_id, severity),
            "priority": step_priority,
            "estimated_effort_hours": if step_priority == "critical" { 4 } else { 2 },
            "requires_downtime": step_priority == "critical",
            "success_criteria": [format!("{} no longer detected by vulnerability scanner", cve_id)],
            "rollback_plan": format!("Revert patch for {} and re-test", cve_id)
        }));
    }

    // Final step: Validation
    steps.push(serde_json::json!({
        "step_number": total_steps,
        "title": "Post-Remediation Validation & Monitoring",
        "description": "Run vulnerability scan to confirm remediation, update ServiceNow records, and enable enhanced monitoring",
        "priority": "high",
        "estimated_effort_hours": 2,
        "requires_downtime": false,
        "success_criteria": ["Vulnerability scan shows 0 critical/high findings", "ServiceNow incidents closed", "Monitoring alerts configured"],
        "rollback_plan": "Document residual risk and apply compensating controls"
    }));

    log::info!(
        "generate_remediation_plan: environment={} steps={} cves_queried={}",
        environment,
        total_steps,
        cve_entries.len()
    );

    Ok(serde_json::json!({
        "plan_summary": {
            "total_steps": total_steps,
            "estimated_total_hours": estimated_hours,
            "recommended_timeline": timeline
        },
        "prioritized_steps": steps,
        "risks": [
            {
                "risk": "Patch introduces regression in production",
                "likelihood": "medium",
                "impact": "high",
                "mitigation": "Test patch in staging before production deployment"
            },
            {
                "risk": "Extended downtime during patching",
                "likelihood": if maintenance_window { "low" } else { "high" },
                "impact": "medium",
                "mitigation": "Schedule patching during off-peak hours with rollback plan ready"
            }
        ],
        "validation_checklist": [
            "Vulnerability scanner confirms CVEs remediated",
            "Application smoke tests pass",
            "ServiceNow vulnerability entries updated to 'Fixed'",
            "Security team sign-off obtained"
        ]
    }))
}

/// T085: Analyze attack surface by querying ServiceNow CMDB for known assets
/// and correlating with vulnerability data.
async fn analyze_attack_surface(
    args: &Value,
    servicenow_url: &str,
    username: &str,
    password: &str,
) -> Result<Value, String> {
    let scan_depth = args["scan_depth"].as_str().unwrap_or("standard");

    let client = get_http_client();

    let base_url = servicenow_url.trim_end_matches('/');

    // Query CMDB for configuration items (servers, network devices)
    let cmdb_limit = match scan_depth {
        "quick" => 20_u64,
        "thorough" => 100_u64,
        _ => 50_u64,
    };

    let url = format!("{base_url}/api/now/table/cmdb_ci");
    let cmdb_records = match client
        .get(&url)
        .basic_auth(username, Some(password))
        .query(&[
            ("sysparm_query", "install_status=1^operational_status=1"),
            ("sysparm_limit", &cmdb_limit.to_string()),
            ("sysparm_fields", "name,ip_address,os,sys_class_name,discovery_source"),
        ])
        .header("Accept", "application/json")
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            resp.json::<Value>()
                .await
                .ok()
                .and_then(|b| b["result"].as_array().cloned())
                .unwrap_or_default()
        }
        _ => {
            log::info!("CMDB query failed or unavailable, returning empty asset list");
            Vec::new()
        }
    };

    let total_assets = cmdb_records.len();

    // Build exposed services from CMDB data (simplified — no actual port scanning)
    let exposed_services: Vec<Value> = cmdb_records
        .iter()
        .filter_map(|r| {
            let name = r["name"].as_str()?;
            let ip = r["ip_address"].as_str().unwrap_or("unknown");
            Some(serde_json::json!({
                "asset": name,
                "port": 443,
                "protocol": "tcp",
                "service": "HTTPS",
                "version": null,
                "is_publicly_accessible": !is_private_ip(ip)
            }))
        })
        .take(10)
        .collect();

    // Query active vulnerabilities from sn_vul_entry
    let vuln_url = format!("{base_url}/api/now/table/sn_vul_entry");
    let vuln_records = match client
        .get(&vuln_url)
        .basic_auth(username, Some(password))
        .query(&[
            ("sysparm_query", "state!=fixed^state!=closed"),
            ("sysparm_limit", "20"),
            ("sysparm_fields", "source_id,severity,state,cmdb_ci"),
        ])
        .header("Accept", "application/json")
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            resp.json::<Value>()
                .await
                .ok()
                .and_then(|b| b["result"].as_array().cloned())
                .unwrap_or_default()
        }
        _ => Vec::new(),
    };

    let critical_count = vuln_records
        .iter()
        .filter(|r| {
            sn_display_label(&r["severity"])
                .to_lowercase()
                .contains("critical")
        })
        .count();

    let high_count = vuln_records
        .iter()
        .filter(|r| {
            let sev = sn_display_label(&r["severity"]).to_lowercase();
            sev.contains("high") && !sev.contains("critical")
        })
        .count();

    let vulnerabilities: Vec<Value> = vuln_records
        .iter()
        .take(10)
        .map(|r| {
            let cve = r["source_id"].as_str().unwrap_or("CVE-UNKNOWN");
            let sev = sn_display_label(&r["severity"]);
            let asset = sn_display_label(&r["cmdb_ci"]);
            serde_json::json!({
                "asset": asset,
                "service": "ServiceNow CMDB",
                "vulnerability_type": "Known CVE",
                "severity": sev.to_lowercase(),
                "cve_ids": [cve],
                "description": format!("Vulnerability {} with severity {} detected", cve, sev)
            })
        })
        .collect();

    let overall_risk = if critical_count > 0 {
        80_u64 + (critical_count as u64 * 5).min(20)
    } else if high_count > 0 {
        50_u64 + (high_count as u64 * 5).min(30)
    } else {
        20_u64
    };

    log::info!(
        "analyze_attack_surface: depth={} assets={} vulns={} critical={} high={}",
        scan_depth,
        total_assets,
        vuln_records.len(),
        critical_count,
        high_count
    );

    let recommendations: Vec<Value> = if critical_count > 0 {
        vec![serde_json::json!({
            "asset": "All affected systems",
            "recommendation": format!("Immediately patch {} critical vulnerabilities", critical_count),
            "priority": "immediate",
            "effort_estimate": "4-8 hours"
        })]
    } else {
        vec![serde_json::json!({
            "asset": "All systems",
            "recommendation": "Schedule regular vulnerability scans and patch management",
            "priority": "high",
            "effort_estimate": "2-4 hours per cycle"
        })]
    };

    Ok(serde_json::json!({
        "summary": {
            "total_assets": total_assets,
            "exposed_services": exposed_services.len(),
            "vulnerabilities_found": vuln_records.len(),
            "overall_risk_score": overall_risk
        },
        "exposed_services": exposed_services,
        "vulnerabilities": vulnerabilities,
        "risk_assessment": {
            "critical_findings": critical_count,
            "high_findings": high_count,
            "attack_vectors": ["Network", "Application"],
            "compliance_issues": if critical_count > 0 { vec!["Unpatched critical CVEs"] } else { vec![] }
        },
        "hardening_recommendations": recommendations
    }))
}

/// T086: Audit security compliance by querying ServiceNow GRC (policy statements)
/// and returning a compliance report against the requested framework.
async fn audit_security_compliance(
    args: &Value,
    servicenow_url: &str,
    username: &str,
    password: &str,
) -> Result<Value, String> {
    let framework = args["framework"].as_str().unwrap_or("CIS");
    let framework_version = args["framework_version"]
        .as_str()
        .unwrap_or(match framework {
            "CIS" => "v8.0",
            "NIST_800-53" => "Rev 5",
            "PCI-DSS" => "v4.0",
            "ISO_27001" => "2022",
            "SOC2" => "2017",
            _ => "latest",
        });

    let client = get_http_client();

    let base_url = servicenow_url.trim_end_matches('/');

    // Query GRC policy statements (sn_compliance_policy_statement)
    let grc_url = format!("{base_url}/api/now/table/sn_compliance_policy_statement");
    let policy_records = match client
        .get(&grc_url)
        .basic_auth(username, Some(password))
        .query(&[
            ("sysparm_limit", "50"),
            ("sysparm_fields", "name,description,state,type,category"),
            ("sysparm_display_value", "true"),
        ])
        .header("Accept", "application/json")
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            resp.json::<Value>()
                .await
                .ok()
                .and_then(|b| b["result"].as_array().cloned())
                .unwrap_or_default()
        }
        _ => {
            log::info!("GRC policy query failed or unavailable, using stub compliance data");
            Vec::new()
        }
    };

    let total_controls = policy_records.len().max(10);
    let passed = if policy_records.is_empty() {
        7
    } else {
        policy_records
            .iter()
            .filter(|r| {
                let state = sn_display_label(&r["state"]).to_lowercase();
                state.contains("compliant") || state.contains("pass")
            })
            .count()
    };
    let failed = total_controls.saturating_sub(passed).min(total_controls / 3);
    let not_tested = total_controls.saturating_sub(passed + failed);

    let compliance_score = if total_controls > 0 {
        (passed as f64 / total_controls as f64 * 100.0).round() as u64
    } else {
        70
    };

    let failed_controls: Vec<Value> = policy_records
        .iter()
        .filter(|r| {
            let state = sn_display_label(&r["state"]).to_lowercase();
            !state.contains("compliant") && !state.contains("pass")
        })
        .take(5)
        .enumerate()
        .map(|(i, r)| {
            let name = sn_display_label(&r["name"]);
            serde_json::json!({
                "control_id": format!("{}-{}", framework, i + 1),
                "control_name": name,
                "severity": "medium",
                "affected_systems": ["all"],
                "current_state": sn_display_label(&r["state"]),
                "expected_state": "Compliant",
                "gap_description": format!("Control '{}' not yet compliant", name)
            })
        })
        .collect();

    let remediation_priorities: Vec<Value> = failed_controls
        .iter()
        .enumerate()
        .map(|(i, ctrl)| {
            serde_json::json!({
                "control_id": ctrl["control_id"],
                "priority_rank": i + 1,
                "remediation_steps": [
                    format!("Review current state of {}", ctrl["control_name"]),
                    "Document gap and assign remediation owner",
                    "Implement required control measures",
                    "Re-test and update ServiceNow GRC record"
                ],
                "estimated_effort_hours": 4,
                "business_justification": format!("Required for {} {} compliance", framework, framework_version)
            })
        })
        .collect();

    // Recommend re-audit in 90 days
    let next_audit = chrono::Utc::now() + chrono::Duration::days(90);
    let next_audit_str = next_audit.format("%Y-%m-%dT%H:%M:%SZ").to_string();

    log::info!(
        "audit_security_compliance: framework={} score={}% total={} passed={} failed={}",
        framework,
        compliance_score,
        total_controls,
        passed,
        failed
    );

    let is_stub = policy_records.is_empty();
    Ok(serde_json::json!({
        "framework": framework,
        "framework_version": framework_version,
        "compliance_score": compliance_score,
        "audit_summary": {
            "total_controls": total_controls,
            "passed": passed,
            "failed": failed,
            "not_applicable": 0,
            "not_tested": not_tested
        },
        "failed_controls": failed_controls,
        "remediation_priorities": remediation_priorities,
        "next_audit_date": next_audit_str,
        "data_source": if is_stub { "stub" } else { "servicenow_grc" },
        "warning": if is_stub { serde_json::json!("GRC data unavailable — values are placeholders") } else { serde_json::Value::Null }
    }))
}
