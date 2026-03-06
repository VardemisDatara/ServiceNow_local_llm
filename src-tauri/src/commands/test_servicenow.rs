use serde::Serialize;
use crate::integrations::servicenow::{ServiceNowClient, ServiceNowConfig};

/// Response for ServiceNow connection test
#[derive(Debug, Serialize)]
pub struct ServiceNowTestResult {
    pub success: bool,
    pub instance: Option<String>,
    pub latency_ms: u64,
    pub error: Option<String>,
}

/// Test connection to ServiceNow using provided credentials
///
/// # Tauri Command
/// Called from frontend: `invoke('test_servicenow_connection', { instanceUrl, username, password })`
#[tauri::command]
pub async fn test_servicenow_connection(
    instance_url: String,
    username: String,
    password: String,
) -> Result<ServiceNowTestResult, String> {
    let start = std::time::Instant::now();

    log::info!("Testing ServiceNow connection: {} (user: {})", instance_url, username);

    let config = ServiceNowConfig::new(instance_url.clone(), username, password);

    let client = match ServiceNowClient::new(config) {
        Ok(c) => c,
        Err(e) => {
            return Ok(ServiceNowTestResult {
                success: false,
                instance: None,
                latency_ms: start.elapsed().as_millis() as u64,
                error: Some(format!("Failed to create client: {e}")),
            });
        }
    };

    match client.health_check().await {
        Ok(()) => {
            let latency_ms = start.elapsed().as_millis() as u64;

            log::info!(
                "ServiceNow connection test passed: instance={}, latency={}ms",
                instance_url,
                latency_ms
            );

            Ok(ServiceNowTestResult {
                success: true,
                instance: Some(instance_url),
                latency_ms,
                error: None,
            })
        }
        Err(e) => {
            let latency_ms = start.elapsed().as_millis() as u64;

            log::warn!("ServiceNow connection test failed: {}", e);

            Ok(ServiceNowTestResult {
                success: false,
                instance: None,
                latency_ms,
                error: Some(e.to_string()),
            })
        }
    }
}
