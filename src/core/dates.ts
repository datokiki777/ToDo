const pad = (n: number) => String(n).padStart(2, '0');

/** A calendar day as "2026-10-30", in the person's own time zone. */
export function dateKey(when: number | Date): string {
  const d = typeof when === 'number' ? new Date(when) : when;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** True only for real days written as "YYYY-MM-DD" ("2026-02-30" is not one). */
export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** The day at noon, so small clock changes (summer time) can never move it to another day. */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12);
}

export function addDays(key: string, days: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

export interface MonthCell {
  key: string;
  day: number;
  /** False for the greyed days of the neighbouring months that fill the first and last weeks. */
  inMonth: boolean;
}

/**
 * The month as a grid of 6 weeks (42 days), starting from Monday by default. `month` is 0-11.
 * A fixed height means the calendar doesn't jump when you change months.
 */
export function monthGrid(year: number, month: number, mondayFirst = true): MonthCell[] {
  const first = new Date(year, month, 1, 12);
  const offset = mondayFirst ? (first.getDay() + 6) % 7 : first.getDay();
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(year, month, 1 - offset + i, 12);
    return { key: dateKey(date), day: date.getDate(), inMonth: date.getMonth() === month };
  });
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month + delta, 1, 12);
  return { year: d.getFullYear(), month: d.getMonth() };
}
