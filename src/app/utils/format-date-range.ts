import { parseIsoDate } from './date-utils';

/** Human-readable inclusive date range like "May 1, 2026 – Jun 19, 2026". */
export function formatDateRange(startIso: string, endIso: string): string {
  const fmt = (iso: string) =>
    parseIsoDate(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  return `${fmt(startIso)} – ${fmt(endIso)}`;
}

/**
 * Compact inclusive range that collapses shared parts:
 * "Sep 12, 2026", "Sep 12 - 16, 2026", "Jun 29 - Jul 3, 2026",
 * "Dec 29, 2026 - Jan 2, 2027".
 */
export function formatDateRangeShort(startIso: string, endIso: string): string {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  const startMonth = start.toLocaleString('en-US', { month: 'short' });
  const endMonth = end.toLocaleString('en-US', { month: 'short' });

  if (startIso === endIso) {
    return `${startMonth} ${start.getDate()}, ${start.getFullYear()}`;
  }

  if (sameMonth) {
    return `${startMonth} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`;
  }

  if (sameYear) {
    return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${start.getFullYear()}`;
  }

  return `${startMonth} ${start.getDate()}, ${start.getFullYear()} - ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
}
