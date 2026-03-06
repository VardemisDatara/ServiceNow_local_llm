/**
 * T103: Search provider configuration UI
 * Lets users select a search provider and enter the required API credentials.
 * Google requires both an API key and a Programmable Search Engine ID (cx).
 * The Google composite value is encoded as "apiKey|||cx" for keychain storage.
 */

type SearchProviderType = 'duckduckgo' | 'perplexity' | 'google';

interface SearchProviderConfigProps {
  provider: SearchProviderType;
  /** Raw stored value: plain string for Perplexity, "key|||cx" for Google */
  apiKey: string;
  onProviderChange: (provider: SearchProviderType) => void;
  onApiKeyChange: (value: string) => void;
  apiKeyError?: string | undefined;
}

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

const labelStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '4px',
  display: 'block',
};

const hintStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#6b7280',
  marginTop: '4px',
};

/** Split Google composite value into its parts */
function splitGoogleKey(composite: string): { key: string; cx: string } {
  const sep = composite.indexOf('|||');
  if (sep !== -1) {
    return { key: composite.slice(0, sep), cx: composite.slice(sep + 3) };
  }
  return { key: composite, cx: '' };
}

export function SearchProviderConfig({
  provider,
  apiKey,
  onProviderChange,
  onApiKeyChange,
  apiKeyError,
}: SearchProviderConfigProps) {
  const googleParts = provider === 'google' ? splitGoogleKey(apiKey) : { key: '', cx: '' };

  function handleGoogleKeyChange(field: 'key' | 'cx', value: string) {
    const current = splitGoogleKey(apiKey);
    const updated = { ...current, [field]: value };
    onApiKeyChange(`${updated.key}|||${updated.cx}`);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Provider selector */}
      <div>
        <label htmlFor="search-provider" style={labelStyle}>
          Search Provider
        </label>
        <select
          id="search-provider"
          value={provider}
          onChange={(e) => {
            onProviderChange(e.target.value as SearchProviderType);
            onApiKeyChange(''); // reset key when switching provider
          }}
          style={inputStyle}
        >
          <option value="duckduckgo">DuckDuckGo (free, no key required)</option>
          <option value="perplexity">Perplexity AI (API key required)</option>
          <option value="google">Google Custom Search (API key + CX required)</option>
        </select>
      </div>

      {/* DuckDuckGo: no key needed */}
      {provider === 'duckduckgo' && (
        <p style={hintStyle}>
          DuckDuckGo search is proxied through the app — no API key needed.
        </p>
      )}

      {/* Perplexity: single API key */}
      {provider === 'perplexity' && (
        <div>
          <label htmlFor="search-api-key" style={labelStyle}>
            Perplexity API Key
          </label>
          <input
            id="search-api-key"
            type="password"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="pplx-..."
            autoComplete="off"
            aria-invalid={!!apiKeyError}
            style={apiKeyError ? inputErrorStyle : inputStyle}
          />
          {apiKeyError && (
            <span role="alert" style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '2px', display: 'block' }}>
              {apiKeyError}
            </span>
          )}
          <p style={hintStyle}>
            Get your key at perplexity.ai/settings/api
          </p>
        </div>
      )}

      {/* Google: API key + CX (Search Engine ID) */}
      {provider === 'google' && (
        <>
          <div>
            <label htmlFor="google-api-key" style={labelStyle}>
              Google API Key
            </label>
            <input
              id="google-api-key"
              type="password"
              value={googleParts.key}
              onChange={(e) => handleGoogleKeyChange('key', e.target.value)}
              placeholder="AIza..."
              autoComplete="off"
              aria-invalid={!!apiKeyError}
              style={apiKeyError ? inputErrorStyle : inputStyle}
            />
            {apiKeyError && (
              <span role="alert" style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '2px', display: 'block' }}>
                {apiKeyError}
              </span>
            )}
          </div>
          <div>
            <label htmlFor="google-cx" style={labelStyle}>
              Search Engine ID (cx)
            </label>
            <input
              id="google-cx"
              type="text"
              value={googleParts.cx}
              onChange={(e) => handleGoogleKeyChange('cx', e.target.value)}
              placeholder="017576662512468239146:omuauf_lfve"
              autoComplete="off"
              style={inputStyle}
            />
            <p style={hintStyle}>
              Create a Programmable Search Engine at programmablesearchengine.google.com
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default SearchProviderConfig;
