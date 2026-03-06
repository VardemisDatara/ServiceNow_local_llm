/**
 * T079: correlate_security_incidents tool
 * Correlates multiple security incidents to identify attack patterns and common indicators
 */

import { z } from 'zod';
import type { MCPToolDefinition, OllamaToolDefinition } from '../protocol';

export const correlateIncidentsInputSchema = z.object({
  incident_ids: z
    .array(z.string())
    .min(2)
    .describe('Array of ServiceNow incident IDs to correlate (minimum 2)'),
  time_window_hours: z
    .number()
    .int()
    .min(1)
    .max(720)
    .default(24)
    .describe('Time window for correlation analysis in hours (default 24)'),
  correlation_threshold: z
    .number()
    .min(0)
    .max(1)
    .default(0.6)
    .describe('Minimum similarity score 0-1 to consider incidents correlated (default 0.6)'),
});

export const correlateIncidentsOutputSchema = z.object({
  correlation_score: z.number(),
  correlation_type: z.enum(['direct', 'indirect', 'none']),
  common_indicators: z.object({
    ip_addresses: z.array(z.string()),
    domains: z.array(z.string()),
    user_accounts: z.array(z.string()),
    affected_systems: z.array(z.string()),
    attack_vectors: z.array(z.string()),
  }),
  attack_pattern: z.object({
    name: z.string(),
    mitre_attack_ids: z.array(z.string()),
    confidence: z.number(),
  }),
  incidents_analyzed: z.number(),
  message: z.string().optional(),
});

export type CorrelateIncidentsInput = z.infer<typeof correlateIncidentsInputSchema>;
export type CorrelateIncidentsOutput = z.infer<typeof correlateIncidentsOutputSchema>;

export const correlateIncidentsTool: MCPToolDefinition = {
  name: 'correlate_security_incidents',
  description:
    'Correlate multiple security incidents to identify attack patterns, common indicators, and threat attribution. Returns correlation score, shared IOCs, and MITRE ATT&CK mappings.',
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
            incident_ids: {
              type: 'array',
              items: { type: 'string' },
              description: 'ServiceNow incident IDs to correlate (minimum 2)',
            },
            time_window_hours: {
              type: 'number',
              description: 'Time window in hours for correlation analysis (default 24)',
            },
            correlation_threshold: {
              type: 'number',
              description: 'Min similarity score 0-1 (default 0.6)',
            },
          },
          required: ['incident_ids'],
        },
      },
    };
  },
};
