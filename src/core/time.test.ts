import { describe, expect, it } from 'vitest';
import { formatDay, formatDayShort, formatLongDate, formatShortDate } from './time';

const now = new Date(2026, 9, 29, 12, 0).getTime();

describe('time formatting', () => {
  it('shows only the time for today', () => {
    const t = new Date(2026, 9, 29, 8, 5).getTime();
    expect(formatShortDate(t, 'en', now, true)).toMatch(/8:05|08:05/);
  });

  it('uses digits only when month names are missing', () => {
    const earlier = new Date(2026, 2, 3).getTime();
    expect(formatShortDate(earlier, 'en', now, false)).toMatch(/^\d{2}\D\d{2}$/);
    const older = new Date(2024, 2, 3).getTime();
    expect(formatShortDate(older, 'en', now, false)).toContain('2024');
    expect(formatLongDate(older, 'en', false)).toMatch(/03\D03\D2024/);
  });

  it('uses month names when the browser has them', () => {
    const earlier = new Date(2026, 2, 3).getTime();
    expect(formatShortDate(earlier, 'en', now, true)).toMatch(/Mar/);
  });
});

describe('formatDay', () => {
  it('writes a calendar day with or without month names', () => {
    expect(formatDay('2026-10-05', 'en', true)).toMatch(/October/);
    expect(formatDay('2026-10-05', 'en', false)).toMatch(/10\D05\D2026/);
  });
});

describe('formatDayShort', () => {
  const now = new Date(2026, 9, 31, 12).getTime();
  it('writes the day first when there are no month names', () => {
    expect(formatDayShort('2026-12-05', 'en', now, false)).toBe('05.12');
    expect(formatDayShort('2027-01-09', 'en', now, false)).toBe('09.01.27');
  });
  it('uses the month name when there is one, and the year only when it is not this one', () => {
    expect(formatDayShort('2026-12-05', 'en', now, true)).toMatch(/Dec/);
    expect(formatDayShort('2026-12-05', 'en', now, true)).not.toMatch(/2026/);
    expect(formatDayShort('2027-12-05', 'en', now, true)).toMatch(/2027/);
  });
});
