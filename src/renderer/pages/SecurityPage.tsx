import { useState, useEffect, useRef } from 'react';
import { SecurityWorkflow } from '../components/SecurityWorkflow';
import { IncidentListPanel } from '../components/IncidentListPanel';
import { useActiveProfile } from '../store/index';
import { securityIncidentRepository } from '../../core/storage/repositories/incident';
import { createSession } from '../../core/services/chat';
import { aiSessionRepository } from '../../core/storage/repositories/session';
import type { SecurityIncident } from '../../core/storage/schema';
import type { MCPContext } from '../../core/services/chat';
import type { IncidentSummary } from '../components/IncidentListPanel';
import { logger } from '../../utils/logger';

/**
 * Security page — side-by-side resizable split:
 *   Left:  IncidentListPanel (live ServiceNow incidents)
 *   Right: SecurityWorkflow (AI-powered analysis chat)
 *
 * T016: Follows the established ChatPage.tsx resizable-divider pattern.
 */
export function SecurityPage() {
  const activeProfile = useActiveProfile();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  // Use a nonce alongside the incident so re-analyzing the same incident always fires
  const [pendingAnalysis, setPendingAnalysis] = useState<{ incident: SecurityIncident; nonce: number } | null>(null);
  const [loading, setLoading] = useState(true);

  // Resizable divider state (T016)
  const [leftWidth, setLeftWidth] = useState(320);
  const isResizing = useRef(false);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      setLeftWidth(Math.min(Math.max(e.clientX, 220), 500));
    };
    const onMouseUp = () => {
      if (!isResizing.current) return;
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  useEffect(() => {
    if (!activeProfile) {
      setLoading(false);
      return;
    }
    void initSession(activeProfile.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile?.id]);

  async function initSession(configId: string) {
    setLoading(true);
    try {
      const existing = await aiSessionRepository.findByConfigId(configId);
      const securitySession =
        existing.find((s) => s.title === 'Security Workflows') ??
        (await createSession(configId, 'Security Workflows', 8760));

      setSessionId(securitySession.id);
      const loaded = await securityIncidentRepository.findBySessionId(securitySession.id);
      setIncidents(loaded);
    } catch (err) {
      logger.error('Failed to initialize security session', {}, err as Error);
    } finally {
      setLoading(false);
    }
  }

  function mapSeverity(raw: string): SecurityIncident['severity'] {
    const s = raw.toLowerCase();
    if (s.includes('1') || s.includes('critical')) return 'critical';
    if (s.includes('2') || s.includes('high')) return 'high';
    if (s.includes('3') || s.includes('medium')) return 'medium';
    if (s.includes('4') || s.includes('low')) return 'low';
    return 'info';
  }

  async function handleAnalyzeLiveIncident(liveSummary: IncidentSummary) {
    if (!sessionId) return;
    const existing = incidents.find((i) => i.incidentId === liveSummary.number);
    if (existing) {
      setPendingAnalysis((prev) => ({ incident: existing, nonce: (prev?.nonce ?? 0) + 1 }));
      return;
    }
    try {
      const created = await securityIncidentRepository.create({
        sessionId,
        incidentId: liveSummary.number,
        title: liveSummary.shortDescription,
        description: liveSummary.description ?? liveSummary.shortDescription,
        severity: mapSeverity(liveSummary.severity),
        status: 'new',
        threatLevel: null,
        cveIds: null,
        correlatedIncidents: null,
        analyzedAt: null,
      });
      setIncidents((prev) => [created, ...prev]);
      setPendingAnalysis((prev) => ({ incident: created, nonce: (prev?.nonce ?? 0) + 1 }));
    } catch (err) {
      logger.error('Failed to import live incident for analysis', {}, err as Error);
    }
  }

  if (!activeProfile) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '40px',
        }}
      >
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          <p style={{ fontSize: '1rem', marginBottom: '8px' }}>No active profile configured.</p>
          <p style={{ fontSize: '0.875rem' }}>
            Go to <strong>Settings</strong> to create a profile first.
          </p>
        </div>
      </div>
    );
  }

  if (loading || !sessionId) {
    return (
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
      >
        <p style={{ color: '#6b7280' }}>Initializing security workspace…</p>
      </div>
    );
  }

  const mcpContext: MCPContext = {
    profileId: activeProfile.id,
    servicenowUrl: activeProfile.servicenowUrl,
    ollamaEndpoint: activeProfile.ollamaEndpoint,
    ollamaModel: activeProfile.ollamaModel,
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
      {/* Left panel: live incident list */}
      <IncidentListPanel
        profileId={activeProfile.id}
        servicenowUrl={activeProfile.servicenowUrl}
        width={leftWidth}
        onAnalyze={(inc) => void handleAnalyzeLiveIncident(inc)}
      />

      {/* Drag-to-resize divider */}
      <div
        onMouseDown={(e) => {
          isResizing.current = true;
          e.preventDefault();
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
        }}
        style={{
          width: '5px',
          flexShrink: 0,
          cursor: 'col-resize',
          backgroundColor: '#e5e7eb',
          transition: 'background-color 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#10b981'; }}
        onMouseLeave={(e) => { if (!isResizing.current) e.currentTarget.style.backgroundColor = '#e5e7eb'; }}
        title="Drag to resize"
      />

      {/* Right panel: security workflow chat */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
            flexShrink: 0,
          }}
        >
          <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>
            Security Incident Analysis
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
            Create incidents and run AI-powered phishing, vulnerability, or compliance workflows
          </p>
        </div>

        <div style={{ flex: 1, overflow: 'hidden', padding: '16px' }}>
          <SecurityWorkflow
            sessionId={sessionId}
            incidents={incidents}
            mcpContext={mcpContext}
            {...(pendingAnalysis !== null ? { pendingAnalysis } : {})}
            onIncidentCreated={(incident) => setIncidents((prev) => [incident, ...prev])}
            onAnalysisComplete={(updated) =>
              setIncidents((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
            }
          />
        </div>
      </div>
    </div>
  );
}

export default SecurityPage;
