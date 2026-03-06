/**
 * T123: In-memory analytics service for tool/search/LLM usage tracking.
 * No external dependencies — data is session-scoped and resets on app restart.
 */

export interface ToolUsageRecord {
  tool: string;
  timestamp: Date;
  durationMs: number;
  success: boolean;
}

export interface SearchQueryRecord {
  provider: string;
  timestamp: Date;
  durationMs: number;
  resultCount: number;
}

export interface LLMRequestRecord {
  provider: string;
  model: string;
  timestamp: Date;
  durationMs: number;
  tokenCount?: number;
  success: boolean;
}

export interface ToolSummaryEntry {
  count: number;
  avgMs: number;
  successRate: number;
}

export interface SearchSummary {
  totalQueries: number;
  byProvider: Record<string, number>;
  avgResultCount: number;
}

export interface LLMSummary {
  totalRequests: number;
  byProvider: Record<string, number>;
  successRate: number;
}

export interface AnalyticsSummary {
  tools: Record<string, ToolSummaryEntry>;
  search: SearchSummary;
  llm: LLMSummary;
}

class AnalyticsService {
  private toolUsage: ToolUsageRecord[] = [];
  private searchQueries: SearchQueryRecord[] = [];
  private llmRequests: LLMRequestRecord[] = [];

  /** Record a completed MCP tool call. */
  trackToolCall(tool: string, durationMs: number, success: boolean): void {
    this.toolUsage.push({ tool, timestamp: new Date(), durationMs, success });
  }

  /** Record a web search query. */
  trackSearch(provider: string, durationMs: number, resultCount: number): void {
    this.searchQueries.push({ provider, timestamp: new Date(), durationMs, resultCount });
  }

  /** Record an LLM streaming request. */
  trackLLMRequest(
    provider: string,
    model: string,
    durationMs: number,
    success: boolean,
    tokenCount?: number
  ): void {
    this.llmRequests.push({
      provider,
      model,
      timestamp: new Date(),
      durationMs,
      ...(tokenCount != null ? { tokenCount } : {}),
      success,
    });
  }

  /** Aggregate tool usage by tool name. */
  getToolSummary(): Record<string, ToolSummaryEntry> {
    const grouped: Record<string, ToolUsageRecord[]> = {};
    for (const r of this.toolUsage) {
      (grouped[r.tool] ??= []).push(r);
    }
    const summary: Record<string, ToolSummaryEntry> = {};
    for (const [tool, records] of Object.entries(grouped)) {
      const count = records.length;
      const avgMs = Math.round(records.reduce((s, r) => s + r.durationMs, 0) / count);
      const successRate = records.filter((r) => r.success).length / count;
      summary[tool] = { count, avgMs, successRate };
    }
    return summary;
  }

  /** Aggregate search query stats. */
  getSearchSummary(): SearchSummary {
    const byProvider: Record<string, number> = {};
    let totalResults = 0;
    for (const r of this.searchQueries) {
      byProvider[r.provider] = (byProvider[r.provider] ?? 0) + 1;
      totalResults += r.resultCount;
    }
    const total = this.searchQueries.length;
    return {
      totalQueries: total,
      byProvider,
      avgResultCount: total > 0 ? Math.round(totalResults / total) : 0,
    };
  }

  /** Aggregate LLM request stats. */
  getLLMSummary(): LLMSummary {
    const byProvider: Record<string, number> = {};
    for (const r of this.llmRequests) {
      byProvider[r.provider] = (byProvider[r.provider] ?? 0) + 1;
    }
    const total = this.llmRequests.length;
    const successRate = total > 0 ? this.llmRequests.filter((r) => r.success).length / total : 1;
    return { totalRequests: total, byProvider, successRate };
  }

  /** Full analytics snapshot for the current session. */
  getSummary(): AnalyticsSummary {
    return {
      tools: this.getToolSummary(),
      search: this.getSearchSummary(),
      llm: this.getLLMSummary(),
    };
  }

  /** Raw tool usage records (for export or debugging). */
  getToolUsageRecords(): readonly ToolUsageRecord[] {
    return this.toolUsage;
  }

  /** Reset all counters (e.g., between test runs). */
  reset(): void {
    this.toolUsage = [];
    this.searchQueries = [];
    this.llmRequests = [];
  }
}

/** Singleton analytics instance. */
export const analytics = new AnalyticsService();
