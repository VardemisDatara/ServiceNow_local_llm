/**
 * Custom error types for ServiceNow MCP Bridge
 * Provides structured error handling with context and recovery hints
 */

export enum ErrorCode {
  // Configuration errors (1000-1099)
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  CONFIG_INVALID = 'CONFIG_INVALID',
  CONFIG_MISSING_CREDENTIALS = 'CONFIG_MISSING_CREDENTIALS',

  // Database errors (1100-1199)
  DATABASE_CONNECTION_FAILED = 'DATABASE_CONNECTION_FAILED',
  DATABASE_QUERY_FAILED = 'DATABASE_QUERY_FAILED',
  DATABASE_MIGRATION_FAILED = 'DATABASE_MIGRATION_FAILED',
  DATABASE_CONSTRAINT_VIOLATION = 'DATABASE_CONSTRAINT_VIOLATION',

  // Credential errors (1200-1299)
  CREDENTIAL_NOT_FOUND = 'CREDENTIAL_NOT_FOUND',
  CREDENTIAL_INVALID = 'CREDENTIAL_INVALID',
  CREDENTIAL_STORAGE_FAILED = 'CREDENTIAL_STORAGE_FAILED',
  CREDENTIAL_RETRIEVAL_FAILED = 'CREDENTIAL_RETRIEVAL_FAILED',

  // ServiceNow errors (2000-2099)
  SERVICENOW_CONNECTION_FAILED = 'SERVICENOW_CONNECTION_FAILED',
  SERVICENOW_AUTH_FAILED = 'SERVICENOW_AUTH_FAILED',
  SERVICENOW_API_ERROR = 'SERVICENOW_API_ERROR',
  SERVICENOW_TIMEOUT = 'SERVICENOW_TIMEOUT',

  // Ollama errors (2100-2199)
  OLLAMA_CONNECTION_FAILED = 'OLLAMA_CONNECTION_FAILED',
  OLLAMA_MODEL_NOT_FOUND = 'OLLAMA_MODEL_NOT_FOUND',
  OLLAMA_INFERENCE_FAILED = 'OLLAMA_INFERENCE_FAILED',
  OLLAMA_TIMEOUT = 'OLLAMA_TIMEOUT',

  // MCP errors (2200-2299)
  MCP_TOOL_NOT_FOUND = 'MCP_TOOL_NOT_FOUND',
  MCP_TOOL_EXECUTION_FAILED = 'MCP_TOOL_EXECUTION_FAILED',
  MCP_INVALID_INPUT = 'MCP_INVALID_INPUT',
  MCP_INVALID_OUTPUT = 'MCP_INVALID_OUTPUT',
  MCP_SERVER_ERROR = 'MCP_SERVER_ERROR',
  MCP_CLIENT_ERROR = 'MCP_CLIENT_ERROR',

  // Search errors (2300-2399)
  SEARCH_PROVIDER_UNAVAILABLE = 'SEARCH_PROVIDER_UNAVAILABLE',
  SEARCH_API_ERROR = 'SEARCH_API_ERROR',
  SEARCH_RATE_LIMITED = 'SEARCH_RATE_LIMITED',
  SEARCH_INVALID_QUERY = 'SEARCH_INVALID_QUERY',

  // Session errors (3000-3099)
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_CREATION_FAILED = 'SESSION_CREATION_FAILED',

  // Network errors (4000-4099)
  NETWORK_ERROR = 'NETWORK_ERROR',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_OFFLINE = 'NETWORK_OFFLINE',

  // Validation errors (5000-5099)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Unknown/Unexpected errors (9000-9999)
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export interface ErrorContext {
  [key: string]: unknown;
}

/**
 * Base application error class
 * All custom errors should extend this
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly context?: ErrorContext,
    public readonly cause?: Error,
    public readonly recoverable: boolean = true,
    public readonly userMessage?: string
  ) {
    super(message);
    this.name = 'AppError';

    // Maintain proper stack trace (only available in V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Get a user-friendly error message
   */
  getUserMessage(): string {
    return this.userMessage || this.message;
  }

  /**
   * Convert to JSON for logging/transmission
   */
  toJSON(): object {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      context: this.context,
      recoverable: this.recoverable,
      stack: this.stack,
      cause: this.cause ? {
        name: this.cause.name,
        message: this.cause.message,
        stack: this.cause.stack,
      } : undefined,
    };
  }
}

/**
 * Configuration-related errors
 */
export class ConfigurationError extends AppError {
  constructor(
    code: ErrorCode,
    message: string,
    context?: ErrorContext,
    cause?: Error
  ) {
    super(code, message, context, cause, true, 'Configuration error. Please check your settings.');
  }
}

/**
 * Database-related errors
 */
export class DatabaseError extends AppError {
  constructor(
    code: ErrorCode,
    message: string,
    context?: ErrorContext,
    cause?: Error
  ) {
    super(code, message, context, cause, false, 'Database error. Please try again.');
  }
}

/**
 * Credential/Authentication errors
 */
export class CredentialError extends AppError {
  constructor(
    code: ErrorCode,
    message: string,
    context?: ErrorContext,
    cause?: Error
  ) {
    super(code, message, context, cause, true, 'Credential error. Please check your credentials.');
  }
}

/**
 * ServiceNow API errors
 */
export class ServiceNowError extends AppError {
  constructor(
    code: ErrorCode,
    message: string,
    public readonly statusCode?: number,
    context?: ErrorContext,
    cause?: Error
  ) {
    super(
      code,
      message,
      { ...context, statusCode },
      cause,
      statusCode ? statusCode < 500 : true,
      'ServiceNow connection error. Please check your configuration.'
    );
  }
}

/**
 * Ollama API errors
 */
export class OllamaError extends AppError {
  constructor(
    code: ErrorCode,
    message: string,
    context?: ErrorContext,
    cause?: Error
  ) {
    super(
      code,
      message,
      context,
      cause,
      true,
      'Ollama connection error. Please ensure Ollama is running.'
    );
  }
}

/**
 * MCP protocol errors
 */
export class MCPError extends AppError {
  constructor(
    code: ErrorCode,
    message: string,
    public readonly toolName?: string,
    context?: ErrorContext,
    cause?: Error
  ) {
    super(
      code,
      message,
      { ...context, toolName },
      cause,
      true,
      'MCP tool error. The operation could not be completed.'
    );
  }
}

/**
 * Search provider errors
 */
export class SearchError extends AppError {
  constructor(
    code: ErrorCode,
    message: string,
    public readonly provider?: string,
    context?: ErrorContext,
    cause?: Error
  ) {
    super(
      code,
      message,
      { ...context, provider },
      cause,
      true,
      'Search error. Unable to retrieve results.'
    );
  }
}

/**
 * Network errors
 */
export class NetworkError extends AppError {
  constructor(
    code: ErrorCode,
    message: string,
    context?: ErrorContext,
    cause?: Error
  ) {
    super(
      code,
      message,
      context,
      cause,
      true,
      'Network error. Please check your connection.'
    );
  }
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown,
    context?: ErrorContext
  ) {
    super(
      ErrorCode.VALIDATION_ERROR,
      message,
      { ...context, field, value },
      undefined,
      true,
      `Validation error: ${message}`
    );
  }
}

/**
 * Error handler utility
 */
export class ErrorHandler {
  /**
   * Convert unknown error to AppError
   */
  static toAppError(error: unknown): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      return new AppError(
        ErrorCode.UNKNOWN_ERROR,
        error.message,
        undefined,
        error
      );
    }

    return new AppError(
      ErrorCode.UNKNOWN_ERROR,
      String(error)
    );
  }

  /**
   * Check if error is recoverable
   */
  static isRecoverable(error: unknown): boolean {
    if (error instanceof AppError) {
      return error.recoverable;
    }
    return true; // Assume unknown errors are recoverable
  }

  /**
   * Get user-friendly error message
   */
  static getUserMessage(error: unknown): string {
    if (error instanceof AppError) {
      return error.getUserMessage();
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'An unexpected error occurred. Please try again.';
  }

  /**
   * Log error with appropriate level
   */
  static logError(error: unknown, logger: { error: (msg: string, ctx?: object, err?: Error) => void }): void {
    const appError = ErrorHandler.toAppError(error);

    logger.error(appError.message, {
      code: appError.code,
      context: appError.context,
      recoverable: appError.recoverable,
    }, appError.cause);
  }
}

/**
 * Result type for operations that can fail
 * Inspired by Rust's Result<T, E>
 */
export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Create a success result
 */
export function Ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * Create an error result
 */
export function Err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Unwrap a result or throw if error
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  throw result.error;
}

/**
 * Get result value or default
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return result.ok ? result.value : defaultValue;
}

/**
 * Map result value if ok
 */
export function mapResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  return result.ok ? Ok(fn(result.value)) : result;
}

/**
 * Async try-catch wrapper that returns Result
 */
export async function tryAsync<T>(
  fn: () => Promise<T>
): Promise<Result<T, AppError>> {
  try {
    const value = await fn();
    return Ok(value);
  } catch (error) {
    return Err(ErrorHandler.toAppError(error));
  }
}
