import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { TodoDB } from '@/core/db/db';
import { createGroupsRepository, type GroupsRepository } from '@/features/groups/repository';
import { createNotesRepository, type NotesRepository } from '@/features/notes/repository';
import { SyncEngine } from './engine';
import { groupKey, META_UID, noteKey } from './keys';
import { FakeCloud } from './testing/fakeCloud';

const UID = 'user-1';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Device {
  db: TodoDB;
  notes: NotesRepository;
  groups: GroupsRepository;
  engine: SyncEngine;
  tick: () => number;
}

let cloud: FakeCloud;
let time: number;
const tick = () => (time += 10);

function device(name: string, uid = UID): Device {
  const db = new TodoDB(`sync-${name}-${crypto.randomUUID()}`);
  const engine = new SyncEngine({
    db,
    uid,
    store: cloud.createStore(uid),
    pushDelayMs: 0,
    now: tick,
    conflictLabel: () => '(copy)',
  });
  return { db, notes: createNotesRepository(db, tick), groups: createGroupsRepository(db, tick), engine, tick };
}

/** Lets every device finish what it is doing, repeatedly, until the whole system is quiet. */
async function settle(...devices: Device[]) {
  for (let round = 0; round < 8; round += 1) {
    await Promise.all(devices.map((d) => d.engine.idle()));
    await sleep(8);
  }
  await Promise.all(devices.map((d) => d.engine.idle()));
}

async function write(d: Device, input: { title?: string; body?: string; groupId?: string | null }) {
  const note = await d.notes.create({ groupId: input.groupId ?? null });
  await d.notes.update(note.id, { title: input.title ?? '', body: input.body ?? '' });
  return note.id;
}

beforeEach(() => {
  cloud = new FakeCloud();
  time = 1_000;
});

describe('first sync', () => {
  it('uploads what is on the device, but not blank notes', async () => {
    const a = device('a');
    const id = await write(a, { title: 'ნოტა', body: 'ტექსტი' });
    await a.notes.create(); // blank, never written in
    const group = await a.groups.create({ name: 'სამსახური' });

    await a.engine.start();
    await settle(a);

    expect(cloud.docs(UID, 'notes').map((d) => d.id)).toEqual([id]);
    expect(cloud.docs(UID, 'groups').map((d) => d.id)).toEqual([group.id]);
    expect(cloud.get(UID, 'notes', id)?.data).toMatchObject({ title: 'ნოტა', body: 'ტექსტი', deletedAt: null });
    expect(a.engine.getStatus()).toMatchObject({ state: 'idle', pending: 0, pushed: 2, error: null });
    expect((await a.db.sync.get(META_UID))?.value).toBe(UID);
  });

  it('a second device downloads everything, including trash and groups', async () => {
    const a = device('a');
    const group = await a.groups.create({ name: 'სახლი', icon: 'home', color: 'green' });
    const live = await write(a, { title: 'ცოცხალი', body: 'x', groupId: group.id });
    const trashed = await write(a, { title: 'ნაგავში', body: 'y' });
    await a.notes.moveToTrash(trashed);
    await a.engine.start();
    await settle(a);

    const b = device('b');
    await b.engine.start();
    await settle(a, b);

    expect((await b.notes.get(live))?.groupId).toBe(group.id);
    expect((await b.notes.get(trashed))?.deletedAt).not.toBeNull();
    expect((await b.groups.getAll())[0]).toMatchObject({ name: 'სახლი', icon: 'home', color: 'green' });
    expect(b.engine.getStatus().pulled).toBe(3);
    expect(b.engine.getStatus().pending).toBe(0);
  });

  it('merges note by note when both devices already have different notes', async () => {
    const a = device('a');
    const b = device('b');
    const fromA = await write(a, { title: 'A-ს ნოტა', body: 'a' });
    const fromB = await write(b, { title: 'B-ს ნოტა', body: 'b' });
    await a.engine.start();
    await b.engine.start();
    await settle(a, b);

    for (const d of [a, b]) {
      expect(await d.notes.get(fromA)).toBeDefined();
      expect(await d.notes.get(fromB)).toBeDefined();
    }
  });
});

describe('keeping devices in step', () => {
  it('an edit on one device reaches the other', async () => {
    const a = device('a');
    const b = device('b');
    const id = await write(a, { title: 'ძველი', body: 'ტექსტი' });
    await a.engine.start();
    await b.engine.start();
    await settle(a, b);

    await a.notes.update(id, { title: 'ახალი', body: 'შეცვლილი' });
    await settle(a, b);

    expect(await b.notes.get(id)).toMatchObject({ title: 'ახალი', body: 'შეცვლილი' });
  });

  it('a note with both text and a checklist reaches the other device whole', async () => {
    const a = device('a');
    const b = device('b');
    const id = await write(a, { title: 'შერეული', body: 'ტექსტი ზემოთ' });
    await a.notes.update(id, { items: [{ id: 'r1', text: 'პური', done: true }, { id: 'r2', text: 'რძე', done: false }] });
    await a.engine.start();
    await b.engine.start();
    await settle(a, b);

    expect(await b.notes.get(id)).toMatchObject({
      body: 'ტექსტი ზემოთ',
      items: [
        { id: 'r1', text: 'პური', done: true },
        { id: 'r2', text: 'რძე', done: false },
      ],
    });

    await b.notes.update(id, { body: 'შეცვლილი ტექსტი' });
    await settle(a, b);
    expect((await a.notes.get(id))?.items).toHaveLength(2);
    expect((await a.notes.get(id))?.body).toBe('შეცვლილი ტექსტი');
  });

  it('a group keeps the colour it gives to new notes when it travels to another device', async () => {
    const a = device('a');
    const b = device('b');
    const group = await a.groups.create({ name: 'სამსახური', color: 'blue', noteColor: 'red' });
    await a.engine.start();
    await b.engine.start();
    await settle(a, b);
    expect((await b.groups.getAll())[0]).toMatchObject({ id: group.id, color: 'blue', noteColor: 'red' });

    await b.groups.update(group.id, { noteColor: null });
    await settle(a, b);
    expect((await a.groups.getAll())[0]?.noteColor).toBeNull();
  });

  it('trash and restore travel too', async () => {
    const a = device('a');
    const b = device('b');
    const id = await write(a, { title: 't', body: 'b' });
    await a.engine.start();
    await b.engine.start();
    await settle(a, b);

    await a.notes.moveToTrash(id);
    await settle(a, b);
    expect((await b.notes.get(id))?.deletedAt).not.toBeNull();

    await a.notes.restore(id);
    await settle(a, b);
    expect((await b.notes.get(id))?.deletedAt).toBeNull();
  });

  it('removing a group lets its notes go back to "no group" on the other device', async () => {
    const a = device('a');
    const b = device('b');
    const group = await a.groups.create({ name: 'g' });
    const id = await write(a, { title: 't', body: 'b', groupId: group.id });
    await a.engine.start();
    await b.engine.start();
    await settle(a, b);
    expect((await b.notes.get(id))?.groupId).toBe(group.id);

    await a.groups.remove(group.id);
    await settle(a, b);

    expect((await b.notes.get(id))?.groupId).toBeNull();
    expect(await b.groups.getAll()).toEqual([]);
  });

  it('is quiet when nothing changes: no echo loops, no repeated uploads', async () => {
    const a = device('a');
    const b = device('b');
    await write(a, { title: 't', body: 'b' });
    await a.engine.start();
    await b.engine.start();
    await settle(a, b);

    const writes = cloud.writes;
    await a.engine.syncNow();
    await settle(a, b);
    await sleep(30);
    await settle(a, b);
    expect(cloud.writes).toBe(writes);
  });
});

describe('conflicts and being offline', () => {
  it('when both devices change the same note offline, the newest wins and the other text survives as a copy', async () => {
    const a = device('a');
    const b = device('b');
    const id = await write(a, { title: 'სია', body: 'საწყისი' });
    await a.engine.start();
    await b.engine.start();
    await settle(a, b);

    cloud.setOnline(false);
    await a.notes.update(id, { body: 'A-ს ვერსია' }); // older
    await b.notes.update(id, { body: 'B-ს ვერსია' }); // newer
    await settle(a, b);
    cloud.setOnline(true);
    await a.engine.syncNow();
    await b.engine.syncNow();
    await settle(a, b);

    for (const d of [a, b]) {
      const all = await d.notes.getAll();
      expect(all).toHaveLength(2);
      expect((await d.notes.get(id))?.body).toBe('B-ს ვერსია');
      const copy = all.find((n) => n.id !== id)!;
      expect(copy).toMatchObject({ title: 'სია (copy)', body: 'A-ს ვერსია', deletedAt: null });
    }
    expect(a.engine.getStatus().pending).toBe(0);
    expect(b.engine.getStatus().pending).toBe(0);
  });

  it('a failed upload keeps the change and succeeds when the connection returns', async () => {
    const a = device('a');
    const id = await write(a, { title: 't', body: 'b' });
    await a.engine.start();
    await settle(a);

    cloud.setOnline(false);
    await a.notes.update(id, { body: 'offline edit' });
    await settle(a);
    expect(a.engine.getStatus()).toMatchObject({ state: 'error', error: 'unavailable' });
    expect(a.engine.getStatus().pending).toBe(1);
    expect(cloud.get(UID, 'notes', id)?.data.body).toBe('b');

    cloud.setOnline(true);
    a.engine.syncNow();
    await settle(a);
    expect(a.engine.getStatus()).toMatchObject({ state: 'idle', pending: 0, error: null });
    expect(cloud.get(UID, 'notes', id)?.data.body).toBe('offline edit');
  });

  it('a device that was offline catches up on everything it missed', async () => {
    const a = device('a');
    const b = device('b');
    const id = await write(a, { title: 'v1', body: 'x' });
    await a.engine.start();
    await b.engine.start();
    await settle(a, b);

    cloud.setOnline(false);
    // B misses these (A cannot upload them either, until the connection is back)
    await a.notes.update(id, { title: 'v2' });
    const later = await write(a, { title: 'ახალი ნოტა', body: 'z' });
    await settle(a, b);
    cloud.setOnline(true);
    a.engine.syncNow();
    await settle(a, b);

    expect((await b.notes.get(id))?.title).toBe('v2');
    expect(await b.notes.get(later)).toBeDefined();
  });

  it('does not resend everything on restart: it resumes from where it stopped', async () => {
    const a = device('a');
    await write(a, { title: 't', body: 'b' });
    await a.groups.create({ name: 'g' });
    await a.engine.start();
    await settle(a);
    a.engine.stop();

    const again = new SyncEngine({ db: a.db, uid: UID, store: cloud.createStore(UID), pushDelayMs: 0, now: tick });
    await again.start();
    await sleep(10);
    await again.idle();

    const lastTwo = cloud.subscribedSince.slice(-2);
    expect(lastTwo.every((since) => typeof since === 'number' && since > 0)).toBe(true);
    expect(again.getStatus().pushed).toBe(0);
  });
});

describe('deleting for good', () => {
  it('reaches other devices, and the cloud stops holding the text', async () => {
    const a = device('a');
    const b = device('b');
    const id = await write(a, { title: 'საიდუმლო', body: 'ტექსტი' });
    await a.engine.start();
    await b.engine.start();
    await settle(a, b);

    await a.notes.moveToTrash(id);
    await a.notes.deleteForever(id);
    await settle(a, b);

    expect(await a.notes.get(id)).toBeUndefined();
    expect(await b.notes.get(id)).toBeUndefined();
    expect(cloud.get(UID, 'notes', id)?.data).toMatchObject({ purged: true });
    expect(JSON.stringify(cloud.get(UID, 'notes', id)?.data)).not.toContain('საიდუმლო');
    expect(await a.db.tombstones.count()).toBe(0); // reported, so no longer pending
  });

  it('reaches a device that was offline at the time', async () => {
    const a = device('a');
    const b = device('b');
    const id = await write(a, { title: 't', body: 'b' });
    await a.engine.start();
    await b.engine.start();
    await settle(a, b);
    b.engine.stop();

    await a.notes.moveToTrash(id);
    await a.notes.emptyTrash();
    await settle(a);

    await b.engine.start();
    await settle(a, b);
    expect(await b.notes.get(id)).toBeUndefined();
  });

  it('a note edited elsewhere after it was deleted for good comes back', async () => {
    const a = device('a');
    const b = device('b');
    const id = await write(a, { title: 't', body: 'b' });
    await a.engine.start();
    await b.engine.start();
    await settle(a, b);

    cloud.setOnline(false);
    await a.notes.moveToTrash(id);
    await a.notes.deleteForever(id); // deletion time T1
    await b.notes.update(id, { body: 'edited later on B' }); // later than T1
    cloud.setOnline(true);
    a.engine.syncNow();
    b.engine.syncNow();
    await settle(a, b);

    expect((await a.notes.get(id))?.body).toBe('edited later on B');
    expect((await b.notes.get(id))?.body).toBe('edited later on B');
  });

  it('a note that never reached the cloud leaves no trace', async () => {
    const a = device('a');
    const id = await write(a, { title: 't', body: 'b' });
    await a.notes.moveToTrash(id);
    await a.notes.deleteForever(id);
    await a.engine.start();
    await settle(a);
    expect(cloud.docs(UID, 'notes')).toEqual([]);
    expect(await a.db.tombstones.count()).toBe(0);
  });
});

describe('accounts', () => {
  it('does not mix in another account: a device bound to one account stays out of another', async () => {
    const a = device('a');
    await write(a, { title: 'ჩემი', body: 'x' });
    await a.engine.start();
    await settle(a);

    const other = new SyncEngine({ db: a.db, uid: 'someone-else', store: cloud.createStore('someone-else'), pushDelayMs: 0 });
    await other.start();
    await sleep(10);
    expect(other.getStatus().state).toBe('mismatch');
    expect(cloud.docs('someone-else', 'notes')).toEqual([]);
  });

  it('keeps each account\'s data apart in the cloud', async () => {
    const a = device('a', 'user-a');
    const b = device('b', 'user-b');
    await write(a, { title: 'A-ს', body: 'x' });
    await a.engine.start();
    await b.engine.start();
    await settle(a, b);
    expect(await b.notes.getAll()).toEqual([]);
  });
});

describe('problems', () => {
  it('one document the cloud refuses does not block the rest', async () => {
    const a = device('a');
    const good = await write(a, { title: 'კარგი', body: 'x' });
    const huge = await write(a, { title: 'უზარმაზარი', body: 'y' });
    cloud.refuse.set(huge, 'invalid-argument');
    await a.engine.start();
    await settle(a);

    expect(cloud.get(UID, 'notes', good)).toBeDefined();
    expect(cloud.get(UID, 'notes', huge)).toBeUndefined();
    expect(a.engine.getStatus()).toMatchObject({ failed: 1, state: 'idle' });
  });

  it('reports a listening failure (e.g. rules not published) instead of hiding it', async () => {
    const a = device('a');
    await a.engine.start();
    await settle(a);
    cloud.failSubscribers('permission-denied');
    await sleep(10);
    expect(a.engine.getStatus()).toMatchObject({ state: 'error', error: 'permission-denied' });
  });

  it('ignores damaged documents in the cloud', async () => {
    const a = device('a');
    await cloud.createStore(UID).write([
      { collection: 'notes', id: 'junk', data: { nonsense: true } },
      { collection: 'notes', id: 'good', data: { kind: 'text', title: 'ok', body: 'x', updatedAt: 5 } },
    ]);
    await a.engine.start();
    await settle(a);
    expect((await a.notes.getAll()).map((n) => n.id)).toEqual(['good']);
    expect(await a.db.sync.get(noteKey('good'))).toBeDefined();
    expect(await a.db.sync.get(groupKey('x'))).toBeUndefined();
  });
});
