export function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function toUTCDate(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Date(d.getTime() + d.getTimezoneOffset() * 60_000);
}

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export function safeMonth(month: string | undefined | null): string {
  return month && MONTH_REGEX.test(month) ? month : getCurrentMonth();
}
