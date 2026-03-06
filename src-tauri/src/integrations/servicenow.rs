use reqwest::{Client, header};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use thiserror::Error;
use base64::{Engine as _, engine::general_purpose::STANDARD as base64};

/// ServiceNow client errors
#[derive(Error, Debug, Serialize)]
pub enum ServiceNowError {
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),

    #[error("Authentication failed")]
    AuthenticationFailed,

    #[error("Request timeout")]
    Timeout,

    #[error("API error: {0}")]
    ApiError(String),

    #[error("Invalid response")]
    InvalidResponse,
}

impl From<reqwest::Error> for ServiceNowError {
    fn from(err: reqwest::Error) -> Self {
        if err.is_timeout() {
            Self::Timeout
        } else if err.is_connect() {
            Self::ConnectionFailed(err.to_string())
        } else if err.status() == Some(reqwest::StatusCode::UNAUTHORIZED) {
            Self::AuthenticationFailed
        } else {
            Self::ApiError(err.to_string())
        }
    }
}

pub type ServiceNowResult<T> = Result<T, ServiceNowError>;

/// ServiceNow configuration
#[derive(Debug, Clone)]
pub struct ServiceNowConfig {
    pub instance_url: String,
    pub username: String,
    pub password: String,
    pub timeout_secs: u64,
}

impl ServiceNowConfig {
    /// Create a new ServiceNow config
    pub fn new(instance_url: String, username: String, password: String) -> Self {
        Self {
            instance_url: instance_url.trim_end_matches('/').to_string(),
            username,
            password,
            timeout_secs: 30,
        }
    }

    /// Generate Basic Auth header value
    fn auth_header_value(&self) -> String {
        let credentials = format!("{}:{}", self.username, self.password);
        format!("Basic {}", base64.encode(credentials))
    }
}

/// ServiceNow incident
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Incident {
    pub sys_id: String,
    pub number: String,
    pub short_description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub priority: String,
    pub state: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub impact: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub urgency: Option<String>,
}

/// Response wrapper for ServiceNow API
#[derive(Debug, Deserialize)]
struct ServiceNowResponse<T> {
    result: Vec<T>,
}

/// Single record response
#[derive(Debug, Deserialize)]
struct ServiceNowSingleResponse<T> {
    result: T,
}

/// ServiceNow client for Rust-side operations
pub struct ServiceNowClient {
    config: ServiceNowConfig,
    client: Client,
}

impl ServiceNowClient {
    /// Create a new ServiceNow client
    pub fn new(config: ServiceNowConfig) -> ServiceNowResult<Self> {
        let mut headers = header::HeaderMap::new();
        headers.insert(
            header::AUTHORIZATION,
            header::HeaderValue::from_str(&config.auth_header_value())
                .map_err(|e| ServiceNowError::ApiError(e.to_string()))?,
        );
        headers.insert(
            header::CONTENT_TYPE,
            header::HeaderValue::from_static("application/json"),
        );
        headers.insert(
            header::ACCEPT,
            header::HeaderValue::from_static("application/json"),
        );

        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .default_headers(headers)
            .build()
            .map_err(|e| ServiceNowError::ConnectionFailed(e.to_string()))?;

        log::info!("ServiceNow client initialized: {}", config.instance_url);

        Ok(Self { config, client })
    }

    /// Test connection to ServiceNow instance
    pub async fn health_check(&self) -> ServiceNowResult<()> {
        let url = format!("{}/api/now/table/sys_user", self.config.instance_url);

        log::debug!("Health check: {}", url);

        let response = self
            .client
            .get(&url)
            .query(&[("sysparm_limit", "1"), ("sysparm_fields", "sys_id")])
            .send()
            .await?;

        match response.status() {
            reqwest::StatusCode::OK => {
                log::info!("ServiceNow health check passed");
                Ok(())
            }
            reqwest::StatusCode::UNAUTHORIZED | reqwest::StatusCode::FORBIDDEN => {
                log::error!("ServiceNow authentication failed");
                Err(ServiceNowError::AuthenticationFailed)
            }
            status => {
                log::error!("ServiceNow health check failed: {}", status);
                Err(ServiceNowError::ConnectionFailed(format!("HTTP {}", status)))
            }
        }
    }

    /// Get incident by number
    pub async fn get_incident(&self, incident_number: &str) -> ServiceNowResult<Option<Incident>> {
        let url = format!("{}/api/now/table/incident", self.config.instance_url);

        log::debug!("Getting incident: {}", incident_number);

        let query_value = format!("number={}", incident_number);
        let response = self
            .client
            .get(&url)
            .query(&[
                ("sysparm_query", query_value.as_str()),
                ("sysparm_limit", "1"),
            ])
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(ServiceNowError::ApiError(format!(
                "HTTP {}",
                response.status()
            )));
        }

        let data: ServiceNowResponse<Incident> = response
            .json()
            .await
            .map_err(|_| ServiceNowError::InvalidResponse)?;

        Ok(data.result.into_iter().next())
    }

    /// Query incidents with a filter
    pub async fn query_incidents(&self, query: &str, limit: usize) -> ServiceNowResult<Vec<Incident>> {
        let url = format!("{}/api/now/table/incident", self.config.instance_url);

        log::debug!("Querying incidents: {}", query);

        let response = self
            .client
            .get(&url)
            .query(&[
                ("sysparm_query", query),
                ("sysparm_limit", &limit.to_string()),
            ])
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(ServiceNowError::ApiError(format!(
                "HTTP {}",
                response.status()
            )));
        }

        let data: ServiceNowResponse<Incident> = response
            .json()
            .await
            .map_err(|_| ServiceNowError::InvalidResponse)?;

        log::info!("Found {} incidents", data.result.len());
        Ok(data.result)
    }

    /// Get the client configuration (without password)
    pub fn instance_url(&self) -> &str {
        &self.config.instance_url
    }

    /// Get username
    pub fn username(&self) -> &str {
        &self.config.username
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_health_check() {
        // This test requires valid ServiceNow credentials
        // It will fail without them, which is expected
        let config = ServiceNowConfig::new(
            "https://dev12345.service-now.com".to_string(),
            "test_user".to_string(),
            "test_pass".to_string(),
        );

        let client = ServiceNowClient::new(config);
        assert!(client.is_ok());

        // This will fail without valid credentials
        if let Ok(client) = client {
            let result = client.health_check().await;
            println!("Health check result: {:?}", result);
        }
    }
}
