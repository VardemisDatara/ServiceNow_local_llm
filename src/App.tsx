import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ConnectionStatusPanel } from './renderer/components/StatusIndicator';
import { useConnectionStatus, useNowAssistConnected, useActiveProfile } from './renderer/store/index';
import type { ConnectionStatus } from './models/Configuration';
import { initializeApp, probeAllConnections } from './main/index';
import { SN_THEME } from './renderer/theme';
import servicenowLogoUrl from './assets/servicenow-logo.svg';

// T127: Lazy-load heavy pages to reduce initial bundle parse time
const Settings = lazy(() => import('./renderer/pages/Settings').then((m) => ({ default: m.Settings })));
const ChatPage = lazy(() => import('./renderer/pages/ChatPage').then((m) => ({ default: m.ChatPage })));
const History = lazy(() => import('./renderer/pages/History').then((m) => ({ default: m.History })));
const SecurityPage = lazy(() => import('./renderer/pages/SecurityPage').then((m) => ({ default: m.SecurityPage })));

function PageFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af' }}>
      Loading…
    </div>
  );
}

type Page = 'home' | 'chat' | 'history' | 'security' | 'settings';

/** Map a boolean connected flag to the appropriate ConnectionStatus value.
 *  If the endpoint is not configured, show 'unknown' (Not Configured).
 *  If configured but not connected, show 'failed' (Unreachable). */
function deriveStatus(connected: boolean, hasEndpoint: boolean): ConnectionStatus {
  if (!hasEndpoint) return 'unknown';
  return connected ? 'connected' : 'failed';
}

function App() {
  const [page, setPage] = useState<Page>('home');
  const [initialized, setInitialized] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const connectionStatus = useConnectionStatus();
  const nowAssistConnected = useNowAssistConnected();
  const activeProfile = useActiveProfile();

  const initCalledRef = useRef(false);
  useEffect(() => {
    // Guard against React StrictMode double-invocation: only call initializeApp() once.
    if (initCalledRef.current) return;
    initCalledRef.current = true;
    initializeApp()
      .catch((err) => console.error('App initialization failed:', err))
      .finally(() => setInitialized(true));
  }, []);

  const navButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    backgroundColor: active ? SN_THEME.navActiveBackground : 'transparent',
    color: active ? SN_THEME.navActiveText : SN_THEME.navText,
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
  });

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Navigation Bar */}
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          borderBottom: '1px solid #1e2e30',
          backgroundColor: SN_THEME.navBackground,
        }}
        aria-label="Main navigation"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img
            src={servicenowLogoUrl}
            alt="ServiceNow"
            height={28}
            style={{ display: 'block', flexShrink: 0 }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <h1 style={{ fontSize: '1rem', fontWeight: 700, color: SN_THEME.navText, margin: 0 }}>
            ServiceNow Local LLM
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            type="button"
            onClick={() => setPage('home')}
            style={navButtonStyle(page === 'home')}
            aria-current={page === 'home' ? 'page' : undefined}
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => setPage('chat')}
            style={navButtonStyle(page === 'chat')}
            aria-current={page === 'chat' ? 'page' : undefined}
          >
            Chat
          </button>
          <button
            type="button"
            onClick={() => setPage('history')}
            style={navButtonStyle(page === 'history')}
            aria-current={page === 'history' ? 'page' : undefined}
          >
            History
          </button>
          <button
            type="button"
            onClick={() => setPage('security')}
            style={navButtonStyle(page === 'security')}
            aria-current={page === 'security' ? 'page' : undefined}
          >
            Security
          </button>
          <button
            type="button"
            onClick={() => setPage('settings')}
            style={navButtonStyle(page === 'settings')}
            aria-current={page === 'settings' ? 'page' : undefined}
          >
            Settings
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} role="main">
        {page === 'home' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            {/* Connection Status heading + refresh button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827', margin: 0 }}>
                Connection Status
              </h2>
              {activeProfile && (
                <button
                  type="button"
                  aria-label="Refresh connection status"
                  disabled={isRefreshing}
                  onClick={() => {
                    setIsRefreshing(true);
                    probeAllConnections()
                      .catch(() => undefined)
                      .finally(() => setIsRefreshing(false));
                  }}
                  style={{
                    background: 'none',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    cursor: isRefreshing ? 'default' : 'pointer',
                    fontSize: '1rem',
                    color: isRefreshing ? '#9ca3af' : '#374151',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    opacity: isRefreshing ? 0.6 : 1,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      animation: isRefreshing ? 'spin 1s linear infinite' : undefined,
                    }}
                  >
                    &#8635;
                  </span>
                  {isRefreshing ? 'Checking…' : 'Refresh'}
                </button>
              )}
            </div>

            {initialized ? (
              <>
                <ConnectionStatusPanel
                  ollamaStatus={deriveStatus(connectionStatus.ollama, !!activeProfile?.ollamaEndpoint)}
                  servicenowStatus={deriveStatus(connectionStatus.servicenow, !!activeProfile?.servicenowUrl)}
                  nowAssistMcpStatus={deriveStatus(nowAssistConnected, !!activeProfile?.nowAssistEndpoint)}
                  searchProviderName={activeProfile?.searchProvider ?? undefined}
                  searchProviderStatus={
                    activeProfile?.searchProvider
                      ? 'connected'
                      : 'unknown'
                  }
                  llmProviderName={
                    activeProfile?.llmProvider && activeProfile.llmProvider !== 'ollama'
                      ? activeProfile.llmProvider
                      : undefined
                  }
                  llmProviderStatus={
                    activeProfile?.llmProvider && activeProfile.llmProvider !== 'ollama' && activeProfile.cloudLlmModel
                      ? 'connected'
                      : undefined
                  }
                />
                {connectionStatus.lastCheck && (
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '8px' }}>
                    Last checked: {connectionStatus.lastCheck.toLocaleTimeString()}
                  </p>
                )}
              </>
            ) : (
              <p style={{ color: '#6b7280' }}>Initializing...</p>
            )}

            {/* Quick Start */}
            <div style={{ marginTop: '28px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>Quick Start</h3>
              <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <li style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.5 }}>
                  <strong>Configure your connections</strong>
                  {initialized && !connectionStatus.fullyConnected && (
                    <span style={{
                      marginLeft: '8px',
                      fontSize: '0.75rem',
                      backgroundColor: '#fef3c7',
                      color: '#92400e',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      border: '1px solid #fcd34d',
                    }}>
                      &#9888; Complete setup in{' '}
                      <button
                        type="button"
                        onClick={() => setPage('settings')}
                        style={{ color: '#92400e', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', padding: 0, textDecoration: 'underline', fontWeight: 600 }}
                      >
                        Settings
                      </button>
                    </span>
                  )}
                  <br />
                  <span style={{ color: '#6b7280' }}>Open Settings to add your Ollama endpoint, ServiceNow URL, and optional search or LLM provider keys.</span>
                </li>
                <li style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.5 }}>
                  <strong>Start a chat</strong><br />
                  <span style={{ color: '#6b7280' }}>Go to Chat to ask questions about your ServiceNow incidents, correlate events, or get AI-powered answers.</span>
                </li>
                <li style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.5 }}>
                  <strong>Run a security analysis</strong><br />
                  <span style={{ color: '#6b7280' }}>Go to Security to launch automated analysis workflows on any SIR or INC incident.</span>
                </li>
              </ol>
            </div>

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {page === 'chat' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Suspense fallback={<PageFallback />}>
              <ChatPage />
            </Suspense>
          </div>
        )}

        {page === 'history' && (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Suspense fallback={<PageFallback />}>
              <History />
            </Suspense>
          </div>
        )}

        {page === 'security' && (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Suspense fallback={<PageFallback />}>
              <SecurityPage />
            </Suspense>
          </div>
        )}

        {page === 'settings' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <Suspense fallback={<PageFallback />}>
              <Settings />
            </Suspense>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
