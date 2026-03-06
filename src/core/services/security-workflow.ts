/**
 * T093 + T098: Security Workflow Orchestration Service
 * Coordinates Ollama + ServiceNow MCP tools to analyze security incidents,
 * then persists results to the database.
 */

import { executeMCPTool } from '../mcp/client';
import { securityIncidentRepository } from '../storage/repositories/incident';
import { analysisResultRepository } from '../storage/repositories/analysis';
import type { SecurityIncident, AnalysisResult } from '../storage/schema';
import type { WorkflowStep } from '../../renderer/components/WorkflowProgress';
import type { MCPContext } from './chat';
import { logger } from '../../utils/logger';
import { runPhishingWorkflow } from '../workflows/phishing';
import { runVulnerabilityWorkflow } from '../workflows/vulnerability';
import { runComplianceWorkflow } from '../workflows/compliance';
import { runGeneralWorkflow } from '../workflows/general';

export interface WorkflowOptions {
  sessionId: string;
  incident: SecurityIncident;
  workflowType: 'phishing' | 'vulnerability' | 'compliance' | 'general';
  mcpContext: MCPContext;
  onStepUpdate?: (steps: WorkflowStep[]) => void;
}

export interface WorkflowResult {
  results: AnalysisResult[];
  updatedIncident: SecurityIncident | null;
}

/**
 * Run a security analysis workflow for a given incident.
 * Delegates to the appropriate workflow module and stores results.
 */
export async function runSecurityWorkflow(opts: WorkflowOptions): Promise<WorkflowResult> {
  const { incident, workflowType, mcpContext, onStepUpdate } = opts;

  logger.info('Starting security workflow', { workflowType, incidentId: incident.id });

  // Mark as analyzing
  let updatedIncident: SecurityIncident | null = null;
  try {
    updatedIncident = await securityIncidentRepository.updateStatus(incident.id, 'analyzing');
  } catch (err) {
    logger.warn('Failed to update incident status to analyzing', {}, err as Error);
  }

  const toolResults: Array<{
    toolName: string;
    toolCategory: string;
    result: Record<string, unknown>;
    success: boolean;
    executionTimeMs: number;
    errorMessage?: string;
    confidence: number;
  }> = [];

  try {
    switch (workflowType) {
      case 'phishing':
        await runPhishingWorkflow({
          incident: updatedIncident ?? incident,
          mcpContext,
          ...(onStepUpdate !== undefined ? { onStepUpdate } : {}),
          onToolResult: (r) => toolResults.push(r),
        });
        break;
      case 'vulnerability':
        await runVulnerabilityWorkflow({
          incident: updatedIncident ?? incident,
          mcpContext,
          ...(onStepUpdate !== undefined ? { onStepUpdate } : {}),
          onToolResult: (r) => toolResults.push(r),
        });
        break;
      case 'compliance':
        await runComplianceWorkflow({
          incident: updatedIncident ?? incident,
          mcpContext,
          ...(onStepUpdate !== undefined ? { onStepUpdate } : {}),
          onToolResult: (r) => toolResults.push(r),
        });
        break;
      case 'general':
        await runGeneralWorkflow({
          incident: updatedIncident ?? incident,
          mcpContext,
          ...(onStepUpdate !== undefined ? { onStepUpdate } : {}),
          onToolResult: (r) => toolResults.push(r),
        });
        break;
    }
  } catch (err) {
    logger.error('Workflow execution error', { workflowType, incidentId: incident.id }, err as Error);
  }

  // T098: Persist analysis results to database
  const savedResults: AnalysisResult[] = [];
  for (const tr of toolResults) {
    try {
      const saved = await analysisResultRepository.create({
        incidentId: incident.id,
        toolName: tr.toolName,
        toolCategory: tr.toolCategory,
        result: tr.result,
        confidence: tr.confidence,
        executionTimeMs: tr.executionTimeMs,
        success: tr.success,
        errorMessage: tr.errorMessage ?? null,
      });
      savedResults.push(saved);
    } catch (err) {
      logger.warn('Failed to save analysis result', { toolName: tr.toolName }, err as Error);
    }
  }

  // Determine threat level from results
  const threatLevel = deriveThreatLevel(savedResults);
  const cveIds = extractCveIds(savedResults);

  // Update incident with analysis results
  try {
    updatedIncident = await securityIncidentRepository.updateAnalysis(incident.id, {
      status: 'analyzed',
      threatLevel,
      cveIds,
    });
  } catch (err) {
    logger.warn('Failed to update incident analysis fields', {}, err as Error);
  }

  logger.info('Security workflow complete', {
    workflowType,
    incidentId: incident.id,
    resultsCount: savedResults.length,
    threatLevel,
  });

  return { results: savedResults, updatedIncident };
}

/** Derive overall threat level from analysis results */
function deriveThreatLevel(
  results: AnalysisResult[],
): SecurityIncident['threatLevel'] {
  if (results.length === 0) return 'minimal';

  const successfulResults = results.filter((r) => r.success);
  if (successfulResults.length === 0) return 'minimal';

  // Look for high-confidence critical results
  const maxConfidence = Math.max(...successfulResults.map((r) => r.confidence));
  if (maxConfidence >= 90) return 'critical';
  if (maxConfidence >= 75) return 'high';
  if (maxConfidence >= 50) return 'medium';
  if (maxConfidence >= 25) return 'low';
  return 'minimal';
}

/** Extract CVE IDs from vulnerability assessment results */
function extractCveIds(results: AnalysisResult[]): string[] {
  const cves = new Set<string>();

  for (const r of results) {
    if (!r.success) continue;
    const data = r.result as Record<string, unknown>;

    // From assess_vulnerability
    if (typeof data['cve_id'] === 'string') {
      cves.add(data['cve_id'] as string);
    }

    // From generate_remediation_plan steps
    const steps = data['prioritized_steps'] as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(steps)) {
      for (const step of steps) {
        const title = step['title'] as string | undefined;
        if (title) {
          const match = title.match(/CVE-\d{4}-\d+/i);
          if (match) cves.add(match[0].toUpperCase());
        }
      }
    }
  }

  return [...cves];
}

/** Execute a single MCP tool and return a normalised result record */
export async function executeSingleTool(
  toolName: string,
  args: Record<string, unknown>,
  mcpContext: MCPContext,
): Promise<{
  toolName: string;
  toolCategory: string;
  result: Record<string, unknown>;
  success: boolean;
  executionTimeMs: number;
  errorMessage?: string;
  confidence: number;
}> {
  const start = Date.now();

  const toolResult = await executeMCPTool(
    toolName,
    args,
    mcpContext.servicenowUrl,
    mcpContext.profileId,
  );

  const executionTimeMs = Date.now() - start;
  const result = toolResult.result ?? {};
  const confidence = toolResult.success ? estimateConfidence(toolName, result) : 0;

  const output: {
    toolName: string;
    toolCategory: string;
    result: Record<string, unknown>;
    success: boolean;
    executionTimeMs: number;
    errorMessage?: string;
    confidence: number;
  } = {
    toolName,
    toolCategory: 'security',
    result,
    success: toolResult.success,
    executionTimeMs,
    confidence,
  };
  if (toolResult.error) output.errorMessage = toolResult.error;
  return output;
}

/** Estimate confidence from a tool result (0-100) */
function estimateConfidence(toolName: string, result: Record<string, unknown>): number {
  switch (toolName) {
    case 'analyze_threat_indicator':
      return result['found'] === true ? 85 : 40;
    case 'assess_vulnerability':
      return result['found'] === true ? 90 : 30;
    case 'correlate_security_incidents': {
      const score = (result['correlation_score'] as number | undefined) ?? 0;
      return Math.round(score * 100);
    }
    case 'generate_remediation_plan':
      return 80;
    case 'analyze_attack_surface': {
      const overallRisk = (result['summary'] as Record<string, unknown> | undefined)?.['overall_risk_score'] as number | undefined;
      return overallRisk ?? 60;
    }
    case 'audit_security_compliance': {
      const score = (result['compliance_score'] as number | undefined) ?? 70;
      return score;
    }
    default:
      return 60;
  }
}
