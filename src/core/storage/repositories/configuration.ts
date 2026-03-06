import { eq } from 'drizzle-orm';
import { getDatabase } from '../database';
import {
  configurationProfiles,
  type ConfigurationProfile,
  type NewConfigurationProfile,
} from '../schema';
import { logger } from '../../../utils/logger';

/**
 * Repository for Configuration Profile CRUD operations
 * Manages ServiceNow instance and Ollama configuration profiles
 */
export class ConfigurationProfileRepository {
  /**
   * Create a new configuration profile
   * If this is the first profile or isActive is true, set it as active
   */
  async create(data: Omit<NewConfigurationProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<ConfigurationProfile> {
    logger.debug('Creating configuration profile', { name: data.name });
    const db = await getDatabase();

    // Check if this should be the active profile
    const existingProfiles = await db.select().from(configurationProfiles);
    const shouldBeActive = existingProfiles.length === 0 || data.isActive === true;

    // If setting as active, deactivate all others
    if (shouldBeActive) {
      await db
        .update(configurationProfiles)
        .set({ isActive: false })
        .where(eq(configurationProfiles.isActive, true));
    }

    const now = new Date();
    const newProfile: NewConfigurationProfile = {
      id: crypto.randomUUID(),
      ...data,
      isActive: shouldBeActive,
      createdAt: now,
      updatedAt: now,
    };

    const [created] = await db
      .insert(configurationProfiles)
      .values(newProfile)
      .returning();

    if (!created) {
      throw new Error('Failed to create configuration profile');
    }

    logger.info('Configuration profile created', { id: created.id, name: created.name });
    return created;
  }

  /**
   * Get a configuration profile by ID
   */
  async findById(id: string): Promise<ConfigurationProfile | undefined> {
    const db = await getDatabase();

    const [profile] = await db
      .select()
      .from(configurationProfiles)
      .where(eq(configurationProfiles.id, id))
      .limit(1);

    return profile;
  }

  /**
   * Get the currently active configuration profile
   */
  async findActive(): Promise<ConfigurationProfile | undefined> {
    const db = await getDatabase();

    const [profile] = await db
      .select()
      .from(configurationProfiles)
      .where(eq(configurationProfiles.isActive, true))
      .limit(1);

    return profile;
  }

  /**
   * Get all configuration profiles
   */
  async findAll(): Promise<ConfigurationProfile[]> {
    const db = await getDatabase();

    return await db
      .select()
      .from(configurationProfiles)
      .orderBy(configurationProfiles.createdAt);
  }

  /**
   * Update a configuration profile
   * Updates the updatedAt timestamp automatically
   */
  async update(
    id: string,
    data: Partial<Omit<ConfigurationProfile, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ConfigurationProfile> {
    logger.debug('Updating configuration profile', { id });
    const db = await getDatabase();

    // If setting as active, deactivate all others first
    if (data.isActive === true) {
      await db
        .update(configurationProfiles)
        .set({ isActive: false })
        .where(eq(configurationProfiles.isActive, true));
    }

    const [updated] = await db
      .update(configurationProfiles)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(configurationProfiles.id, id))
      .returning();

    if (!updated) {
      throw new Error(`Configuration profile not found: ${id}`);
    }

    logger.info('Configuration profile updated', { id });
    return updated;
  }

  /**
   * Set a profile as the active one
   * Deactivates all other profiles
   */
  async setActive(id: string): Promise<ConfigurationProfile> {
    const db = await getDatabase();

    // Verify profile exists
    const profile = await this.findById(id);
    if (!profile) {
      throw new Error(`Configuration profile not found: ${id}`);
    }

    // Deactivate all profiles
    await db
      .update(configurationProfiles)
      .set({ isActive: false })
      .where(eq(configurationProfiles.isActive, true));

    // Activate the selected profile
    return await this.update(id, { isActive: true });
  }

  /**
   * Delete a configuration profile
   * Cannot delete the active profile unless it's the only one
   */
  async delete(id: string): Promise<boolean> {
    logger.debug('Deleting configuration profile', { id });
    const db = await getDatabase();

    const profile = await this.findById(id);
    if (!profile) {
      logger.warn('Attempted to delete non-existent configuration profile', { id });
      return false;
    }

    // Check if trying to delete the active profile
    if (profile.isActive) {
      const allProfiles = await this.findAll();
      if (allProfiles.length > 1) {
        throw new Error('Cannot delete active profile. Set another profile as active first.');
      }
    }

    await db
      .delete(configurationProfiles)
      .where(eq(configurationProfiles.id, id));

    logger.info('Configuration profile deleted', { id });
    return true;
  }

  /**
   * Test connection to ServiceNow instance
   * Returns true if connection successful, throws error otherwise
   */
  async testServiceNowConnection(profileId: string): Promise<boolean> {
    const profile = await this.findById(profileId);
    if (!profile) {
      throw new Error(`Configuration profile not found: ${profileId}`);
    }

    // This will be implemented when ServiceNow client is ready (T025)
    // For now, just validate the URL format
    try {
      new URL(profile.servicenowUrl);
      return true;
    } catch {
      throw new Error('Invalid ServiceNow URL format');
    }
  }

  /**
   * Test connection to Ollama instance
   * Returns true if connection successful, throws error otherwise
   */
  async testOllamaConnection(profileId: string): Promise<boolean> {
    const profile = await this.findById(profileId);
    if (!profile) {
      throw new Error(`Configuration profile not found: ${profileId}`);
    }

    // This will be implemented when Ollama client is ready (T024)
    // For now, just validate the URL format
    try {
      new URL(profile.ollamaEndpoint);
      return true;
    } catch {
      throw new Error('Invalid Ollama endpoint URL format');
    }
  }

  /**
   * Get profiles by search provider
   */
  async findBySearchProvider(provider: 'duckduckgo' | 'perplexity' | 'google'): Promise<ConfigurationProfile[]> {
    const db = await getDatabase();

    return await db
      .select()
      .from(configurationProfiles)
      .where(eq(configurationProfiles.searchProvider, provider));
  }

  /**
   * Count total profiles
   */
  async count(): Promise<number> {
    const db = await getDatabase();

    const result = await db
      .select()
      .from(configurationProfiles);

    return result.length;
  }
}

// Export a singleton instance
export const configurationProfileRepository = new ConfigurationProfileRepository();
