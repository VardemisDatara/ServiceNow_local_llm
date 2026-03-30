/**
 * Script to run the MCP integration diagnostic service.
 */

import { diagnoseMCPIntegration } from './src/services/mcp-integration/diagnostic.service.ts';

async function runDiagnostic() {
  console.log('Running MCP Integration Diagnostic...');
  const report = await diagnoseMCPIntegration();
  console.log('Diagnostic Report:', report);
}

runDiagnostic().catch(console.error);
