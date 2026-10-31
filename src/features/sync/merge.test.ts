import { describe, expect, it } from 'vitest';
import type { Group } from '@/features/groups/model';
import type { Note } from '@/features/notes/model';
import { decideGroup, decideNote, textDiffers } from './merge';

const note = (p: Partial<Note> = {}): Note => ({
  id: 'n1',
  kind: 'text',
  title: 't',
  body: 'b',
  items: [],
  color: 'yellow',
  groupId: null,
  pinned: false,
  archived: false,
  createdAt: 1,
  updatedAt: 100,
  deletedAt: null,
  ...p,
});
const doc = (n: Note) => ({ kind: 'doc' as const, note: n });
const purged = (updatedAt: number) => ({ kind: 'purged' as const, updatedAt });

describe('decideNote: a note that exists on both sides', () => {
  it('does nothing when the versions match', () => {
    expect(decideNote(note(), undefined, doc(note()), 100)).toEqual({ action: 'noop', base: 100 });
  });

  it('takes the cloud version when it is newer and we changed nothing', () => {
    const d = decideNote(note({ updatedAt: 100 }), undefined, doc(note({ updatedAt: 200, body: 'new' })), 100);
    expect(d).toEqual({ action: 'apply', base: 200 });
  });

  it('keeps ours when it is newer (it will be uploaded)', () => {
    const d = decideNote(note({ updatedAt: 300 }), undefined, doc(note({ updatedAt: 200 })), 200);
    expect(d).toEqual({ action: 'keepLocal', base: 200 });
  });

  it('keeps the losing text as a copy when both sides changed it since they agreed', () => {
    const mine = note({ updatedAt: 150, body: 'my edit' });
    const theirs = note({ updatedAt: 200, body: 'their edit' });
    expect(decideNote(mine, undefined, doc(theirs), 100)).toEqual({ action: 'apply', base: 200, copy: 'local' });
    const mineNewer = note({ updatedAt: 250, body: 'my edit' });
    expect(decideNote(mineNewer, undefined, doc(theirs), 100)).toEqual({
      action: 'keepLocal',
      base: 200,
      copy: 'remote',
    });
  });

  it('makes no copy when only colour, pin or archive differ (no text lost)', () => {
    const mine = note({ updatedAt: 150, pinned: true });
    const theirs = note({ updatedAt: 200, color: 'red' });
    expect(decideNote(mine, undefined, doc(theirs), 100)).toEqual({ action: 'apply', base: 200 });
  });

  it('makes no copy when there was never a shared version (e.g. a restored backup)', () => {
    const mine = note({ updatedAt: 150, body: 'old backup text' });
    const theirs = note({ updatedAt: 200, body: 'newer text' });
    expect(decideNote(mine, undefined, doc(theirs), undefined)).toEqual({ action: 'apply', base: 200 });
  });

  it('makes no copy when only the cloud changed', () => {
    const d = decideNote(note({ updatedAt: 100 }), undefined, doc(note({ updatedAt: 200, body: 'x' })), 100);
    expect(d.copy).toBeUndefined();
  });
});

describe('decideNote: a note missing here', () => {
  it('downloads it', () => {
    expect(decideNote(undefined, undefined, doc(note({ updatedAt: 200 })), undefined)).toEqual({
      action: 'apply',
      base: 200,
    });
  });

  it('respects our own later deletion', () => {
    expect(decideNote(undefined, 300, doc(note({ updatedAt: 200 })), 100)).toEqual({ action: 'noop', base: 200 });
  });

  it('brings it back if the cloud copy was edited after we deleted ours', () => {
    expect(decideNote(undefined, 150, doc(note({ updatedAt: 200 })), 100)).toEqual({ action: 'apply', base: 200 });
  });
});

describe('decideNote: deleted for good in the cloud', () => {
  it('removes our copy', () => {
    expect(decideNote(note({ updatedAt: 100 }), undefined, purged(200), 100)).toEqual({ action: 'delete', base: 200 });
  });

  it('keeps our copy if it was edited after the deletion', () => {
    expect(decideNote(note({ updatedAt: 300 }), undefined, purged(200), 100)).toEqual({
      action: 'keepLocal',
      base: 200,
    });
  });

  it('has nothing to do when we do not have it either', () => {
    expect(decideNote(undefined, undefined, purged(200), undefined)).toEqual({ action: 'noop', base: 200 });
  });
});

describe('textDiffers (continued)', () => {
  it('does not treat the kind hint on its own as a change of text', () => {
    expect(textDiffers(note({ kind: 'text', body: 'b' }), note({ kind: 'checklist', body: 'b' }))).toBe(false);
  });
  it('sees a change in the checklist even when there is text too', () => {
    const a = note({ body: 'b', items: [{ id: '1', text: 'x', done: false }] });
    const b = note({ body: 'b', items: [{ id: '1', text: 'x', done: true }] });
    expect(textDiffers(a, b)).toBe(true);
  });
});

describe('textDiffers', () => {
  it('ignores surrounding whitespace and compares checklist rows', () => {
    expect(textDiffers(note({ body: ' b ' }), note({ body: 'b' }))).toBe(false);
    const a = note({ kind: 'checklist', body: '', items: [{ id: '1', text: 'x', done: false }] });
    const b = note({ kind: 'checklist', body: '', items: [{ id: '2', text: 'x', done: true }] });
    expect(textDiffers(a, b)).toBe(true);
  });
});

describe('decideGroup', () => {
  const group = (p: Partial<Group> = {}): Group => ({
    id: 'g',
    name: 'n',
    icon: 'folder',
    color: 'blue',
    createdAt: 1,
    updatedAt: 100,
    deletedAt: null,
    ...p,
  });
  it('newest wins', () => {
    expect(decideGroup(undefined, { kind: 'doc', group: group() })).toEqual({ action: 'apply', base: 100 });
    expect(decideGroup(group({ updatedAt: 100 }), { kind: 'doc', group: group({ updatedAt: 200 }) })).toEqual({
      action: 'apply',
      base: 200,
    });
    expect(decideGroup(group({ updatedAt: 300 }), { kind: 'doc', group: group({ updatedAt: 200 }) })).toEqual({
      action: 'keepLocal',
      base: 200,
    });
    expect(decideGroup(group(), { kind: 'doc', group: group() })).toEqual({ action: 'noop', base: 100 });
  });
});
