import { newId } from '@/core/id';
import type { ChecklistItem } from './model';

export interface ItemInputResult {
  items: ChecklistItem[];
  /** The row that should get the cursor next, if typing created new rows. */
  focusId: string | null;
}

/**
 * Applies what was typed into one checklist row. A line break starts a new row, so Enter
 * (on any keyboard) and pasting several lines both work: the first line stays in this row and
 * every other line becomes its own row right after it.
 */
export function applyItemInput(
  items: ChecklistItem[],
  id: string,
  value: string,
  makeId: () => string = newId,
): ItemInputResult {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return { items, focusId: null };

  if (!/[\r\n]/.test(value)) {
    return { items: items.map((item) => (item.id === id ? { ...item, text: value } : item)), focusId: null };
  }

  const [first = '', ...rest] = value.split(/\r?\n/);
  const added: ChecklistItem[] = rest.map((line) => ({ id: makeId(), text: line.trim(), done: false }));
  const next = [...items];
  next[index] = { ...items[index]!, text: first };
  next.splice(index + 1, 0, ...added);
  return { items: next, focusId: added.at(-1)?.id ?? null };
}

/** How many rows are ticked. */
export function doneCount(items: ChecklistItem[]): number {
  return items.filter((item) => item.done).length;
}

export interface RemovedRow {
  item: ChecklistItem;
  /** Where the row was, so it can be put back in the same place. */
  index: number;
}

/** Takes the ticked rows out, remembering them (and their places) for "undo". */
export function removeDone(items: ChecklistItem[]): { items: ChecklistItem[]; removed: RemovedRow[] } {
  const removed: RemovedRow[] = [];
  const kept: ChecklistItem[] = [];
  items.forEach((item, index) => {
    if (item.done) removed.push({ item, index });
    else kept.push(item);
  });
  return { items: kept, removed };
}

/** Puts removed rows back where they were. Rows added in the meantime are kept. */
export function reinsertRows(items: ChecklistItem[], removed: RemovedRow[]): ChecklistItem[] {
  const next = [...items];
  for (const { item, index } of [...removed].sort((a, b) => a.index - b.index)) {
    if (next.some((existing) => existing.id === item.id)) continue;
    next.splice(Math.min(index, next.length), 0, item);
  }
  return next;
}

/** Unticks every row, remembering which ones were ticked. */
export function uncheckAll(items: ChecklistItem[]): { items: ChecklistItem[]; changedIds: string[] } {
  return {
    items: items.map((item) => (item.done ? { ...item, done: false } : item)),
    changedIds: items.filter((item) => item.done).map((item) => item.id),
  };
}

/** Ticks the given rows again ("undo" of unticking). */
export function recheck(items: ChecklistItem[], ids: string[]): ChecklistItem[] {
  const set = new Set(ids);
  return items.map((item) => (set.has(item.id) ? { ...item, done: true } : item));
}
