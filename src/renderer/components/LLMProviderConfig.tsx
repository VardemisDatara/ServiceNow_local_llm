/**
 * T113: LLM Provider configuration component
 * Allows selecting between local Ollama, OpenAI, or Mistral with API key entry.
 */

import { OPENAI_MODELS } from '../../core/integrations/llm/openai';
import { MISTRAL_MODELS } from '../../core/integrations/llm/mistral';

type LLMProviderName = 'ollama' | 'openai' | 'mistral';

interface LLMProviderConfigProps {
  provider: LLMProviderName;
  apiKey: string;
  cloudModel: string;
  onProviderChange: (provider: LLMProviderName) => void;
  onApiKeyChange: (key: string) => void;
  onCloudModelChange: (model: string) => void;
  apiKeyError?: string | undefined;
}

const PROVIDER_LABELS: Record<LLMProviderName, string> = {
  ollama: 'Ollama (Local)',
  openai: 'OpenAI',
  mistral: 'Mistral AI',
};

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  fontSize: '0.875rem',
  color: '#374151',
  backgroundColor: '#ffffff',
  width: '100%',
  boxSizing: 'border-box',
};

const inputErrorStyle: React.CSSProperties = {
  ...inputStyle,
  borderColor: '#ef4444',
};

export function LLMProviderConfig({
  provider,
  apiKey,
  cloudModel,
  onProviderChange,
  onApiKeyChange,
  onCloudModelChange,
  apiKeyError,
}: LLMProviderConfigProps) {
  const isCloud = provider === 'openai' || provider === 'mistral';
  const models = provider === 'openai' ? OPENAI_MODELS : provider === 'mistral' ? MISTRAL_MODELS : [];
  const defaultModel = provider === 'openai' ? 'gpt-4o-mini' : 'mistral-small-latest';

  function handleProviderChange(next: LLMProviderName) {
    onProviderChange(next);
    // Reset model to provider default when switching
    if (next === 'openai') onCloudModelChange('gpt-4o-mini');
    else if (next === 'mistral') onCloudModelChange('mistral-small-latest');
    else onCloudModelChange('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Provider selector */}
      <div>
        <label
          htmlFor="llm-provider"
          style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}
        >
          LLM Provider
        </label>
        <select
          id="llm-provider"
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value as LLMProviderName)}
          style={inputStyle}
        >
          {(Object.keys(PROVIDER_LABELS) as LLMProviderName[]).map((p) => (
            <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
          ))}
        </select>
      </div>

      {/* Ollama info */}
      {provider === 'ollama' && (
        <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0, fontStyle: 'italic' }}>
          Uses your local Ollama instance and model configured above. No API key required.
        </p>
      )}

      {/* Cloud provider fields */}
      {isCloud && (
        <>
          {/* Model selector */}
          <div>
            <label
              htmlFor="cloud-llm-model"
              style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}
            >
              Model
            </label>
            <select
              id="cloud-llm-model"
              value={cloudModel || defaultModel}
              onChange={(e) => onCloudModelChange(e.target.value)}
              style={inputStyle}
            >
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* API key */}
          <div>
            <label
              htmlFor="llm-api-key"
              style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}
            >
              {PROVIDER_LABELS[provider]} API Key
              <span style={{ color: '#ef4444', marginLeft: '2px' }} aria-hidden="true">*</span>
            </label>
            <input
              id="llm-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder={provider === 'openai' ? 'sk-...' : 'Enter your Mistral API key'}
              autoComplete="off"
              aria-required="true"
              aria-invalid={!!apiKeyError}
              style={apiKeyError ? inputErrorStyle : inputStyle}
            />
            {apiKeyError && (
              <span
                role="alert"
                style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '2px', display: 'block' }}
              >
                {apiKeyError}
              </span>
            )}
            <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '4px 0 0', fontStyle: 'italic' }}>
              Stored securely in OS keychain. Never logged or transmitted to ServiceNow.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default LLMProviderConfig;
