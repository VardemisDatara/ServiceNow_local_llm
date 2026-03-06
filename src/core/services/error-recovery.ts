import { logger } from '../../utils/logger';

/**
 * T058: Error recovery strategies for connection loss and retry logic
 */

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
}

/**
 * Retry an async operation with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const { maxAttempts = 3, delayMs = 500, backoffMultiplier = 2 } = opts;
  let lastError: Error | unknown;
  let delay = delayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        logger.warn(`Operation failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms`, {}, err as Error);
        await sleep(delay);
        delay *= backoffMultiplier;
      }
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Classify an error for user-facing display */
export function classifyError(err: unknown): { title: string; message: string; retryable: boolean } {
  const message = err instanceof Error ? err.message : String(err);

  if (message.includes('Failed to connect') || message.includes('Connection refused')) {
    return {
      title: 'Connection Lost',
      message: 'Could not reach Ollama. Make sure it is running.',
      retryable: true,
    };
  }
  if (message.includes('timeout') || message.includes('Timeout')) {
    return {
      title: 'Request Timed Out',
      message: 'The AI took too long to respond. Try again or choose a smaller model.',
      retryable: true,
    };
  }
  if (message.includes('HTTP 404') || message.includes('model not found')) {
    return {
      title: 'Model Not Found',
      message: 'The selected model is not available in Ollama.',
      retryable: false,
    };
  }

  return {
    title: 'Unexpected Error',
    message,
    retryable: true,
  };
}
