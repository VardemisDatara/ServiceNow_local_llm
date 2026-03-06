use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use thiserror::Error;

/// Ollama client errors
#[derive(Error, Debug, Serialize)]
pub enum OllamaError {
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),

    #[error("Request timeout")]
    Timeout,

    #[error("Model not found: {0}")]
    ModelNotFound(String),

    #[error("Inference failed: {0}")]
    InferenceFailed(String),

    #[error("Invalid response")]
    InvalidResponse,
}

impl From<reqwest::Error> for OllamaError {
    fn from(err: reqwest::Error) -> Self {
        if err.is_timeout() {
            Self::Timeout
        } else if err.is_connect() {
            Self::ConnectionFailed(err.to_string())
        } else {
            Self::InferenceFailed(err.to_string())
        }
    }
}

pub type OllamaResult<T> = Result<T, OllamaError>;

/// Ollama configuration
#[derive(Debug, Clone)]
pub struct OllamaConfig {
    pub endpoint: String,
    pub timeout_secs: u64,
}

impl Default for OllamaConfig {
    fn default() -> Self {
        Self {
            endpoint: "http://localhost:11434".to_string(),
            timeout_secs: 30,
        }
    }
}

/// Ollama model information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaModel {
    pub name: String,
    pub modified_at: String,
    pub size: i64,
    pub digest: String,
}

/// Response from /api/tags
#[derive(Debug, Deserialize)]
struct TagsResponse {
    models: Vec<OllamaModel>,
}

/// Response from /api/version
#[derive(Debug, Deserialize)]
struct VersionResponse {
    version: String,
}

/// Ollama client for Rust-side operations
pub struct OllamaClient {
    config: OllamaConfig,
    client: Client,
}

impl OllamaClient {
    /// Create a new Ollama client
    pub fn new(config: OllamaConfig) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .build()
            .expect("Failed to build HTTP client");

        log::info!("Ollama client initialized: {}", config.endpoint);

        Self { config, client }
    }

    /// Test connection to Ollama instance
    pub async fn health_check(&self) -> OllamaResult<String> {
        let url = format!("{}/api/version", self.config.endpoint);

        log::debug!("Health check: {}", url);

        let response = self.client.get(&url).send().await?;

        if !response.status().is_success() {
            return Err(OllamaError::ConnectionFailed(format!(
                "HTTP {}",
                response.status()
            )));
        }

        let data: VersionResponse = response.json().await?;

        log::info!("Ollama health check passed: version {}", data.version);
        Ok(data.version)
    }

    /// List available models
    pub async fn list_models(&self) -> OllamaResult<Vec<OllamaModel>> {
        let url = format!("{}/api/tags", self.config.endpoint);

        log::debug!("Listing models: {}", url);

        let response = self.client.get(&url).send().await?;

        if !response.status().is_success() {
            return Err(OllamaError::ConnectionFailed(format!(
                "HTTP {}",
                response.status()
            )));
        }

        let data: TagsResponse = response.json().await?;

        log::info!("Found {} Ollama models", data.models.len());
        Ok(data.models)
    }

    /// Check if a specific model is available
    pub async fn has_model(&self, model_name: &str) -> bool {
        match self.list_models().await {
            Ok(models) => models.iter().any(|m| m.name == model_name),
            Err(e) => {
                log::warn!("Failed to check model availability: {}", e);
                false
            }
        }
    }

    /// Get the client configuration
    pub fn config(&self) -> &OllamaConfig {
        &self.config
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_health_check() {
        // This test requires Ollama to be running
        let config = OllamaConfig::default();
        let client = OllamaClient::new(config);

        // This will fail if Ollama is not running, which is expected
        let result = client.health_check().await;
        println!("Health check result: {:?}", result);
    }
}
