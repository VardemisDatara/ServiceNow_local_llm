/**
 * T081: analyze_attack_surface tool
 * Analyzes the external attack surface using ServiceNow CMDB data
 */

import { z } from 'zod';
import type { MCPToolDefinition, OllamaToolDefinition } from '../protocol';

export const analyzeAttackSurfaceInputSchema = z.object({
  target_scope: z.object({
    ip_ranges: z
      .array(z.string())
      .optional()
      .describe('CIDR IP ranges to analyze (e.g. "192.0.2.0/24")'),
    domains: z.array(z.string()).optional().describe('Domains to analyze'),
    exclude: z.array(z.string()).optional().describe('IPs or domains to exclude'),
  }),
  scan_depth: z
    .enum(['quick', 'standard', 'thorough'])
    .describe('Depth of attack surface analysis'),
  focus_areas: z
    .array(z.enum(['ports', 'ssl', 'dns', 'web_apps', 'cloud_assets']))
    .optional()
    .describe('Specific areas to focus on'),
});

export const analyzeAttackSurfaceOutputSchema = z.object({
  summary: z.object({
    total_assets: z.number(),
    exposed_services: z.number(),
    vulnerabilities_found: z.number(),
    overall_risk_score: z.number(),
  }),
  exposed_services: z.array(
    z.object({
      asset: z.string(),
      port: z.number(),
      protocol: z.enum(['tcp', 'udp']),
      service: z.string(),
      version: z.string().nullable(),
      is_publicly_accessible: z.boolean(),
    }),
  ),
  vulnerabilities: z.array(
    z.object({
      asset: z.string(),
      service: z.string(),
      vulnerability_type: z.string(),
      severity: z.enum(['critical', 'high', 'medium', 'low']),
      cve_ids: z.array(z.string()),
      description: z.string(),
    }),
  ),
  risk_assessment: z.object({
    critical_findings: z.number(),
    high_findings: z.number(),
    attack_vectors: z.array(z.string()),
    compliance_issues: z.array(z.string()),
  }),
  hardening_recommendations: z.array(
    z.object({
      asset: z.string(),
      recommendation: z.string(),
      priority: z.enum(['immediate', 'high', 'medium', 'low']),
      effort_estimate: z.string(),
    }),
  ),
});

export type AnalyzeAttackSurfaceInput = z.infer<typeof analyzeAttackSurfaceInputSchema>;
export type AnalyzeAttackSurfaceOutput = z.infer<typeof analyzeAttackSurfaceOutputSchema>;

export const analyzeAttackSurfaceTool: MCPToolDefinition = {
  name: 'analyze_attack_surface',
  description:
    'Analyze the attack surface for specified IP ranges or domains using ServiceNow CMDB data, identifying exposed services, open ports, and vulnerabilities across the environment.',
  category: 'security',
  provider: 'servicenow',

  toOllamaDefinition(): OllamaToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: {
          type: 'object',
          properties: {
            target_scope: {
              type: 'object',
              description: 'IP ranges or domains to analyze',
              properties: {
                ip_ranges: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'CIDR notation IP ranges',
                },
                domains: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Domains to analyze',
                },
              },
            },
            scan_depth: {
              type: 'string',
              enum: ['quick', 'standard', 'thorough'],
              description: 'Depth of attack surface analysis',
            },
            focus_areas: {
              type: 'array',
              items: { type: 'string', enum: ['ports', 'ssl', 'dns', 'web_apps', 'cloud_assets'] },
              description: 'Specific focus areas for analysis',
            },
          },
          required: ['target_scope', 'scan_depth'],
        },
      },
    };
  },
};
