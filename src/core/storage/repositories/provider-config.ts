import { and, eq, like } from 'drizzle-orm';
import { getDatabase } from '../database';
import { providerConfiguration, credentialProviderItemIds } from '../schema';
import type { ProviderId } from '../../services/credential-provider';
import { isProviderId } from '../../services/credential-provider';

/**
 * Repository for credential provider configuration.
 *
 * Uses the `provider_configuration` key/value table:
 *   - `default_provider`      → the active ProviderId for all credentials
 *   - `override:{key}`        → per-credential ProviderId override
 *
 * And the `credential_provider_item_ids` table for caching external UUIDs
 * (e.g. Bitwarden item IDs).
 */
export class ProviderConfigRepository {
  // ── Default provider ───────────────────────────────────────────────────────

  async getDefaultProvider(): Promise<ProviderId> {
    const db = await getDatabase();
    const [row] = await db
      .select()
      .from(providerConfiguration)
      .where(eq(providerConfiguration.key, 'default_provider'))
      .limit(1);

    if (!row) return 'keychain';

    return isProviderId(row.value) ? row.value : 'keychain';
  }

  async setDefaultProvider(id: ProviderId): Promise<void> {
    const db = await getDatabase();
    await db
      .insert(providerConfiguration)
      .values({ key: 'default_provider', value: id })
      .onConflictDoUpdate({
        target: providerConfiguration.key,
        set: { value: id },
      });
  }

  // ── Per-credential overrides ───────────────────────────────────────────────

  async getOverride(credentialKey: string): Promise<ProviderId | undefined> {
    const db = await getDatabase();
    const [row] = await db
      .select()
      .from(providerConfiguration)
      .where(eq(providerConfiguration.key, `override:${credentialKey}`))
      .limit(1);

    if (!row) return undefined;
    return isProviderId(row.value) ? row.value : undefined;
  }

  async setOverride(credentialKey: string, providerId: ProviderId): Promise<void> {
    const db = await getDatabase();
    await db
      .insert(providerConfiguration)
      .values({ key: `override:${credentialKey}`, value: providerId })
      .onConflictDoUpdate({
        target: providerConfiguration.key,
        set: { value: providerId },
      });
  }

  async removeOverride(credentialKey: string): Promise<void> {
    const db = await getDatabase();
    await db
      .delete(providerConfiguration)
      .where(eq(providerConfiguration.key, `override:${credentialKey}`));
  }

  async getAllOverrides(): Promise<Record<string, ProviderId>> {
    const db = await getDatabase();
    const rows = await db
      .select()
      .from(providerConfiguration)
      .where(like(providerConfiguration.key, 'override:%'));

    const result: Record<string, ProviderId> = {};
    for (const row of rows) {
      const credentialKey = row.key.slice('override:'.length);
      if (isProviderId(row.value)) {
        result[credentialKey] = row.value;
      }
    }
    return result;
  }

  // ── External item ID cache (Bitwarden / 1Password UUIDs) ──────────────────

  async getExternalItemId(
    credentialKey: string,
    providerId: ProviderId,
  ): Promise<string | undefined> {
    const db = await getDatabase();
    const [row] = await db
      .select()
      .from(credentialProviderItemIds)
      .where(
        and(
          eq(credentialProviderItemIds.credentialKey, credentialKey),
          eq(credentialProviderItemIds.providerId, providerId),
        ),
      )
      .limit(1);

    return row?.externalItemId;
  }

  async setExternalItemId(
    credentialKey: string,
    providerId: ProviderId,
    externalItemId: string,
  ): Promise<void> {
    const db = await getDatabase();
    await db
      .insert(credentialProviderItemIds)
      .values({ credentialKey, providerId, externalItemId })
      .onConflictDoUpdate({
        target: [
          credentialProviderItemIds.credentialKey,
          credentialProviderItemIds.providerId,
        ],
        set: { externalItemId },
      });
  }

  async removeExternalItemId(
    credentialKey: string,
    providerId: ProviderId,
  ): Promise<void> {
    const db = await getDatabase();
    await db
      .delete(credentialProviderItemIds)
      .where(
        and(
          eq(credentialProviderItemIds.credentialKey, credentialKey),
          eq(credentialProviderItemIds.providerId, providerId),
        ),
      );
  }
}

export const providerConfigRepository = new ProviderConfigRepository();
