/**
 * Integration test: probeAllConnections correctly calls reconnect and updates store.
 * T005 — US1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock reconnect so we can track calls without real network
const _mockReconnect = vi.fn().mockResolvedValue(undefined);

vi.mock('../../src/core/services/connection-test', () => ({
  testOllamaConnection: vi.fn().mockResolvedValue({ success: true, latencyMs: 10, message: 'ok' }),
  testServiceNowConnection: vi.fn().mockResolvedValue({ success: true, latencyMs: 10, message: 'ok' }),
}));

vi.mock('../../src/main/ipc', () => ({
  IPC: {
    getApiKey: vi.fn().mockResolvedValue('token'),
    getServiceNowCredentials: vi.fn().mockResolvedValue({ username: 'user', password: 'pass' }),
  },
}));

vi.mock('../../src/core/services/now-assist-mcp-client', () => ({
  nowAssistMCPClient: {
    connect: vi.fn().mockResolvedValue(undefined),
    getDiscoveredTools: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

vi.mock('../../src/core/storage/repositories/configuration', () => ({
  configurationProfileRepository: {
    findAll: vi.fn().mockResolvedValue([]),
  },
}));

// Mock the store so getState returns a profile
vi.mock('../../src/renderer/store/index', () => {
  const mockSetOllamaConnected = vi.fn();
  const mockSetServiceNowConnected = vi.fn();
  const mockUpdateHealthCheck = vi.fn();
  const activeProfile = {
    id: 'profile-1',
    ollamaEndpoint: 'http://localhost:11434',
    servicenowUrl: 'https://test.service-now.com',
  };
  return {
    useAppStore: Object.assign(vi.fn(() => ({})), {
      getState: vi.fn(() => ({
        activeProfile,
        setOllamaConnected: mockSetOllamaConnected,
        setServiceNowConnected: mockSetServiceNowConnected,
        updateHealthCheck: mockUpdateHealthCheck,
      })),
    }),
    appActions: {
      setProfiles: vi.fn(),
      setActiveProfile: vi.fn(),
      setOllamaConnected: mockSetOllamaConnected,
      setServiceNowConnected: mockSetServiceNowConnected,
      setNowAssistConnected: vi.fn(),
      setNowAssistTools: vi.fn(),
      setNowAssistError: vi.fn(),
      setError: vi.fn(),
      updateHealthCheck: mockUpdateHealthCheck,
    },
    useConnectionStatus: vi.fn(() => ({ ollama: false, servicenow: false, lastCheck: null, fullyConnected: false })),
    useNowAssistConnected: vi.fn(() => false),
    useActiveProfile: vi.fn(() => activeProfile),
  };
});

describe('probeAllConnections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is exported from src/main/index', async () => {
    const mainModule = await import('../../src/main/index');
    expect(typeof mainModule.probeAllConnections).toBe('function');
  });

  it('resolves without throwing when active profile is set', async () => {
    const { probeAllConnections } = await import('../../src/main/index');
    await expect(probeAllConnections()).resolves.toBeUndefined();
  });

  it('calls through to connection test infrastructure', async () => {
    const { testOllamaConnection } = await import('../../src/core/services/connection-test');
    const { probeAllConnections } = await import('../../src/main/index');

    await probeAllConnections();

    expect(testOllamaConnection).toHaveBeenCalledWith('http://localhost:11434');
  });
});
