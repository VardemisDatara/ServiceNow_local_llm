/**
 * T119: LLM API error handler
 * Classifies HTTP errors from cloud LLM providers (OpenAI, Mistral) into typed errors.
 */

export class LLMQuotaError extends Error {
  readonly provider: string;

  constructor(provider: string, detail: string) {
    super(`${provider} quota exceeded — ${detail}`);
    this.name = 'LLMQuotaError';
    this.provider = provider;
  }
}

export class LLMAuthError extends Error {
  readonly provider: string;

  constructor(provider: string) {
    super(`${provider} authentication failed — verify your API key in Settings`);
    this.name = 'LLMAuthError';
    this.provider = provider;
  }
}

export class LLMRateLimitError extends Error {
  readonly provider: string;
  readonly retryAfterMs: number;

  constructor(provider: string, retryAfterMs = 60_000) {
    super(`${provider} rate limit reached — retry after ${Math.ceil(retryAfterMs / 1000)}s`);
    this.name = 'LLMRateLimitError';
    this.provider = provider;
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Classify an HTTP error response from a cloud LLM provider into a typed error.
 * @param status - HTTP status code
 * @param provider - Provider name (e.g. 'OpenAI', 'Mistral')
 * @param body - Raw response body text (truncated for error messages)
 * @param retryAfterHeader - Value of Retry-After response header if present
 */
export function classifyLLMError(
  status: number,
  provider: string,
  body: string,
  retryAfterHeader?: string | null,
): Error {
  const detail = body.slice(0, 300);

  if (status === 401 || status === 403) {
    return new LLMAuthError(provider);
  }
  if (status === 402) {
    return new LLMQuotaError(provider, detail);
  }
  if (status === 429) {
    const secs = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
    const retryMs = Number.isFinite(secs) ? secs * 1000 : 60_000;
    return new LLMRateLimitError(provider, retryMs);
  }
  return new Error(`${provider} API error ${status}: ${detail}`);
}
