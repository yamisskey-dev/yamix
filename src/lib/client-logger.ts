/**
 * Client-side logger — wraps console with production silencing
 * "use client" components can import this instead of using console directly
 */

const isDev = process.env.NODE_ENV === "development";

export const clientLogger = {
  error(message: string, ...args: unknown[]) {
    console.error(`[ERROR] ${message}`, ...args);
  },
  warn(message: string, ...args: unknown[]) {
    if (isDev) console.warn(`[WARN] ${message}`, ...args);
  },
  info(message: string, ...args: unknown[]) {
    if (isDev) console.info(`[INFO] ${message}`, ...args);
  },
  debug(message: string, ...args: unknown[]) {
    if (isDev) console.debug(`[DEBUG] ${message}`, ...args);
  },
};
