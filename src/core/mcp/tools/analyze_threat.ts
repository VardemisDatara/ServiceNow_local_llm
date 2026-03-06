/**
 * T065 + T067: analyze_threat_indicator tool
 * Analyzes threat indicators (IP, hash, domain, URL) against ServiceNow Threat Intelligence
 */

import { z } from 'zod';
import type { MCPToolDefinition, OllamaToolDefinition } from '../protocol';

/** Zod schema for analyze_threat_indicator input */
export const analyzeThreatInputSchema = z.object({
  indicator: z.string().min(1).describe('The threat indicator value to analyze (e.g. IP address, domain, file hash, URL)'),
  indicator_type: z
    .enum(['ip', 'domain', 'hash', 'url'])
    .describe('Type of the indicator: ip, domain, hash, or url'),
});

/** Zod schema for analyze_threat_indicator output */
export const analyzeThreatOutputSchema = z.object({
  indicator: z.string(),
  indicator_type: z.string(),
  found: z.boolean(),
  risk_score: z.union([z.string(), z.number(), z.null()]).optional(),
  threat_type: z.union([z.string(), z.null()]).optional(),
  first_seen: z.union([z.string(), z.null()]).optional(),
  last_seen: z.union([z.string(), z.null()]).optional(),
  total_records: z.number().optional(),
  message: z.string().optional(),
});

export type AnalyzeThreatInput = z.infer<typeof analyzeThreatInputSchema>;
export type AnalyzeThreatOutput = z.infer<typeof analyzeThreatOutputSchema>;

/** MCP tool definition for analyze_threat_indicator */
export const analyzeThreatTool: MCPToolDefinition = {
  name: 'analyze_threat_indicator',
  description:
    'Analyze a threat indicator (IP address, domain, file hash, or URL) against ServiceNow Threat Intelligence to check for known malicious activity, risk scores, and threat type classification.',
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
            indicator: {
              type: 'string',
              description: 'The threat indicator to analyze (e.g., "1.2.3.4", "evil.com", "abc123hash", "https://bad.site")',
            },
            indicator_type: {
              type: 'string',
              enum: ['ip', 'domain', 'hash', 'url'],
              description: 'Type of indicator: ip, domain, hash, or url',
            },
          },
          required: ['indicator', 'indicator_type'],
        },
      },
    };
  },
};
