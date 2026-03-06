/**
 * Unit tests for NowAssistMCPClient (Rust-proxy edition)
 *
 * The client now delegates all network calls to IPC.nowAssistConnect and
 * IPC.nowAssistCallTool (Tauri commands that run in Rust via reqwest).
 * No MCP SDK usage remains — mocks target the IPC module instead.
 *
 * Tests cover: connect success, unreachable endpoint, auth failure,
 * callTool success, tool error, rate limit, NOT_CONNECTED guard,
 * testConnection, disconnect, getDiscoveredTools.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NowAssistMCPClient,
  NowAssistRateLimitError,
} from '../../../src/core/services/now-assist-mcp-client';

// ─── Mock IPC module ──────────────────────────────────────────────────────────

const mockNowAssistConnect = vi.fn();
const mockNowAssistCallTool = vi.fn();

vi.mock('../../../src/main/ipc', () => ({
  IPC: {
    nowAssistConnect: (...args: unknown[]) => mockNowAssistConnect(...args),
    nowAssistCallTool: (...args: unknown[]) => mockNowAssistCallTool(...args),
  },
}));

// ─── Mock logger ──────────────────────────────────────────────────────────────

vi.mock('../../../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const validConfig = {
  endpoint: 'https://myinstance.service-now.com/sncapps/mcp-server/mcp/external_llm_mcp',
  token: 'my-secret-token',
  authMode: 'apikey' as const,
};

const mockToolsRaw = [
  {
    name: 'summarize_incident',
    description: 'Summarize a security incident',
    input_schema: { type: 'object', properties: { incident_id: { type: 'string' } }, required: ['incident_id'] },
  },
  {
    name: 'analyze_threat',
    description: 'Analyze a potential threat',
    input_schema: { type: 'object', properties: { threat_id: { type: 'string' } } },
  },
];

function setupSuccessfulConnect() {
  mockNowAssistConnect.mockResolvedValue({ tools: mockToolsRaw, tool_count: 2 });
}

function setupSuccessfulCallTool(content = 'Tool result text', isError = false) {
  mockNowAssistCallTool.mockResolvedValue({ content, is_error: isError, latency_ms: 42 });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('NowAssistMCPClient', () => {
  let client: NowAssistMCPClient;

  beforeEach(() => {
    client = new NowAssistMCPClient();
    vi.clearAllMocks();
    setupSuccessfulConnect();
  });

  afterEach(() => {
    if (client.isConnected()) {
      client.disconnect();
    }
  });

  // ── connect() success ──────────────────────────────────────────────────────

  it('connect(): establishes connection and discovers tools', async () => {
    await client.connect(validConfig);

    expect(client.isConnected()).toBe(true);
    expect(client.getDiscoveredTools()).toHaveLength(2);
    expect(client.getDiscoveredTools()[0]?.name).toBe('summarize_incident');
  });

  it('connect(): passes endpoint, token and authMode to IPC', async () => {
    await client.connect(validConfig);

    expect(mockNowAssistConnect).toHaveBeenCalledWith(
      validConfig.endpoint,
      validConfig.token,
      validConfig.authMode,
    );
  });

  it('connect(): disconnects existing session before reconnecting', async () => {
    await client.connect(validConfig);
    expect(client.isConnected()).toBe(true);

    await client.connect({ ...validConfig, token: 'new-token' });

    expect(client.isConnected()).toBe(true);
    expect(mockNowAssistConnect).toHaveBeenCalledTimes(2);
  });

  // ── connect() error paths ─────────────────────────────────────────────────

  it('connect(): throws ENDPOINT_UNREACHABLE on generic network error', async () => {
    mockNowAssistConnect.mockRejectedValue(new Error('Network timeout'));

    await expect(client.connect(validConfig)).rejects.toMatchObject({
      code: 'ENDPOINT_UNREACHABLE',
    });
    expect(client.isConnected()).toBe(false);
  });

  it('connect(): throws AUTH_FAILED on 401 error', async () => {
    mockNowAssistConnect.mockRejectedValue(new Error('HTTP 401 Unauthorized'));

    await expect(client.connect(validConfig)).rejects.toMatchObject({
      code: 'AUTH_FAILED',
    });
    expect(client.isConnected()).toBe(false);
  });

  it('connect(): throws AUTH_FAILED on 403 error', async () => {
    mockNowAssistConnect.mockRejectedValue(new Error('HTTP 403 Forbidden'));

    await expect(client.connect(validConfig)).rejects.toMatchObject({
      code: 'AUTH_FAILED',
    });
  });

  it('connect(): throws TOOL_DISCOVERY_FAILED when error mentions tools/list', async () => {
    mockNowAssistConnect.mockRejectedValue(new Error('MCP tools/list failed: invalid cursor'));

    await expect(client.connect(validConfig)).rejects.toMatchObject({
      code: 'TOOL_DISCOVERY_FAILED',
    });
  });

  // ── callTool() success ────────────────────────────────────────────────────

  it('callTool(): returns formatted result from Rust command', async () => {
    await client.connect(validConfig);
    setupSuccessfulCallTool('Incident INC001: Critical — brute force attack detected');

    const result = await client.callTool({ name: 'summarize_incident', arguments: { incident_id: 'INC001' } });

    expect(result.toolName).toBe('summarize_incident');
    expect(result.content).toContain('brute force attack detected');
    expect(result.isError).toBe(false);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('callTool(): propagates isError=true from tool result', async () => {
    await client.connect(validConfig);
    setupSuccessfulCallTool('Tool execution failed: incident not found', true);

    const result = await client.callTool({ name: 'summarize_incident', arguments: { incident_id: 'MISSING' } });

    expect(result.isError).toBe(true);
  });

  it('callTool(): passes correct params to IPC', async () => {
    await client.connect(validConfig);
    setupSuccessfulCallTool();

    await client.callTool({ name: 'analyze_threat', arguments: { threat_id: 'T42' } });

    expect(mockNowAssistCallTool).toHaveBeenCalledWith(
      validConfig.endpoint,
      validConfig.token,
      validConfig.authMode,
      'analyze_threat',
      { threat_id: 'T42' },
    );
  });

  // ── callTool() error paths ────────────────────────────────────────────────

  it('callTool(): returns isError result (does not throw) on unexpected IPC failure', async () => {
    await client.connect(validConfig);
    mockNowAssistCallTool.mockRejectedValue(new Error('Network error'));

    const result = await client.callTool({ name: 'summarize_incident', arguments: {} });

    expect(result.isError).toBe(true);
    expect(result.content).toContain('Tool call failed');
  });

  it('callTool(): throws NowAssistRateLimitError on HTTP 429', async () => {
    await client.connect(validConfig);
    mockNowAssistCallTool.mockRejectedValue(
      new Error('HTTP 429 Too Many Requests, Retry-After: 30')
    );

    await expect(
      client.callTool({ name: 'summarize_incident', arguments: {} })
    ).rejects.toThrow(NowAssistRateLimitError);
  });

  it('callTool(): throws NOT_CONNECTED when not connected', async () => {
    await expect(client.callTool({ name: 'any_tool', arguments: {} })).rejects.toMatchObject({
      code: 'NOT_CONNECTED',
    });
  });

  // ── testConnection() ──────────────────────────────────────────────────────

  it('testConnection(): returns tool count without mutating instance state', async () => {
    const count = await client.testConnection(validConfig);

    expect(count).toBe(2);
    // The client instance used for the test should remain disconnected
    expect(client.isConnected()).toBe(false);
  });

  // ── disconnect() ─────────────────────────────────────────────────────────

  it('disconnect(): sets isConnected to false and clears tools', async () => {
    await client.connect(validConfig);
    expect(client.isConnected()).toBe(true);

    client.disconnect();

    expect(client.isConnected()).toBe(false);
    expect(client.getDiscoveredTools()).toHaveLength(0);
  });

  it('disconnect(): does not throw if called when not connected', () => {
    expect(() => client.disconnect()).not.toThrow();
  });

  // ── getDiscoveredTools() ──────────────────────────────────────────────────

  it('getDiscoveredTools(): returns empty array when not connected', () => {
    expect(client.getDiscoveredTools()).toEqual([]);
  });

  it('getDiscoveredTools(): returns tools after connect', async () => {
    await client.connect(validConfig);

    const tools = client.getDiscoveredTools();
    expect(tools).toHaveLength(2);
    expect(tools[0]?.name).toBe('summarize_incident');
    expect(tools[1]?.name).toBe('analyze_threat');
  });
});
