import { searchDuckDuckGo, type SearchResult } from '../integrations/search/duckduckgo';
import { perplexityProvider } from '../integrations/search/perplexity';
import { googleProvider } from '../integrations/search/google';
import type { SearchContext } from '../integrations/search/provider';
import { IPC } from '../../main/ipc';
import { logger } from '../../utils/logger';

/**
 * T052 + T053 + T102 + T108: Web search augmentation
 *
 * Detects from the USER'S MESSAGE whether current web data is needed,
 * searches BEFORE streaming Ollama, and injects results into context
 * so Ollama's answer incorporates them naturally.
 */

// Patterns in the USER'S MESSAGE that signal web search is needed
const PROACTIVE_SEARCH_PATTERNS = [
  // Explicit recency signals
  /\b(latest|recent|current|today|this week|this month|this year)\b/i,
  // Year references beyond typical training cutoff
  /\b202[4-9]\b/,
  // News / event language
  /\b(news|happened|happening|announce(d|ment)|disclos(e|ed|ure)|released?)\b/i,
  // CVE / security + recency
  /\b(cve|vulnerabilit|exploit|patch|breach).{0,40}\b(202[4-9]|latest|recent|new|last (month|week|year))\b/i,
  /\b(202[4-9]|latest|recent|last (month|week|year)).{0,40}\b(cve|vulnerabilit|exploit|patch)\b/i,
];

/** Returns true when the user's message needs current web information */
export function needsProactiveSearch(userMessage: string): boolean {
  return PROACTIVE_SEARCH_PATTERNS.some((p) => p.test(userMessage));
}

/**
 * Extract a concise search query from the user's message.
 * Strips conversational preamble and focuses on the key topic.
 */
export function extractSearchQuery(userMessage: string): string {
  const stripped = userMessage
    .replace(/^(what|who|when|where|why|how|can you|could you|tell me|explain|describe)\s+(is|are|was|were|do|does|did|the|a|an)?\s*/i, '')
    .replace(/\?$/, '')
    .trim();
  return stripped.length > 100 ? stripped.substring(0, 100) : stripped || userMessage;
}

/**
 * Format search results as a natural assistant-style summary.
 * Injected as an assistant message in prior conversation so the model
 * treats it as information it already "said" — the same pattern that works
 * for MCP tool results in this app.
 */
export function formatSearchForContext(results: SearchResult[], query: string): string {
  if (results.length === 0) return `I searched the web for "${query}" but found no results.`;
  const bullets = results
    .map((r) => `- ${r.snippet.replace(/\*\*/g, '')}`)
    .join('\n');
  return `I looked up current information about "${query}" and found:\n${bullets}`;
}

/** Parse Google's composite keychain value: "apiKey|||cx" */
function parseGoogleKey(stored: string): { key: string; cx: string } {
  const sep = stored.indexOf('|||');
  if (sep !== -1) return { key: stored.slice(0, sep), cx: stored.slice(sep + 3) };
  try {
    const parsed = JSON.parse(stored) as { key?: string; cx?: string };
    return { key: parsed.key ?? stored, cx: parsed.cx ?? '' };
  } catch {
    return { key: stored, cx: '' };
  }
}

/**
 * Perform web search based on the user's message.
 * Called BEFORE streaming Ollama so results can be injected as context.
 * Falls back to DuckDuckGo when the configured provider fails.
 */
export async function augmentWithSearch(
  userMessage: string,
  searchContext?: SearchContext,
): Promise<{
  shouldAugment: boolean;
  searchResults: SearchResult[];
  query: string;
  provider: string;
  error?: string;
}> {
  if (!needsProactiveSearch(userMessage)) {
    return { shouldAugment: false, searchResults: [], query: '', provider: '' };
  }

  logger.info('Proactive web search triggered by user message');

  const query = extractSearchQuery(userMessage);
  const provider = searchContext?.provider ?? 'duckduckgo';
  let results: SearchResult[] = [];
  let lastError: string | undefined;

  if (provider === 'perplexity' && searchContext) {
    try {
      const apiKey = await IPC.getApiKey('perplexity', searchContext.profileId);
      results = await perplexityProvider.search(query, apiKey);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      logger.warn('Perplexity search failed, falling back to DuckDuckGo', {}, err as Error);
    }
  } else if (provider === 'google' && searchContext) {
    try {
      const stored = await IPC.getApiKey('google', searchContext.profileId);
      const { key, cx } = parseGoogleKey(stored);
      results = await googleProvider.search(query, key, { cx });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      logger.warn('Google search failed, falling back to DuckDuckGo', {}, err as Error);
    }
  }

  const usedProvider = results.length > 0 ? provider : 'duckduckgo';
  if (results.length === 0) {
    if (provider !== 'duckduckgo') logger.info('Falling back to DuckDuckGo search');
    results = await searchDuckDuckGo(query);
  }

  logger.info('Web search complete', { query, provider: usedProvider, resultCount: results.length });

  return {
    shouldAugment: true,
    searchResults: results,
    query,
    provider: usedProvider,
    ...(lastError !== undefined ? { error: lastError } : {}),
  };
}
