/**
 * T090: SecurityWorkflow UI component
 * Main workflow panel — lets users register a security incident and trigger analysis
 */

import { useState, useEffect } from 'react';
import type { SecurityIncident, AnalysisResult, ConfigurationProfile } from '../../core/storage/schema';
import type { WorkflowStep } from './WorkflowProgress';
import { WorkflowProgress } from './WorkflowProgress';
import { IncidentList } from './IncidentList';
import { AnalysisReport } from './AnalysisReport';
import type { WorkflowOptions } from '../../core/services/security-workflow';
import { runSecurityWorkflow } from '../../core/services/security-workflow';
import type { MCPContext } from '../../core/services/chat';
import { useActiveProfile } from '../store/index';

interface SecurityWorkflowProps {
  sessionId: string;
  incidents: SecurityIncident[];
  mcpContext: MCPContext;
  /** Carries a nonce so the effect fires even when the same incident is re-analyzed */
  pendingAnalysis?: { incident: SecurityIncident; nonce: number } | undefined;
  onIncidentCreated?: (incident: SecurityIncident) => void;
  onAnalysisComplete?: (incident: SecurityIncident, results: AnalysisResult[]) => void;
}

type WorkflowType = 'general' | 'phishing' | 'vulnerability' | 'compliance';

const WORKFLOW_LABELS: Record<WorkflowType, string> = {
  general: 'General Analysis',
  phishing: 'Phishing Analysis',
  vulnerability: 'Vulnerability Assessment',
  compliance: 'Compliance Audit',
};

export function SecurityWorkflow({
  sessionId,
  incidents,
  mcpContext,
  pendingAnalysis,
  onIncidentCreated,
  onAnalysisComplete,
}: SecurityWorkflowProps) {
  const activeProfile = useActiveProfile();
  const [selectedIncident, setSelectedIncident] = useState<SecurityIncident | null>(null);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [workflowType, setWorkflowType] = useState<WorkflowType>('general');
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiActions, setAiActions] = useState<string[] | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // When a live incident arrives from the left panel, auto-trigger analysis.
  // The nonce changes on every click (even re-analyzing the same incident)
  // so this effect always fires regardless of which incident was chosen.
  useEffect(() => {
    if (pendingAnalysis && !isRunning) {
      void handleAnalyze(pendingAnalysis.incident);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAnalysis?.nonce]);

  // New incident form
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    incidentId: '',
    title: '',
    description: '',
    severity: 'medium' as SecurityIncident['severity'],
  });

  const handleAnalyze = async (incident: SecurityIncident) => {
    if (isRunning) return;
    setSelectedIncident(incident);
    setIsRunning(true);
    setSteps([]);
    setAnalysisResults([]);
    setAiSummary(null);
    setAiActions(null);

    const opts: WorkflowOptions = {
      sessionId,
      incident,
      workflowType,
      mcpContext,
      onStepUpdate: (updated) => setSteps(updated),
    };

    const { results, updatedIncident } = await runSecurityWorkflow(opts);
    setAnalysisResults(results);
    if (updatedIncident) setSelectedIncident(updatedIncident);
    setIsRunning(false);
    onAnalysisComplete?.(updatedIncident ?? incident, results);

    // Generate plain-language AI summary after workflow completes
    if (activeProfile) {
      setIsSummarizing(true);
      try {
        const { summary, actions } = await generateWorkflowSummary(
          updatedIncident ?? incident,
          results,
          activeProfile,
        );
        setAiSummary(summary);
        setAiActions(actions);
      } catch {
        // Summary is supplementary — don't block the UI on failure
      } finally {
        setIsSummarizing(false);
      }
    }
  };

  const handleCreate = async () => {
    if (!formData.incidentId || !formData.title) return;
    // Import is deferred to avoid circular dep at module level
    const { securityIncidentRepository } = await import(
      '../../core/storage/repositories/incident'
    );
    const incident = await securityIncidentRepository.create({
      sessionId,
      incidentId: formData.incidentId,
      title: formData.title,
      description: formData.description,
      severity: formData.severity,
      status: 'new',
      threatLevel: null,
      cveIds: null,
      correlatedIncidents: null,
      analyzedAt: null,
    });
    setFormData({ incidentId: '', title: '', description: '', severity: 'medium' });
    setShowForm(false);
    onIncidentCreated?.(incident);
  };

  return (
    <div style={{ display: 'flex', height: '100%', gap: '16px' }}>
      {/* Left panel: incident list */}
      <div
        style={{
          width: '280px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111827' }}>
            Security Incidents
          </span>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            aria-expanded={showForm}
            aria-label={showForm ? 'Cancel new incident form' : 'Create new incident'}
            style={{
              fontSize: '0.75rem',
              padding: '3px 8px',
              borderRadius: '4px',
              border: '1px solid #3b82f6',
              backgroundColor: showForm ? '#3b82f6' : '#eff6ff',
              color: showForm ? '#ffffff' : '#1d4ed8',
              cursor: 'pointer',
            }}
          >
            {showForm ? 'Cancel' : '+ New'}
          </button>
        </div>

        {showForm && (
          <div
            role="form"
            aria-label="Create new security incident"
            style={{
              padding: '10px',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              backgroundColor: '#f9fafb',
            }}
          >
            <input
              aria-label="Incident ID"
              placeholder="Incident ID (e.g. SIR0001234)"
              value={formData.incidentId}
              onChange={(e) => setFormData({ ...formData, incidentId: e.target.value })}
              style={inputStyle}
            />
            <input
              aria-label="Incident title"
              placeholder="Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              style={inputStyle}
            />
            <textarea
              aria-label="Incident description (optional)"
              placeholder="Description (optional)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              style={{ ...inputStyle, height: '60px', resize: 'vertical' }}
            />
            <select
              aria-label="Severity"
              value={formData.severity}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  severity: e.target.value as SecurityIncident['severity'],
                })
              }
              style={inputStyle}
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="info">Info</option>
            </select>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={!formData.incidentId || !formData.title}
              aria-disabled={!formData.incidentId || !formData.title}
              style={{
                width: '100%',
                padding: '6px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '0.8rem',
                opacity: !formData.incidentId || !formData.title ? 0.5 : 1,
              }}
            >
              Create Incident
            </button>
          </div>
        )}

        <IncidentList
          incidents={incidents}
          {...(selectedIncident?.id !== undefined ? { selectedId: selectedIncident.id } : {})}
          onSelect={setSelectedIncident}
          onAnalyze={(inc) => void handleAnalyze(inc)}
        />
      </div>

      {/* Right panel: analysis */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Workflow type selector */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            marginBottom: '12px',
            flexWrap: 'wrap',
          }}
        >
          {(Object.keys(WORKFLOW_LABELS) as WorkflowType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setWorkflowType(type)}
              aria-pressed={workflowType === type}
              aria-label={`Select ${WORKFLOW_LABELS[type]} workflow`}
              style={{
                fontSize: '0.8rem',
                padding: '4px 10px',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: workflowType === type ? '#3b82f6' : '#d1d5db',
                backgroundColor: workflowType === type ? '#3b82f6' : '#ffffff',
                color: workflowType === type ? '#ffffff' : '#374151',
                cursor: 'pointer',
              }}
            >
              {WORKFLOW_LABELS[type]}
            </button>
          ))}
        </div>

        {isRunning && steps.length > 0 && (
          <WorkflowProgress title={WORKFLOW_LABELS[workflowType]} steps={steps} />
        )}

        {!isRunning && selectedIncident && (
          <AnalysisReport
            incident={selectedIncident}
            results={analysisResults}
            aiSummary={aiSummary}
            aiActions={aiActions}
            isSummarizing={isSummarizing}
          />
        )}

        {!selectedIncident && !isRunning && (
          <div
            style={{
              textAlign: 'center',
              color: '#9ca3af',
              padding: '40px 16px',
              fontSize: '0.875rem',
            }}
          >
            Select an incident from the list to view its analysis, or click &quot;Analyze&quot; to run a new
            workflow.
          </div>
        )}
      </div>
    </div>
  );
}

/** Call the Ollama API (non-streaming) to produce a plain-language summary + action list */
async function generateWorkflowSummary(
  incident: SecurityIncident,
  results: AnalysisResult[],
  profile: ConfigurationProfile,
): Promise<{ summary: string; actions: string[] }> {
  const successfulResults = results.filter((r) => r.success);
  const toolLines = successfulResults.map((r) => {
    const data =
      typeof r.result === 'string'
        ? (JSON.parse(r.result) as Record<string, unknown>)
        : (r.result as Record<string, unknown>);
    return `- ${r.toolName}: ${JSON.stringify(data)}`;
  });

  const prompt = [
    'You are a security analyst. Analyse the following incident and respond in exactly this format — no extra text:',
    '',
    'SUMMARY:',
    '[Write 3-5 sentences describing what was found and the overall risk level.]',
    '',
    'RECOMMENDED ACTIONS:',
    '1. [First specific action to take]',
    '2. [Second specific action to take]',
    '3. [Third specific action to take]',
    '',
    '---',
    `Incident: ${incident.title}`,
    `ID: ${incident.incidentId ?? 'N/A'}`,
    `Severity: ${incident.severity}`,
    `Description: ${incident.description ?? 'N/A'}`,
    '',
    'Tool results:',
    ...toolLines,
  ].join('\n');

  const endpoint = profile.ollamaEndpoint.replace(/\/$/, '');
  const resp = await fetch(`${endpoint}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: profile.ollamaModel, prompt, stream: false }),
  });
  if (!resp.ok) throw new Error(`Ollama returned ${resp.status}`);
  const data = (await resp.json()) as { response?: string };
  const raw = data.response?.trim() ?? '';

  // Parse the two sections from the model response
  const summaryMatch = /SUMMARY:\s*([\s\S]*?)(?=RECOMMENDED ACTIONS:|$)/i.exec(raw);
  const actionsMatch = /RECOMMENDED ACTIONS:\s*([\s\S]*)/i.exec(raw);

  const summary = summaryMatch?.[1]?.trim() ?? raw;

  const actions: string[] = [];
  if (actionsMatch?.[1]) {
    for (const line of actionsMatch[1].split('\n')) {
      const cleaned = line.replace(/^\s*\d+[.)]\s*/, '').trim();
      if (cleaned.length > 0) actions.push(cleaned);
    }
  }

  return { summary: summary || 'Summary unavailable.', actions };
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: '4px',
  border: '1px solid #d1d5db',
  fontSize: '0.8rem',
  marginBottom: '6px',
  boxSizing: 'border-box',
};

export default SecurityWorkflow;
