/**
 * Integration tests for Now Assist Settings (T018)
 *
 * Tests:
 *  - NowAssistConfig component (T019): saves nowAssistEndpoint + nowAssistAuthMode
 *    to profile and token to keychain via IPC.storeApiKey('now_assist', ...)
 *  - NowAssistConfig clears values and calls IPC.deleteApiKey('now_assist', ...)
 *  - Test Connection button calls nowAssistMCPClient.testConnection() and
 *    displays tool count on success and error message on failure
 *
 * THESE TESTS FAIL until T019 creates and exports NowAssistConfig from
 * src/renderer/components/Configuration.tsx.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockStoreApiKey = vi.fn().mockResolvedValue(undefined);
const mockDeleteApiKey = vi.fn().mockResolvedValue(undefined);
const mockGetApiKey = vi.fn().mockResolvedValue('');
const mockUpdateProfile = vi.fn().mockImplementation((id: string, vals: object) =>
  Promise.resolve({ id, ...vals }),
);
const mockTestConnection = vi.fn().mockResolvedValue(5);

vi.mock('../../src/main/ipc', () => ({
  IPC: {
    storeApiKey: mockStoreApiKey,
    deleteApiKey: mockDeleteApiKey,
    getApiKey: mockGetApiKey,
    storeServiceNowCredentials: vi.fn().mockResolvedValue(undefined),
    deleteServiceNowCredentials: vi.fn().mockResolvedValue(undefined),
    hasApiKey: vi.fn().mockResolvedValue(false),
  },
}));

vi.mock('../../src/core/storage/repositories/configuration', () => ({
  configurationProfileRepository: {
    update: mockUpdateProfile,
    findAll: vi.fn().mockResolvedValue([]),
    findActive: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'profile-1' }),
  },
}));

vi.mock('../../src/core/services/now-assist-mcp-client', () => ({
  nowAssistMCPClient: {
    testConnection: mockTestConnection,
    isConnected: vi.fn().mockReturnValue(false),
    disconnect: vi.fn().mockResolvedValue(undefined),
  },
  NowAssistConnectionError: class NowAssistConnectionError extends Error {
    constructor(msg: string, public code: string) { super(msg); }
  },
}));

vi.mock('../../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

// ─── Component under test ─────────────────────────────────────────────────────
// NowAssistConfig will be exported from Configuration.tsx after T019.
// Until then, the destructured import gives undefined → tests fail with
// "NowAssistConfig is not a function" (TDD expected failure).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { NowAssistConfig } = await import('../../src/renderer/components/Configuration').catch(
  () => ({ NowAssistConfig: undefined }),
) as { NowAssistConfig: React.FC<{
  profileId: string;
  initialEndpoint?: string;
  initialAuthMode?: 'apikey' | 'bearer';
  initialApiKeyRef?: string | null;
  onSaved?: (endpoint: string, authMode: string) => void;
}> | undefined };

// ─── Tests ─────────────────────────────────────────────────────────────────────

const defaultProps = {
  profileId: 'profile-1',
  initialEndpoint: '',
  initialAuthMode: 'apikey' as const,
  initialApiKeyRef: null,
  onSaved: vi.fn(),
};

describe('NowAssistConfig integration (T018)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiKey.mockResolvedValue('');
  });

  // ── Save credentials ──────────────────────────────────────────────────────

  it('saves endpoint, authMode to profile and token to keychain on Save', async () => {
    if (!NowAssistConfig) throw new Error('NowAssistConfig not yet exported from Configuration.tsx (T019)');

    render(<NowAssistConfig {...defaultProps} />);

    // Fill in endpoint URL
    const endpointInput = screen.getByPlaceholderText(/service-now\.com/i);
    fireEvent.change(endpointInput, {
      target: { value: 'https://dev12345.service-now.com/sncapps/mcp-server/abc123' },
    });

    // Fill in token/API key
    const tokenInput = screen.getByLabelText('Token');
    fireEvent.change(tokenInput, { target: { value: 'secret-token-value' } });

    // Click Save
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockStoreApiKey).toHaveBeenCalledWith('now_assist', 'profile-1', 'secret-token-value');
    });

    expect(mockUpdateProfile).toHaveBeenCalledWith(
      'profile-1',
      expect.objectContaining({
        nowAssistEndpoint: 'https://dev12345.service-now.com/sncapps/mcp-server/abc123',
        nowAssistAuthMode: 'apikey',
      }),
    );
  });

  it('saves bearer auth mode to profile when OAuth Bearer is selected', async () => {
    if (!NowAssistConfig) throw new Error('NowAssistConfig not yet exported from Configuration.tsx (T019)');

    render(<NowAssistConfig {...defaultProps} initialEndpoint="https://dev.service-now.com/mcp/abc" />);

    // Select bearer auth mode
    const bearerRadio = screen.getByRole('radio', { name: /oauth bearer/i });
    fireEvent.click(bearerRadio);

    const tokenInput = screen.getByLabelText('Token');
    fireEvent.change(tokenInput, { target: { value: 'bearer-oauth-token' } });

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        'profile-1',
        expect.objectContaining({ nowAssistAuthMode: 'bearer' }),
      );
    });
  });

  // ── Clear credentials ─────────────────────────────────────────────────────

  it('clears endpoint and deletes keychain entry on Clear click', async () => {
    if (!NowAssistConfig) throw new Error('NowAssistConfig not yet exported from Configuration.tsx (T019)');

    render(
      <NowAssistConfig
        {...defaultProps}
        initialEndpoint="https://dev.service-now.com/sncapps/mcp-server/abc"
        initialApiKeyRef="now_assist_profile-1"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /clear/i }));

    await waitFor(() => {
      expect(mockDeleteApiKey).toHaveBeenCalledWith('now_assist', 'profile-1');
    });

    expect(mockUpdateProfile).toHaveBeenCalledWith(
      'profile-1',
      expect.objectContaining({
        nowAssistEndpoint: null,
        nowAssistApiKeyRef: null,
      }),
    );
  });

  // ── Test Connection ───────────────────────────────────────────────────────

  it('shows discovered tool count on successful Test Connection', async () => {
    if (!NowAssistConfig) throw new Error('NowAssistConfig not yet exported from Configuration.tsx (T019)');

    mockTestConnection.mockResolvedValue(7);

    render(
      <NowAssistConfig
        {...defaultProps}
        initialEndpoint="https://dev.service-now.com/sncapps/mcp-server/abc"
      />,
    );

    // Enter token before testing
    const tokenInput = screen.getByLabelText('Token');
    fireEvent.change(tokenInput, { target: { value: 'my-api-token' } });

    fireEvent.click(screen.getByRole('button', { name: /test connection/i }));

    await waitFor(() => {
      expect(screen.getByText(/7.*(tool|discovered)|connected.*7/i)).toBeTruthy();
    });
  });

  it('shows error message on failed Test Connection', async () => {
    if (!NowAssistConfig) throw new Error('NowAssistConfig not yet exported from Configuration.tsx (T019)');

    mockTestConnection.mockRejectedValue(new Error('401 Unauthorized'));

    render(
      <NowAssistConfig
        {...defaultProps}
        initialEndpoint="https://dev.service-now.com/sncapps/mcp-server/abc"
      />,
    );

    const tokenInput = screen.getByLabelText('Token');
    fireEvent.change(tokenInput, { target: { value: 'bad-token' } });

    fireEvent.click(screen.getByRole('button', { name: /test connection/i }));

    await waitFor(() => {
      expect(screen.getByText(/unauthorized|connection.*failed|error/i)).toBeTruthy();
    });
  });

  it('testConnection is called with correct endpoint, token, and authMode', async () => {
    if (!NowAssistConfig) throw new Error('NowAssistConfig not yet exported from Configuration.tsx (T019)');

    mockTestConnection.mockResolvedValue(3);

    render(<NowAssistConfig {...defaultProps} />);

    const endpointInput = screen.getByPlaceholderText(/service-now\.com/i);
    fireEvent.change(endpointInput, {
      target: { value: 'https://myinstance.service-now.com/sncapps/mcp-server/xyz' },
    });

    const tokenInput = screen.getByLabelText('Token');
    fireEvent.change(tokenInput, { target: { value: 'test-token-123' } });

    fireEvent.click(screen.getByRole('button', { name: /test connection/i }));

    await waitFor(() => {
      expect(mockTestConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: 'https://myinstance.service-now.com/sncapps/mcp-server/xyz',
          token: 'test-token-123',
          authMode: 'apikey',
        }),
      );
    });
  });
});
