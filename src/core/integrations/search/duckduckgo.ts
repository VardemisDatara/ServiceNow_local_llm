import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../../utils/logger';

/**
 * T051: DuckDuckGo search provider
 * Proxied through Rust to avoid CORS
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  logger.info('DuckDuckGo search', { query });
  const start = Date.now();

  try {
    const results = await invoke<SearchResult[]>('search_duckduckgo', { query });
    logger.info('DuckDuckGo search complete', { query, count: results.length, ms: Date.now() - start });
    return results;
  } catch (err) {
    logger.error('DuckDuckGo search failed', { query }, err as Error);
    return [];
  }
}
