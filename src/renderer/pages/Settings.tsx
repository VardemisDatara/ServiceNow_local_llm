import { useState, useEffect } from 'react';
import { Configuration } from '../components/Configuration';
import { ProfileSelector } from '../components/ProfileSelector';
import { CredentialStoragePanel } from '../components/CredentialStoragePanel';
import type { ConfigurationFormValues } from '../../models/Configuration';
import { configurationProfileRepository } from '../../core/storage/repositories/configuration';
import { IPC } from '../../main/ipc';
import { useAppStore, useProfiles, useActiveProfile } from '../store/index';
import { getAvailableProviders } from '../../core/services/credential-router';
import { logger } from '../../utils/logger';

/**
 * T034: Settings page — configuration save logic
 * Orchestrates profile creation/editing and credential storage
 */

type SettingsMode = 'view' | 'edit' | 'new';

export function Settings() {
  const profiles = useProfiles();
  const activeProfile = useActiveProfile();
  const { setProfiles, setActiveProfile, addProfile, updateProfile, removeProfile, setError, clearError, setProviderStatuses } = useAppStore();
  const [mode, setMode] = useState<SettingsMode>('view');
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Load profiles on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void loadProfiles(); void loadProviderStatuses(); }, []);

  async function loadProviderStatuses() {
    try {
      const statuses = await getAvailableProviders();
      setProviderStatuses(statuses);
    } catch (err) {
      logger.warn('Failed to load provider statuses', {}, err as Error);
    }
  }

  async function loadProfiles() {
    setLoading(true);
    try {
      const all = await configurationProfileRepository.findAll();
      setProfiles(all);

      const active = all.find((p) => p.isActive) ?? all[0] ?? null;
      setActiveProfile(active ?? null);
    } catch (err) {
      logger.error('Failed to load profiles', {}, err as Error);
      setError('Failed to load configuration profiles');
    } finally {
      setLoading(false);
    }
  }

  // ============================================================================
  // Save handler — called by Configuration form
  // ============================================================================

  async function handleSave(values: ConfigurationFormValues) {
    clearError();

    if (mode === 'new') {
      await handleCreate(values);
    } else if (mode === 'edit' && activeProfile) {
      await handleUpdate(activeProfile.id, values);
    }
  }

  async function handleCreate(values: ConfigurationFormValues) {
    logger.info('Creating new configuration profile', { name: values.name });

    // 1. Create the profile record (without credentials)
    const profile = await configurationProfileRepository.create({
      name: values.name,
      servicenowUrl: values.servicenowUrl,
      servicenowCredentialRef: `profile_${Date.now()}`, // Will be overwritten with real ID
      ollamaEndpoint: values.ollamaEndpoint,
      ollamaModel: values.ollamaModel,
      searchProvider: values.searchProvider,
      searchApiKeyRef: null,
      llmProvider: values.llmProvider,
      llmApiKeyRef: null,
      ...(values.cloudLlmModel !== undefined ? { cloudLlmModel: values.cloudLlmModel } : {}),
      sessionTimeoutHours: values.sessionTimeoutHours,
      persistConversations: values.persistConversations,
      isActive: values.isActive,
    });

    // 2. Store credentials in OS keychain using profile ID as reference
    await IPC.storeServiceNowCredentials(profile.id, values.servicenowUsername, values.servicenowPassword);

    // 3. Update credential reference to use profile ID
    const updated = await configurationProfileRepository.update(profile.id, {
      servicenowCredentialRef: profile.id,
    });

    // 4. Store search API key if provided
    if (values.searchApiKey && (values.searchProvider === 'perplexity' || values.searchProvider === 'google')) {
      await IPC.storeApiKey(values.searchProvider, profile.id, values.searchApiKey);
      await configurationProfileRepository.update(profile.id, {
        searchApiKeyRef: `${values.searchProvider}_${profile.id}`,
      });
    }

    // 5. Store LLM API key if cloud provider
    if (values.llmApiKey && (values.llmProvider === 'openai' || values.llmProvider === 'mistral')) {
      await IPC.storeApiKey(`llm_${values.llmProvider}`, profile.id, values.llmApiKey);
      await configurationProfileRepository.update(profile.id, {
        llmApiKeyRef: `llm_${values.llmProvider}_${profile.id}`,
      });
    }

    addProfile(updated);
    if (updated.isActive) {
      setActiveProfile(updated);
    }

    setMode('view');
    logger.info('Profile created', { id: profile.id, name: profile.name });
  }

  async function handleUpdate(profileId: string, values: ConfigurationFormValues) {
    logger.info('Updating configuration profile', { profileId, name: values.name });

    // 1. Update profile record
    const updated = await configurationProfileRepository.update(profileId, {
      name: values.name,
      servicenowUrl: values.servicenowUrl,
      ollamaEndpoint: values.ollamaEndpoint,
      ollamaModel: values.ollamaModel,
      searchProvider: values.searchProvider,
      llmProvider: values.llmProvider,
      ...(values.cloudLlmModel !== undefined ? { cloudLlmModel: values.cloudLlmModel } : {}),
      sessionTimeoutHours: values.sessionTimeoutHours,
      persistConversations: values.persistConversations,
      isActive: values.isActive,
    });

    // 2. Update credentials if password was provided
    if (values.servicenowPassword) {
      await IPC.storeServiceNowCredentials(profileId, values.servicenowUsername, values.servicenowPassword);
    }

    // 3. Update search API key if provided
    if (values.searchApiKey && (values.searchProvider === 'perplexity' || values.searchProvider === 'google')) {
      await IPC.storeApiKey(values.searchProvider, profileId, values.searchApiKey);
      await configurationProfileRepository.update(profileId, {
        searchApiKeyRef: `${values.searchProvider}_${profileId}`,
      });
    }

    // 4. Update LLM API key if cloud provider
    if (values.llmApiKey && (values.llmProvider === 'openai' || values.llmProvider === 'mistral')) {
      await IPC.storeApiKey(`llm_${values.llmProvider}`, profileId, values.llmApiKey);
      await configurationProfileRepository.update(profileId, {
        llmApiKeyRef: `llm_${values.llmProvider}_${profileId}`,
      });
    }

    updateProfile(profileId, updated);
    if (updated.isActive) {
      setActiveProfile(updated);
    }

    setMode('view');
    logger.info('Profile updated', { id: profileId });
  }

  async function handleDelete(profileId: string) {
    try {
      await configurationProfileRepository.delete(profileId);

      // Clean up credentials
      try {
        await IPC.deleteServiceNowCredentials(profileId);
      } catch {
        // Credentials may not exist, ignore
      }

      removeProfile(profileId);

      if (activeProfile?.id === profileId) {
        const remaining = profiles.filter((p) => p.id !== profileId);
        setActiveProfile(remaining[0] ?? null);
      }

      setDeleteConfirm(null);
      logger.info('Profile deleted', { profileId });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete profile';
      setError(message);
      logger.error('Failed to delete profile', { profileId }, err as Error);
    }
  }

  // ============================================================================
  // Render
  // ============================================================================

  if (loading) {
    return (
      <div style={{ padding: '24px' }}>
        <p style={{ color: '#6b7280' }}>Loading configuration...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '700px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', margin: 0 }}>
          Configuration
        </h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {profiles.length > 1 && <ProfileSelector />}
          {mode === 'view' && (
            <>
              {activeProfile && (
                <button
                  type="button"
                  onClick={() => setMode('edit')}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    color: '#374151',
                  }}
                >
                  Edit
                </button>
              )}
              <button
                type="button"
                onClick={() => setMode('new')}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#10b981',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  color: '#ffffff',
                }}
              >
                + New Profile
              </button>
            </>
          )}
        </div>
      </div>

      {/* New / Edit Form */}
      {(mode === 'new' || mode === 'edit') && (
        <Configuration
          profile={mode === 'edit' ? activeProfile ?? undefined : undefined}
          onSave={handleSave}
          onCancel={() => setMode('view')}
          isNew={mode === 'new'}
        />
      )}

      {/* View: show active profile summary */}
      {mode === 'view' && (
        <>
          {activeProfile ? (
            <div
              style={{
                padding: '16px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                backgroundColor: '#f9fafb',
              }}
            >
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', marginTop: 0 }}>
                {activeProfile.name}
                <span
                  style={{
                    marginLeft: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    backgroundColor: '#d1fae5',
                    color: '#065f46',
                    padding: '2px 6px',
                    borderRadius: '9999px',
                  }}
                >
                  Active
                </span>
              </h3>
              <dl style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '4px 16px', fontSize: '0.875rem' }}>
                <dt style={{ color: '#6b7280', fontWeight: 600 }}>ServiceNow:</dt>
                <dd style={{ color: '#374151', margin: 0 }}>{activeProfile.servicenowUrl}</dd>
                <dt style={{ color: '#6b7280', fontWeight: 600 }}>Ollama:</dt>
                <dd style={{ color: '#374151', margin: 0 }}>{activeProfile.ollamaEndpoint}</dd>
                <dt style={{ color: '#6b7280', fontWeight: 600 }}>Model:</dt>
                <dd style={{ color: '#374151', margin: 0 }}>{activeProfile.ollamaModel}</dd>
                <dt style={{ color: '#6b7280', fontWeight: 600 }}>Search:</dt>
                <dd style={{ color: '#374151', margin: 0 }}>{activeProfile.searchProvider}</dd>
              </dl>

              {/* Delete confirmation */}
              {deleteConfirm === activeProfile.id ? (
                <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca' }}>
                  <p style={{ fontSize: '0.875rem', color: '#dc2626', margin: '0 0 8px' }}>
                    Delete this profile? This cannot be undone.
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleDelete(activeProfile.id)}
                      style={{ padding: '6px 12px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(null)}
                      style={{ padding: '6px 12px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(activeProfile.id)}
                  style={{ marginTop: '16px', padding: '6px 12px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '0.875rem', cursor: 'pointer' }}
                >
                  Delete Profile
                </button>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              <p style={{ marginBottom: '16px' }}>No configuration profile found.</p>
              <button
                type="button"
                onClick={() => setMode('new')}
                style={{ padding: '8px 16px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 600 }}
              >
                Create Your First Profile
              </button>
            </div>
          )}
        </>
      )}
      {/* Credential Storage section */}
      <details
        style={{ marginTop: '24px' }}
        onToggle={(e) => {
          if ((e.currentTarget as HTMLDetailsElement).open) {
            void loadProviderStatuses();
          }
        }}
      >
        <summary
          style={{
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 700,
            color: '#111827',
            padding: '8px 0',
            userSelect: 'none',
            listStyle: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          ▸ Credential Storage
        </summary>
        <div
          style={{
            marginTop: '12px',
            padding: '16px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            backgroundColor: '#f9fafb',
          }}
        >
          <CredentialStoragePanel />
        </div>
      </details>
    </div>
  );
}

export default Settings;
