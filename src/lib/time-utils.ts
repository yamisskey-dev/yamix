/**
 * Time utilities with UTC-first approach
 *
 * SECURITY: All time-based operations use UTC to prevent timezone manipulation
 */

/**
 * Get start of today in UTC
 * SECURITY: Prevents timezone-based manipulation of daily limits
 */
export function getUTCStartOfDay(date: Date = new Date()): Date {
  const utcDate = new Date(date);
  utcDate.setUTCHours(0, 0, 0, 0);
  return utcDate;
}

/**
 * Get end of today in UTC
 */
export function getUTCEndOfDay(date: Date = new Date()): Date {
  const utcDate = new Date(date);
  utcDate.setUTCHours(23, 59, 59, 999);
  return utcDate;
}

/**
 * Check if two dates are on the same UTC day
 */
export function isSameUTCDay(date1: Date, date2: Date): boolean {
  return (
    date1.getUTCFullYear() === date2.getUTCFullYear() &&
    date1.getUTCMonth() === date2.getUTCMonth() &&
    date1.getUTCDate() === date2.getUTCDate()
  );
}

/**
 * Get days difference in UTC
 */
export function getUTCDaysDifference(date1: Date, date2: Date): number {
  const utc1 = Date.UTC(
    date1.getUTCFullYear(),
    date1.getUTCMonth(),
    date1.getUTCDate()
  );
  const utc2 = Date.UTC(
    date2.getUTCFullYear(),
    date2.getUTCMonth(),
    date2.getUTCDate()
  );
  return Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

/**
 * Get UTC timestamp (milliseconds)
 */
export function getUTCTimestamp(date: Date = new Date()): number {
  return date.getTime();
}

/**
 * Format date in UTC ISO string
 */
export function formatUTCDate(date: Date): string {
  return date.toISOString();
}
