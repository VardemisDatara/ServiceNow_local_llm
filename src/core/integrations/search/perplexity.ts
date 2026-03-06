/**
 * T100: Perplexity search provider
 * Uses the Perplexity OpenAI-compatible chat API with an online (search-augmented) model.
 * The sonar model streams web-sourced answers with inline citations.
 */

import { logger } from '../../../utils/logger';
import type { SearchResult, SearchProvider } from './provider';

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const PERPLEXITY_MODEL = 'sonar'; // current Perplexity standard model (replaces llama-3.1-sonar-small-128k-online)
const TIMEOUT_MS = 15_000;

/**
 * Parse citations from Perplexity's response content.
 * Perplexity inline-cites sources as [1], [2] etc. and returns them in `citations`.
 */
function buildResults(content: string, citations: string[]): SearchResult[] {
  if (citations.length === 0) {
    return [{ title: 'Perplexity Search', url: '', snippet: content.slice(0, 300) }];
  }

  return citations.slice(0, 3).map((url, i) => ({
    title: `Source ${i + 1}`,
    url,
    snippet: content.slice(0, 200),
  }));
}

async function searchPerplexity(query: string, apiKey: string): Promise<SearchResult[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(PERPLEXITY_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model: PERPLEXITY_MODEL,
        messages: [{ role: 'user', content: query }],
        max_tokens: 512,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Perplexity API HTTP ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      citations?: string[];
    };

    const content = data.choices[0]?.message.content ?? '';
    const citations = data.citations ?? [];
    return buildResults(content, citations);
  } finally {
    clearTimeout(timer);
  }
}

export const perplexityProvider: SearchProvider = {
  name: 'perplexity',

  async search(query: string, apiKey?: string): Promise<SearchResult[]> {
    if (!apiKey) {
      logger.warn('Perplexity search skipped — no API key');
      return [];
    }
    logger.info('Perplexity search', { query });
    const start = Date.now();
    try {
      const results = await searchPerplexity(query, apiKey);
      logger.info('Perplexity search complete', { query, count: results.length, ms: Date.now() - start });
      return results;
    } catch (err) {
      logger.error('Perplexity search failed', { query }, err as Error);
      return [];
    }
  },
};
