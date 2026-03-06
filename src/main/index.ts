import { configurationProfileRepository } from '../core/storage/repositories/configuration';
import { testOllamaConnection, testServiceNowConnection } from '../core/services/connection-test';
import { IPC } from './ipc';
import { appActions } from '../renderer/store/index';
import { nowAssistMCPClient } from '../core/services/now-assist-mcp-client';
import { logger } from '../utils/logger';

/**
 * T035: Auto-reconnect on app startup
 * Loads the active configuration profile and attempts to re-establish connections.
 * Database is lazily initialised by the first repository call via tauri-plugin-sql.
 */

export async function initializeApp(): Promise<void> {
  logger.info('Initializing ServiceNow Local LLM...');

  // 1. Load configuration profiles (triggers DB lazy-init via tauri-plugin-sql)
  let profiles;
  try {
    profiles = await configurationProfileRepository.findAll();
    appActions.setProfiles(profiles);
    logger.info('Profiles loaded', { count: profiles.length });
  } catch (err) {
    logger.error('Failed to load profiles', {}, err as Error);
    appActions.setError('Failed to load configuration profiles', 'DATABASE_INIT_FAILED');
    return;
  }

  // 2. Find the active profile
  const activeProfile = profiles.find((p) => p.isActive) ?? profiles[0] ?? null;
  if (!activeProfile) {
    logger.info('No configuration profile found — skipping auto-connect');
    return;
  }

  appActions.setActiveProfile(activeProfile);
  logger.info('Active profile set', { id: activeProfile.id, name: activeProfile.name });

  // 3. Attempt connections in parallel (non-blocking — failures are logged, not fatal)
  // T020: Now Assist auto-connect (runs alongside Ollama/ServiceNow reconnect)
  if (activeProfile.nowAssistEndpoint && activeProfile.nowAssistApiKeyRef) {
    connectNowAssist(activeProfile.id, activeProfile.nowAssistEndpoint, (activeProfile.nowAssistAuthMode ?? 'apikey') as 'apikey' | 'bearer')
      .catch((err) => logger.warn('Now Assist auto-connect failed', {}, err as Error));
  }

  reconnect(activeProfile.id, activeProfile.ollamaEndpoint, activeProfile.servicenowUrl).catch(
    (err) => logger.warn('Auto-reconnect failed', {}, err as Error)
  );
}

/**
 * Attempt to reconnect to both Ollama and ServiceNow for a given profile.
 * Updates global connection state based on results.
 */
export async function reconnect(
  profileId: string,
  ollamaEndpoint: string,
  servicenowUrl: string
): Promise<void> {
  logger.info('Attempting auto-reconnect', { profileId, ollamaEndpoint, servicenowUrl });

  const [ollamaResult, servicenowResult] = await Promise.allSettled([
    testOllamaConnection(ollamaEndpoint),
    reconnectServiceNow(profileId, servicenowUrl),
  ]);

  if (ollamaResult.status === 'fulfilled') {
    const r = ollamaResult.value;
    appActions.setOllamaConnected(r.success);
    if (r.success) {
      logger.info('Ollama auto-reconnect succeeded', { latencyMs: r.latencyMs });
    } else {
      logger.warn('Ollama auto-reconnect failed', { message: r.message });
    }
  } else {
    appActions.setOllamaConnected(false);
    logger.warn('Ollama auto-reconnect threw', {}, ollamaResult.reason);
  }

  if (servicenowResult.status === 'fulfilled') {
    const r = servicenowResult.value;
    appActions.setServiceNowConnected(r.success);
    if (r.success) {
      logger.info('ServiceNow auto-reconnect succeeded', { latencyMs: r.latencyMs });
    } else {
      logger.warn('ServiceNow auto-reconnect failed', { message: r.message });
    }
  } else {
    appActions.setServiceNowConnected(false);
    logger.warn('ServiceNow auto-reconnect threw', {}, servicenowResult.reason);
  }

  appActions.updateHealthCheck();
}

/**
 * T020: Auto-connect to Now Assist MCP on profile load.
 * Retrieves token from OS keychain and connects the singleton client.
 */
async function connectNowAssist(
  profileId: string,
  endpoint: string,
  authMode: 'apikey' | 'bearer',
): Promise<void> {
  let token: string;
  try {
    token = await IPC.getApiKey('now_assist', profileId);
  } catch {
    logger.warn('No Now Assist token stored for profile', { profileId });
    appActions.setNowAssistConnected(false);
    return;
  }

  try {
    await nowAssistMCPClient.connect({ endpoint, token, authMode });
    const tools = nowAssistMCPClient.getDiscoveredTools();
    appActions.setNowAssistConnected(true);
    appActions.setNowAssistTools(tools);
    appActions.setNowAssistError(null);
    logger.info('Now Assist auto-connected', { toolCount: tools.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    appActions.setNowAssistConnected(false);
    appActions.setNowAssistError(msg);
    logger.warn('Now Assist auto-connect failed', { profileId }, err instanceof Error ? err : new Error(msg));
  }
}

/**
 * Probe all configured connections (Ollama + ServiceNow) and update the Zustand store.
 * Exported for use by the Home tab refresh button.
 * Now Assist MCP state is managed by the MCP client singleton and excluded from this probe.
 * Never rejects — all errors are caught and logged internally.
 */
export async function probeAllConnections(): Promise<void> {
  const activeProfile = (await import('../renderer/store/index')).useAppStore.getState().activeProfile;
  if (!activeProfile) return;
  await reconnect(activeProfile.id, activeProfile.ollamaEndpoint, activeProfile.servicenowUrl).catch(
    (err) => logger.warn('probeAllConnections failed', {}, err as Error),
  );
}

async function reconnectServiceNow(
  profileId: string,
  servicenowUrl: string
): Promise<{ success: boolean; message: string; latencyMs: number }> {
  let credentials;
  try {
    credentials = await IPC.getServiceNowCredentials(profileId);
  } catch {
    logger.warn('No ServiceNow credentials stored for profile', { profileId });
    return { success: false, message: 'No credentials stored', latencyMs: 0 };
  }

  return testServiceNowConnection(servicenowUrl, credentials.username, credentials.password);
}
