/**
 * T091: IncidentList component
 * Displays security incidents stored in the local DB with filtering
 */

import type { SecurityIncident } from '../../core/storage/schema';

interface IncidentListProps {
  incidents: SecurityIncident[];
  selectedId?: string;
  onSelect?: (incident: SecurityIncident) => void;
  onAnalyze?: (incident: SecurityIncident) => void;
}

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  critical: { bg: '#fef2f2', text: '#dc2626' },
  high: { bg: '#fff7ed', text: '#c2410c' },
  medium: { bg: '#fefce8', text: '#ca8a04' },
  low: { bg: '#f0fdf4', text: '#166534' },
  info: { bg: '#f0f9ff', text: '#0369a1' },
};

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  analyzing: 'Analyzing…',
  analyzed: 'Analyzed',
  resolved: 'Resolved',
  closed: 'Closed',
};

export function IncidentList({
  incidents,
  selectedId,
  onSelect,
  onAnalyze,
}: IncidentListProps) {
  if (incidents.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          color: '#9ca3af',
          padding: '24px 16px',
          fontSize: '0.875rem',
        }}
      >
        No security incidents recorded yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {incidents.map((incident) => {
        const colors = SEVERITY_COLORS[incident.severity] ?? SEVERITY_COLORS['info']!;
        const isSelected = incident.id === selectedId;

        return (
          <div
            key={incident.id}
            onClick={() => onSelect?.(incident)}
            style={{
              border: `1px solid ${isSelected ? '#3b82f6' : '#e5e7eb'}`,
              borderRadius: '6px',
              padding: '10px 12px',
              cursor: 'pointer',
              backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
              transition: 'border-color 0.15s',
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelect?.(incident);
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '4px',
              }}
            >
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#111827',
                  flex: 1,
                  marginRight: '8px',
                }}
              >
                {incident.title}
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: '9999px',
                  backgroundColor: colors.bg,
                  color: colors.text,
                  whiteSpace: 'nowrap',
                }}
              >
                {incident.severity.toUpperCase()}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                {incident.incidentId} · {STATUS_LABELS[incident.status] ?? incident.status}
              </span>
              {(incident.status === 'new' || incident.status === 'analyzed') && onAnalyze && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAnalyze(incident);
                  }}
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: '1px solid #3b82f6',
                    backgroundColor: '#eff6ff',
                    color: '#1d4ed8',
                    cursor: 'pointer',
                  }}
                >
                  {incident.status === 'analyzed' ? 'Re-analyze' : 'Analyze'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default IncidentList;
