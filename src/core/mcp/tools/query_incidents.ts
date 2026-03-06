/**
 * query_incidents tool
 * Lists security incidents (or regular incidents) from ServiceNow
 */

import { z } from 'zod';
import type { MCPToolDefinition, OllamaToolDefinition } from '../protocol';

export const queryIncidentsInputSchema = z.object({
  state: z
    .enum(['open', 'all', 'closed'])
    .default('open')
    .describe('Filter by state: open (active), all, or closed'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .describe('Maximum number of incidents to return (1-100)'),
});

export const queryIncidentsOutputSchema = z.object({
  incidents: z.array(
    z.object({
      number: z.string(),
      short_description: z.string(),
      state: z.string(),
      priority: z.string().optional(),
      category: z.string().optional(),
      assigned_to: z.string().optional(),
      opened_at: z.string().optional(),
    }),
  ),
  total: z.number(),
  table: z.string(),
  message: z.string().optional(),
});

export type QueryIncidentsInput = z.infer<typeof queryIncidentsInputSchema>;
export type QueryIncidentsOutput = z.infer<typeof queryIncidentsOutputSchema>;

export const queryIncidentsTool: MCPToolDefinition = {
  name: 'query_incidents',
  description:
    'Query security incidents (or regular incidents) from ServiceNow. Returns a list with number, description, state, priority and category.',
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
            state: {
              type: 'string',
              enum: ['open', 'all', 'closed'],
              description: 'Filter by state: open (default), all, or closed',
            },
            limit: {
              type: 'number',
              description: 'Max number of results (1-20, default 10)',
            },
          },
          required: [],
        },
      },
    };
  },
};
