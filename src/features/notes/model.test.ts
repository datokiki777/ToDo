import { describe, expect, it } from 'vitest';
import {
  checklistProgress,
  contentForSave,
  convertKind,
  deriveKind,
  displayTitle,
  hasChecklist,
  isNoteEmpty,
  matchesQuery,
  parseNote,
  previewLines,
  type Note,
  type NoteContent,
} from './model';
import { noteToCloud } from '@/features/sync/cloud';
import { countNotes, selectNotes } from './selectors';

function note(partial: Partial<Note> = {}): Note {
  return {
    id: crypto.randomUUID(),
    kind: 'text',
    title: '',
    body: '',
    items: [],
    color: 'yellow',
    groupId: null,
    pinned: false,
    archived: false,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    ...partial,
  };
}

describe('model', () => {
  it('detects empty notes', () => {
    expect(isNoteEmpty(note())).toBe(true);
    expect(isNoteEmpty(note({ title: '  ' }))).toBe(true);
    expect(isNoteEmpty(note({ body: 'x' }))).toBe(false);
    expect(
      isNoteEmpty(note({ kind: 'checklist', items: [{ id: '1', text: ' ', done: false }] })),
    ).toBe(true);
  });

  it('converts text to checklist and back without losing words', () => {
    const text = note({ body: 'პური\n\nკარაქი  \nყველი' });
    const list = convertKind(text, 'checklist');
    expect(list.kind).toBe('checklist');
    expect(list.body).toBe('');
    expect(list.items.map((i) => i.text)).toEqual(['პური', 'კარაქი', 'ყველი']);
    const back = convertKind(list, 'text');
    expect(back.body).toBe('პური\nკარაქი\nყველი');
    expect(back.items).toEqual([]);
  });

  it('builds title and preview from content', () => {
    const n = note({ body: 'პირველი ხაზი\nმეორე\nმესამე' });
    expect(displayTitle(n)).toBe('პირველი ხაზი');
    expect(previewLines(n, 2)).toEqual(['მეორე', 'მესამე']);
    const titled = note({ title: 'სათაური', body: 'ტექსტი' });
    expect(displayTitle(titled)).toBe('სათაური');
    expect(previewLines(titled, 2)).toEqual(['ტექსტი']);
  });

  it('counts checklist progress', () => {
    const n = note({
      kind: 'checklist',
      items: [
        { id: '1', text: 'a', done: true },
        { id: '2', text: 'b', done: false },
        { id: '3', text: '', done: true },
      ],
    });
    expect(checklistProgress(n)).toEqual({ done: 1, total: 2 });
  });

  it('searches case-insensitively, including Georgian and checklist items', () => {
    expect(matchesQuery(note({ title: 'Shopping LIST' }), 'list')).toBe(true);
    expect(matchesQuery(note({ body: 'ხვალ შეხვედრა' }), 'შეხვედრა')).toBe(true);
    expect(
      matchesQuery(note({ kind: 'checklist', items: [{ id: '1', text: 'Milk', done: false }] }), 'milk'),
    ).toBe(true);
    expect(matchesQuery(note({ body: 'abc' }), 'xyz')).toBe(false);
    expect(matchesQuery(note(), '')).toBe(true);
  });

  describe('parseNote', () => {
    it('rejects unusable values', () => {
      expect(parseNote(null)).toBeNull();
      expect(parseNote('x')).toBeNull();
      expect(parseNote({})).toBeNull();
      expect(parseNote({ id: 'a' })).toBeNull();
      expect(parseNote({ id: '', updatedAt: 1 })).toBeNull();
    });

    it('fills safe defaults for damaged fields', () => {
      const parsed = parseNote({ id: 'a', updatedAt: 5, color: 'pink', title: 42, pinned: 'yes' });
      expect(parsed).toMatchObject({
        id: 'a',
        kind: 'text',
        title: '',
        color: 'yellow',
        pinned: false,
        createdAt: 5,
        deletedAt: null,
      });
    });

    it('keeps valid checklist items and drops broken ones', () => {
      const parsed = parseNote({
        id: 'a',
        kind: 'checklist',
        updatedAt: 1,
        items: [{ id: 'i1', text: 'ok', done: true }, { text: 5 }, null],
      });
      expect(parsed?.items).toEqual([{ id: 'i1', text: 'ok', done: true }]);
    });

    it('keeps both the text and the checklist, whatever the kind says', () => {
      const items = [{ id: 'i1', text: 'რძე', done: false }];
      for (const kind of ['text', 'checklist']) {
        const parsed = parseNote({ id: 'a', kind, updatedAt: 1, body: 'ტექსტი', items });
        expect(parsed).toMatchObject({ body: 'ტექსტი', items });
      }
    });
  });
});

describe('selectNotes', () => {
  const base = { query: '', color: null, groupId: null, sortBy: 'date' } as const;
  const a = note({ id: 'a', body: 'a', updatedAt: 10, color: 'blue' });
  const b = note({ id: 'b', body: 'b', updatedAt: 30, color: 'red' });
  const c = note({ id: 'c', body: 'c', updatedAt: 20, color: 'blue', pinned: true });
  const arch = note({ id: 'arch', body: 'arch', archived: true });
  const trash = note({ id: 'trash', body: 'trash', deletedAt: 99 });
  const all = [a, b, c, arch, trash];

  it('separates active, archive and trash', () => {
    expect(selectNotes(all, { ...base, view: 'active' }).map((n) => n.id)).toEqual(['c', 'b', 'a']);
    expect(selectNotes(all, { ...base, view: 'archive' }).map((n) => n.id)).toEqual(['arch']);
    expect(selectNotes(all, { ...base, view: 'trash' }).map((n) => n.id)).toEqual(['trash']);
  });

  it('filters by colour and sorts by colour', () => {
    expect(selectNotes(all, { ...base, view: 'active', color: 'blue' }).map((n) => n.id)).toEqual([
      'c',
      'a',
    ]);
    // red comes before blue in the palette order; pinned still first
    expect(selectNotes(all, { ...base, view: 'active', sortBy: 'color' }).map((n) => n.id)).toEqual([
      'c',
      'b',
      'a',
    ]);
  });
});

describe('contentForSave', () => {
  it('drops blank checklist rows but keeps order and done state', async () => {
    const { contentForSave } = await import('./model');
    const saved = contentForSave({
      kind: 'checklist',
      title: 't',
      body: '',
      items: [
        { id: '1', text: 'a', done: true },
        { id: '2', text: '  ', done: false },
        { id: '3', text: 'b', done: false },
      ],
    });
    expect(saved.items.map((i) => i.id)).toEqual(['1', '3']);
    expect(saved.items[0]?.done).toBe(true);
  });
});

describe('blank notes are not listed', () => {
  it('hides blank notes in active and archive but not in trash', () => {
    const blank = note({ id: 'blank' });
    const blankTrashed = note({ id: 'blank-trash', deletedAt: 5 });
    const q = { query: '', color: null, groupId: null, sortBy: 'date' } as const;
    expect(selectNotes([blank], { ...q, view: 'active' })).toEqual([]);
    expect(selectNotes([{ ...blank, archived: true }], { ...q, view: 'archive' })).toEqual([]);
    expect(selectNotes([blankTrashed], { ...q, view: 'trash' })).toHaveLength(1);
  });
});

describe('groups in lists', () => {
  const q = { query: '', color: null, sortBy: 'date' } as const;
  const inA = note({ id: 'a1', body: 'a', groupId: 'A', updatedAt: 3 });
  const inA2 = note({ id: 'a2', body: 'a', groupId: 'A', updatedAt: 2 });
  const inB = note({ id: 'b1', body: 'b', groupId: 'B', updatedAt: 1 });
  const none = note({ id: 'n1', body: 'n', updatedAt: 4 });
  const archivedA = note({ id: 'a3', body: 'a', groupId: 'A', archived: true });
  const all = [inA, inA2, inB, none, archivedA];

  it('shows only the chosen group, or everything when none is chosen', () => {
    expect(selectNotes(all, { ...q, view: 'active', groupId: 'A' }).map((n) => n.id)).toEqual(['a1', 'a2']);
    expect(selectNotes(all, { ...q, view: 'active', groupId: null }).map((n) => n.id)).toEqual([
      'n1',
      'a1',
      'a2',
      'b1',
    ]);
  });

  it('combines group with colour and search', () => {
    const red = note({ id: 'r', body: 'milk', groupId: 'A', color: 'red' });
    expect(selectNotes([inA, red], { ...q, view: 'active', groupId: 'A', color: 'red' }).map((n) => n.id)).toEqual(['r']);
    expect(selectNotes([inA, red], { ...q, view: 'active', groupId: 'A', query: 'milk', color: null }).map((n) => n.id)).toEqual(['r']);
  });

  it('counts per group for the cards, per view', () => {
    const active = countNotes(all, 'active');
    expect(active.total).toBe(4);
    expect(active.byGroup.get('A')).toBe(2);
    expect(active.byGroup.get('B')).toBe(1);
    expect(countNotes(all, 'archive').byGroup.get('A')).toBe(1);
  });

  it('parses groupId from backups, defaulting to no group', () => {
    expect(parseNote({ id: 'x', updatedAt: 1, groupId: 'G' })?.groupId).toBe('G');
    expect(parseNote({ id: 'x', updatedAt: 1 })?.groupId).toBeNull();
    expect(parseNote({ id: 'x', updatedAt: 1, groupId: 5 })?.groupId).toBeNull();
  });
});

describe('a note with both text and a checklist', () => {
  const row = (text: string, done = false) => ({ id: text, text, done });
  const mixed = (p: Partial<Note> = {}) =>
    note({ title: 'სია', body: 'ტექსტი\nმეორე ხაზი', items: [row('პური', true), row('რძე')], ...p });

  it('shows the text first and then the checklist in previews', () => {
    expect(previewLines(mixed(), 5)).toEqual(['ტექსტი', 'მეორე ხაზი', 'პური', 'რძე']);
    expect(previewLines(mixed({ title: '' }), 5)).toEqual(['მეორე ხაზი', 'პური', 'რძე']);
  });

  it('counts the checklist progress even when there is text too', () => {
    expect(hasChecklist(mixed())).toBe(true);
    expect(checklistProgress(mixed())).toEqual({ done: 1, total: 2 });
    expect(hasChecklist(note({ body: 'x' }))).toBe(false);
  });

  it('is found by searching either part', () => {
    expect(matchesQuery(mixed(), 'მეორე ხაზი')).toBe(true);
    expect(matchesQuery(mixed(), 'რძე')).toBe(true);
  });

  it('derives the hint from what is inside, keeping the choice for a blank note', () => {
    const c = (p: Partial<NoteContent>): NoteContent => ({ kind: 'text', title: '', body: '', items: [], ...p });
    expect(deriveKind(c({ items: [row('a')] }))).toBe('checklist');
    expect(deriveKind(c({ body: 'x', items: [row('a')] }))).toBe('text');
    expect(deriveKind(c({ kind: 'checklist', body: 'x' }))).toBe('text');
    expect(deriveKind(c({ kind: 'checklist' }))).toBe('checklist'); // a new, still blank checklist
    expect(deriveKind(c({ kind: 'text' }))).toBe('text');
    expect(deriveKind(c({ kind: 'checklist', items: [row('  ')] }))).toBe('checklist');
  });

  it('turning text into a checklist adds to the rows already there, and back', () => {
    const start: NoteContent = { kind: 'text', title: 't', body: 'ერთი\nორი', items: [row('უკვე იყო')] };
    const list = convertKind(start, 'checklist');
    expect(list.items.map((i) => i.text)).toEqual(['უკვე იყო', 'ერთი', 'ორი']);
    expect(list.body).toBe('');
    const text = convertKind({ ...start, body: 'ტექსტი' }, 'text');
    expect(text.body).toBe('ტექსტი\nუკვე იყო');
    expect(text.items).toEqual([]);
  });

  it('saving keeps both parts and writes the right hint', () => {
    const saved = contentForSave({ kind: 'checklist', title: '', body: 'ტექსტი', items: [row('a'), row('  ')] });
    expect(saved.kind).toBe('text');
    expect(saved.items.map((i) => i.text)).toEqual(['a']);
    expect(saved.body).toBe('ტექსტი');
  });

  it('survives the trip to the cloud and back', () => {
    const original = mixed({ updatedAt: 9, kind: 'text' });
    expect(parseNote({ ...noteToCloud(original), id: original.id })).toEqual(original);
  });
});
