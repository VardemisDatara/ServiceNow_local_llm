/**
 * T064: Tool Registry Service
 * Central registry of available MCP tools with dynamic loading support
 */

import { analyzeThreatTool } from '../mcp/tools/analyze_threat';
import { assessVulnerabilityTool } from '../mcp/tools/assess_vulnerability';
import { queryIncidentsTool } from '../mcp/tools/query_incidents';
import { correlateIncidentsTool } from '../mcp/tools/correlate_incidents';
import { generateRemediationTool } from '../mcp/tools/generate_remediation';
import { analyzeAttackSurfaceTool } from '../mcp/tools/analyze_attack_surface';
import { auditComplianceTool } from '../mcp/tools/audit_compliance';
import type { MCPToolDefinition, OllamaToolDefinition } from '../mcp/protocol';
import { logger } from '../../utils/logger';

/** All registered MCP tools */
const REGISTERED_TOOLS: MCPToolDefinition[] = [
  analyzeThreatTool,
  assessVulnerabilityTool,
  queryIncidentsTool,
  correlateIncidentsTool,
  generateRemediationTool,
  analyzeAttackSurfaceTool,
  auditComplianceTool,
];

/** Get a tool definition by name */
export function getTool(name: string): MCPToolDefinition | undefined {
  return REGISTERED_TOOLS.find((t) => t.name === name);
}

/** Get all registered tool definitions */
export function getAllTools(): MCPToolDefinition[] {
  return [...REGISTERED_TOOLS];
}

/** Get all tools as Ollama function tool definitions (for passing to check_ollama_tool_calls) */
export function getOllamaToolDefinitions(): OllamaToolDefinition[] {
  return REGISTERED_TOOLS.map((t) => t.toOllamaDefinition());
}

/** Get tools filtered by category */
export function getToolsByCategory(
  category: MCPToolDefinition['category'],
): MCPToolDefinition[] {
  return REGISTERED_TOOLS.filter((t) => t.category === category);
}

/** Log registry summary on startup */
export function logRegistrySummary(): void {
  logger.info(`MCP tool registry loaded: ${REGISTERED_TOOLS.length} tools`, {
    tools: REGISTERED_TOOLS.map((t) => t.name),
  });
}
