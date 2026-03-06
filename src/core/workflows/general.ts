/**
 * General Security Incident Workflow
 *
 * A broad-purpose workflow suitable for any incident type that doesn't match
 * a specific workflow (phishing, vulnerability, compliance). It:
 *   1. Queries the live incident details from ServiceNow
 *   2. Correlates with related incidents in the last 7 days
 *   3. Extracts and analyses any IOCs (IPs, domains, hashes) in the text
 *   4. Assesses the attack surface for the affected asset
 *   5. Generates a remediation plan
 */

import type { SecurityIncident } from '../storage/schema';
import type { WorkflowStep } from '../../renderer/components/WorkflowProgress';
import type { MCPContext } from '../services/chat';
import { executeSingleTool } from '../services/security-workflow';
import { logger } from '../../utils/logger';

export interface GeneralWorkflowOptions {
  incident: SecurityIncident;
  mcpContext: MCPContext;
  onStepUpdate?: (steps: WorkflowStep[]) => void;
  onToolResult: (result: {
    toolName: string;
    toolCategory: string;
    result: Record<string, unknown>;
    success: boolean;
    executionTimeMs: number;
    errorMessage?: string;
    confidence: number;
  }) => void;
}

/** Extract IOCs (IPs, domains, hashes) from free text */
function extractIocs(text: string): { ips: string[]; domains: string[]; hashes: string[] } {
  const ipPattern = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g;
  const hashPattern = /\b([a-fA-F0-9]{64}|[a-fA-F0-9]{40}|[a-fA-F0-9]{32})\b/g;
  const domainPattern =
    /\b(?!localhost\b)(?!.*service-now\.com\b)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b/g;

  const ips = [...new Set(text.match(ipPattern) ?? [])];
  const hashes = [...new Set(text.match(hashPattern) ?? [])].filter(
    (h) => !ips.some((ip) => ip.replace(/\./g, '') === h),
  );
  const domains = [...new Set(text.match(domainPattern) ?? [])].filter(
    (d) => !/^\d+\.\d+/.test(d),
  );
  return { ips: ips.slice(0, 3), domains: domains.slice(0, 3), hashes: hashes.slice(0, 2) };
}

export async function runGeneralWorkflow(opts: GeneralWorkflowOptions): Promise<void> {
  const { incident, mcpContext, onStepUpdate, onToolResult } = opts;

  const fullText = `${incident.title} ${incident.description}`;
  const { ips, domains, hashes } = extractIocs(fullText);
  const totalIocs = ips.length + domains.length + hashes.length;

  const steps: WorkflowStep[] = [
    { id: 'fetch',     label: 'Fetch incident details from ServiceNow', status: 'running' },
    { id: 'correlate', label: 'Correlate with related incidents (7 days)', status: 'pending' },
    { id: 'iocs',      label: `Analyse ${totalIocs} indicator(s) found in text`, status: 'pending' },
    { id: 'surface',   label: 'Assess attack surface for affected asset', status: 'pending' },
    { id: 'remediate', label: 'Generate remediation plan', status: 'pending' },
  ];

  const update = (id: string, status: WorkflowStep['status'], detail?: string) => {
    const idx = steps.findIndex((s) => s.id === id);
    if (idx >= 0) {
      const updated: WorkflowStep = { ...steps[idx]!, status };
      if (detail !== undefined) updated.detail = detail;
      steps[idx] = updated;
    }
    onStepUpdate?.([...steps]);
  };

  // ── Step 1: Fetch incident details from ServiceNow ────────────────────────
  const detailResult = await executeSingleTool(
    'query_incidents',
    { state: 'all', limit: 1, query: `number=${incident.incidentId}` },
    mcpContext,
  );
  onToolResult(detailResult);
  if (detailResult.success) {
    const raw = detailResult.result as { incidents?: Array<Record<string, unknown>> };
    const first = raw.incidents?.[0];
    const state = first?.['state'] ? String(first['state']) : 'unknown';
    update('fetch', 'done', `State: ${state}`);
  } else {
    update('fetch', 'error', detailResult.errorMessage ?? 'Could not fetch incident');
  }

  // ── Step 2: Incident correlation ──────────────────────────────────────────
  update('correlate', 'running');
  if (incident.incidentId) {
    // correlate_security_incidents requires at least 2 IDs — pass a sentinel second ID
    // so the tool can still find related incidents via the time window
    const correlResult = await executeSingleTool(
      'correlate_security_incidents',
      { incident_ids: [incident.incidentId, incident.incidentId + '_related'], time_window_hours: 168 },
      mcpContext,
    );
    onToolResult(correlResult);
    const corrType = (correlResult.result as Record<string, unknown>)['correlation_type'] as string | undefined;
    const score = (correlResult.result as Record<string, unknown>)['correlation_score'] as number | undefined;
    const detail = corrType
      ? `Type: ${corrType}${score !== undefined ? ` (score: ${Math.round(score * 100)}%)` : ''}`
      : 'No correlations found';
    update('correlate', correlResult.success ? 'done' : 'error', detail);
  } else {
    update('correlate', 'done', 'Skipped — no incident number');
  }

  // ── Step 3: IOC analysis ──────────────────────────────────────────────────
  update('iocs', 'running');
  if (totalIocs > 0) {
    const indicators: Array<{ indicator: string; indicator_type: 'ip' | 'domain' | 'hash' }> = [
      ...ips.map((ip) => ({ indicator: ip, indicator_type: 'ip' as const })),
      ...domains.map((d) => ({ indicator: d, indicator_type: 'domain' as const })),
      ...hashes.map((h) => ({ indicator: h, indicator_type: 'hash' as const })),
    ];
    let hits = 0;
    for (const ioc of indicators) {
      const r = await executeSingleTool('analyze_threat_indicator', ioc, mcpContext);
      onToolResult(r);
      if (r.success && (r.result as Record<string, unknown>)['found']) hits++;
    }
    update('iocs', 'done', `${hits}/${indicators.length} indicator(s) matched threat intel`);
  } else {
    update('iocs', 'done', 'No IOCs found in incident text');
  }

  // ── Step 4: Attack surface assessment ────────────────────────────────────
  update('surface', 'running');
  const surfaceResult = await executeSingleTool(
    'analyze_attack_surface',
    {
      asset_id: incident.incidentId ?? 'unknown',
      asset_type: 'incident',
      include_related: true,
    },
    mcpContext,
  );
  onToolResult(surfaceResult);
  if (surfaceResult.success) {
    const summary = (surfaceResult.result as Record<string, unknown>)['summary'] as Record<string, unknown> | undefined;
    const riskScore = summary?.['overall_risk_score'] as number | undefined;
    update('surface', 'done', riskScore !== undefined ? `Risk score: ${riskScore}` : 'Assessment complete');
  } else {
    update('surface', 'error', surfaceResult.errorMessage ?? 'Attack surface analysis failed');
  }

  // ── Step 5: Remediation plan ──────────────────────────────────────────────
  update('remediate', 'running');
  const remediateResult = await executeSingleTool(
    'generate_remediation_plan',
    {
      incident_id: incident.incidentId ?? incident.id,
      incident_type: 'general',
      severity: incident.severity,
    },
    mcpContext,
  );
  onToolResult(remediateResult);
  if (remediateResult.success) {
    const steps_count = (
      (remediateResult.result as Record<string, unknown>)['prioritized_steps'] as unknown[] | undefined
    )?.length ?? 0;
    update('remediate', 'done', `${steps_count} remediation step(s) generated`);
  } else {
    update('remediate', 'error', remediateResult.errorMessage ?? 'Remediation plan failed');
  }

  logger.info('General security workflow complete', {
    incidentId: incident.id,
    iocs: totalIocs,
  });
}
