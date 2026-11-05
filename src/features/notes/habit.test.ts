import { describe, expect, it } from 'vitest';
import { dayDone, dayLabel, extendHabit, habitDates, habitLine, habitRows, inferSkip, isHabitNote, MAX_HABIT_DAYS, MAX_ROWS, rowsOf, toggleDay } from './habit';
import { parseNote, type ChecklistItem } from './model';

const MON = '2026-11-02'; // a Monday

describe('the days of a habit list', () => {
  it('is one row per day from the start', () => {
    expect(habitDates({ start: MON, days: 3, skip: [] })).toEqual(['2026-11-02', '2026-11-03', '2026-11-04']);
  });

  it('a month is thirty days', () => {
    const dates = habitDates({ start: '2026-11-03', days: 30, skip: [] });
    expect(dates).toHaveLength(30);
    expect(dates[0]).toBe('2026-11-03');
    expect(dates.at(-1)).toBe('2026-12-02');
  });

  it('leaves out the skipped weekdays but still counts them in the span', () => {
    // 14 days from Monday = two full weeks; without Saturday (6) and Sunday (0) that is 10 days
    const dates = habitDates({ start: MON, days: 14, skip: [0, 6] });
    expect(dates).toHaveLength(10);
    expect(dates).not.toContain('2026-11-07'); // Saturday
    expect(dates).not.toContain('2026-11-08'); // Sunday
    expect(dates[5]).toBe('2026-11-09'); // the second Monday follows the first Friday
  });

  it('can skip any day of the week, even every day (nothing is made)', () => {
    expect(habitDates({ start: MON, days: 7, skip: [3] })).toHaveLength(6);
    expect(habitDates({ start: MON, days: 7, skip: [0, 1, 2, 3, 4, 5, 6] })).toEqual([]);
  });

  it('runs across the end of a month and a year, and over summer-time changes', () => {
    expect(habitDates({ start: '2026-12-30', days: 4, skip: [] })).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
    expect(habitDates({ start: '2026-03-28', days: 3, skip: [] })).toEqual(['2026-03-28', '2026-03-29', '2026-03-30']);
    expect(habitDates({ start: '2026-10-24', days: 3, skip: [] })).toEqual(['2026-10-24', '2026-10-25', '2026-10-26']);
  });

  it('is limited to a year, and nonsense gives an empty list', () => {
    expect(habitDates({ start: MON, days: 9999, skip: [] })).toHaveLength(MAX_HABIT_DAYS);
    expect(habitDates({ start: MON, days: 0, skip: [] })).toEqual([]);
    expect(habitDates({ start: MON, days: -5, skip: [] })).toEqual([]);
    expect(habitDates({ start: MON, days: Number.NaN, skip: [] })).toEqual([]);
  });
});

describe('the rows', () => {
  it('each has its own day, a label, and starts unticked', () => {
    const rows = habitRows({ start: MON, days: 2, skip: [] }, (d) => `day ${d}`);
    expect(rows.map((r) => [r.text, r.date, r.done])).toEqual([
      ['day 2026-11-02', '2026-11-02', false],
      ['day 2026-11-03', '2026-11-03', false],
    ]);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2);
  });
});

describe('ticking today', () => {
  const row = (date: string | null, done = false, text = 'x'): ChecklistItem => ({ id: `${date}-${text}`, text, done, date });
  const list = [row('2026-11-02'), row('2026-11-03'), row('2026-11-04')];

  it('ticks only today\'s row, and unticks it on the second tap', () => {
    const ticked = toggleDay(list, '2026-11-03')!;
    expect(ticked.map((r) => r.done)).toEqual([false, true, false]);
    expect(dayDone(ticked, '2026-11-03')).toBe(true);
    expect(toggleDay(ticked, '2026-11-03')!.map((r) => r.done)).toEqual([false, false, false]);
  });

  it('does nothing when the list has no row for today (not started, ended, a skipped day)', () => {
    expect(toggleDay(list, '2026-11-09')).toBeNull();
    expect(toggleDay([], '2026-11-03')).toBeNull();
    expect(dayDone(list, '2026-11-09')).toBe(false);
  });

  it('rows without a day are never touched', () => {
    const mixed = [row(null, false, 'plain'), row('2026-11-03')];
    expect(toggleDay(mixed, '2026-11-03')!.map((r) => r.done)).toEqual([false, true]);
  });

  it('with two rows on one day, one tap ticks both; ticked only when both are', () => {
    const two = [row('2026-11-03', true, 'a'), row('2026-11-03', false, 'b')];
    expect(dayDone(two, '2026-11-03')).toBe(false);
    expect(toggleDay(two, '2026-11-03')!.every((r) => r.done)).toBe(true);
  });

  it('knows which note is a habit list, and what to say about today', () => {
    expect(isHabitNote({ items: list })).toBe(true);
    expect(isHabitNote({ items: [row(null)] })).toBe(false);
    expect(rowsOf(list, '2026-11-04')).toHaveLength(1);
    expect(habitLine([row('2026-11-03', false, ' Tue, 3 Nov ')], '2026-11-03')).toBe('Tue, 3 Nov');
    expect(habitLine(list, '2026-12-01')).toBeNull();
  });
});

describe('a row\'s day survives saving and loading', () => {
  it('is kept when valid, dropped when not, and absent for old rows', () => {
    const parsed = parseNote({
      id: 'n',
      updatedAt: 1,
      kind: 'checklist',
      items: [
        { id: 'a', text: 'ok', done: false, date: '2026-11-03' },
        { id: 'b', text: 'bad', done: false, date: '2026-02-30' },
        { id: 'c', text: 'old', done: true },
      ],
    });
    expect(parsed?.items.map((i) => i.date)).toEqual(['2026-11-03', undefined, undefined]);
  });
});

describe('the label of a daily row', () => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  it('says the weekday, the day and the month', () => {
    expect(dayLabel('2026-11-03', months, weekdays)).toBe('Tue, 3 Nov');
    expect(dayLabel('2026-11-08', months, weekdays)).toBe('Sun, 8 Nov');
    expect(dayLabel('2027-01-01', months, weekdays)).toBe('Fri, 1 Jan');
  });
});

describe('adding more days to a daily list', () => {
  const label = (d: string) => `L ${d}`;
  const make = (start: string, days: number, skip: number[]) => habitRows({ start, days, skip }, label);

  it('continues the day after the last row, for 30 days', () => {
    const list = make('2026-11-02', 7, []); // Mon 2 – Sun 8 Nov
    const { items, added } = extendHabit(list, '2026-11-03', 30, label);
    expect(added).toHaveLength(30);
    expect(added[0]!.date).toBe('2026-11-09');
    expect(added.at(-1)!.date).toBe('2026-12-08');
    expect(items).toHaveLength(37);
    expect(added[0]!.text).toBe('L 2026-11-09');
    expect(added.every((r) => !r.done)).toBe(true);
  });

  it('keeps leaving out the weekdays the list left out', () => {
    const list = make('2026-11-02', 14, [0, 6]); // two weeks without weekends
    expect(inferSkip(list)).toEqual([0, 6]);
    const { added } = extendHabit(list, '2026-11-03', 14, label);
    expect(added).toHaveLength(10);
    expect(added.map((r) => new Date(`${r.date}T12:00:00`).getDay()).every((w) => w !== 0 && w !== 6)).toBe(true);
  });

  it('a list shorter than a week does not guess: nothing is left out', () => {
    const list = make('2026-11-02', 5, []);
    expect(inferSkip(list)).toEqual([]);
    expect(extendHabit(list, '2026-11-03', 7, label).added).toHaveLength(7);
  });

  it('a list that ended long ago continues from today, not from the past', () => {
    const list = make('2026-09-01', 7, []); // ended 7 Sep
    const { added } = extendHabit(list, '2026-11-03', 3, label);
    expect(added.map((r) => r.date)).toEqual(['2026-11-03', '2026-11-04', '2026-11-05']);
  });

  it('a list that has not ended yet continues right after its last day', () => {
    const list = make('2026-11-02', 30, []); // until 1 Dec
    const { added } = extendHabit(list, '2026-11-03', 2, label);
    expect(added.map((r) => r.date)).toEqual(['2026-12-02', '2026-12-03']);
  });

  it('puts the new rows right after the last daily row, before anything written below', () => {
    const plain: ChecklistItem = { id: 'p', text: 'a note to self', done: false };
    const list = [...make('2026-11-02', 2, []), plain];
    const { items } = extendHabit(list, '2026-11-02', 2, label);
    expect(items.map((r) => r.date ?? 'plain')).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', 'plain']);
  });

  it('keeps ticks and the rows already there, and gives every new row its own id', () => {
    const list = make('2026-11-02', 3, []).map((r, i) => ({ ...r, done: i === 0 }));
    const { items, added } = extendHabit(list, '2026-11-02', 4, label);
    expect(items.slice(0, 3)).toEqual(list);
    expect(new Set(items.map((r) => r.id)).size).toBe(items.length);
    expect(added).toHaveLength(4);
  });

  it('does nothing for a note with no daily rows', () => {
    const plain: ChecklistItem[] = [{ id: 'a', text: 'x', done: false }];
    expect(extendHabit(plain, '2026-11-03', 30, label)).toEqual({ items: plain, added: [] });
    expect(extendHabit([], '2026-11-03', 30, label).added).toEqual([]);
  });

  it('never grows a list past the limit', () => {
    const big = make('2026-01-01', 366, []).concat(make('2027-01-01', 366, [])).concat(make('2028-01-01', 250, []));
    expect(big.length).toBeGreaterThan(MAX_ROWS - 30);
    const { items, added } = extendHabit(big, '2026-01-02', 30, label);
    expect(items.length).toBeLessThanOrEqual(MAX_ROWS);
    expect(added.length).toBeLessThanOrEqual(30);
    const full = make('2026-01-01', 366, []).concat(make('2027-01-01', 366, [])).concat(make('2028-01-01', 268, []));
    expect(full).toHaveLength(MAX_ROWS);
    expect(extendHabit(full, '2026-01-02', 30, label).added).toEqual([]);
  });
});
