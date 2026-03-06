/**
 * T094: Phishing Analysis Workflow
 * Analyzes phishing indicators using threat intelligence and incident correlation tools.
 * Detects IOCs (IPs, domains, hashes) in the incident description and runs them through
 * ServiceNow Threat Intelligence.
 */

import type { SecurityIncident } from '../storage/schema';
import type { WorkflowStep } from '../../renderer/components/WorkflowProgress';
import type { MCPContext } from '../services/chat';
import { executeSingleTool } from '../services/security-workflow';
import { logger } from '../../utils/logger';

export interface PhishingWorkflowOptions {
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

/**
 * Extract IOCs (IPs, domains, hashes) from the incident description.
 */
function extractIocs(text: string): {
  ips: string[];
  domains: string[];
  hashes: string[];
} {
  const ipPattern =
    /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g;
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

export async function runPhishingWorkflow(opts: PhishingWorkflowOptions): Promise<void> {
  const { incident, mcpContext, onStepUpdate, onToolResult } = opts;

  const fullText = `${incident.title} ${incident.description}`;
  const { ips, domains, hashes } = extractIocs(fullText);

  const totalIndicators = ips.length + domains.length + hashes.length;

  const steps: WorkflowStep[] = [
    { id: 'extract', label: 'Extract IOCs from incident', status: 'running' },
    {
      id: 'threat',
      label: `Analyze ${totalIndicators} threat indicator(s)`,
      status: 'pending',
    },
    { id: 'correlate', label: 'Check for correlated incidents', status: 'pending' },
    { id: 'report', label: 'Compile phishing analysis report', status: 'pending' },
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

  // Step 1: IOC extraction (already done above)
  update('extract', 'done', `Found ${ips.length} IPs, ${domains.length} domains, ${hashes.length} hashes`);

  // Step 2: Threat indicator analysis
  update('threat', 'running');

  const indicators: Array<{ indicator: string; indicator_type: 'ip' | 'domain' | 'hash' }> = [
    ...ips.map((ip) => ({ indicator: ip, indicator_type: 'ip' as const })),
    ...domains.map((d) => ({ indicator: d, indicator_type: 'domain' as const })),
    ...hashes.map((h) => ({ indicator: h, indicator_type: 'hash' as const })),
  ];

  let threatHits = 0;
  if (indicators.length > 0) {
    for (const ioc of indicators) {
      const result = await executeSingleTool('analyze_threat_indicator', ioc, mcpContext);
      onToolResult(result);
      if (result.success && (result.result as Record<string, unknown>)['found']) {
        threatHits++;
      }
    }
    update('threat', 'done', `${threatHits}/${indicators.length} indicator(s) matched threat intel`);
  } else {
    update('threat', 'done', 'No IOCs found in incident text');
  }

  // Step 3: Incident correlation (if incident has a ServiceNow number)
  update('correlate', 'running');
  const incidentNumber = incident.incidentId;
  if (incidentNumber) {
    const correlResult = await executeSingleTool(
      'correlate_security_incidents',
      { incident_ids: [incidentNumber, incidentNumber + '_phishing'], time_window_hours: 72 },
      mcpContext,
    );
    onToolResult(correlResult);
    const corrType = (correlResult.result as Record<string, unknown>)['correlation_type'] as string;
    update('correlate', correlResult.success ? 'done' : 'error', `Correlation: ${corrType ?? 'N/A'}`);
  } else {
    update('correlate', 'done', 'Skipped — no incident number');
  }

  // Step 4: Done
  update('report', 'done', `Phishing analysis complete — ${threatHits} threat hit(s)`);

  logger.info('Phishing workflow complete', {
    incidentId: incident.id,
    iocs: totalIndicators,
    threatHits,
  });
}
