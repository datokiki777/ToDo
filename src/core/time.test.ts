import { describe, expect, it } from 'vitest';
import { formatLongDate, formatShortDate } from './time';

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
