import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { TodoDB } from '@/core/db/db';
import { createNotesRepository, type NotesRepository } from '@/features/notes/repository';
import { normalizeGroupName, parseGroup } from './model';
import { createGroupsRepository, type GroupsRepository } from './repository';

let clock = 1000;
let db: TodoDB;
let groups: GroupsRepository;
let notes: NotesRepository;

beforeEach(() => {
  clock = 1000;
  db = new TodoDB(`test-${crypto.randomUUID()}`);
  const now = () => (clock += 10);
  groups = createGroupsRepository(db, now);
  notes = createNotesRepository(db, now);
});

describe('group names and parsing', () => {
  it('tidies names', () => {
    expect(normalizeGroupName('  სამსახური   პროექტი ')).toBe('სამსახური პროექტი');
    expect(normalizeGroupName('x'.repeat(100))).toHaveLength(40);
  });

  it('rejects unusable groups and fixes damaged fields', () => {
    expect(parseGroup(null)).toBeNull();
    expect(parseGroup({ id: 'a', name: '  ', updatedAt: 1 })).toBeNull();
    expect(parseGroup({ id: 'a', name: 'ok' })).toBeNull();
    expect(parseGroup({ id: 'a', name: 'ok', updatedAt: 5, icon: 'nope', color: 'pink' })).toMatchObject({
      icon: 'folder',
      color: 'blue',
      createdAt: 5,
      deletedAt: null,
    });
  });
});

describe('groups repository', () => {
  it('creates groups and lists them oldest first', async () => {
    const first = await groups.create({ name: 'სამსახური', icon: 'building', color: 'red' });
    const second = await groups.create({ name: 'სახლი' });
    expect(first).toMatchObject({ name: 'სამსახური', icon: 'building', color: 'red' });
    expect((await groups.getAll()).map((g) => g.id)).toEqual([first.id, second.id]);
  });

  it('refuses an empty name', async () => {
    await expect(groups.create({ name: '   ' })).rejects.toThrowError(RangeError);
    const g = await groups.create({ name: 'ok' });
    await expect(groups.update(g.id, { name: ' ' })).rejects.toThrowError(RangeError);
  });

  it('renames and restyles', async () => {
    const g = await groups.create({ name: 'old' });
    await groups.update(g.id, { name: 'new', icon: 'star', color: 'green' });
    expect((await groups.getAll())[0]).toMatchObject({ name: 'new', icon: 'star', color: 'green' });
  });

  it('removing a group keeps its notes and detaches them', async () => {
    const g = await groups.create({ name: 'work' });
    const other = await groups.create({ name: 'home' });
    const inGroup = await notes.create({ groupId: g.id });
    const inOther = await notes.create({ groupId: other.id });
    await notes.update(inGroup.id, { body: 'x' });

    await groups.remove(g.id);

    expect((await groups.getAll()).map((x) => x.id)).toEqual([other.id]);
    expect((await groups.getAllIncludingDeleted()).find((x) => x.id === g.id)?.deletedAt).not.toBeNull();
    expect((await notes.get(inGroup.id))?.groupId).toBeNull();
    expect((await notes.get(inGroup.id))?.body).toBe('x');
    expect((await notes.get(inOther.id))?.groupId).toBe(other.id);
  });

  it('merges imported groups: newer wins', async () => {
    const g = await groups.create({ name: 'mine' });
    const current = (await groups.getAllIncludingDeleted())[0]!;
    await groups.importMany([
      { ...current, name: 'older', updatedAt: current.updatedAt - 1 },
      { ...current, id: 'other', name: 'imported' },
    ]);
    const names = (await groups.getAll()).map((x) => x.name).sort();
    expect(names).toEqual(['imported', 'mine']);
    await groups.importMany([{ ...current, name: 'newer', updatedAt: current.updatedAt + 1 }]);
    expect((await groups.getAll()).find((x) => x.id === g.id)?.name).toBe('newer');
  });

  it('assigns a note to a group and back', async () => {
    const g = await groups.create({ name: 'g' });
    const n = await notes.create();
    await notes.update(n.id, { groupId: g.id });
    expect((await notes.get(n.id))?.groupId).toBe(g.id);
    await notes.update(n.id, { groupId: null });
    expect((await notes.get(n.id))?.groupId).toBeNull();
  });
});

describe('database upgrade from version 1', () => {
  it('keeps every existing note and gives it no group', async () => {
    const name = `legacy-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(1).stores({ notes: 'id, updatedAt, deletedAt, color' });
    const legacy = (id: string, extra: object = {}) => ({
      id,
      kind: 'text',
      title: `title ${id}`,
      body: 'ტექსტი',
      items: [],
      color: 'green',
      pinned: true,
      archived: false,
      createdAt: 1,
      updatedAt: 2,
      deletedAt: null,
      ...extra,
    });
    await old.table('notes').bulkAdd([legacy('a'), legacy('b', { deletedAt: 9 }), legacy('c', { kind: 'checklist', items: [{ id: 'i', text: 'x', done: true }] })]);
    old.close();

    const upgraded = new TodoDB(name);
    const all = await upgraded.notes.toArray();
    expect(all).toHaveLength(3);
    for (const note of all) {
      expect(note.groupId).toBeNull();
      expect(note.color).toBe('green');
      expect(note.pinned).toBe(true);
    }
    expect(all.find((n) => n.id === 'a')).toMatchObject({ title: 'title a', body: 'ტექსტი' });
    expect(all.find((n) => n.id === 'b')?.deletedAt).toBe(9);
    expect(all.find((n) => n.id === 'c')?.items).toEqual([{ id: 'i', text: 'x', done: true }]);
    expect(await upgraded.groups.count()).toBe(0);
    upgraded.close();
  });
});

describe('the colour new notes get in a group', () => {
  it('is chosen when the group is made, changed later, and cleared', async () => {
    const { groups: repo } = (() => {
      const db = new TodoDB(`gc-${crypto.randomUUID()}`);
      return { groups: createGroupsRepository(db) };
    })();
    const g = await repo.create({ name: 'სამსახური', noteColor: 'red' });
    expect(g.noteColor).toBe('red');
    await repo.update(g.id, { noteColor: 'green' });
    expect((await repo.getAll())[0]?.noteColor).toBe('green');
    await repo.update(g.id, { noteColor: null });
    expect((await repo.getAll())[0]?.noteColor).toBeNull();
    await repo.update(g.id, { name: 'ახალი სახელი' }); // changing something else leaves it alone
    expect((await repo.getAll())[0]?.noteColor).toBeNull();
  });

  it('starts as "no preference" and old groups read that way too', async () => {
    const db = new TodoDB(`gc-${crypto.randomUUID()}`);
    const repo = createGroupsRepository(db);
    expect((await repo.create({ name: 'a' })).noteColor).toBeNull();
    expect(parseGroup({ id: 'old', name: 'ძველი', updatedAt: 1 })?.noteColor).toBeNull();
    expect(parseGroup({ id: 'x', name: 'x', updatedAt: 1, noteColor: 'pink' })?.noteColor).toBeNull();
    expect(parseGroup({ id: 'x', name: 'x', updatedAt: 1, noteColor: 'teal' })?.noteColor).toBe('teal');
  });
});
