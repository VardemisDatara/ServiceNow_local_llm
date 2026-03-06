use serde::Serialize;
use crate::integrations::ollama::{OllamaClient, OllamaConfig};

/// Response for Ollama connection test
#[derive(Debug, Serialize)]
pub struct OllamaTestResult {
    pub success: bool,
    pub version: Option<String>,
    pub models: Vec<String>,
    pub latency_ms: u64,
    pub error: Option<String>,
}

/// Test connection to Ollama and list available models
///
/// # Tauri Command
/// Called from frontend: `invoke('test_ollama_connection', { endpoint })`
#[tauri::command]
pub async fn test_ollama_connection(endpoint: String) -> Result<OllamaTestResult, String> {
    let start = std::time::Instant::now();

    log::info!("Testing Ollama connection: {}", endpoint);

    let config = OllamaConfig {
        endpoint: endpoint.clone(),
        timeout_secs: 10,
    };

    let client = OllamaClient::new(config);

    // Test health check
    let version = match client.health_check().await {
        Ok(v) => v,
        Err(e) => {
            let latency_ms = start.elapsed().as_millis() as u64;
            log::warn!("Ollama connection failed: {}", e);
            return Ok(OllamaTestResult {
                success: false,
                version: None,
                models: vec![],
                latency_ms,
                error: Some(e.to_string()),
            });
        }
    };

    // List available models
    let models = match client.list_models().await {
        Ok(m) => m.into_iter().map(|model| model.name).collect(),
        Err(e) => {
            log::warn!("Ollama model listing failed: {}", e);
            vec![]
        }
    };

    let latency_ms = start.elapsed().as_millis() as u64;

    log::info!(
        "Ollama connection test passed: version={}, models={}, latency={}ms",
        version,
        models.len(),
        latency_ms
    );

    Ok(OllamaTestResult {
        success: true,
        version: Some(version),
        models,
        latency_ms,
        error: None,
    })
}
