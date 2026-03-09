/**
 * Returns the current month in "YYYY-MM" format (UTC).
 */
export function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Validates and returns a month string in "YYYY-MM" format.
 * Falls back to current month if invalid.
 */
export function safeMonth(month: string | undefined | null): string {
  return month && MONTH_REGEX.test(month) ? month : getCurrentMonth();
}
