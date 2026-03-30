/**
 * Integration Tests for MCP Integration
 * 
 * These tests verify the integration between the local LLM and ServiceNow MCP tools.
 */

import { diagnoseMCPIntegration } from '../../src/services/mcp-integration/diagnostic.service';

describe('MCP Integration Diagnostic Service', () => {
  it('should diagnose MCP integration issues', async () => {
    const report = await diagnoseMCPIntegration();
    
    // Verify the report structure
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('success');
    expect(report).toHaveProperty('errors');
    expect(report).toHaveProperty('rootCause');
    
    // Verify the report is an array
    expect(Array.isArray(report.errors)).toBe(true);
  });

  it('should handle no issue detected', async () => {
    const report = await diagnoseMCPIntegration();
    
    expect(report.success).toBe(true);
    expect(report.rootCause).toBe('NO_ISSUE_DETECTED');
    expect(report.errors).toHaveLength(0);
  });
});
