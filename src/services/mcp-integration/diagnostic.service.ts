/**
 * Diagnostic Service for MCP Integration
 * 
 * This service is responsible for diagnosing issues with the local LLM's
 * integration with ServiceNow MCP tools.
 */

// Use mock clients for testing
import { MCPClient } from './mcp.client.mock';
import { LLMClient } from '../../llm/llm.client';

/**
 * Diagnoses the root cause of the LLM's failure to use the MCP tools.
 * 
 * @returns A diagnostic report containing the root cause and error details.
 */
export async function diagnoseMCPIntegration(): Promise<DiagnosticReport> {
  const report: DiagnosticReport = {
    timestamp: new Date().toISOString(),
    success: false,
    errors: [],
    rootCause: null,
  };

  try {
    // Step 1: Check if MCP Client is initialized
    const mcpClient = new MCPClient();
    if (!mcpClient.isInitialized()) {
      report.errors.push('MCP Client is not initialized');
      report.rootCause = 'MCP_CLIENT_NOT_INITIALIZED';
      return report;
    }

    // Step 2: Check if LLM Client is initialized
    const llmClient = new LLMClient();
    if (!llmClient.isInitialized()) {
      report.errors.push('LLM Client is not initialized');
      report.rootCause = 'LLM_CLIENT_NOT_INITIALIZED';
      return report;
    }

    // Step 3: Test MCP Client connectivity
    const mcpStatus = await mcpClient.checkConnectivity();
    if (!mcpStatus.connected) {
      report.errors.push('MCP Client cannot connect to ServiceNow');
      report.rootCause = 'MCP_CONNECTIVITY_ISSUE';
      return report;
    }

    // Step 4: Test LLM Client functionality
    const llmStatus = await llmClient.checkHealth();
    if (!llmStatus.healthy) {
      report.errors.push('LLM Client is not healthy');
      report.rootCause = 'LLM_HEALTH_ISSUE';
      return report;
    }

    // Step 5: Test integration between LLM and MCP
    try {
      const integrationTest = await llmClient.testMCPIntegration(mcpClient);
      if (!integrationTest.success) {
        report.errors.push('Integration test failed');
        report.rootCause = 'INTEGRATION_FAILURE';
        return report;
      }
    } catch (error) {
      report.errors.push(`Integration test error: ${error.message}`);
      report.rootCause = 'INTEGRATION_ERROR';
      return report;
    }

    // If all checks pass, the issue might be intermittent or not reproducible
    report.success = true;
    report.rootCause = 'NO_ISSUE_DETECTED';
    return report;

  } catch (error) {
    report.errors.push(`Unexpected error during diagnosis: ${error.message}`);
    report.rootCause = 'UNEXPECTED_ERROR';
    return report;
  }
}

/**
 * Interface for the diagnostic report.
 */
export interface DiagnosticReport {
  timestamp: string;
  success: boolean;
  errors: string[];
  rootCause:
    | 'MCP_CLIENT_NOT_INITIALIZED'
    | 'LLM_CLIENT_NOT_INITIALIZED'
    | 'MCP_CONNECTIVITY_ISSUE'
    | 'LLM_HEALTH_ISSUE'
    | 'INTEGRATION_FAILURE'
    | 'INTEGRATION_ERROR'
    | 'NO_ISSUE_DETECTED'
    | 'UNEXPECTED_ERROR'
    | null;
}
