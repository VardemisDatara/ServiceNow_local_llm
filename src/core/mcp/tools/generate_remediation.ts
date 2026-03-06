/**
 * T080: generate_remediation_plan tool
 * Generates a prioritized remediation plan for security vulnerabilities
 */

import { z } from 'zod';
import type { MCPToolDefinition, OllamaToolDefinition } from '../protocol';

export const generateRemediationInputSchema = z.object({
  vulnerability_data: z.object({
    cve_ids: z.array(z.string()).optional().describe('CVE identifiers to remediate'),
    findings: z
      .array(
        z.object({
          title: z.string(),
          severity: z.enum(['critical', 'high', 'medium', 'low']),
          description: z.string(),
          affected_systems: z.array(z.string()),
        }),
      )
      .optional()
      .describe('Custom security findings to include in the plan'),
  }),
  business_context: z.object({
    environment: z
      .enum(['production', 'staging', 'development'])
      .describe('Target environment'),
    business_criticality: z
      .enum(['critical', 'high', 'medium', 'low'])
      .describe('Business criticality of affected systems'),
    maintenance_window_available: z
      .boolean()
      .describe('Whether a maintenance window is available'),
    available_resources: z.number().int().min(1).describe('Available team size'),
  }),
  constraints: z
    .object({
      max_downtime_hours: z.number().optional(),
      must_maintain_uptime_percent: z.number().optional(),
      budget_limit_usd: z.number().optional(),
    })
    .optional(),
});

export const generateRemediationOutputSchema = z.object({
  plan_summary: z.object({
    total_steps: z.number(),
    estimated_total_hours: z.number(),
    recommended_timeline: z.string(),
  }),
  prioritized_steps: z.array(
    z.object({
      step_number: z.number(),
      title: z.string(),
      description: z.string(),
      priority: z.enum(['critical', 'high', 'medium', 'low']),
      estimated_effort_hours: z.number(),
      requires_downtime: z.boolean(),
      success_criteria: z.array(z.string()),
      rollback_plan: z.string(),
    }),
  ),
  risks: z.array(
    z.object({
      risk: z.string(),
      likelihood: z.enum(['high', 'medium', 'low']),
      impact: z.enum(['high', 'medium', 'low']),
      mitigation: z.string(),
    }),
  ),
  validation_checklist: z.array(z.string()),
});

export type GenerateRemediationInput = z.infer<typeof generateRemediationInputSchema>;
export type GenerateRemediationOutput = z.infer<typeof generateRemediationOutputSchema>;

export const generateRemediationTool: MCPToolDefinition = {
  name: 'generate_remediation_plan',
  description:
    'Generate a prioritized remediation plan for security vulnerabilities or findings. Queries ServiceNow Vulnerability Management for CVSS context and produces step-by-step remediation steps with effort estimates and risk analysis.',
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
            vulnerability_data: {
              type: 'object',
              description: 'CVE IDs or custom findings to remediate',
              properties: {
                cve_ids: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'CVE identifiers to include',
                },
              },
            },
            business_context: {
              type: 'object',
              description: 'Business environment and resource context',
              properties: {
                environment: {
                  type: 'string',
                  enum: ['production', 'staging', 'development'],
                },
                business_criticality: {
                  type: 'string',
                  enum: ['critical', 'high', 'medium', 'low'],
                },
                maintenance_window_available: { type: 'boolean' },
                available_resources: { type: 'number' },
              },
              required: [
                'environment',
                'business_criticality',
                'maintenance_window_available',
                'available_resources',
              ],
            },
          },
          required: ['vulnerability_data', 'business_context'],
        },
      },
    };
  },
};
