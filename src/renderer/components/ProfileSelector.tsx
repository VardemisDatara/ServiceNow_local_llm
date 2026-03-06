import { useState } from 'react';
import type { ConfigurationProfile } from '../../models/Configuration';
import { useProfiles, useActiveProfile, useAppStore } from '../store/index';
import { configurationProfileRepository } from '../../core/storage/repositories/configuration';
import { logger } from '../../utils/logger';

/**
 * T038: ProfileSelector component
 * Allows switching between saved configuration profiles
 */

interface ProfileSelectorProps {
  onProfileChange?: (profile: ConfigurationProfile) => void;
}

export function ProfileSelector({ onProfileChange }: ProfileSelectorProps) {
  const profiles = useProfiles();
  const activeProfile = useActiveProfile();
  const { setActiveProfile, updateProfile, setError } = useAppStore();
  const [switching, setSwitching] = useState(false);

  if (profiles.length === 0) {
    return null;
  }

  async function handleSwitch(profileId: string) {
    if (switching || profileId === activeProfile?.id) return;

    setSwitching(true);
    try {
      const updated = await configurationProfileRepository.setActive(profileId);
      setActiveProfile(updated);
      updateProfile(updated.id, { isActive: true });

      // Mark previous active as inactive in store
      if (activeProfile) {
        updateProfile(activeProfile.id, { isActive: false });
      }

      logger.info('Switched active profile', { profileId });
      onProfileChange?.(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to switch profile';
      logger.error('Failed to switch profile', { profileId }, err as Error);
      setError(message, 'PROFILE_SWITCH_FAILED');
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div
      className="profile-selector"
      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
    >
      <label
        htmlFor="profile-select"
        style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}
      >
        Profile:
      </label>
      <select
        id="profile-select"
        value={activeProfile?.id ?? ''}
        disabled={switching}
        onChange={(e) => handleSwitch(e.target.value)}
        aria-label="Select configuration profile"
        style={{
          fontSize: '0.875rem',
          padding: '4px 8px',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          backgroundColor: '#ffffff',
          color: '#374151',
          cursor: switching ? 'wait' : 'pointer',
        }}
      >
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.name}
            {profile.isActive ? ' (active)' : ''}
          </option>
        ))}
      </select>
      {switching && (
        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Switching...</span>
      )}
    </div>
  );
}

export default ProfileSelector;
