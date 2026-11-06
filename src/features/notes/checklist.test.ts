import { describe, expect, it } from 'vitest';
import { applyItemInput, conversionLoss, doneCount, dropIndex, moveItem, recheck, reinsertRows, removeDone, slideOffset, uncheckAll } from './checklist';
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

describe('moving rows', () => {
  const abc = ['a', 'b', 'c', 'd'];

  it('moves a row down and up, without touching the original', () => {
    expect(moveItem(abc, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(abc, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
    expect(abc).toEqual(['a', 'b', 'c', 'd']);
  });

  it('moving a row where it already is changes nothing', () => {
    expect(moveItem(abc, 2, 2)).toBe(abc);
  });

  it('keeps within the list, so a push past the end is harmless', () => {
    expect(moveItem(abc, 3, 9)).toBe(abc);
    expect(moveItem(abc, 0, -4)).toBe(abc);
    expect(moveItem(abc, 1, 99)).toEqual(['a', 'c', 'd', 'b']);
    expect(moveItem([], 0, 1)).toEqual([]);
  });

  describe('where a dragged row lands', () => {
    const centers = [20, 70, 120, 170]; // four rows, 50 high

    it('stays put until its middle passes a neighbour', () => {
      expect(dropIndex(centers, 1, 70)).toBe(1);
      expect(dropIndex(centers, 1, 60)).toBe(1);
      expect(dropIndex(centers, 1, 90)).toBe(1);
    });

    it('goes down past a row once its middle is below that row\'s middle', () => {
      expect(dropIndex(centers, 0, 80)).toBe(1);
      expect(dropIndex(centers, 0, 130)).toBe(2);
      expect(dropIndex(centers, 0, 999)).toBe(3);
    });

    it('goes up past a row once its middle is above that row\'s middle', () => {
      expect(dropIndex(centers, 3, 100)).toBe(2);
      expect(dropIndex(centers, 3, 60)).toBe(1);
      expect(dropIndex(centers, 3, -50)).toBe(0);
    });

    it('works with rows of different heights', () => {
      expect(dropIndex([10, 60, 200], 0, 100)).toBe(1);
      expect(dropIndex([10, 60, 200], 0, 250)).toBe(2);
    });
  });

  describe('making room for the dragged row', () => {
    it('rows it passes going down slide up by its height', () => {
      expect([0, 1, 2, 3].map((i) => slideOffset(i, 0, 2, 40))).toEqual([0, -40, -40, 0]);
    });
    it('rows it passes going up slide down by its height', () => {
      expect([0, 1, 2, 3].map((i) => slideOffset(i, 3, 1, 40))).toEqual([0, 40, 40, 0]);
    });
    it('nothing moves while the row is still in its place', () => {
      expect([0, 1, 2, 3].map((i) => slideOffset(i, 2, 2, 40))).toEqual([0, 0, 0, 0]);
    });
    it('the dragged row itself is moved by the finger, not by this', () => {
      expect(slideOffset(1, 1, 3, 40)).toBe(0);
    });
  });
});

describe('what turning a checklist into text would lose', () => {
  const row = (text: string, done = false, date?: string): ChecklistItem => ({ id: text, text, done, ...(date ? { date } : {}) });
  it('nothing for a plain, unticked list', () => {
    expect(conversionLoss([row('a'), row('b')])).toEqual({ ticked: 0, days: 0 });
  });
  it('counts ticked rows and daily rows', () => {
    expect(conversionLoss([row('a', true), row('b'), row('c', true, '2026-11-03'), row('d', false, '2026-11-04')])).toEqual({ ticked: 2, days: 2 });
  });
  it('a blank ticked row is not a loss', () => {
    expect(conversionLoss([row('  ', true)])).toEqual({ ticked: 0, days: 0 });
  });
});
