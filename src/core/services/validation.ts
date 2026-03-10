/**
 * T036: Validation service for ServiceNow URL and Ollama endpoint
 * Pure validation functions — no side effects
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ============================================================================
// URL Validators
// ============================================================================

/**
 * Validate a ServiceNow instance URL
 * Must be https://<instance>.service-now.com or a custom URL
 */
export function validateServiceNowUrl(url: string): ValidationResult {
  if (!url || url.trim().length === 0) {
    return { valid: false, error: 'ServiceNow URL is required' };
  }

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return { valid: false, error: 'Invalid URL format. Example: https://dev12345.service-now.com' };
  }

  if (parsed.protocol !== 'https:') {
    return {
      valid: false,
      error: 'ServiceNow URL must use HTTPS (https://). HTTP is not accepted because credentials would be transmitted in cleartext.',
    };
  }

  if (!parsed.hostname || parsed.hostname.length === 0) {
    return { valid: false, error: 'URL must include a hostname' };
  }

  return { valid: true };
}

/**
 * Validate an Ollama endpoint URL
 * Typically http://localhost:11434
 */
export function validateOllamaEndpoint(endpoint: string): ValidationResult {
  if (!endpoint || endpoint.trim().length === 0) {
    return { valid: false, error: 'Ollama endpoint is required' };
  }

  let parsed: URL;
  try {
    parsed = new URL(endpoint.trim());
  } catch {
    return { valid: false, error: 'Invalid URL format. Example: http://localhost:11434' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'Endpoint must use http or https protocol' };
  }

  if (!parsed.hostname || parsed.hostname.length === 0) {
    return { valid: false, error: 'Endpoint must include a hostname' };
  }

  return { valid: true };
}

// ============================================================================
// Field Validators
// ============================================================================

export function validateProfileName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Profile name is required' };
  }
  if (name.trim().length > 64) {
    return { valid: false, error: 'Profile name must be 64 characters or less' };
  }
  return { valid: true };
}

export function validateUsername(username: string): ValidationResult {
  if (!username || username.trim().length === 0) {
    return { valid: false, error: 'Username is required' };
  }
  return { valid: true };
}

export function validatePassword(password: string): ValidationResult {
  if (!password || password.length === 0) {
    return { valid: false, error: 'Password is required' };
  }
  return { valid: true };
}

export function validateOllamaModel(model: string): ValidationResult {
  if (!model || model.trim().length === 0) {
    return { valid: false, error: 'Ollama model name is required' };
  }
  return { valid: true };
}

export function validateApiKey(apiKey: string, provider: string): ValidationResult {
  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false, error: `${provider} API key is required` };
  }
  if (apiKey.trim().length < 10) {
    return { valid: false, error: 'API key appears too short' };
  }
  return { valid: true };
}

// ============================================================================
// Form-level Validation
// ============================================================================

export interface ConfigurationFormErrors {
  name?: string | undefined;
  servicenowUrl?: string | undefined;
  servicenowUsername?: string | undefined;
  servicenowPassword?: string | undefined;
  ollamaEndpoint?: string | undefined;
  ollamaModel?: string | undefined;
  searchApiKey?: string | undefined;
  llmApiKey?: string | undefined;
}

export interface ConfigurationFormInput {
  name: string;
  servicenowUrl: string;
  servicenowUsername: string;
  servicenowPassword: string;
  ollamaEndpoint: string;
  ollamaModel: string;
  searchProvider: string;
  searchApiKey?: string;
  llmProvider?: string;
  llmApiKey?: string;
  isNew?: boolean; // If creating, password is required
}

/**
 * Validate the full configuration form
 * Returns errors object (empty if all valid)
 */
export function validateConfigurationForm(values: ConfigurationFormInput): ConfigurationFormErrors {
  const errors: ConfigurationFormErrors = {};

  const nameResult = validateProfileName(values.name);
  if (!nameResult.valid && nameResult.error) errors.name = nameResult.error;

  const snUrlResult = validateServiceNowUrl(values.servicenowUrl);
  if (!snUrlResult.valid && snUrlResult.error) errors.servicenowUrl = snUrlResult.error;

  const usernameResult = validateUsername(values.servicenowUsername);
  if (!usernameResult.valid && usernameResult.error) errors.servicenowUsername = usernameResult.error;

  if (values.isNew || values.servicenowPassword.length > 0) {
    const passwordResult = validatePassword(values.servicenowPassword);
    if (!passwordResult.valid && passwordResult.error) errors.servicenowPassword = passwordResult.error;
  }

  const ollamaResult = validateOllamaEndpoint(values.ollamaEndpoint);
  if (!ollamaResult.valid && ollamaResult.error) errors.ollamaEndpoint = ollamaResult.error;

  const modelResult = validateOllamaModel(values.ollamaModel);
  if (!modelResult.valid && modelResult.error) errors.ollamaModel = modelResult.error;

  if (
    (values.searchProvider === 'perplexity' || values.searchProvider === 'google') &&
    values.searchApiKey !== undefined
  ) {
    const apiKeyResult = validateApiKey(values.searchApiKey, values.searchProvider);
    if (!apiKeyResult.valid && apiKeyResult.error) errors.searchApiKey = apiKeyResult.error;
  }

  // T116: Validate LLM API key when a cloud provider is selected
  if (
    (values.llmProvider === 'openai' || values.llmProvider === 'mistral') &&
    values.llmApiKey !== undefined
  ) {
    const llmKeyResult = validateApiKey(values.llmApiKey, values.llmProvider);
    if (!llmKeyResult.valid && llmKeyResult.error) errors.llmApiKey = llmKeyResult.error;
  }

  return errors;
}

/**
 * Check if a form errors object has any errors
 */
export function hasErrors(errors: ConfigurationFormErrors): boolean {
  return Object.values(errors).some((e) => e !== undefined);
}
