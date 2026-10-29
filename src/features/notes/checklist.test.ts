import { describe, expect, it } from 'vitest';
import { applyItemInput } from './checklist';
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
