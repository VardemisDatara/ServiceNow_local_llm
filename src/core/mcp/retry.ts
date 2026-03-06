/**
 * T075: Retry logic with exponential backoff for MCP calls
 */

import { logger } from '../../utils/logger';

export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  backoffFactor: 2,
};

/** Sleep for the given number of milliseconds */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an async operation with exponential backoff retry.
 * Only retries if `shouldRetry(error)` returns true.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  shouldRetry: (error: unknown) => boolean,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;
  let delayMs = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === opts.maxAttempts || !shouldRetry(error)) {
        break;
      }

      logger.warn(`MCP operation failed (attempt ${attempt}/${opts.maxAttempts}), retrying in ${delayMs}ms`, {});
      await sleep(delayMs);
      delayMs = Math.min(delayMs * opts.backoffFactor, opts.maxDelayMs);
    }
  }

  throw lastError;
}
