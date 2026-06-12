/**
 * Shared date helpers for the schedule feature. All functions work on local
 * dates; ISO strings are strict `YYYY-MM-DD`.
 */

/** Parse a `YYYY-MM-DD` string into a local Date at midnight. */
export function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Format a local Date as `YYYY-MM-DD`. */
export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Local midnight of the given date. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Monday-based start of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const result = startOfDay(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  return result;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Add months, clamping the day to the target month's length (Jan 31 + 1mo → Feb 28). */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const targetMonth = result.getMonth() + months;
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(targetMonth);
  const lastDayOfTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDayOfTargetMonth));
  return result;
}

/**
 * Calendar-day difference between two local dates. Raw `getTime()` deltas
 * drift by ±1h across DST transitions, which makes `floor(diff / DAY_MS)`
 * lose a whole day (e.g. winter start → summer date); normalising through
 * UTC removes the offset entirely.
 */
export function daysBetween(start: Date, end: Date): number {
  const DAY_MS = 86_400_000;
  const utcStart = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const utcEnd = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((utcEnd - utcStart) / DAY_MS);
}

/** Inclusive day count of an ISO date range (same start and end → 1). */
export function durationInDays(startIso: string, endIso: string): number {
  return Math.max(daysBetween(parseIsoDate(startIso), parseIsoDate(endIso)) + 1, 1);
}
