/**
 * T073: MCP Error Handler
 * Centralized error handling for MCP communication failures
 */

import { logger } from '../../utils/logger';

export class MCPError extends Error {
  constructor(
    message: string,
    public readonly toolName: string,
    public readonly code: MCPErrorCode,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

export enum MCPErrorCode {
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  CREDENTIALS_MISSING = 'CREDENTIALS_MISSING',
  SERVICENOW_UNAVAILABLE = 'SERVICENOW_UNAVAILABLE',
  OLLAMA_UNAVAILABLE = 'OLLAMA_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  INVALID_ARGUMENTS = 'INVALID_ARGUMENTS',
  PARSE_ERROR = 'PARSE_ERROR',
}

/** Classify a raw error string from Tauri into an MCPError */
export function classifyMCPError(toolName: string, rawError: string): MCPError {
  if (rawError.includes('credentials') || rawError.includes('keychain')) {
    return new MCPError(rawError, toolName, MCPErrorCode.CREDENTIALS_MISSING, false);
  }
  if (rawError.includes('timeout') || rawError.includes('timed out')) {
    return new MCPError(rawError, toolName, MCPErrorCode.TIMEOUT, true);
  }
  if (rawError.includes('connect') || rawError.includes('connection refused')) {
    return new MCPError(rawError, toolName, MCPErrorCode.SERVICENOW_UNAVAILABLE, true);
  }
  if (rawError.includes('Unknown tool')) {
    return new MCPError(rawError, toolName, MCPErrorCode.TOOL_NOT_FOUND, false);
  }
  return new MCPError(rawError, toolName, MCPErrorCode.EXECUTION_FAILED, true);
}

/** Handle an MCP tool execution error, returning a user-friendly message */
export function handleMCPError(error: MCPError): string {
  logger.error(`MCP tool error [${error.code}]`, { toolName: error.toolName, retryable: error.retryable }, error);

  switch (error.code) {
    case MCPErrorCode.CREDENTIALS_MISSING:
      return `Unable to access ServiceNow credentials for tool "${error.toolName}". Please verify your profile settings.`;
    case MCPErrorCode.SERVICENOW_UNAVAILABLE:
      return `ServiceNow is currently unreachable. Tool "${error.toolName}" could not be executed.`;
    case MCPErrorCode.TIMEOUT:
      return `Tool "${error.toolName}" timed out. ServiceNow may be slow — try again.`;
    case MCPErrorCode.TOOL_NOT_FOUND:
      return `Tool "${error.toolName}" is not registered in the MCP server.`;
    case MCPErrorCode.INVALID_ARGUMENTS:
      return `Invalid arguments provided to tool "${error.toolName}": ${error.message}`;
    default:
      return `Tool "${error.toolName}" failed: ${error.message}`;
  }
}
