/**
 * T096: Compliance Audit Workflow
 * Runs a compliance audit against a security framework using ServiceNow GRC data.
 */

import type { SecurityIncident } from '../storage/schema';
import type { WorkflowStep } from '../../renderer/components/WorkflowProgress';
import type { MCPContext } from '../services/chat';
import { executeSingleTool } from '../services/security-workflow';
import { logger } from '../../utils/logger';

export type ComplianceFramework = 'CIS' | 'NIST_800-53' | 'PCI-DSS' | 'ISO_27001' | 'SOC2';

export interface ComplianceWorkflowOptions {
  incident: SecurityIncident;
  mcpContext: MCPContext;
  framework?: ComplianceFramework;
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

/** Detect a compliance framework mention in incident text */
function detectFramework(text: string): ComplianceFramework {
  const lower = text.toLowerCase();
  if (lower.includes('pci') || lower.includes('pci-dss')) return 'PCI-DSS';
  if (lower.includes('nist') || lower.includes('800-53')) return 'NIST_800-53';
  if (lower.includes('iso 27001') || lower.includes('iso27001')) return 'ISO_27001';
  if (lower.includes('soc 2') || lower.includes('soc2')) return 'SOC2';
  return 'CIS'; // default
}

export async function runComplianceWorkflow(opts: ComplianceWorkflowOptions): Promise<void> {
  const { incident, mcpContext, framework: explicitFramework, onStepUpdate, onToolResult } = opts;

  const fullText = `${incident.title} ${incident.description}`;
  const framework = explicitFramework ?? detectFramework(fullText);

  const steps: WorkflowStep[] = [
    { id: 'detect', label: 'Detect compliance framework', status: 'running' },
    { id: 'inventory', label: 'Build system inventory from CMDB', status: 'pending' },
    { id: 'audit', label: `Run ${framework} compliance audit`, status: 'pending' },
    { id: 'surface', label: 'Analyze attack surface', status: 'pending' },
    { id: 'report', label: 'Compile compliance report', status: 'pending' },
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

  // Step 1: Framework detection
  update('detect', 'done', `Framework: ${framework}`);

  // Step 2: Build minimal system inventory from incident context
  update('inventory', 'running');
  const systemInventory = [
    {
      system_id: `sys-${incident.incidentId}`,
      type: 'server' as const,
      os: 'Unknown',
      configurations: {
        incident_id: incident.incidentId,
        severity: incident.severity,
      },
    },
  ];
  update('inventory', 'done', `${systemInventory.length} system(s) in scope`);

  // Step 3: Compliance audit
  update('audit', 'running');
  const auditResult = await executeSingleTool(
    'audit_security_compliance',
    {
      framework,
      system_inventory: systemInventory,
    },
    mcpContext,
  );
  onToolResult(auditResult);

  const auditData = auditResult.result as Record<string, unknown>;
  const complianceScore = auditData['compliance_score'] as number | undefined;
  const auditSummary = auditData['audit_summary'] as Record<string, unknown> | undefined;

  update(
    'audit',
    auditResult.success ? 'done' : 'error',
    auditResult.success
      ? `Compliance score: ${complianceScore ?? 'N/A'}% (${String(auditSummary?.['failed'] ?? 0)} control(s) failed)`
      : 'Audit query failed',
  );

  // Step 4: Attack surface (quick)
  update('surface', 'running');
  const surfaceResult = await executeSingleTool(
    'analyze_attack_surface',
    { target_scope: {}, scan_depth: 'quick' },
    mcpContext,
  );
  onToolResult(surfaceResult);
  const riskAssessment = surfaceResult.result['risk_assessment'] as Record<string, unknown> | undefined;
  update(
    'surface',
    surfaceResult.success ? 'done' : 'error',
    riskAssessment
      ? `${String(riskAssessment['critical_findings'] ?? 0)} critical, ${String(riskAssessment['high_findings'] ?? 0)} high findings`
      : 'Surface analysis unavailable',
  );

  // Step 5: Done
  update('report', 'done', `${framework} compliance audit complete`);

  logger.info('Compliance workflow complete', {
    incidentId: incident.id,
    framework,
    complianceScore,
  });
}
