/**
 * CredentialProviderOverrideSelect — per-credential vault provider dropdown.
 *
 * Wire into Settings.tsx per-credential fields after US1 CredentialStoragePanel is merged.
 *
 * Shows a <select> for a single credential key that lets the user pick:
 *   - "(using default)" — no override; credential uses the global default provider
 *   - "OS Keychain"     — force this credential to keychain
 *   - "1Password"       — force this credential to 1Password
 *   - "Bitwarden"       — force this credential to Bitwarden
 *
 * Unavailable providers (not installed or not authenticated) are rendered as
 * disabled <option> elements so the user knows they exist but cannot select them.
 */

import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/index';
import {
  setCredentialProviderOverride,
  removeCredentialProviderOverride,
} from '../../core/services/credential-router';
import type { ProviderId } from '../../core/services/credential-provider';
import { PROVIDER_DISPLAY_NAMES } from '../../core/services/credential-provider';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  credentialKey: string;
}

// ── Styles (consistent with LLMProviderConfig / SearchProviderConfig) ─────────

const selectStyle: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  fontSize: '0.875rem',
  color: '#374151',
  backgroundColor: '#ffffff',
  width: '100%',
  boxSizing: 'border-box',
};

const selectErrorStyle: React.CSSProperties = {
  ...selectStyle,
  borderColor: '#ef4444',
};

const errorTextStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#ef4444',
  marginTop: '2px',
  display: 'block',
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Renders a provider dropdown for a single credential key.
 * Reads the current override and provider statuses from the Zustand store.
 * Persists changes to SQLite via credential-router.ts (no Rust round-trip).
 */
export function CredentialProviderOverrideSelect({ credentialKey }: Props) {
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // US1 agent adds providerConfig to the store.  Use optional chaining until merged.
  const { currentOverride, providerStatuses } = useAppStore(
    useShallow((state) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pc = (state as any).providerConfig as
        | {
            overrides: Record<string, ProviderId>;
            providerStatuses: Array<{
              id: ProviderId;
              isInstalled: boolean;
              isAuthenticated: boolean;
            }>;
          }
        | undefined;

      return {
        currentOverride: pc?.overrides?.[credentialKey] ?? null,
        providerStatuses: pc?.providerStatuses ?? [],
      };
    }),
  );

  // US1 agent adds setOverride / removeOverride actions to the store.
  // Access them safely via getState() so missing actions don't crash at render.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const storeActions = useAppStore.getState() as any;
  const dispatchSetOverride: ((key: string, id: ProviderId) => void) | undefined =
    storeActions.setOverride;
  const dispatchRemoveOverride: ((key: string) => void) | undefined =
    storeActions.removeOverride;

  const ALL_PROVIDERS: ProviderId[] = ['keychain', '1password', 'bitwarden'];

  function isProviderAvailable(id: ProviderId): boolean {
    if (providerStatuses.length === 0) {
      // Store not yet populated (US1 not merged) — treat keychain as always available
      return id === 'keychain';
    }
    const status = providerStatuses.find((s) => s.id === id);
    if (!status) return false;
    return status.isInstalled && status.isAuthenticated;
  }

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    setSaveError(null);
    setIsSaving(true);

    try {
      if (value === '') {
        // "(using default)" selected — remove override
        await removeCredentialProviderOverride(credentialKey);
        dispatchRemoveOverride?.(credentialKey);
      } else {
        const providerId = value as ProviderId;
        await setCredentialProviderOverride(credentialKey, providerId);
        dispatchSetOverride?.(credentialKey, providerId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSaveError(`Failed to save: ${message}`);
    } finally {
      setIsSaving(false);
    }
  }

  const selectValue = currentOverride ?? '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <select
        value={selectValue}
        onChange={handleChange}
        disabled={isSaving}
        aria-label={`Credential provider for ${credentialKey}`}
        aria-busy={isSaving}
        style={saveError ? selectErrorStyle : selectStyle}
      >
        {/* Default option — no override */}
        <option value="">(using default)</option>

        {/* One option per supported provider */}
        {ALL_PROVIDERS.map((id) => {
          const available = isProviderAvailable(id);
          return (
            <option key={id} value={id} disabled={!available}>
              {PROVIDER_DISPLAY_NAMES[id]}
              {!available ? ' (unavailable)' : ''}
            </option>
          );
        })}
      </select>

      {saveError && (
        <span role="alert" style={errorTextStyle}>
          {saveError}
        </span>
      )}
    </div>
  );
}

export default CredentialProviderOverrideSelect;
