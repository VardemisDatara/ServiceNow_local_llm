/**
 * T111: Mistral AI streaming client
 * Uses the Mistral chat completions endpoint (OpenAI-compatible SSE format).
 */

import type { CloudLLMProvider, LLMMessage, LLMStreamCallbacks } from './provider';
import { classifyLLMError } from './error-handler';
import { logger } from '../../../utils/logger';

const MISTRAL_BASE_URL = 'https://api.mistral.ai/v1';
const TIMEOUT_MS = 60_000;

export const MISTRAL_MODELS = [
  'mistral-large-latest',
  'mistral-small-latest',
  'open-mistral-7b',
  'codestral-latest',
] as const;

/** Parse a single SSE chunk and call onToken if content is present */
function parseSseChunk(
  data: string,
  callbacks: LLMStreamCallbacks,
  startMs: number,
): boolean {
  if (data === '[DONE]') {
    callbacks.onDone(Date.now() - startMs);
    return true;
  }
  try {
    const parsed = JSON.parse(data) as {
      choices: Array<{ delta: { content?: string }; finish_reason: string | null }>;
    };
    const content = parsed.choices[0]?.delta.content;
    if (content) callbacks.onToken(content);
    if (parsed.choices[0]?.finish_reason === 'stop') {
      callbacks.onDone(Date.now() - startMs);
      return true;
    }
  } catch {
    // skip malformed SSE line
  }
  return false;
}

async function streamMistral(
  messages: LLMMessage[],
  model: string,
  apiKey: string,
  callbacks: LLMStreamCallbacks,
): Promise<void> {
  const startMs = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  logger.info('Mistral stream start', { model });

  try {
    const response = await fetch(`${MISTRAL_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, stream: true }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw classifyLLMError(response.status, 'Mistral', body, response.headers.get('Retry-After'));
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Mistral: response body unavailable');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (parseSseChunk(data, callbacks, startMs)) {
          logger.info('Mistral stream complete', { ms: Date.now() - startMs });
          return;
        }
      }
    }

    callbacks.onDone(Date.now() - startMs);
    logger.info('Mistral stream complete (EOF)', { ms: Date.now() - startMs });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      callbacks.onError('Mistral request timed out (60s)');
    } else {
      callbacks.onError(err instanceof Error ? err.message : String(err));
    }
    logger.error('Mistral stream failed', {}, err as Error);
  } finally {
    clearTimeout(timer);
  }
}

export const mistralProvider: CloudLLMProvider = {
  name: 'mistral',
  defaultModel: 'mistral-small-latest',
  availableModels: MISTRAL_MODELS,

  async stream(messages, model, apiKey, callbacks) {
    await streamMistral(messages, model, apiKey, callbacks);
  },
};
