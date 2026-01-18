/**
 * Structured Logging System
 * 本番環境対応の構造化ログ
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// 環境に応じたログレベル
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LOG_LEVEL: LogLevel =
  process.env.NODE_ENV === "production" ? "info" : "debug";

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LOG_LEVEL];
}

function formatError(error: unknown): LogEntry["error"] | undefined {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    };
  }
  if (error !== undefined && error !== null) {
    return {
      name: "UnknownError",
      message: String(error),
    };
  }
  return undefined;
}

function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: unknown
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context && Object.keys(context).length > 0 && { context }),
    ...(error && { error: formatError(error) }),
  };
}

function output(entry: LogEntry): void {
  // 本番環境では構造化JSONで出力（モニタリングツール連携用）
  if (process.env.NODE_ENV === "production") {
    const logFn = entry.level === "error" ? console.error : console.log;
    logFn(JSON.stringify(entry));
    return;
  }

  // 開発環境では人間が読みやすい形式
  const prefix = `[${entry.level.toUpperCase()}]`;
  const contextStr = entry.context
    ? ` ${JSON.stringify(entry.context)}`
    : "";

  switch (entry.level) {
    case "debug":
      console.debug(`${prefix} ${entry.message}${contextStr}`);
      break;
    case "info":
      console.info(`${prefix} ${entry.message}${contextStr}`);
      break;
    case "warn":
      console.warn(`${prefix} ${entry.message}${contextStr}`);
      break;
    case "error":
      console.error(`${prefix} ${entry.message}${contextStr}`);
      if (entry.error?.stack) {
        console.error(entry.error.stack);
      }
      break;
  }
}

/**
 * Logger - 構造化ログ出力
 */
export const logger = {
  debug(message: string, context?: LogContext): void {
    if (!shouldLog("debug")) return;
    output(createLogEntry("debug", message, context));
  },

  info(message: string, context?: LogContext): void {
    if (!shouldLog("info")) return;
    output(createLogEntry("info", message, context));
  },

  warn(message: string, context?: LogContext, error?: unknown): void {
    if (!shouldLog("warn")) return;
    output(createLogEntry("warn", message, context, error));
  },

  error(message: string, context?: LogContext, error?: unknown): void {
    if (!shouldLog("error")) return;
    output(createLogEntry("error", message, context, error));
  },

  /**
   * APIリクエストのロギング用
   */
  api(method: string, path: string, context?: LogContext): void {
    this.info(`${method} ${path}`, context);
  },

  /**
   * APIエラーのロギング用
   */
  apiError(
    method: string,
    path: string,
    status: number,
    error?: unknown
  ): void {
    this.error(`${method} ${path} failed`, { status }, error);
  },
};

export default logger;
