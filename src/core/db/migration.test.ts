import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { groupToCloud, noteToCloud, findUndefined } from '@/features/sync/cloud';
import type { Group } from '@/features/groups/model';
import type { Note } from '@/features/notes/model';
import { TodoDB } from './db';

const name = () => `migrate-${crypto.randomUUID()}`;

describe('opening a database made by an older version of the app', () => {
  it('gives old notes a date (none) and old groups a note colour (none), and changes nothing else', async () => {
    const dbName = name();
    // The database exactly as version 4 of the app left it: records without the newer fields.
    const old = new Dexie(dbName);
    old.version(4).stores({
      notes: 'id, updatedAt, deletedAt, color, groupId',
      groups: 'id, updatedAt, deletedAt',
      sync: 'key',
      tombstones: 'key',
      pendingSnapshots: 'id',
    });
    await old.table('notes').put({
      id: 'n1', kind: 'text', title: 'ძველი', body: 'ტექსტი', items: [], color: 'red', groupId: 'g1',
      pinned: true, archived: false, createdAt: 5, updatedAt: 777, deletedAt: null,
    });
    await old.table('groups').put({ id: 'g1', name: 'ჯგუფი', icon: 'folder', color: 'blue', createdAt: 5, updatedAt: 888, deletedAt: null });
    old.close();

    const db = new TodoDB(dbName);
    const note = (await db.notes.get('n1')) as Note;
    const group = (await db.groups.get('g1')) as Group;

    expect(note.date).toBeNull();
    expect(group.noteColor).toBeNull();
    // nothing looks edited: the sync would otherwise re-upload everything
    expect(note).toMatchObject({ title: 'ძველი', body: 'ტექსტი', color: 'red', groupId: 'g1', pinned: true, updatedAt: 777 });
    expect(group).toMatchObject({ name: 'ჯგუფი', color: 'blue', updatedAt: 888 });
    db.close();
  });

  it('leaves dates and colours that are already set alone', async () => {
    const dbName = name();
    const old = new Dexie(dbName);
    old.version(4).stores({
      notes: 'id, updatedAt, deletedAt, color, groupId',
      groups: 'id, updatedAt, deletedAt',
      sync: 'key',
      tombstones: 'key',
      pendingSnapshots: 'id',
    });
    await old.table('notes').put({ id: 'n', kind: 'text', title: 't', body: '', items: [], color: 'red', groupId: null, date: '2026-12-05', pinned: false, archived: false, createdAt: 1, updatedAt: 1, deletedAt: null });
    await old.table('groups').put({ id: 'g', name: 'g', icon: 'folder', color: 'blue', noteColor: 'green', createdAt: 1, updatedAt: 1, deletedAt: null });
    old.close();
    const db = new TodoDB(dbName);
    expect(((await db.notes.get('n')) as Note).date).toBe('2026-12-05');
    expect(((await db.groups.get('g')) as Group).noteColor).toBe('green');
    db.close();
  });

  it('upgrades all the way from the very first version', async () => {
    const dbName = name();
    const first = new Dexie(dbName);
    first.version(1).stores({ notes: 'id, updatedAt, deletedAt, color' });
    await first.table('notes').put({ id: 'n', kind: 'text', title: 'პირველი', body: 'b', items: [], color: 'yellow', pinned: false, archived: false, createdAt: 1, updatedAt: 1, deletedAt: null });
    first.close();
    const db = new TodoDB(dbName);
    expect(await db.notes.get('n')).toMatchObject({ title: 'პირველი', groupId: null, date: null });
    db.close();
  });
});

describe('what goes to the cloud', () => {
  const legacyNote = { id: 'n', kind: 'text', title: 't', body: 'b', items: [{ id: 'i', text: 'x', done: false }], color: 'red', pinned: false, archived: false, createdAt: 1, updatedAt: 2 } as unknown as Note;
  const legacyGroup = { id: 'g', name: 'g', icon: 'folder', color: 'blue', createdAt: 1, updatedAt: 2 } as unknown as Group;

  it('never contains undefined, even for records that lack newer fields', () => {
    expect(findUndefined(noteToCloud(legacyNote))).toBeNull();
    expect(findUndefined(groupToCloud(legacyGroup))).toBeNull();
    expect(noteToCloud(legacyNote)).toMatchObject({ date: null, groupId: null, deletedAt: null });
    expect(groupToCloud(legacyGroup)).toMatchObject({ noteColor: null, deletedAt: null });
  });

  it('findUndefined sees it anywhere, also inside lists', () => {
    expect(findUndefined({ a: 1, b: { c: undefined } })).toBe('b.c');
    expect(findUndefined({ items: [{ id: 1 }, { id: undefined }] })).toBe('items[1].id');
    expect(findUndefined({ a: null, b: 0, c: '' })).toBeNull();
  });
});
