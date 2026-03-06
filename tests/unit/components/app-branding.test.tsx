/**
 * T004 [US1]: Unit tests for nav bar branding — app rename and logo.
 * Verifies that the nav bar renders "ServiceNow Local LLM", the ServiceNow
 * logo img element, and the onError fallback. No "MCP Bridge" text anywhere.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock Tauri + store modules that App.tsx imports
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('../../../src/renderer/store/index', () => ({
  useConnectionStatus: () => ({ ollama: false, servicenow: false, lastCheck: null, fullyConnected: false }),
  useNowAssistConnected: () => false,
  useActiveProfile: () => null,
}));
vi.mock('../../../src/main/index', () => ({
  initializeApp: vi.fn().mockResolvedValue(undefined),
  probeAllConnections: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@tauri-apps/plugin-sql', () => ({ default: { load: vi.fn() } }));
vi.mock('@tauri-apps/plugin-store', () => ({ Store: vi.fn() }));

// Mock the SVG asset import
vi.mock('../../../src/assets/servicenow-logo.svg', () => ({
  default: '/servicenow-logo.svg',
}));

describe('Nav bar — app rename (US1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "ServiceNow Local LLM" as the app name', async () => {
    const { default: App } = await import('../../../src/App');
    render(<App />);
    expect(screen.getByText('ServiceNow Local LLM')).toBeTruthy();
  });

  it('does NOT render "MCP Bridge" anywhere in the nav bar', async () => {
    const { default: App } = await import('../../../src/App');
    render(<App />);
    expect(screen.queryByText(/MCP Bridge/i)).toBeNull();
  });

  it('does NOT render "servicenow MCP bridge" (case-insensitive) anywhere', async () => {
    const { default: App } = await import('../../../src/App');
    const { container } = render(<App />);
    expect(container.innerHTML).not.toMatch(/mcp bridge/i);
  });

  it('renders an img element with alt="ServiceNow" for the logo', async () => {
    const { default: App } = await import('../../../src/App');
    render(<App />);
    const img = screen.getByRole('img', { name: /servicenow/i });
    expect(img).toBeTruthy();
    expect(img.getAttribute('alt')).toBe('ServiceNow');
  });

  it('hides the logo img on error (onError sets display:none)', async () => {
    const { default: App } = await import('../../../src/App');
    render(<App />);
    const img = screen.getByRole('img', { name: /servicenow/i }) as HTMLImageElement;
    fireEvent.error(img);
    expect(img.style.display).toBe('none');
  });

  it('still shows the app name text when the logo fails to load', async () => {
    const { default: App } = await import('../../../src/App');
    render(<App />);
    const img = screen.getByRole('img', { name: /servicenow/i }) as HTMLImageElement;
    fireEvent.error(img);
    // Name text must still be visible
    expect(screen.getByText('ServiceNow Local LLM')).toBeTruthy();
  });
});
