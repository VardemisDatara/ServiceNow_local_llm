/**
 * T092: AnalysisReport component
 * Renders the full analysis report for a security incident
 */

import type { SecurityIncident, AnalysisResult } from '../../core/storage/schema';

/**
 * Returns true when a result field should be rendered as a collapsible XML panel.
 * Conditions (both must be met):
 *   1. key ends with '_xml' OR is in the explicit known-field list
 *   2. value is a non-empty string that starts with '<' (after trimming leading whitespace)
 */
// eslint-disable-next-line react-refresh/only-export-components
export function isXmlPayloadField(key: string, value: unknown): boolean {
  if (typeof value !== 'string' || value.length === 0) return false;
  const knownXmlFields = ['raw_xml', 'xml_payload', 'work_notes_xml', 'description_xml'];
  const isNamedXmlField = key.endsWith('_xml') || knownXmlFields.includes(key);
  return isNamedXmlField && value.trimStart().startsWith('<');
}

/** Humanise a snake_case field key for display in the panel summary. */
function humaniseXmlLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\bxml\b/gi, 'XML')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface AnalysisReportProps {
  incident: SecurityIncident;
  results: AnalysisResult[];
  aiSummary?: string | null;
  aiActions?: string[] | null;
  isSummarizing?: boolean;
}

const THREAT_LEVEL_COLORS: Record<string, string> = {
  critical: '#dc2626',
  high: '#c2410c',
  medium: '#ca8a04',
  low: '#166534',
  minimal: '#0369a1',
};

function ResultCard({ result }: { result: AnalysisResult }) {
  const data =
    typeof result.result === 'string'
      ? (JSON.parse(result.result) as Record<string, unknown>)
      : (result.result as Record<string, unknown>);

  // Split data fields into XML payload fields (collapsible) and everything else
  const xmlEntries = Object.entries(data).filter(([k, v]) => isXmlPayloadField(k, v));
  const nonXmlData = Object.fromEntries(Object.entries(data).filter(([k, v]) => !isXmlPayloadField(k, v)));

  return (
    <details
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        marginBottom: '8px',
        backgroundColor: result.success ? '#f9fafb' : '#fef2f2',
      }}
    >
      <summary
        style={{
          padding: '10px 12px',
          cursor: 'pointer',
          userSelect: 'none',
          listStyle: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>&#9658;</span>
          <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#111827' }}>
            {result.toolName}
          </span>
        </span>
        <span style={{ fontSize: '0.75rem', color: result.success ? '#10b981' : '#ef4444' }}>
          {result.success ? `✓ ${result.executionTimeMs}ms` : '✗ Failed'}
        </span>
      </summary>

      <div style={{ padding: '0 12px 12px', borderTop: '1px solid #e5e7eb' }}>
        {result.errorMessage && (
          <p style={{ fontSize: '0.8rem', color: '#dc2626', margin: '8px 0 0' }}>{result.errorMessage}</p>
        )}

        {result.success && (
          <>
            {/* XML payload fields — collapsible panels, collapsed by default */}
            {xmlEntries.map(([key, value]) => (
              <details
                key={key}
                style={{
                  marginTop: '8px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                  backgroundColor: '#ffffff',
                }}
              >
                <summary
                  aria-label={`${humaniseXmlLabel(key)} — click to expand or collapse`}
                  style={{
                    padding: '5px 8px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: '#374151',
                    cursor: 'pointer',
                    userSelect: 'none',
                    listStyle: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>&#9658;</span>
                  {humaniseXmlLabel(key)}
                </summary>
                <pre
                  style={{
                    fontSize: '0.72rem',
                    color: '#374151',
                    margin: 0,
                    padding: '8px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'monospace',
                    borderTop: '1px solid #e5e7eb',
                  }}
                >
                  {value as string}
                </pre>
              </details>
            ))}

            {/* Non-XML fields — standard JSON display */}
            {Object.keys(nonXmlData).length > 0 && (
              <pre
                style={{
                  fontSize: '0.75rem',
                  color: '#374151',
                  margin: '8px 0 0',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'monospace',
                }}
              >
                {JSON.stringify(nonXmlData, null, 2)}
              </pre>
            )}
          </>
        )}

        <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '8px' }}>
          Confidence: {result.confidence}% · Category: {result.toolCategory}
        </div>
      </div>
    </details>
  );
}

export function AnalysisReport({ incident, results, aiSummary, aiActions, isSummarizing }: AnalysisReportProps) {
  const threatColor = THREAT_LEVEL_COLORS[incident.threatLevel ?? 'minimal'] ?? '#6b7280';

  const cveIds: string[] =
    typeof incident.cveIds === 'string'
      ? (JSON.parse(incident.cveIds) as string[])
      : (incident.cveIds as string[] | null) ?? [];

  const correlatedIds: string[] =
    typeof incident.correlatedIncidents === 'string'
      ? (JSON.parse(incident.correlatedIncidents) as string[])
      : (incident.correlatedIncidents as string[] | null) ?? [];

  return (
    <div role="region" aria-label={`Analysis report for ${incident.title}`} style={{ padding: '16px' }}>
      {/* Header */}
      <div
        style={{
          borderBottom: '1px solid #e5e7eb',
          paddingBottom: '12px',
          marginBottom: '16px',
        }}
      >
        <h2 style={{ margin: '0 0 4px', fontSize: '1rem', color: '#111827' }}>
          {incident.title}
        </h2>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{incident.incidentId}</span>
          <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
            Status: {incident.status}
          </span>
          {incident.threatLevel && (
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: threatColor,
              }}
            >
              Threat Level: {incident.threatLevel.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* AI Summary */}
      {(isSummarizing || aiSummary) && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 14px',
            backgroundColor: '#f0f9ff',
            borderRadius: '8px',
            border: '1px solid #bae6fd',
          }}
        >
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0369a1', margin: '0 0 8px' }}>
            AI Analysis Summary
          </h3>
          {isSummarizing ? (
            <p style={{ fontSize: '0.85rem', color: '#0369a1', margin: 0, fontStyle: 'italic' }}>
              Generating summary...
            </p>
          ) : (
            <>
              <p style={{ fontSize: '0.85rem', color: '#1e3a5f', margin: '0 0 10px', lineHeight: 1.65 }}>
                {aiSummary}
              </p>
              {aiActions && aiActions.length > 0 && (
                <div>
                  <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0369a1', margin: '0 0 6px' }}>
                    Recommended Actions
                  </p>
                  <ol style={{ margin: 0, paddingLeft: '18px' }}>
                    {aiActions.map((action, i) => (
                      <li
                        key={i}
                        style={{ fontSize: '0.83rem', color: '#1e3a5f', lineHeight: 1.6, marginBottom: '4px' }}
                      >
                        {action}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Description */}
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '0.9rem', color: '#374151', margin: '0 0 6px' }}>Description</h3>
        <p style={{ fontSize: '0.85rem', color: '#4b5563', margin: 0 }}>{incident.description}</p>
      </div>

      {/* CVE IDs */}
      {cveIds.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '0.9rem', color: '#374151', margin: '0 0 6px' }}>
            Associated CVEs
          </h3>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {cveIds.map((cve) => (
              <span
                key={cve}
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: '#fff7ed',
                  border: '1px solid #fed7aa',
                  color: '#9a3412',
                }}
              >
                {cve}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Correlated incidents */}
      {correlatedIds.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '0.9rem', color: '#374151', margin: '0 0 6px' }}>
            Correlated Incidents
          </h3>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {correlatedIds.map((id) => (
              <span
                key={id}
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  color: '#0369a1',
                }}
              >
                {id}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tool results */}
      {results.length > 0 && (
        <div role="list" aria-label="Tool analysis results">
          <h3 style={{ fontSize: '0.9rem', color: '#374151', margin: '0 0 10px' }}>
            Tool Analysis Results ({results.length})
          </h3>
          {results.map((r) => (
            <ResultCard key={r.id} result={r} />
          ))}
        </div>
      )}

      {results.length === 0 && incident.status !== 'new' && (
        <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>No analysis results recorded.</p>
      )}

      {incident.analyzedAt && (
        <div
          style={{
            marginTop: '12px',
            fontSize: '0.75rem',
            color: '#9ca3af',
            textAlign: 'right',
          }}
        >
          Analyzed at {new Date(incident.analyzedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}

export default AnalysisReport;
