import { describe, expect, it } from 'vitest';
import { TRASH_RETENTION_DAYS, trashDaysLeft } from './trash';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 9, 29, 12, 0);

describe('trashDaysLeft', () => {
  it('starts at the full retention period', () => {
    expect(TRASH_RETENTION_DAYS).toBe(30);
    expect(trashDaysLeft(now, now)).toBe(30);
  });

  it('counts down by day and rounds partial days up', () => {
    expect(trashDaysLeft(now - 1 * DAY, now)).toBe(29);
    expect(trashDaysLeft(now - 10 * DAY - 1000, now)).toBe(20);
    expect(trashDaysLeft(now - 29.5 * DAY, now)).toBe(1);
  });

  it('never shows less than one day or more than the maximum', () => {
    expect(trashDaysLeft(now - 31 * DAY, now)).toBe(1);
    expect(trashDaysLeft(now + 5 * DAY, now)).toBe(30);
  });
});
