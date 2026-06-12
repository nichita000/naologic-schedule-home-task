import { addMonths, daysBetween, durationInDays, parseIsoDate, startOfWeek, toIsoDate } from './date-utils';
import { formatDateRangeShort } from './format-date-range';

describe('date-utils', () => {
  describe('daysBetween', () => {
    it('counts calendar days', () => {
      expect(daysBetween(parseIsoDate('2026-09-12'), parseIsoDate('2026-09-16'))).toBe(4);
    });

    it('is DST-safe across a spring transition', () => {
      // Jan 1 → Jul 1 crosses a DST boundary in most timezones; the raw
      // millisecond delta is ±1h off, but the count must stay exact.
      expect(daysBetween(parseIsoDate('2026-01-01'), parseIsoDate('2026-07-01'))).toBe(181);
    });
  });

  describe('durationInDays', () => {
    it('is inclusive: same start and end is 1 day', () => {
      expect(durationInDays('2026-10-06', '2026-10-06')).toBe(1);
    });

    it('spans month boundaries', () => {
      expect(durationInDays('2026-09-29', '2026-10-02')).toBe(4);
    });
  });

  describe('addMonths', () => {
    it('clamps the day to the target month length', () => {
      expect(toIsoDate(addMonths(parseIsoDate('2026-01-31'), 1))).toBe('2026-02-28');
    });
  });

  describe('startOfWeek', () => {
    it('returns the Monday of the containing week', () => {
      // 2026-06-10 is a Wednesday.
      expect(toIsoDate(startOfWeek(parseIsoDate('2026-06-10')))).toBe('2026-06-08');
    });

    it('treats Sunday as the end of the week', () => {
      // 2026-06-14 is a Sunday → its week starts Monday 2026-06-08.
      expect(toIsoDate(startOfWeek(parseIsoDate('2026-06-14')))).toBe('2026-06-08');
    });
  });

  describe('formatDateRangeShort', () => {
    it('formats a single day', () => {
      expect(formatDateRangeShort('2026-09-12', '2026-09-12')).toBe('Sep 12, 2026');
    });

    it('collapses a same-month range', () => {
      expect(formatDateRangeShort('2026-09-12', '2026-09-16')).toBe('Sep 12 - 16, 2026');
    });

    it('formats a month-boundary range', () => {
      expect(formatDateRangeShort('2026-09-29', '2026-10-02')).toBe('Sep 29 - Oct 2, 2026');
    });

    it('formats a year-boundary range', () => {
      expect(formatDateRangeShort('2026-12-29', '2027-01-02')).toBe('Dec 29, 2026 - Jan 2, 2027');
    });
  });
});
