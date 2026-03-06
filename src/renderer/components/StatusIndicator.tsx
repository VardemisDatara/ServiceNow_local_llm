import type { ConnectionStatus } from '../../models/Configuration';
import { connectionStatusLabel } from '../../models/Configuration';

/**
 * T030: StatusIndicator component
 * Shows a colored dot + label for connection status
 */

interface StatusIndicatorProps {
  label: string;
  status: ConnectionStatus;
  latencyMs?: number | undefined;
  className?: string | undefined;
}

const STATUS_COLORS: Record<ConnectionStatus, string> = {
  unknown: '#9ca3af',    // gray-400
  connecting: '#f59e0b', // amber-500
  connected: '#10b981',  // emerald-500
  failed: '#ef4444',     // red-500
  degraded: '#f97316',   // orange-500
};

export function StatusIndicator({ label, status, latencyMs, className = '' }: StatusIndicatorProps) {
  const color = STATUS_COLORS[status];
  const text = connectionStatusLabel(status);
  const isConnecting = status === 'connecting';

  return (
    <div className={`status-indicator ${className}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span
        aria-label={`${label}: ${text}`}
        style={{
          display: 'inline-block',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: color,
          flexShrink: 0,
          animation: isConnecting ? 'pulse 1.5s infinite' : undefined,
        }}
      />
      <span style={{ fontSize: '0.875rem', color: '#374151' }}>
        <strong>{label}:</strong> {text}
        {status === 'connected' && latencyMs !== undefined && (
          <span style={{ color: '#6b7280', marginLeft: '4px' }}>({latencyMs}ms)</span>
        )}
      </span>
    </div>
  );
}

// ============================================================================
// Connection Status Panel — shows both Ollama + ServiceNow at once
// ============================================================================

interface ConnectionStatusPanelProps {
  ollamaStatus: ConnectionStatus;
  servicenowStatus: ConnectionStatus;
  ollamaLatencyMs?: number | undefined;
  servicenowLatencyMs?: number | undefined;
  /** When provided, shows a Now Assist MCP status row */
  nowAssistMcpStatus?: ConnectionStatus | undefined;
  nowAssistMcpLatencyMs?: number | undefined;
  /** When provided, shows a search provider status row */
  searchProviderName?: string | undefined;
  searchProviderStatus?: ConnectionStatus | undefined;
  /** When provided, shows an LLM provider status row (T120) */
  llmProviderName?: string | undefined;
  llmProviderStatus?: ConnectionStatus | undefined;
}

export function ConnectionStatusPanel({
  ollamaStatus,
  servicenowStatus,
  ollamaLatencyMs,
  servicenowLatencyMs,
  nowAssistMcpStatus,
  nowAssistMcpLatencyMs,
  searchProviderName,
  searchProviderStatus,
  llmProviderName,
  llmProviderStatus,
}: ConnectionStatusPanelProps) {
  return (
    <div
      className="connection-status-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '12px',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        backgroundColor: '#f9fafb',
      }}
      role="status"
      aria-live="polite"
      aria-label="Connection status"
    >
      <StatusIndicator label="Ollama" status={ollamaStatus} {...(ollamaLatencyMs !== undefined ? { latencyMs: ollamaLatencyMs } : {})} />
      <StatusIndicator label="ServiceNow" status={servicenowStatus} {...(servicenowLatencyMs !== undefined ? { latencyMs: servicenowLatencyMs } : {})} />
      {nowAssistMcpStatus !== undefined && (
        <StatusIndicator label="ServiceNow MCP" status={nowAssistMcpStatus} {...(nowAssistMcpLatencyMs !== undefined ? { latencyMs: nowAssistMcpLatencyMs } : {})} />
      )}
      {searchProviderName !== undefined && searchProviderStatus !== undefined && (
        <StatusIndicator label={`Search (${searchProviderName})`} status={searchProviderStatus} />
      )}
      {llmProviderName !== undefined && llmProviderStatus !== undefined && (
        <StatusIndicator label={`LLM (${llmProviderName})`} status={llmProviderStatus} />
      )}
    </div>
  );
}

export default StatusIndicator;
