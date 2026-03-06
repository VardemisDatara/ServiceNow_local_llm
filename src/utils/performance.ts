/**
 * T122: Performance monitoring utilities
 * Provides operation timing, performance budgets, and measurement helpers
 */

/**
 * Performance budgets in milliseconds for key operations.
 * Operations exceeding their budget will trigger a warning.
 */
export const PERFORMANCE_BUDGETS: Record<string, number> = {
  'db.query': 100,
  'db.write': 200,
  'db.delete': 100,
  'ollama.stream': 30_000,
  'mcp.tool': 5_000,
  'search.query': 3_000,
  'llm.stream': 60_000,
  'ui.render': 16, // ~60fps
};

export interface TimerResult {
  name: string;
  durationMs: number;
  marks: Record<string, number>;
  budgetExceeded: boolean;
  budgetMs: number | null;
}

/**
 * Lightweight operation timer with mark support.
 * Typical usage:
 *   const t = new OperationTimer('db.query');
 *   // ... do work ...
 *   const result = t.end();
 */
export class OperationTimer {
  private readonly startTime: number;
  private readonly _marks: Map<string, number> = new Map();

  constructor(public readonly name: string) {
    this.startTime = performance.now();
  }

  /**
   * Record a named milestone relative to start time.
   */
  mark(label: string): void {
    this._marks.set(label, performance.now() - this.startTime);
  }

  /**
   * Current elapsed time in milliseconds (rounded).
   */
  elapsed(): number {
    return Math.round(performance.now() - this.startTime);
  }

  /**
   * Stop the timer and return the result.
   */
  end(): TimerResult {
    const durationMs = this.elapsed();
    const marks: Record<string, number> = {};
    for (const [k, v] of this._marks) {
      marks[k] = Math.round(v);
    }
    const budgetMs = PERFORMANCE_BUDGETS[this.name] ?? null;
    const budgetExceeded = budgetMs !== null && durationMs > budgetMs;

    if (budgetExceeded) {
      console.warn(
        `[Performance] ${this.name} took ${durationMs}ms (budget: ${budgetMs}ms)`
      );
    }

    return { name: this.name, durationMs, marks, budgetExceeded, budgetMs };
  }
}

/**
 * Wrap an async function with automatic performance measurement.
 * Logs a warning if the operation exceeds its budget.
 *
 * @example
 *   const result = await measure('db.query', () => db.select()...);
 */
export async function measure<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const timer = new OperationTimer(name);
  try {
    return await fn();
  } finally {
    timer.end();
  }
}

/**
 * Synchronous variant of `measure` for CPU-bound operations.
 */
export function measureSync<T>(name: string, fn: () => T): T {
  const timer = new OperationTimer(name);
  try {
    return fn();
  } finally {
    timer.end();
  }
}
