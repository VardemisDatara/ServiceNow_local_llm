import { useState, useEffect } from 'react';
import type { ConfigurationFormValues, ConnectionState } from '../../models/Configuration';
import { DEFAULT_CONFIGURATION } from '../../models/Configuration';
import type { ConfigurationFormErrors } from '../../core/services/validation';
import {
  validateConfigurationForm,
  hasErrors,
  validateServiceNowUrl,
  validateOllamaEndpoint,
} from '../../core/services/validation';
import { testOllamaConnection, testServiceNowConnection } from '../../core/services/connection-test';
import { ConnectionStatusPanel } from './StatusIndicator';
import { SearchProviderConfig } from './SearchProviderConfig';
import { LLMProviderConfig } from './LLMProviderConfig';
import type { ConfigurationProfile } from '../../core/storage/schema';
import { configurationProfileRepository } from '../../core/storage/repositories/configuration';
import { IPC } from '../../main/ipc';
import { nowAssistMCPClient } from '../../core/services/now-assist-mcp-client';
import type { NowAssistAuthMode } from '../../core/services/now-assist-mcp-client';
import { logger } from '../../utils/logger';

/**
 * T029 + T037: Configuration UI component with error handling
 * Handles form state, validation, connection testing, and saving
 */

interface ConfigurationProps {
  profile?: ConfigurationProfile | undefined;
  onSave: (values: ConfigurationFormValues) => Promise<void>;
  onCancel?: (() => void) | undefined;
  isNew?: boolean | undefined;
}

function FieldError({ error }: { error?: string | undefined }) {
  if (!error) return null;
  return (
    <span
      role="alert"
      style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '2px', display: 'block' }}
    >
      {error}
    </span>
  );
}

function FormField({
  label,
  htmlFor,
  required,
  children,
  error,
}: {
  label: string;
  htmlFor: string;
  required?: boolean | undefined;
  children: React.ReactNode;
  error?: string | undefined;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
      <label
        htmlFor={htmlFor}
        style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}
      >
        {label}
        {required && <span style={{ color: '#ef4444', marginLeft: '2px' }} aria-hidden="true">*</span>}
      </label>
      {children}
      <FieldError error={error} />
    </div>
  );
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

export function Configuration({ profile, onSave, onCancel, isNew = false }: ConfigurationProps) {
  const [values, setValues] = useState<ConfigurationFormValues>(() => ({
    name: profile?.name ?? '',
    servicenowUrl: profile?.servicenowUrl ?? '',
    servicenowUsername: '',
    servicenowPassword: '',
    ollamaEndpoint: profile?.ollamaEndpoint ?? DEFAULT_CONFIGURATION.ollamaEndpoint,
    ollamaModel: profile?.ollamaModel ?? DEFAULT_CONFIGURATION.ollamaModel,
    searchProvider: profile?.searchProvider ?? DEFAULT_CONFIGURATION.searchProvider,
    llmProvider: profile?.llmProvider ?? DEFAULT_CONFIGURATION.llmProvider,
    ...(profile?.cloudLlmModel != null ? { cloudLlmModel: profile.cloudLlmModel } : {}),
    sessionTimeoutHours: profile?.sessionTimeoutHours ?? DEFAULT_CONFIGURATION.sessionTimeoutHours,
    persistConversations: profile?.persistConversations ?? DEFAULT_CONFIGURATION.persistConversations,
    isActive: profile?.isActive ?? DEFAULT_CONFIGURATION.isActive,
  }));

  const [errors, setErrors] = useState<ConfigurationFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [ollamaState, setOllamaState] = useState<ConnectionState>({ status: 'unknown' });
  const [servicenowState, setServicenowState] = useState<ConnectionState>({ status: 'unknown' });
  const [testing, setTesting] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // Auto-fetch models if endpoint is already set (edit mode)
  useEffect(() => {
    if (!values.ollamaEndpoint) return;
    testOllamaConnection(values.ollamaEndpoint)
      .then((result) => {
        if (result.success && result.models && result.models.length > 0) {
          setAvailableModels(result.models);
        }
      })
      .catch(() => null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update<K extends keyof ConfigurationFormValues>(key: K, value: ConfigurationFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    // Clear save error on any change
    setSaveError(null);
    // Clear field-level error on change
    if (errors[key as keyof ConfigurationFormErrors]) {
      setErrors((e) => {
        const next = { ...e };
        delete next[key as keyof ConfigurationFormErrors];
        return next;
      });
    }
  }

  // ============================================================================
  // Connection Testing
  // ============================================================================

  async function handleTestOllama() {
    const result = validateOllamaEndpoint(values.ollamaEndpoint);
    if (!result.valid) {
      if (result.error) setErrors((e) => ({ ...e, ollamaEndpoint: result.error }));
      return;
    }

    setOllamaState({ status: 'connecting' });
    setTesting(true);
    try {
      const testResult = await testOllamaConnection(values.ollamaEndpoint);
      setOllamaState({
        status: testResult.success ? 'connected' : 'failed',
        message: testResult.message,
        testedAt: new Date(),
        latencyMs: testResult.latencyMs,
      });
      if (testResult.success && testResult.models && testResult.models.length > 0) {
        setAvailableModels(testResult.models);
        if (!testResult.models.includes(values.ollamaModel)) {
          update('ollamaModel', testResult.models[0] ?? values.ollamaModel);
        }
      }
      logger.info('Ollama test complete', { success: testResult.success });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection test failed';
      setOllamaState({ status: 'failed', message, testedAt: new Date() });
    } finally {
      setTesting(false);
    }
  }

  async function handleTestServiceNow() {
    const urlResult = validateServiceNowUrl(values.servicenowUrl);
    if (!urlResult.valid) {
      if (urlResult.error) setErrors((e) => ({ ...e, servicenowUrl: urlResult.error }));
      return;
    }
    if (!values.servicenowUsername) {
      setErrors((e) => ({ ...e, servicenowUsername: 'Username is required to test connection' }));
      return;
    }
    if (!values.servicenowPassword) {
      setErrors((e) => ({ ...e, servicenowPassword: 'Password is required to test connection' }));
      return;
    }

    setServicenowState({ status: 'connecting' });
    setTesting(true);
    try {
      const testResult = await testServiceNowConnection(
        values.servicenowUrl,
        values.servicenowUsername,
        values.servicenowPassword
      );
      setServicenowState({
        status: testResult.success ? 'connected' : 'failed',
        message: testResult.message,
        testedAt: new Date(),
        latencyMs: testResult.latencyMs,
      });
      logger.info('ServiceNow test complete', { success: testResult.success });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection test failed';
      setServicenowState({ status: 'failed', message, testedAt: new Date() });
    } finally {
      setTesting(false);
    }
  }

  async function handleTestAll() {
    await Promise.all([handleTestOllama(), handleTestServiceNow()]);
  }

  // ============================================================================
  // Form Submit
  // ============================================================================

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);

    const formErrors = validateConfigurationForm({
      ...values,
      isNew,
    });

    if (hasErrors(formErrors)) {
      setErrors(formErrors);
      return;
    }

    setSaving(true);
    try {
      await onSave(values);
      logger.info('Configuration saved successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save configuration';
      setSaveError(message);
      logger.error('Configuration save failed', {}, err as Error);
    } finally {
      setSaving(false);
    }
  }

  // ============================================================================
  // Render
  // ============================================================================

  const buttonStyle: React.CSSProperties = {
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label={isNew ? 'New configuration profile' : 'Edit configuration profile'}
      style={{ maxWidth: '600px' }}
    >
      {/* ── Profile Name ── */}
      <FormField label="Profile Name" htmlFor="profile-name" required error={errors.name}>
        <input
          id="profile-name"
          type="text"
          value={values.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder="e.g. Production Instance"
          autoComplete="off"
          aria-required="true"
          aria-invalid={!!errors.name}
          style={errors.name ? inputErrorStyle : inputStyle}
        />
      </FormField>

      {/* ── ServiceNow Section ── */}
      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>
        ServiceNow Connection
      </h3>

      <FormField label="Instance URL" htmlFor="sn-url" required error={errors.servicenowUrl}>
        <input
          id="sn-url"
          type="url"
          value={values.servicenowUrl}
          onChange={(e) => update('servicenowUrl', e.target.value)}
          placeholder="https://dev12345.service-now.com"
          autoComplete="url"
          aria-required="true"
          aria-invalid={!!errors.servicenowUrl}
          style={errors.servicenowUrl ? inputErrorStyle : inputStyle}
        />
      </FormField>

      <FormField label="Username" htmlFor="sn-username" required error={errors.servicenowUsername}>
        <input
          id="sn-username"
          type="text"
          value={values.servicenowUsername}
          onChange={(e) => update('servicenowUsername', e.target.value)}
          placeholder="admin"
          autoComplete="username"
          aria-required="true"
          aria-invalid={!!errors.servicenowUsername}
          style={errors.servicenowUsername ? inputErrorStyle : inputStyle}
        />
      </FormField>

      <FormField
        label={isNew ? 'Password' : 'Password (leave blank to keep current)'}
        htmlFor="sn-password"
        required={isNew}
        error={errors.servicenowPassword}
      >
        <input
          id="sn-password"
          type="password"
          value={values.servicenowPassword}
          onChange={(e) => update('servicenowPassword', e.target.value)}
          placeholder={isNew ? 'Enter password' : '••••••••'}
          autoComplete={isNew ? 'new-password' : 'current-password'}
          aria-required={isNew}
          aria-invalid={!!errors.servicenowPassword}
          style={errors.servicenowPassword ? inputErrorStyle : inputStyle}
        />
      </FormField>

      {/* ── Ollama Section ── */}
      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', margin: '20px 0 12px' }}>
        Ollama Connection
      </h3>

      <FormField label="Ollama Endpoint" htmlFor="ollama-endpoint" required error={errors.ollamaEndpoint}>
        <input
          id="ollama-endpoint"
          type="url"
          value={values.ollamaEndpoint}
          onChange={(e) => update('ollamaEndpoint', e.target.value)}
          placeholder="http://localhost:11434"
          autoComplete="url"
          aria-required="true"
          aria-invalid={!!errors.ollamaEndpoint}
          style={errors.ollamaEndpoint ? inputErrorStyle : inputStyle}
        />
      </FormField>

      <FormField label="Default Model" htmlFor="ollama-model" required error={errors.ollamaModel}>
        {availableModels.length > 0 ? (
          <select
            id="ollama-model"
            value={values.ollamaModel}
            onChange={(e) => update('ollamaModel', e.target.value)}
            aria-required="true"
            style={errors.ollamaModel ? inputErrorStyle : inputStyle}
          >
            {availableModels.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        ) : (
          <input
            id="ollama-model"
            type="text"
            value={values.ollamaModel}
            onChange={(e) => update('ollamaModel', e.target.value)}
            placeholder="llama3.2 — test connection to see available models"
            autoComplete="off"
            aria-required="true"
            aria-invalid={!!errors.ollamaModel}
            style={errors.ollamaModel ? inputErrorStyle : inputStyle}
          />
        )}
      </FormField>

      {/* ── LLM Provider ── */}
      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', margin: '20px 0 12px' }}>
        AI Language Model
      </h3>
      <div style={{ marginBottom: '16px' }}>
        <LLMProviderConfig
          provider={values.llmProvider}
          apiKey={values.llmApiKey ?? ''}
          cloudModel={values.cloudLlmModel ?? ''}
          onProviderChange={(p) => update('llmProvider', p)}
          onApiKeyChange={(k) => update('llmApiKey', k)}
          onCloudModelChange={(m) => update('cloudLlmModel', m)}
          {...(errors.llmApiKey !== undefined ? { apiKeyError: errors.llmApiKey } : {})}
        />
      </div>

      {/* ── Search Provider ── */}
      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', margin: '20px 0 12px' }}>
        Web Search Provider
      </h3>
      <div style={{ marginBottom: '16px' }}>
        <SearchProviderConfig
          provider={values.searchProvider}
          apiKey={values.searchApiKey ?? ''}
          onProviderChange={(p) => update('searchProvider', p)}
          onApiKeyChange={(k) => update('searchApiKey', k)}
          {...(errors.searchApiKey !== undefined ? { apiKeyError: errors.searchApiKey } : {})}
        />
      </div>

      {/* ── Now Assist MCP Integration (edit mode only — needs an existing profile ID) ── */}
      {profile?.id && (
        <>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', margin: '20px 0 12px' }}>
            Now Assist MCP Integration
          </h3>
          <div style={{ marginBottom: '16px' }}>
            <NowAssistConfig
              profileId={profile.id}
              serviceNowUrl={profile.servicenowUrl}
              initialServerId={profile.nowAssistServerId ?? ''}
              initialAuthMode={(profile.nowAssistAuthMode as 'apikey' | 'bearer') ?? 'apikey'}
              initialApiKeyRef={profile.nowAssistApiKeyRef ?? null}
              initialOAuthClientId={profile.nowAssistOAuthClientId ?? null}
              initialHasOAuthSecret={!!profile.nowAssistOAuthSecretRef}
            />
          </div>
        </>
      )}

      {/* ── Connection Status ── */}
      <div style={{ margin: '20px 0' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleTestAll}
            disabled={testing}
            aria-busy={testing}
            style={{
              ...buttonStyle,
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              opacity: testing ? 0.7 : 1,
            }}
          >
            {testing ? 'Testing...' : 'Test Connections'}
          </button>
          <button
            type="button"
            onClick={handleTestOllama}
            disabled={testing}
            style={{
              ...buttonStyle,
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: '1px solid #d1d5db',
              opacity: testing ? 0.7 : 1,
            }}
          >
            Test Ollama
          </button>
          <button
            type="button"
            onClick={handleTestServiceNow}
            disabled={testing}
            style={{
              ...buttonStyle,
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: '1px solid #d1d5db',
              opacity: testing ? 0.7 : 1,
            }}
          >
            Test ServiceNow
          </button>
        </div>
        <ConnectionStatusPanel
          ollamaStatus={ollamaState.status}
          servicenowStatus={servicenowState.status}
          ollamaLatencyMs={ollamaState.latencyMs}
          servicenowLatencyMs={servicenowState.latencyMs}
        />
        {ollamaState.message && ollamaState.status === 'failed' && (
          <p role="alert" style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '4px' }}>
            Ollama: {ollamaState.message}
          </p>
        )}
        {servicenowState.message && servicenowState.status === 'failed' && (
          <p role="alert" style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '4px' }}>
            ServiceNow: {servicenowState.message}
          </p>
        )}
      </div>

      {/* ── Session Settings ── */}
      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', margin: '20px 0 12px' }}>
        Session Settings
      </h3>

      <FormField label="Session Timeout (hours)" htmlFor="session-timeout">
        <input
          id="session-timeout"
          type="number"
          min={1}
          max={168}
          value={values.sessionTimeoutHours}
          onChange={(e) => update('sessionTimeoutHours', parseInt(e.target.value, 10) || 24)}
          style={inputStyle}
        />
      </FormField>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <input
          id="persist-conversations"
          type="checkbox"
          checked={values.persistConversations}
          onChange={(e) => update('persistConversations', e.target.checked)}
          style={{ width: '16px', height: '16px' }}
        />
        <label htmlFor="persist-conversations" style={{ fontSize: '0.875rem', color: '#374151' }}>
          Persist conversations to database
        </label>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        <input
          id="is-active"
          type="checkbox"
          checked={values.isActive}
          onChange={(e) => update('isActive', e.target.checked)}
          style={{ width: '16px', height: '16px' }}
        />
        <label htmlFor="is-active" style={{ fontSize: '0.875rem', color: '#374151' }}>
          Set as active profile
        </label>
      </div>

      {/* ── Save Error ── */}
      {saveError && (
        <div
          role="alert"
          style={{
            padding: '12px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#dc2626',
            fontSize: '0.875rem',
            marginBottom: '16px',
          }}
        >
          <strong>Save failed:</strong> {saveError}
        </div>
      )}

      {/* ── Actions ── */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            style={{
              ...buttonStyle,
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: '1px solid #d1d5db',
            }}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          aria-busy={saving}
          style={{
            ...buttonStyle,
            backgroundColor: '#10b981',
            color: '#ffffff',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving...' : isNew ? 'Create Profile' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

export default Configuration;

// ─── NowAssistConfig (T019) ───────────────────────────────────────────────────

export interface NowAssistConfigProps {
  profileId: string;
  /** ServiceNow instance base URL — used to construct the MCP endpoint from the Server ID. */
  serviceNowUrl: string;
  /** MCP Server sys_id (the short ID the user enters; endpoint is derived automatically). */
  initialServerId?: string | undefined;
  initialAuthMode?: NowAssistAuthMode;
  /** Non-null means a token is saved in keychain. */
  initialApiKeyRef?: string | null;
  /** OAuth Application Registry client_id for automatic Bearer token fetch. */
  initialOAuthClientId?: string | null;
  /** True if an OAuth client_secret is stored in keychain. */
  initialHasOAuthSecret?: boolean;
  onSaved?: (endpoint: string, authMode: NowAssistAuthMode) => void;
}

/**
 * Now Assist MCP configuration sub-section shown inside the Settings page.
 * The user enters only the MCP Server sys_id — the full endpoint URL is derived
 * automatically from the profile's ServiceNow instance URL.
 *
 * In OAuth Bearer mode, the user can also enter their OAuth Application Registry
 * client_id and client_secret to fetch a Bearer token automatically.
 */
export function NowAssistConfig({
  profileId,
  serviceNowUrl,
  initialServerId = '',
  initialAuthMode = 'apikey',
  initialApiKeyRef,
  initialOAuthClientId,
  initialHasOAuthSecret = false,
  onSaved,
}: NowAssistConfigProps) {
  const [serverId, setServerId] = useState(initialServerId);
  const [authMode, setAuthMode] = useState<NowAssistAuthMode>(initialAuthMode);
  const [token, setToken] = useState('');
  const [hasStoredToken, setHasStoredToken] = useState(!!initialApiKeyRef);
  const [oauthClientId, setOauthClientId] = useState(initialOAuthClientId ?? '');
  const [oauthClientSecret, setOauthClientSecret] = useState('');
  const [hasStoredOAuthSecret, setHasStoredOAuthSecret] = useState(initialHasOAuthSecret);
  const [fetchingToken, setFetchingToken] = useState(false);
  const [fetchTokenMessage, setFetchTokenMessage] = useState<string | null>(null);
  const [browserLoginPending, setBrowserLoginPending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  /** Derive the full MCP endpoint URL from the profile's ServiceNow base URL + Server Name.
   *  ServiceNow Yokohama format: /sncapps/mcp-server/mcp/<name>  */
  const derivedEndpoint = serverId.trim()
    ? `${serviceNowUrl.replace(/\/$/, '')}/sncapps/mcp-server/mcp/${serverId.trim()}`
    : '';

  async function handleFetchToken() {
    if (!oauthClientId.trim()) {
      setFetchTokenMessage('Enter OAuth Client ID first');
      return;
    }
    const secret = oauthClientSecret
      || (hasStoredOAuthSecret ? await IPC.getApiKey('now_assist_oauth_secret', profileId).catch(() => '') : '');
    if (!secret) {
      setFetchTokenMessage('Enter OAuth Client Secret first');
      return;
    }
    setFetchingToken(true);
    setFetchTokenMessage(null);
    try {
      const creds = await IPC.getServiceNowCredentials(profileId);
      // Use Rust IPC to avoid CORS restrictions from the renderer WebView.
      const accessToken = await IPC.getNowAssistOAuthToken(
        serviceNowUrl,
        oauthClientId.trim(),
        secret,
        creds.username,
        creds.password,
      );
      setToken(accessToken);
      const isJwt = accessToken.split('.').length === 3;
      if (isJwt) {
        setFetchTokenMessage('✓ Token fetched successfully (JWT)');
      } else {
        setFetchTokenMessage(
          '⚠ Token fetched but it is NOT a JWT — the MCP endpoint requires a JWT. ' +
          'Set Token Type to "JWT" on the OAuth Application Registry record in ServiceNow.'
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const hint = msg.includes('access_denied')
        ? ' — ensure the oauth_user role is assigned to your ServiceNow account (User Administration → Users → Roles tab)'
        : '';
      setFetchTokenMessage(`Failed to fetch token: ${msg}${hint}`);
      logger.warn('Now Assist OAuth token fetch failed', {}, err instanceof Error ? err : new Error(msg));
    } finally {
      setFetchingToken(false);
    }
  }

  async function handleBrowserLogin() {
    if (!oauthClientId.trim()) {
      setFetchTokenMessage('Enter OAuth Client ID first');
      return;
    }
    const secret = oauthClientSecret
      || (hasStoredOAuthSecret ? await IPC.getApiKey('now_assist_oauth_secret', profileId).catch(() => '') : '');
    if (!secret) {
      setFetchTokenMessage('Enter OAuth Client Secret first');
      return;
    }
    setBrowserLoginPending(true);
    setFetchTokenMessage('Browser opened — log in to ServiceNow, then return here…');
    try {
      const accessToken = await IPC.nowAssistOAuthLogin(
        serviceNowUrl,
        oauthClientId.trim(),
        secret,
      );
      setToken(accessToken);
      // A valid JWT has exactly 3 dot-separated segments (header.payload.signature).
      const isJwt = accessToken.split('.').length === 3;
      if (isJwt) {
        setFetchTokenMessage('✓ Token obtained via browser login (JWT)');
      } else {
        setFetchTokenMessage(
          '⚠ Token obtained but it is NOT a JWT — the MCP endpoint will reject it. ' +
          'In ServiceNow, open the OAuth Application Registry record and set Token Type to "JWT", ' +
          'or enable OpenID Connect (OIDC) on the application so an id_token is returned.'
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFetchTokenMessage(`Browser login failed: ${msg}`);
      logger.warn('Now Assist browser OAuth login failed', {}, err instanceof Error ? err : new Error(msg));
    } finally {
      setBrowserLoginPending(false);
    }
  }

  async function handleTestConnection() {
    const resolvedToken = token || (hasStoredToken ? await IPC.getApiKey('now_assist', profileId).catch(() => '') : '');
    if (!derivedEndpoint || !resolvedToken) {
      setTestMessage('Enter Server ID and token / key first');
      setTestSuccess(false);
      return;
    }
    setTesting(true);
    setTestMessage(null);
    try {
      const count = await nowAssistMCPClient.testConnection({ endpoint: derivedEndpoint, token: resolvedToken, authMode });
      setTestMessage(`✓ Connected — ${count} tool${count !== 1 ? 's' : ''} discovered`);
      setTestSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestMessage(`Connection failed: ${msg}`);
      setTestSuccess(false);
      logger.warn('Now Assist test connection failed', {}, err instanceof Error ? err : new Error(msg));
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveMessage(null);

    // ── Phase 1: persist to keychain + DB ─────────────────────────────────────
    let newHasToken = hasStoredToken;
    let newHasSecret = hasStoredOAuthSecret;
    try {
      if (token) {
        await IPC.storeApiKey('now_assist', profileId, token);
        newHasToken = true;
      }
      if (oauthClientSecret) {
        await IPC.storeApiKey('now_assist_oauth_secret', profileId, oauthClientSecret);
        newHasSecret = true;
      }
      await configurationProfileRepository.update(profileId, {
        nowAssistEndpoint: derivedEndpoint || null,
        nowAssistServerId: serverId.trim() || null,
        nowAssistAuthMode: authMode,
        nowAssistApiKeyRef: derivedEndpoint && newHasToken ? `now_assist_${profileId}` : null,
        nowAssistOAuthClientId: oauthClientId.trim() || null,
        nowAssistOAuthSecretRef: newHasSecret ? `now_assist_oauth_secret_${profileId}` : null,
      });
      setHasStoredToken(newHasToken);
      setHasStoredOAuthSecret(newHasSecret);
      onSaved?.(derivedEndpoint, authMode);
      setSaveMessage('✓ Saved');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveMessage(`Save failed: ${msg}`);
      logger.error('Failed to save Now Assist config', {}, err as Error);
      setSaving(false);
      return;
    }

    // ── Phase 2: attempt live connection (separate from save — failure is OK) ──
    if (derivedEndpoint && newHasToken) {
      try {
        const resolvedToken = token || await IPC.getApiKey('now_assist', profileId);
        await nowAssistMCPClient.connect({ endpoint: derivedEndpoint, token: resolvedToken, authMode });
        setSaveMessage('✓ Saved & connected');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Settings are saved — only the live connection failed.
        setSaveMessage(`✓ Saved (not connected: ${msg})`);
        logger.warn('Now Assist connect after save failed', {}, err instanceof Error ? err : new Error(msg));
      }
    } else {
      nowAssistMCPClient.disconnect();
    }

    setSaving(false);
  }

  async function handleClear() {
    try {
      await IPC.deleteApiKey('now_assist', profileId);
      await IPC.deleteApiKey('now_assist_oauth_secret', profileId).catch(() => undefined);
      await configurationProfileRepository.update(profileId, {
        nowAssistEndpoint: null,
        nowAssistServerId: null,
        nowAssistApiKeyRef: null,
        nowAssistOAuthClientId: null,
        nowAssistOAuthSecretRef: null,
      });
      setServerId('');
      setToken('');
      setHasStoredToken(false);
      setOauthClientId('');
      setOauthClientSecret('');
      setHasStoredOAuthSecret(false);
      setTestMessage(null);
      setSaveMessage(null);
      setFetchTokenMessage(null);
      await nowAssistMCPClient.disconnect();
    } catch (err) {
      logger.error('Failed to clear Now Assist config', {}, err as Error);
    }
  }

  const naInputStyle: React.CSSProperties = {
    padding: '6px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '0.875rem',
    color: '#374151',
    backgroundColor: '#ffffff',
    width: '100%',
    boxSizing: 'border-box',
  };

  const naBtnBase: React.CSSProperties = {
    padding: '6px 14px',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
  };

  const naLabelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '4px',
  };

  return (
    <div>
      {/* Server ID */}
      <div style={{ marginBottom: '12px' }}>
        <label htmlFor="na-server-id" style={naLabelStyle}>
          MCP Server ID
        </label>
        <input
          id="na-server-id"
          type="text"
          value={serverId}
          onChange={(e) => setServerId(e.target.value)}
          placeholder="e.g. a1b2c3d4e5f6789012345678901234ab"
          autoComplete="off"
          style={naInputStyle}
        />
        {derivedEndpoint && (
          <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '3px 0 0' }}>
            Endpoint: {derivedEndpoint}
          </p>
        )}
      </div>

      {/* Auth mode */}
      <div style={{ marginBottom: '12px' }}>
        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>
          Authentication Mode
        </p>
        <div style={{ display: 'flex', gap: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', cursor: 'pointer' }}>
            <input
              type="radio"
              name={`na-auth-mode-${profileId}`}
              value="apikey"
              checked={authMode === 'apikey'}
              onChange={() => setAuthMode('apikey')}
            />
            API Key (x-sn-apikey)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', cursor: 'pointer' }}>
            <input
              type="radio"
              name={`na-auth-mode-${profileId}`}
              value="bearer"
              checked={authMode === 'bearer'}
              onChange={() => setAuthMode('bearer')}
            />
            OAuth Bearer
          </label>
        </div>
      </div>

      {/* OAuth credentials (Bearer mode only) */}
      {authMode === 'bearer' && (
        <div
          style={{
            marginBottom: '12px',
            padding: '12px',
            backgroundColor: '#f0f9ff',
            borderRadius: '6px',
            border: '1px solid #bae6fd',
          }}
        >
          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0369a1', margin: '0 0 10px' }}>
            OAuth Application Credentials
          </p>
          <div style={{ marginBottom: '8px' }}>
            <label htmlFor="na-oauth-client-id" style={{ ...naLabelStyle, fontSize: '0.8rem' }}>
              OAuth Client ID
            </label>
            <input
              id="na-oauth-client-id"
              type="text"
              value={oauthClientId}
              onChange={(e) => setOauthClientId(e.target.value)}
              placeholder="Paste client_id from ServiceNow OAuth Application Registry"
              autoComplete="off"
              style={{ ...naInputStyle, fontSize: '0.8rem' }}
            />
          </div>
          <div style={{ marginBottom: '8px' }}>
            <label htmlFor="na-oauth-client-secret" style={{ ...naLabelStyle, fontSize: '0.8rem' }}>
              OAuth Client Secret
            </label>
            <input
              id="na-oauth-client-secret"
              type="password"
              value={oauthClientSecret}
              onChange={(e) => setOauthClientSecret(e.target.value)}
              placeholder={hasStoredOAuthSecret ? '•••••••  (secret saved)' : 'Paste client_secret'}
              autoComplete="off"
              style={{ ...naInputStyle, fontSize: '0.8rem' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => { void handleBrowserLogin(); }}
              disabled={browserLoginPending || fetchingToken}
              aria-busy={browserLoginPending}
              style={{ ...naBtnBase, backgroundColor: '#0ea5e9', color: '#fff', opacity: (browserLoginPending || fetchingToken) ? 0.7 : 1, fontSize: '0.8rem', padding: '5px 12px' }}
            >
              {browserLoginPending ? 'Waiting for browser…' : 'Browser Login'}
            </button>
            <button
              type="button"
              onClick={() => { void handleFetchToken(); }}
              disabled={fetchingToken || browserLoginPending}
              aria-busy={fetchingToken}
              style={{ ...naBtnBase, backgroundColor: '#7c3aed', color: '#fff', opacity: (fetchingToken || browserLoginPending) ? 0.7 : 1, fontSize: '0.8rem', padding: '5px 12px' }}
            >
              {fetchingToken ? 'Fetching…' : 'Fetch Token'}
            </button>
          </div>
          {fetchTokenMessage && (
            <p style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              margin: '8px 0 0',
              color: fetchTokenMessage.startsWith('✓') ? '#16a34a'
                : fetchTokenMessage.startsWith('Browser opened') ? '#0369a1'
                : fetchTokenMessage.startsWith('⚠') ? '#b45309'
                : '#dc2626',
            }}>
              {fetchTokenMessage}
            </p>
          )}
        </div>
      )}

      {/* Token input */}
      <div style={{ marginBottom: '12px' }}>
        <label htmlFor="na-token" style={naLabelStyle}>
          {authMode === 'bearer' ? 'Bearer Token' : 'API Key'}
        </label>
        <input
          id="na-token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={hasStoredToken ? '•••••••  (saved — paste new value to replace)' : (authMode === 'bearer' ? 'Paste Bearer token or use Fetch Token above' : 'Paste API key here')}
          autoComplete="off"
          style={naInputStyle}
        />
      </div>

      {/* Test / Save result messages */}
      {testMessage && (
        <p style={{ fontSize: '0.8rem', fontWeight: 600, color: testSuccess ? '#16a34a' : '#dc2626', margin: '0 0 8px' }}>
          {testMessage}
        </p>
      )}
      {saveMessage && (
        <p style={{ fontSize: '0.8rem', fontWeight: 600, color: saveMessage.startsWith('✓') ? '#16a34a' : '#dc2626', margin: '0 0 8px' }}>
          {saveMessage}
        </p>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => { void handleTestConnection(); }}
          disabled={testing}
          aria-busy={testing}
          style={{ ...naBtnBase, backgroundColor: '#3b82f6', color: '#fff', opacity: testing ? 0.7 : 1 }}
        >
          {testing ? 'Testing…' : 'Test Connection'}
        </button>
        <button
          type="button"
          onClick={() => { void handleSave(); }}
          disabled={saving}
          aria-busy={saving}
          style={{ ...naBtnBase, backgroundColor: '#10b981', color: '#fff', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => { void handleClear(); }}
          style={{ ...naBtnBase, backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
