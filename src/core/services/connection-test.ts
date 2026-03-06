import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../utils/logger';
import type { ConnectionTestResult } from '../../models/Configuration';

/**
 * T031: Connection test service
 * Bridges TypeScript frontend with Tauri Rust commands to test connectivity
 */

// ============================================================================
// Tauri Command Types
// ============================================================================

interface TauriOllamaTestResult {
  success: boolean;
  version: string | null;
  models: string[];
  latency_ms: number;
  error: string | null;
}

interface TauriServiceNowTestResult {
  success: boolean;
  instance: string | null;
  latency_ms: number;
  error: string | null;
}

// ============================================================================
// Connection Test Service
// ============================================================================

/**
 * Test connection to the Ollama instance
 */
export async function testOllamaConnection(endpoint: string): Promise<ConnectionTestResult> {
  const start = Date.now();
  logger.info('Testing Ollama connection', { endpoint });

  try {
    const result = await invoke<TauriOllamaTestResult>('test_ollama_connection', { endpoint });

    if (result.success) {
      logger.info('Ollama connection test passed', {
        endpoint,
        version: result.version,
        modelCount: result.models.length,
        latencyMs: result.latency_ms,
      });
      return {
        success: true,
        latencyMs: result.latency_ms,
        message: `Connected (v${result.version ?? 'unknown'})`,
        ...(result.version !== null ? { version: result.version } : {}),
        models: result.models,
      };
    }

    logger.warn('Ollama connection test failed', { endpoint, error: result.error });
    return {
      success: false,
      latencyMs: Date.now() - start,
      message: result.error ?? 'Connection failed',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Ollama connection test threw', { endpoint }, err as Error);
    return {
      success: false,
      latencyMs: Date.now() - start,
      message: `Error: ${message}`,
    };
  }
}

/**
 * Test connection to a ServiceNow instance using stored credentials
 */
export async function testServiceNowConnection(
  instanceUrl: string,
  username: string,
  password: string
): Promise<ConnectionTestResult> {
  const start = Date.now();
  logger.info('Testing ServiceNow connection', { instanceUrl, username });

  try {
    const result = await invoke<TauriServiceNowTestResult>('test_servicenow_connection', {
      instanceUrl,
      username,
      password,
    });

    if (result.success) {
      logger.info('ServiceNow connection test passed', {
        instanceUrl,
        latencyMs: result.latency_ms,
      });
      return {
        success: true,
        latencyMs: result.latency_ms,
        message: `Connected to ${result.instance ?? instanceUrl}`,
      };
    }

    logger.warn('ServiceNow connection test failed', { instanceUrl, error: result.error });
    return {
      success: false,
      latencyMs: Date.now() - start,
      message: result.error ?? 'Connection failed',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('ServiceNow connection test threw', { instanceUrl }, err as Error);
    return {
      success: false,
      latencyMs: Date.now() - start,
      message: `Error: ${message}`,
    };
  }
}

/**
 * Test both Ollama and ServiceNow in parallel
 */
export async function testAllConnections(params: {
  ollamaEndpoint: string;
  servicenowUrl: string;
  servicenowUsername: string;
  servicenowPassword: string;
}): Promise<{
  ollama: ConnectionTestResult;
  servicenow: ConnectionTestResult;
}> {
  const [ollama, servicenow] = await Promise.all([
    testOllamaConnection(params.ollamaEndpoint),
    testServiceNowConnection(
      params.servicenowUrl,
      params.servicenowUsername,
      params.servicenowPassword
    ),
  ]);

  return { ollama, servicenow };
}
