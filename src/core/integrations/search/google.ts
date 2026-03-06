/**
 * T101: Google Custom Search API provider
 * Uses the Google Custom Search JSON API (requires API key + Programmable Search Engine ID).
 * Docs: https://developers.google.com/custom-search/v1/reference/rest/v1/cse/list
 */

import { logger } from '../../../utils/logger';
import type { SearchResult, SearchProvider } from './provider';

const GOOGLE_API_URL = 'https://www.googleapis.com/customsearch/v1';
const TIMEOUT_MS = 10_000;

interface GoogleSearchItem {
  title: string;
  link: string;
  snippet: string;
}

interface GoogleSearchResponse {
  items?: GoogleSearchItem[];
  error?: { message: string; code: number };
}

async function searchGoogle(
  query: string,
  apiKey: string,
  cx: string,
): Promise<SearchResult[]> {
  const url = new URL(GOOGLE_API_URL);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('cx', cx);
  url.searchParams.set('q', query);
  url.searchParams.set('num', '5');
  url.searchParams.set('safe', 'active');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Google Search API HTTP ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = (await response.json()) as GoogleSearchResponse;

    if (data.error) {
      throw new Error(`Google Search API error ${data.error.code}: ${data.error.message}`);
    }

    return (data.items ?? []).map((item) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
    }));
  } finally {
    clearTimeout(timer);
  }
}

export const googleProvider: SearchProvider = {
  name: 'google',

  async search(query: string, apiKey?: string, extra?: Record<string, string>): Promise<SearchResult[]> {
    if (!apiKey) {
      logger.warn('Google search skipped — no API key');
      return [];
    }
    const cx = extra?.['cx'] ?? '';
    if (!cx) {
      logger.warn('Google search skipped — no Search Engine ID (cx)');
      return [];
    }

    logger.info('Google search', { query });
    const start = Date.now();
    try {
      const results = await searchGoogle(query, apiKey, cx);
      logger.info('Google search complete', { query, count: results.length, ms: Date.now() - start });
      return results;
    } catch (err) {
      logger.error('Google search failed', { query }, err as Error);
      return [];
    }
  },
};
