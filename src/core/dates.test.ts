import { describe, expect, it } from 'vitest';
import { addDays, dateKey, isDateKey, monthGrid, parseDateKey, shiftMonth } from './dates';

describe('date keys', () => {
  it('writes a day the same way whatever the time of day', () => {
    expect(dateKey(new Date(2026, 0, 5, 0, 0).getTime())).toBe('2026-01-05');
    expect(dateKey(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05');
    expect(dateKey(parseDateKey('2026-03-29'))).toBe('2026-03-29'); // the day summer time starts in Europe
  });

  it('accepts real days only', () => {
    expect(isDateKey('2026-10-30')).toBe(true);
    expect(isDateKey('2028-02-29')).toBe(true); // a leap day
    expect(isDateKey('2026-02-29')).toBe(false);
    expect(isDateKey('2026-13-01')).toBe(false);
    expect(isDateKey('2026-1-1')).toBe(false);
    expect(isDateKey(null)).toBe(false);
  });

  it('moves across months, years and clock changes', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
  });
});

describe('monthGrid', () => {
  it('is always six full weeks, starting on Monday', () => {
    for (const [y, m] of [[2026, 9], [2026, 1], [2027, 1], [2026, 11]] as const) {
      const grid = monthGrid(y, m);
      expect(grid).toHaveLength(42);
      expect(parseDateKey(grid[0]!.key).getDay()).toBe(1);
      expect(grid.filter((c) => c.inMonth)).toHaveLength(new Date(y, m + 1, 0).getDate());
    }
  });

  it('puts October 2026 in the right place (the 1st is a Thursday)', () => {
    const grid = monthGrid(2026, 9);
    expect(grid[0]!.key).toBe('2026-09-28');
    expect(grid[3]!.key).toBe('2026-10-01');
    expect(grid[3]!.inMonth).toBe(true);
    expect(grid[0]!.inMonth).toBe(false);
    expect(grid[33]!.key).toBe('2026-10-31');
  });

  it('can start on Sunday', () => {
    expect(monthGrid(2026, 9, false)[0]!.key).toBe('2026-09-27');
  });

  it('shifts months over year ends', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth(2026, 5, 0)).toEqual({ year: 2026, month: 5 });
  });
});
