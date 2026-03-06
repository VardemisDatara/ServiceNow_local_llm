/**
 * T082: audit_security_compliance tool
 * Audits systems against security compliance frameworks via ServiceNow GRC
 */

import { z } from 'zod';
import type { MCPToolDefinition, OllamaToolDefinition } from '../protocol';

export const auditComplianceInputSchema = z.object({
  framework: z
    .enum(['CIS', 'NIST_800-53', 'PCI-DSS', 'ISO_27001', 'SOC2'])
    .describe('Compliance framework to audit against'),
  framework_version: z.string().optional().describe('Specific framework version (e.g. "CIS v8.0")'),
  system_inventory: z
    .array(
      z.object({
        system_id: z.string().describe('Unique identifier for the system'),
        type: z.enum(['server', 'workstation', 'network_device', 'application']),
        os: z.string().describe('Operating system (e.g. "Ubuntu 22.04")'),
        configurations: z.record(z.unknown()).describe('System-specific configuration key-value pairs'),
      }),
    )
    .min(1),
  scope: z
    .array(z.string())
    .optional()
    .describe('Specific control IDs to audit; audits all if omitted'),
});

export const auditComplianceOutputSchema = z.object({
  framework: z.string(),
  framework_version: z.string(),
  compliance_score: z.number(),
  audit_summary: z.object({
    total_controls: z.number(),
    passed: z.number(),
    failed: z.number(),
    not_applicable: z.number(),
    not_tested: z.number(),
  }),
  failed_controls: z.array(
    z.object({
      control_id: z.string(),
      control_name: z.string(),
      severity: z.enum(['critical', 'high', 'medium', 'low']),
      affected_systems: z.array(z.string()),
      current_state: z.string(),
      expected_state: z.string(),
      gap_description: z.string(),
    }),
  ),
  remediation_priorities: z.array(
    z.object({
      control_id: z.string(),
      priority_rank: z.number(),
      remediation_steps: z.array(z.string()),
      estimated_effort_hours: z.number(),
      business_justification: z.string(),
    }),
  ),
  next_audit_date: z.string(),
});

export type AuditComplianceInput = z.infer<typeof auditComplianceInputSchema>;
export type AuditComplianceOutput = z.infer<typeof auditComplianceOutputSchema>;

export const auditComplianceTool: MCPToolDefinition = {
  name: 'audit_security_compliance',
  description:
    'Audit system configurations against security compliance frameworks (CIS, NIST 800-53, PCI-DSS, ISO 27001, SOC2) using ServiceNow GRC data. Returns compliance score, failed controls, and prioritized remediation guidance.',
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
            framework: {
              type: 'string',
              enum: ['CIS', 'NIST_800-53', 'PCI-DSS', 'ISO_27001', 'SOC2'],
              description: 'Compliance framework to audit against',
            },
            framework_version: {
              type: 'string',
              description: 'Specific version of the framework (optional)',
            },
            system_inventory: {
              type: 'array',
              description: 'Systems to include in the audit',
              items: {
                type: 'object',
                properties: {
                  system_id: { type: 'string' },
                  type: {
                    type: 'string',
                    enum: ['server', 'workstation', 'network_device', 'application'],
                  },
                  os: { type: 'string' },
                  configurations: { type: 'object' },
                },
                required: ['system_id', 'type', 'os', 'configurations'],
              },
            },
          },
          required: ['framework', 'system_inventory'],
        },
      },
    };
  },
};
