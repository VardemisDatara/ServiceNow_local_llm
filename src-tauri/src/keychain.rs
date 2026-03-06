use keyring::{Entry, Error as KeyringError};
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Custom error type for keychain operations
#[derive(Error, Debug, Serialize)]
pub enum KeychainError {
    #[error("Keychain error: {0}")]
    KeyringError(String),

    #[error("Credential not found: {0}")]
    NotFound(String),

    #[error("Invalid credential format")]
    InvalidFormat,

    #[error("Platform not supported")]
    PlatformNotSupported,
}

impl From<KeyringError> for KeychainError {
    fn from(err: KeyringError) -> Self {
        match err {
            KeyringError::NoEntry => Self::NotFound("Credential not found".to_string()),
            _ => Self::KeyringError(err.to_string()),
        }
    }
}

/// Result type for keychain operations
pub type KeychainResult<T> = Result<T, KeychainError>;

/// Service name for all credentials (used as namespace in OS keychain)
const SERVICE_NAME: &str = "com.servicenow.mcp-bridge";

/// Credential types supported by the application
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceNowCredentials {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyCredential {
    pub api_key: String,
}

/// Store ServiceNow credentials in OS keychain
///
/// # Arguments
/// * `profile_id` - Unique identifier for the configuration profile
/// * `credentials` - ServiceNow username and password
///
/// # Returns
/// * `Ok(())` if successful
/// * `Err(KeychainError)` if storage fails
pub fn store_servicenow_credentials(
    profile_id: &str,
    credentials: &ServiceNowCredentials,
) -> KeychainResult<()> {
    let account_name = format!("servicenow_{}", profile_id);
    let entry = Entry::new(SERVICE_NAME, &account_name)?;

    // Serialize credentials to JSON for storage
    let credentials_json = serde_json::to_string(credentials)
        .map_err(|_| KeychainError::InvalidFormat)?;

    entry
        .set_password(&credentials_json)
        .map_err(KeychainError::from)?;

    log::info!("Stored ServiceNow credentials for profile: {}", profile_id);
    Ok(())
}

/// Retrieve ServiceNow credentials from OS keychain
///
/// # Arguments
/// * `profile_id` - Unique identifier for the configuration profile
///
/// # Returns
/// * `Ok(ServiceNowCredentials)` if found and valid
/// * `Err(KeychainError)` if not found or invalid
pub fn get_servicenow_credentials(
    profile_id: &str,
) -> KeychainResult<ServiceNowCredentials> {
    let account_name = format!("servicenow_{}", profile_id);
    let entry = Entry::new(SERVICE_NAME, &account_name)?;

    let password = entry.get_password().map_err(KeychainError::from)?;

    let credentials: ServiceNowCredentials = serde_json::from_str(&password)
        .map_err(|_| KeychainError::InvalidFormat)?;

    log::debug!("Retrieved ServiceNow credentials for profile: {}", profile_id);
    Ok(credentials)
}

/// Delete ServiceNow credentials from OS keychain
///
/// # Arguments
/// * `profile_id` - Unique identifier for the configuration profile
///
/// # Returns
/// * `Ok(())` if successful or credential doesn't exist
/// * `Err(KeychainError)` if deletion fails
pub fn delete_servicenow_credentials(profile_id: &str) -> KeychainResult<()> {
    let account_name = format!("servicenow_{}", profile_id);
    let entry = Entry::new(SERVICE_NAME, &account_name)?;

    match entry.delete_password() {
        Ok(()) => {
            log::info!("Deleted ServiceNow credentials for profile: {}", profile_id);
            Ok(())
        }
        Err(KeyringError::NoEntry) => {
            // Credential doesn't exist, consider it a success
            Ok(())
        }
        Err(e) => Err(KeychainError::from(e)),
    }
}

/// Store API key (for search providers, LLM APIs, etc.) in OS keychain
///
/// # Arguments
/// * `provider` - Provider name (e.g., "perplexity", "openai", "google")
/// * `profile_id` - Configuration profile ID
/// * `api_key` - API key to store
///
/// # Returns
/// * `Ok(())` if successful
/// * `Err(KeychainError)` if storage fails
pub fn store_api_key(
    provider: &str,
    profile_id: &str,
    api_key: &str,
) -> KeychainResult<()> {
    let account_name = format!("{}_{}", provider, profile_id);
    let entry = Entry::new(SERVICE_NAME, &account_name)?;

    let credential = ApiKeyCredential {
        api_key: api_key.to_string(),
    };

    let credential_json = serde_json::to_string(&credential)
        .map_err(|_| KeychainError::InvalidFormat)?;

    entry
        .set_password(&credential_json)
        .map_err(KeychainError::from)?;

    log::info!("Stored API key for provider: {} (profile: {})", provider, profile_id);
    Ok(())
}

/// Retrieve API key from OS keychain
///
/// # Arguments
/// * `provider` - Provider name (e.g., "perplexity", "openai", "google")
/// * `profile_id` - Configuration profile ID
///
/// # Returns
/// * `Ok(String)` - The API key if found
/// * `Err(KeychainError)` if not found or invalid
pub fn get_api_key(provider: &str, profile_id: &str) -> KeychainResult<String> {
    let account_name = format!("{}_{}", provider, profile_id);
    let entry = Entry::new(SERVICE_NAME, &account_name)?;

    let password = entry.get_password().map_err(KeychainError::from)?;

    let credential: ApiKeyCredential = serde_json::from_str(&password)
        .map_err(|_| KeychainError::InvalidFormat)?;

    log::debug!("Retrieved API key for provider: {} (profile: {})", provider, profile_id);
    Ok(credential.api_key)
}

/// Delete API key from OS keychain
///
/// # Arguments
/// * `provider` - Provider name
/// * `profile_id` - Configuration profile ID
///
/// # Returns
/// * `Ok(())` if successful or key doesn't exist
/// * `Err(KeychainError)` if deletion fails
pub fn delete_api_key(provider: &str, profile_id: &str) -> KeychainResult<()> {
    let account_name = format!("{}_{}", provider, profile_id);
    let entry = Entry::new(SERVICE_NAME, &account_name)?;

    match entry.delete_password() {
        Ok(()) => {
            log::info!("Deleted API key for provider: {} (profile: {})", provider, profile_id);
            Ok(())
        }
        Err(KeyringError::NoEntry) => Ok(()),
        Err(e) => Err(KeychainError::from(e)),
    }
}

/// Check if credentials exist for a profile
///
/// # Arguments
/// * `profile_id` - Configuration profile ID
///
/// # Returns
/// * `true` if ServiceNow credentials exist for this profile
/// * `false` otherwise
pub fn has_servicenow_credentials(profile_id: &str) -> bool {
    let account_name = format!("servicenow_{}", profile_id);
    match Entry::new(SERVICE_NAME, &account_name) {
        Ok(entry) => entry.get_password().is_ok(),
        Err(_) => false,
    }
}

/// Check if API key exists for a provider
///
/// # Arguments
/// * `provider` - Provider name
/// * `profile_id` - Configuration profile ID
///
/// # Returns
/// * `true` if API key exists
/// * `false` otherwise
pub fn has_api_key(provider: &str, profile_id: &str) -> bool {
    let account_name = format!("{}_{}", provider, profile_id);
    match Entry::new(SERVICE_NAME, &account_name) {
        Ok(entry) => entry.get_password().is_ok(),
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_PROFILE_ID: &str = "test_profile_123";
    const TEST_PROVIDER: &str = "test_provider";

    #[test]
    fn test_servicenow_credentials_roundtrip() {
        let credentials = ServiceNowCredentials {
            username: "test_user".to_string(),
            password: "test_pass".to_string(),
        };

        // Store
        store_servicenow_credentials(TEST_PROFILE_ID, &credentials)
            .expect("Failed to store credentials");

        // Retrieve
        let retrieved = get_servicenow_credentials(TEST_PROFILE_ID)
            .expect("Failed to retrieve credentials");

        assert_eq!(credentials.username, retrieved.username);
        assert_eq!(credentials.password, retrieved.password);

        // Check existence
        assert!(has_servicenow_credentials(TEST_PROFILE_ID));

        // Cleanup
        delete_servicenow_credentials(TEST_PROFILE_ID)
            .expect("Failed to delete credentials");

        assert!(!has_servicenow_credentials(TEST_PROFILE_ID));
    }

    #[test]
    fn test_api_key_roundtrip() {
        let api_key = "sk-test-key-12345";

        // Store
        store_api_key(TEST_PROVIDER, TEST_PROFILE_ID, api_key)
            .expect("Failed to store API key");

        // Retrieve
        let retrieved = get_api_key(TEST_PROVIDER, TEST_PROFILE_ID)
            .expect("Failed to retrieve API key");

        assert_eq!(api_key, retrieved);

        // Check existence
        assert!(has_api_key(TEST_PROVIDER, TEST_PROFILE_ID));

        // Cleanup
        delete_api_key(TEST_PROVIDER, TEST_PROFILE_ID)
            .expect("Failed to delete API key");

        assert!(!has_api_key(TEST_PROVIDER, TEST_PROFILE_ID));
    }
}
