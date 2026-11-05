import { addDays, parseDateKey } from '@/core/dates';
import { newId } from '@/core/id';
import type { ChecklistItem, Note } from './model';

/** The longest list one habit can make (a year). */
export const MAX_HABIT_DAYS = 366;

export interface HabitPlan {
  /** First day, "2026-11-03". */
  start: string;
  /** How many calendar days the list spans, counting from `start`. */
  days: number;
  /** Weekdays to leave out, as JavaScript counts them: 0 = Sunday … 6 = Saturday. */
  skip: number[];
}

/** The days of a habit list, in order: every day of the span except the skipped weekdays. */
export function habitDates(plan: HabitPlan): string[] {
  const days = Math.min(Math.max(Math.floor(plan.days) || 0, 0), MAX_HABIT_DAYS);
  const skip = new Set(plan.skip);
  const dates: string[] = [];
  for (let i = 0; i < days; i += 1) {
    const key = addDays(plan.start, i);
    if (!skip.has(parseDateKey(key).getDay())) dates.push(key);
  }
  return dates;
}

/** One row per day, each with its own day and a label such as "Mon, 3 November". */
export function habitRows(plan: HabitPlan, label: (day: string) => string): ChecklistItem[] {
  return habitDates(plan).map((date) => ({ id: newId(), text: label(date), done: false, date }));
}

/** A habit list is a checklist whose rows have days. */
export function isHabitNote(note: Pick<Note, 'items'>): boolean {
  return note.items.some((item) => item.date);
}

/** The rows that belong to the given day. */
export function rowsOf(items: ChecklistItem[], day: string): ChecklistItem[] {
  return items.filter((item) => item.date === day);
}

/** Is today's mark made? (Several rows on one day count as done only when all are.) */
export function dayDone(items: ChecklistItem[], day: string): boolean {
  const rows = rowsOf(items, day);
  return rows.length > 0 && rows.every((row) => row.done);
}

/**
 * Ticks today's row, or unticks it if it is ticked. Returns the new list, or null when the note has
 * no row for that day (the list has not started, has ended, or today is a skipped day).
 */
export function toggleDay(items: ChecklistItem[], day: string): ChecklistItem[] | null {
  if (rowsOf(items, day).length === 0) return null;
  const mark = !dayDone(items, day);
  return items.map((item) => (item.date === day ? { ...item, done: mark } : item));
}

/** What the card says about a habit: today's row if there is one. */
export function habitLine(items: ChecklistItem[], day: string): string | null {
  return rowsOf(items, day)[0]?.text.trim() || null;
}

/** "Tue, 3 November": the label on a daily row. `weekdays` start on Monday. */
export function dayLabel(key: string, months: string[], weekdays: string[]): string {
  const d = parseDateKey(key);
  return `${weekdays[(d.getDay() + 6) % 7] ?? ''}, ${d.getDate()} ${months[d.getMonth()] ?? ''}`;
}
