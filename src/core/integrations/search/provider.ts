/**
 * T099: Search provider interface
 * Common contract for all search provider implementations
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/** Context needed to call a search provider */
export interface SearchContext {
  provider: 'duckduckgo' | 'perplexity' | 'google';
  /** Tauri profileId used to retrieve API keys from the OS keychain */
  profileId: string;
}

/** Unified search provider interface */
export interface SearchProvider {
  readonly name: string;
  search(query: string, apiKey?: string, extra?: Record<string, string>): Promise<SearchResult[]>;
}
