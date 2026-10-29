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
