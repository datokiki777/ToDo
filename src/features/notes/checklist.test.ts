import { describe, expect, it } from 'vitest';
import { applyItemInput, doneCount, recheck, reinsertRows, removeDone, uncheckAll } from './checklist';
import type { ChecklistItem } from './model';

const items = (): ChecklistItem[] => [
  { id: 'a', text: 'პური', done: true },
  { id: 'b', text: 'რძე', done: false },
];
let n = 0;
const makeId = () => `new${++n}`;

describe('applyItemInput', () => {
  it('updates the text when there is no line break', () => {
    const r = applyItemInput(items(), 'b', 'რძე და კარაქი');
    expect(r.items.map((i) => i.text)).toEqual(['პური', 'რძე და კარაქი']);
    expect(r.focusId).toBeNull();
  });

  it('Enter at the end starts an empty row and moves the cursor there', () => {
    n = 0;
    const r = applyItemInput(items(), 'a', 'პური\n', makeId);
    expect(r.items.map((i) => i.text)).toEqual(['პური', '', 'რძე']);
    expect(r.items[0]?.done).toBe(true);
    expect(r.items[1]).toMatchObject({ id: 'new1', done: false });
    expect(r.focusId).toBe('new1');
  });

  it('Enter in the middle splits the row', () => {
    n = 0;
    const r = applyItemInput(items(), 'b', 'რ\nძე', makeId);
    expect(r.items.map((i) => i.text)).toEqual(['პური', 'რ', 'ძე']);
    expect(r.focusId).toBe('new1');
  });

  it('pasting several lines makes a row per line, in order', () => {
    n = 0;
    const r = applyItemInput(items(), 'a', 'ერთი\n  ორი \r\nსამი', makeId);
    expect(r.items.map((i) => i.text)).toEqual(['ერთი', 'ორი', 'სამი', 'რძე']);
    expect(r.focusId).toBe('new2');
  });

  it('ignores an unknown row', () => {
    const before = items();
    expect(applyItemInput(before, 'zzz', 'x').items).toBe(before);
  });
});

describe('ticked rows: delete and untick, with undo', () => {
  const row = (id: string, done: boolean, text = id) => ({ id, text, done });
  const list = [row('a', true), row('b', false), row('c', true), row('d', false), row('e', true)];

  it('counts the ticked rows', () => {
    expect(doneCount(list)).toBe(3);
    expect(doneCount([])).toBe(0);
  });

  it('removes only the ticked rows, in order', () => {
    const { items, removed } = removeDone(list);
    expect(items.map((i) => i.id)).toEqual(['b', 'd']);
    expect(removed.map((r) => [r.item.id, r.index])).toEqual([['a', 0], ['c', 2], ['e', 4]]);
  });

  it('undo puts the rows back exactly where they were', () => {
    const { items, removed } = removeDone(list);
    expect(reinsertRows(items, removed)).toEqual(list);
  });

  it('undo keeps what was typed in the meantime', () => {
    const { items, removed } = removeDone(list);
    const meanwhile = [...items, row('new', false)];
    expect(reinsertRows(meanwhile, removed).map((i) => i.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'new']);
  });

  it('undo twice does not duplicate rows', () => {
    const { items, removed } = removeDone(list);
    const once = reinsertRows(items, removed);
    expect(reinsertRows(once, removed)).toEqual(once);
  });

  it('unticks everything and can tick the same rows again', () => {
    const { items, changedIds } = uncheckAll(list);
    expect(items.every((i) => !i.done)).toBe(true);
    expect(changedIds).toEqual(['a', 'c', 'e']);
    expect(recheck(items, changedIds)).toEqual(list);
  });

  it('does nothing to a list with nothing ticked', () => {
    const none = [row('a', false)];
    expect(removeDone(none)).toEqual({ items: none, removed: [] });
    expect(uncheckAll(none).changedIds).toEqual([]);
  });
});
