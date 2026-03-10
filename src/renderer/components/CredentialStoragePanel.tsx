/**
 * T013: Credential Storage panel — lets the user select the active credential backend.
 *
 * Displays provider cards for OS Keychain, 1Password, and Bitwarden.
 * Reads and writes the default provider via credential-router / Zustand.
 *
 * When the user selects a different provider and clicks Save, a migration modal
 * is shown. The credentials are migrated before the default provider is changed.
 */

import { useState } from 'react';
import { useAppStore, useProviderConfig } from '../store/index';
import { setDefaultProvider, migrateCredentials } from '../../core/services/credential-router';
import type { ProviderId, ProviderStatus } from '../../core/services/credential-provider';
import { PROVIDER_DISPLAY_NAMES } from '../../core/services/credential-provider';
import type { MigrateCredentialsResult } from '../../core/services/credential-router';
import { CredentialMigrationModal } from './CredentialMigrationModal';

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ProviderStatus }) {
  let label: string;
  let bg: string;
  let color: string;

  if (!status.isInstalled) {
    label = 'Not installed';
    bg = '#f3f4f6';
    color = '#6b7280';
  } else if (!status.isAuthenticated) {
    label = 'Locked';
    bg = '#fef9c3';
    color = '#92400e';
  } else {
    label = 'Ready';
    bg = '#d1fae5';
    color = '#065f46';
  }

  return (
    <span
      style={{
        fontSize: '0.75rem',
        fontWeight: 600,
        backgroundColor: bg,
        color,
        padding: '2px 8px',
        borderRadius: '9999px',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

// ── Provider card ─────────────────────────────────────────────────────────────

interface ProviderCardProps {
  status: ProviderStatus;
  isSelected: boolean;
  onSelect: () => void;
}

function ProviderCard({ status, isSelected, onSelect }: ProviderCardProps) {
  const isReady = status.isInstalled && status.isAuthenticated;

  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '12px 16px',
        border: `1px solid ${isSelected ? '#10b981' : '#e5e7eb'}`,
        borderRadius: '8px',
        backgroundColor: isSelected ? '#f0fdf4' : '#ffffff',
        cursor: isReady ? 'pointer' : 'default',
        opacity: isReady || isSelected ? 1 : 0.6,
      }}
    >
      <input
        type="radio"
        name="credential-provider"
        value={status.id}
        checked={isSelected}
        disabled={!isReady}
        onChange={onSelect}
        style={{ marginTop: '2px', accentColor: '#10b981' }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
            {status.displayName}
          </span>
          <StatusBadge status={status} />
        </div>
        {status.errorMessage && !isSelected && (
          <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0, fontStyle: 'italic' }}>
            {status.errorMessage}
          </p>
        )}
      </div>
    </label>
  );
}

// ── Static fallback entries for providers not yet fetched ─────────────────────

const PROVIDER_IDS: ProviderId[] = ['keychain', '1password', 'bitwarden'];

function buildFallbackStatus(id: ProviderId): ProviderStatus {
  return {
    id,
    displayName: PROVIDER_DISPLAY_NAMES[id],
    isInstalled: id === 'keychain',
    isAuthenticated: id === 'keychain',
    errorMessage: id === 'keychain' ? null : 'Status not yet loaded',
  };
}

// ── Main component ────────────────────────────────────────────────────────────

export function CredentialStoragePanel() {
  const { defaultProvider, providerStatuses } = useProviderConfig();
  const { setDefaultProvider: storeSetDefaultProvider } = useAppStore();

  const [selected, setSelected] = useState<ProviderId>(defaultProvider);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Migration modal state
  const [migrationModalOpen, setMigrationModalOpen] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<ProviderId | null>(null);

  // Build display list — fall back to stubs when statuses haven't loaded yet
  const statusMap = new Map(providerStatuses.map((s) => [s.id, s]));
  const displayStatuses: ProviderStatus[] = PROVIDER_IDS.map(
    (id) => statusMap.get(id) ?? buildFallbackStatus(id),
  );

  const selectedStatus = displayStatuses.find((s) => s.id === selected);
  const canSave = selectedStatus?.isInstalled && selectedStatus.isAuthenticated && !saving;

  // Is the newly selected provider different from the currently active one?
  const isProviderChange = selected !== defaultProvider;

  async function handleSave() {
    if (isProviderChange) {
      // Open migration modal instead of saving immediately
      setPendingProvider(selected);
      setMigrationModalOpen(true);
      return;
    }

    // Same provider — just persist (no migration needed)
    await persistProvider(selected);
  }

  async function persistProvider(providerId: ProviderId) {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await setDefaultProvider(providerId);
      storeSetDefaultProvider(providerId);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save provider');
    } finally {
      setSaving(false);
    }
  }

  async function handleMigrationConfirm(bwSession?: string): Promise<MigrateCredentialsResult> {
    const result = await migrateCredentials(pendingProvider!, bwSession);

    if (result.providerChanged) {
      // Migration succeeded — update DB + store
      await persistProvider(pendingProvider!);
    } else if (result.failed.length > 0) {
      // Partial / full failure — revert UI selection back to current provider
      setSelected(defaultProvider);
      setSaveError(
        `Migration failed: ${result.failed.length} credential(s) could not be moved.`,
      );
    }

    return result;
  }

  function handleMigrationCancel() {
    // Revert UI selection to whatever is currently saved
    setSelected(defaultProvider);
    setMigrationModalOpen(false);
    setPendingProvider(null);
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
          Choose where credentials (ServiceNow passwords, API keys) are stored on this device.
        </p>

        {displayStatuses.map((status) => (
          <ProviderCard
            key={status.id}
            status={status}
            isSelected={selected === status.id}
            onSelect={() => setSelected(status.id)}
          />
        ))}

        {saveError && (
          <p role="alert" style={{ fontSize: '0.875rem', color: '#dc2626', margin: 0 }}>
            {saveError}
          </p>
        )}

        {saveSuccess && (
          <p
            role="status"
            style={{ fontSize: '0.875rem', color: '#065f46', margin: 0 }}
          >
            Credential storage provider saved.
          </p>
        )}

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!canSave}
            style={{
              padding: '7px 16px',
              backgroundColor: canSave ? '#10b981' : '#d1d5db',
              color: canSave ? '#ffffff' : '#9ca3af',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: canSave ? 'pointer' : 'not-allowed',
            }}
          >
            {saving ? 'Saving…' : isProviderChange ? 'Migrate & Save' : 'Save'}
          </button>
          {!canSave && !saving && (
            <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              Selected provider must be ready before saving.
            </span>
          )}
        </div>
      </div>

      {migrationModalOpen && pendingProvider !== null && (
        <CredentialMigrationModal
          isOpen={migrationModalOpen}
          fromProvider={defaultProvider}
          toProvider={pendingProvider}
          onConfirm={handleMigrationConfirm}
          onCancel={handleMigrationCancel}
        />
      )}
    </>
  );
}

export default CredentialStoragePanel;
