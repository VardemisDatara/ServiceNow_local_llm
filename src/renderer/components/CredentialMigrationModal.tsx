/**
 * CredentialMigrationModal — confirmation dialog shown when the user switches
 * the global credential provider. Triggers migration via the Rust command and
 * shows per-credential progress + final summary.
 */

import { useState } from 'react';
import { PROVIDER_DISPLAY_NAMES } from '../../core/services/credential-provider';
import type { ProviderId } from '../../core/services/credential-provider';
import type { MigrateCredentialsResult } from '../../core/services/credential-router';

interface Props {
  isOpen: boolean;
  fromProvider: ProviderId;
  toProvider: ProviderId;
  /** Called with the optional Bitwarden session token. Must resolve with the migration result. */
  onConfirm: (bwSession?: string) => Promise<MigrateCredentialsResult>;
  onCancel: () => void;
}

// ── Modal state machine ───────────────────────────────────────────────────────

type ModalPhase = 'idle' | 'migrating' | 'done';

// ── Shared styles ─────────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const cardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '10px',
  padding: '24px',
  width: '440px',
  maxWidth: '90vw',
  boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const headingStyle: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 700,
  color: '#111827',
  margin: 0,
};

const bodyTextStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: '#374151',
  margin: 0,
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  justifyContent: 'flex-end',
};

const btnBase: React.CSSProperties = {
  padding: '7px 18px',
  border: 'none',
  borderRadius: '6px',
  fontSize: '0.875rem',
  fontWeight: 600,
  cursor: 'pointer',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function CredentialMigrationModal({
  isOpen,
  fromProvider,
  toProvider,
  onConfirm,
  onCancel,
}: Props) {
  const [bwSession, setBwSession] = useState('');
  const [phase, setPhase] = useState<ModalPhase>('idle');
  const [result, setResult] = useState<MigrateCredentialsResult | null>(null);
  const [invokeError, setInvokeError] = useState<string | null>(null);

  if (!isOpen) return null;

  const fromName = PROVIDER_DISPLAY_NAMES[fromProvider];
  const toName = PROVIDER_DISPLAY_NAMES[toProvider];

  async function handleConfirm() {
    setPhase('migrating');
    setInvokeError(null);
    try {
      const migrationResult = await onConfirm(
        toProvider === 'bitwarden' ? bwSession : undefined,
      );
      setResult(migrationResult);
      setPhase('done');
    } catch (err) {
      setInvokeError(err instanceof Error ? err.message : String(err));
      setPhase('done');
    }
  }

  // ── Migrating spinner ─────────────────────────────────────────────────────

  if (phase === 'migrating') {
    return (
      <div style={overlayStyle}>
        <div style={cardStyle}>
          <p style={headingStyle}>Migrating credentials…</p>
          <p style={bodyTextStyle}>
            Copying credentials from <strong>{fromName}</strong> to <strong>{toName}</strong>.
            Please wait.
          </p>
        </div>
      </div>
    );
  }

  // ── Done: invoke-level error ───────────────────────────────────────────────

  if (phase === 'done' && invokeError !== null) {
    return (
      <div style={overlayStyle}>
        <div style={cardStyle}>
          <p style={headingStyle}>Migration error</p>
          <p style={{ ...bodyTextStyle, color: '#b91c1c' }}>{invokeError}</p>
          <div style={rowStyle}>
            <button
              type="button"
              style={{ ...btnBase, backgroundColor: '#6b7280', color: '#fff' }}
              onClick={onCancel}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Done: migration result ────────────────────────────────────────────────

  if (phase === 'done' && result !== null) {
    const success = result.success && result.failed.length === 0;

    return (
      <div style={overlayStyle}>
        <div style={cardStyle}>
          <p style={headingStyle}>
            {success ? 'Migration complete' : 'Migration failed — rolled back'}
          </p>

          {success ? (
            <p style={{ ...bodyTextStyle, color: '#065f46' }}>
              {result.migrated.length} credential
              {result.migrated.length === 1 ? '' : 's'} migrated to {toName}.
            </p>
          ) : (
            <>
              <p style={{ ...bodyTextStyle, color: '#b91c1c' }}>
                The following credentials could not be migrated. Any partially-written items have
                been removed from {toName}.
              </p>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '20px',
                  fontSize: '0.8rem',
                  color: '#b91c1c',
                }}
              >
                {result.failed.map((f) => (
                  <li key={f.credentialKey}>
                    <strong>{f.credentialKey}</strong>: {f.error}
                  </li>
                ))}
              </ul>
              {result.migrated.length > 0 && (
                <p style={{ ...bodyTextStyle, color: '#6b7280' }}>
                  {result.migrated.length} credential
                  {result.migrated.length === 1 ? '' : 's'} had already been written but have been
                  rolled back.
                </p>
              )}
            </>
          )}

          <div style={rowStyle}>
            <button
              type="button"
              style={{
                ...btnBase,
                backgroundColor: success ? '#10b981' : '#6b7280',
                color: '#fff',
              }}
              onClick={onCancel}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Idle: confirmation prompt ─────────────────────────────────────────────

  const canConfirm = toProvider !== 'bitwarden' || bwSession.trim().length > 0;

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <p style={headingStyle}>Migrate credentials?</p>

        <p style={bodyTextStyle}>
          This will copy all credentials from <strong>{fromName}</strong> to{' '}
          <strong>{toName}</strong>. The originals will remain in {fromName} and can be removed
          manually after confirming the migration succeeded.
        </p>

        {toProvider === 'bitwarden' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              htmlFor="bw-session"
              style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}
            >
              Bitwarden session token{' '}
              <span style={{ fontWeight: 400, color: '#6b7280' }}>
                (from <code>bw unlock --raw</code>)
              </span>
            </label>
            <input
              id="bw-session"
              type="password"
              value={bwSession}
              onChange={(e) => setBwSession(e.target.value)}
              placeholder="Paste session token…"
              style={{
                padding: '7px 10px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontFamily: 'monospace',
              }}
            />
          </div>
        )}

        <div style={rowStyle}>
          <button
            type="button"
            style={{ ...btnBase, backgroundColor: '#f3f4f6', color: '#374151' }}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            style={{
              ...btnBase,
              backgroundColor: canConfirm ? '#10b981' : '#d1d5db',
              color: canConfirm ? '#ffffff' : '#9ca3af',
              cursor: canConfirm ? 'pointer' : 'not-allowed',
            }}
            onClick={() => void handleConfirm()}
          >
            Migrate
          </button>
        </div>
      </div>
    </div>
  );
}

export default CredentialMigrationModal;
