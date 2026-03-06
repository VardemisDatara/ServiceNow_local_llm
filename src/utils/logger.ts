/**
 * Logging utility for ServiceNow MCP Bridge
 * Provides structured logging with different levels and optional persistence
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
}

export type LogHandler = (entry: LogEntry) => void;

class Logger {
  private minLevel: LogLevel = LogLevel.INFO;
  private handlers: LogHandler[] = [];

  constructor() {
    // Default console handler
    this.addHandler(this.consoleHandler);
  }

  /**
   * Set minimum log level
   * Logs below this level will be ignored
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Add a custom log handler
   */
  addHandler(handler: LogHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Remove all custom handlers
   */
  clearHandlers(): void {
    this.handlers = [this.consoleHandler];
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const minIndex = levels.indexOf(this.minLevel);
    const currentIndex = levels.indexOf(level);
    return currentIndex >= minIndex;
  }

  /**
   * Create a log entry and dispatch to handlers
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      error,
    };

    this.handlers.forEach((handler) => {
      try {
        handler(entry);
      } catch (e) {
        // Prevent handler errors from breaking the application
        console.error('Log handler error:', e);
      }
    });
  }

  /**
   * Default console handler
   */
  private consoleHandler(entry: LogEntry): void {
    const time = entry.timestamp.toISOString();
    const prefix = `[${time}] [${entry.level.toUpperCase()}]`;

    const parts = [prefix, entry.message];

    if (entry.context) {
      parts.push(JSON.stringify(entry.context));
    }

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(...parts, entry.error);
        break;
      case LogLevel.INFO:
        console.info(...parts);
        break;
      case LogLevel.WARN:
        console.warn(...parts, entry.error);
        break;
      case LogLevel.ERROR:
        console.error(...parts, entry.error);
        break;
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, unknown>, error?: Error): void {
    this.log(LogLevel.WARN, message, context, error);
  }

  /**
   * Log error message
   */
  error(message: string, context?: Record<string, unknown>, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Create a child logger with a specific context
   * Context will be automatically included in all log entries
   */
  child(context: Record<string, unknown>): ContextLogger {
    return new ContextLogger(this, context);
  }
}

/**
 * Context logger that automatically includes context in all log entries
 */
class ContextLogger {
  constructor(
    private parent: Logger,
    private defaultContext: Record<string, unknown>
  ) {}

  private mergeContext(context?: Record<string, unknown>): Record<string, unknown> {
    return { ...this.defaultContext, ...context };
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.parent.debug(message, this.mergeContext(context));
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.parent.info(message, this.mergeContext(context));
  }

  warn(message: string, context?: Record<string, unknown>, error?: Error): void {
    this.parent.warn(message, this.mergeContext(context), error);
  }

  error(message: string, context?: Record<string, unknown>, error?: Error): void {
    this.parent.error(message, this.mergeContext(context), error);
  }
}

/**
 * File handler for persistent logging
 * Logs to a rotating file in the user's data directory
 */
export function createFileHandler(filePath: string): LogHandler {
  const logs: LogEntry[] = [];
  const MAX_LOGS = 1000;

  return (entry: LogEntry) => {
    logs.push(entry);

    // Keep only last MAX_LOGS entries
    if (logs.length > MAX_LOGS) {
      logs.shift();
    }

    // In a real implementation, this would write to a file using Tauri's fs API
    // For now, just store in memory
    // TODO: Implement file writing when Tauri fs plugin is added
  };
}

/**
 * Performance measurement utility
 */
export class PerformanceLogger {
  private startTime: number;

  constructor(
    private logger: Logger,
    private operation: string
  ) {
    this.startTime = performance.now();
    this.logger.debug(`Starting: ${operation}`);
  }

  /**
   * End performance measurement and log duration
   */
  end(context?: Record<string, unknown>): number {
    const duration = performance.now() - this.startTime;
    this.logger.info(`Completed: ${this.operation}`, {
      ...context,
      durationMs: Math.round(duration),
    });
    return duration;
  }

  /**
   * End with error
   */
  endWithError(error: Error, context?: Record<string, unknown>): number {
    const duration = performance.now() - this.startTime;
    this.logger.error(`Failed: ${this.operation}`, {
      ...context,
      durationMs: Math.round(duration),
    }, error);
    return duration;
  }
}

// Export singleton instance
export const logger = new Logger();

// Configure based on environment
const env = import.meta.env;
if (env.DEV) {
  logger.setLevel(LogLevel.DEBUG);
} else {
  logger.setLevel(LogLevel.INFO);
}

// Export for convenience
export default logger;
