import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { TodoDB } from '@/core/db/db';
import { createGroupsRepository } from '@/features/groups/repository';
import { createNotesRepository, type NotesRepository } from '@/features/notes/repository';
import { SyncEngine } from '@/features/sync/engine';
import { FakeCloud } from '@/features/sync/testing/fakeCloud';
import {
  addDays,
  dateKey,
  decodeSnapshot,
  encodeSnapshot,
  isExpired,
  stateHash,
  type SnapshotData,
} from './model';
import { previewRestore } from './restore';
import { SnapshotService } from './service';
import { FakeSnapshotStore } from './testing/fakeSnapshotStore';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// Noon on a fixed day, so "same day" arithmetic never crosses midnight by accident.
const T0 = new Date(2026, 9, 30, 12, 0, 0).getTime();

let time: number;
const tick = () => (time += 10);

function setup() {
  const db = new TodoDB(`snap-${crypto.randomUUID()}`);
  return { db, notes: createNotesRepository(db, tick), groups: createGroupsRepository(db, tick) };
}
async function note(n: NotesRepository, title: string, body = '') {
  const created = await n.create();
  await n.update(created.id, { title, body });
  return created.id;
}

beforeEach(() => {
  time = T0;
});

describe('days and keeping', () => {
  it('names days by the local calendar date', () => {
    expect(dateKey(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('keeps today and the 29 days before it, drops the rest', () => {
    const today = '2026-10-30';
    expect(isExpired('2026-10-30', today)).toBe(false);
    expect(isExpired('2026-10-01', today)).toBe(false); // 29 days ago: the oldest kept
    expect(isExpired('2026-09-30', today)).toBe(true); // 30 days ago
    expect(isExpired('2026-01-01', today)).toBe(true);
  });
});

describe('the snapshot file', () => {
  it('survives compression and being cut into pieces, with Georgian text', async () => {
    const { db, notes } = setup();
    await note(notes, 'სათაური', 'ტექსტი '.repeat(500));
    const data: SnapshotData = { version: 1, takenAt: T0, notes: await db.notes.toArray(), groups: [] };
    const chunks = await encodeSnapshot(data, 40);
    expect(chunks.length).toBeGreaterThan(1);
    expect(await decodeSnapshot(chunks)).toEqual(data);
  });

  it('is much smaller than the text it holds', async () => {
    const { db, notes } = setup();
    await note(notes, 'x', 'ხანგრძლივი ტექსტი '.repeat(2000));
    const data: SnapshotData = { version: 1, takenAt: T0, notes: await db.notes.toArray(), groups: [] };
    const bytes = (await encodeSnapshot(data)).reduce((s, c) => s + c.length, 0);
    expect(bytes).toBeLessThan(JSON.stringify(data).length / 5);
  });

  it('refuses damaged data instead of guessing', async () => {
    await expect(decodeSnapshot([new Uint8Array([1, 2, 3])])).rejects.toMatchObject({ code: 'invalid' });
  });

  it('a fingerprint changes when anything is edited, added or removed', async () => {
    const { db, notes } = setup();
    const id = await note(notes, 'a', 'b');
    const h1 = stateHash(await db.notes.toArray(), []);
    expect(stateHash(await db.notes.toArray(), [])).toBe(h1);
    await notes.update(id, { body: 'changed' });
    const h2 = stateHash(await db.notes.toArray(), []);
    expect(h2).not.toBe(h1);
    await note(notes, 'second');
    expect(stateHash(await db.notes.toArray(), [])).not.toBe(h2);
  });
});

describe('the daily snapshot', () => {
  function service(over: { db: TodoDB }) {
    const store = new FakeSnapshotStore();
    return { store, svc: new SnapshotService({ db: over.db, store, now: () => time }) };
  }

  it('writes one on the first run of a day and then only when something changed', async () => {
    const { db, notes } = setup();
    const { store, svc } = service({ db });
    const id = await note(notes, 'ნოტა', 'x');

    expect(await svc.maybeTake()).toBe('written');
    expect(store.writes).toBe(1);
    expect(await svc.maybeTake()).toBe('unchanged');
    expect(store.writes).toBe(1);

    await notes.update(id, { body: 'edited' });
    time = T0 + 10 * 60_000; // 10 minutes later
    expect(await svc.maybeTake()).toBe('too-soon');
    time = T0 + 45 * 60_000; // 45 minutes later
    expect(await svc.maybeTake()).toBe('written');
    expect(store.writes).toBe(2);
    expect(store.metas.size).toBe(1); // same day, same entry: it holds the day's LAST state
  });

  it('the entry for a day holds the last state of that day', async () => {
    const { db, notes } = setup();
    const { svc } = service({ db });
    const id = await note(notes, 'ნოტა', 'morning');
    await svc.maybeTake();
    await notes.update(id, { body: 'evening' });
    time = T0 + 5 * HOUR;
    await svc.maybeTake();

    const [meta] = await svc.list();
    const data = await svc.load(meta!);
    expect(data.notes.find((n) => n.id === id)?.body).toBe('evening');
  });

  it('starts a new entry on a new day, and drops entries older than 30 days', async () => {
    const { db, notes } = setup();
    const { store, svc } = service({ db });
    await note(notes, 'a', 'b');
    await svc.maybeTake();
    const firstDay = dateKey(T0);

    for (let day = 1; day <= 31; day += 1) {
      time = T0 + day * DAY;
      await svc.maybeTake();
    }
    const dates = [...store.metas.values()].map((m) => m.date).sort();
    expect(dates).toHaveLength(30);
    expect(dates).not.toContain(firstDay);
    expect(dates.at(-1)).toBe(dateKey(T0 + 31 * DAY));
    expect(dates[0]).toBe(dateKey(T0 + 2 * DAY));
  });

  it('counts only live notes in the list entry', async () => {
    const { db, notes } = setup();
    const { svc } = service({ db });
    await note(notes, 'live');
    const gone = await note(notes, 'trashed');
    await notes.moveToTrash(gone);
    const meta = await svc.take('day');
    expect(meta).toMatchObject({ noteCount: 1, kind: 'day', date: dateKey(T0) });
  });
});

describe('restoring the whole app', () => {
  async function scenario() {
    const { db, notes, groups } = setup();
    const store = new FakeSnapshotStore();
    const svc = new SnapshotService({ db, store, now: () => time });
    const group = await groups.create({ name: 'სამსახური' });
    const kept = await note(notes, 'დარჩენილი', 'ძველი ტექსტი');
    await notes.update(kept, { groupId: group.id, pinned: true });
    const lost = await note(notes, 'დაკარგული', 'მნიშვნელოვანი');
    const trashed = await note(notes, 'ნაგავში იყო', 'ტექსტი');
    await notes.moveToTrash(trashed);
    const snapshot = await svc.take('day');
    return { db, notes, groups, store, svc, snapshot, ids: { kept, lost, trashed }, group };
  }

  it('brings the app back to that day, and nothing is destroyed', async () => {
    const { db, notes, groups, svc, snapshot, ids, group } = await scenario();
    time += DAY;
    await notes.update(ids.kept, { body: 'ახალი ტექსტი' });
    await notes.moveToTrash(ids.lost);
    await notes.deleteForever(ids.lost); // deleted for good after the snapshot
    const later = await note(notes, 'ახალი ნოტა', 'შეიქმნა მერე');
    await groups.remove(group.id);

    const result = await svc.restore(snapshot, 'whole');

    expect(result.restored).toBe(3);
    expect(result.trashed).toBe(1);
    const kept = await notes.get(ids.kept);
    expect(kept).toMatchObject({ body: 'ძველი ტექსტი', pinned: true, groupId: group.id, deletedAt: null });
    expect(await notes.get(ids.lost)).toMatchObject({ body: 'მნიშვნელოვანი', deletedAt: null });
    expect((await notes.get(ids.trashed))?.deletedAt).not.toBeNull(); // it was in the trash then, too
    expect(await notes.get(later)).toMatchObject({ body: 'შეიქმნა მერე' });
    expect((await notes.get(later))?.deletedAt).not.toBeNull(); // made later: now in the trash, not gone
    expect((await groups.getAll()).map((g) => g.name)).toEqual(['სამსახური']);
    expect(await db.tombstones.count()).toBe(0);
  });

  it('notes that were in the trash get a fresh 30 days, so they are not deleted at once', async () => {
    const { notes, svc, snapshot, ids } = await scenario();
    time += 40 * DAY; // far longer than the trash keeps things
    await svc.restore(snapshot, 'whole');
    const restoredTrash = await notes.get(ids.trashed);
    expect(restoredTrash!.deletedAt!).toBeGreaterThanOrEqual(time - 1000); // fresh, not 40 days old
    expect(await notes.purgeExpiredTrash(30 * DAY)).toBe(0);
    expect(await notes.get(ids.trashed)).toBeDefined();
  });

  it('saves the present state first, so the restore itself can be undone', async () => {
    const { notes, svc, snapshot, ids, store } = await scenario();
    time += DAY;
    await notes.update(ids.kept, { body: 'ახალი ტექსტი' });
    await svc.restore(snapshot, 'whole');
    expect((await notes.get(ids.kept))?.body).toBe('ძველი ტექსტი');

    const before = (await svc.list()).find((m) => m.kind === 'before-restore')!;
    expect(before).toBeDefined();
    time += HOUR;
    await svc.restore(before, 'whole');
    expect((await notes.get(ids.kept))?.body).toBe('ახალი ტექსტი');
    expect(store.metas.size).toBeGreaterThanOrEqual(3);
  });

  it('does nothing at all if the snapshot cannot be read', async () => {
    const { notes, svc, snapshot, ids, store } = await scenario();
    await notes.update(ids.kept, { body: 'ახალი' });
    store.chunks.set(snapshot.id, [new Uint8Array([9, 9, 9])]);
    await expect(svc.restore(snapshot, 'whole')).rejects.toBeDefined();
    expect((await notes.get(ids.kept))?.body).toBe('ახალი');
    expect((await svc.list()).filter((m) => m.kind === 'before-restore')).toHaveLength(0);
  });

  it('shows in advance what a restore would do', async () => {
    const { db, notes, svc, snapshot, ids } = await scenario();
    time += DAY;
    await notes.update(ids.kept, { body: 'ახალი ტექსტი' });
    await notes.moveToTrash(ids.lost);
    await note(notes, 'ახალი', 'x');
    const preview = previewRestore({ notes: await db.notes.toArray() }, await svc.load(snapshot));
    expect(preview).toEqual({ inSnapshot: 2, now: 2, returning: 1, changing: 1, toTrash: 1 });
  });
});

describe('restoring only what is lost', () => {
  it('brings back missing and trashed notes and leaves everything else as it is', async () => {
    const { db, notes } = setup();
    const store = new FakeSnapshotStore();
    const svc = new SnapshotService({ db, store, now: () => time });
    const edited = await note(notes, 'ჩემი', 'ძველი');
    const trashed = await note(notes, 'ნაგავში გადავა', 'a');
    const purged = await note(notes, 'სამუდამოდ წაიშლება', 'b');
    const snapshot = await svc.take('day');

    time += DAY;
    await notes.update(edited, { body: 'ახალი, შენარჩუნდება' });
    await notes.moveToTrash(trashed);
    await notes.moveToTrash(purged);
    await notes.deleteForever(purged);
    const fresh = await note(notes, 'ახალი ნოტა');

    const result = await svc.restore(snapshot, 'missing');

    expect(result.restored).toBe(2);
    expect((await notes.get(edited))?.body).toBe('ახალი, შენარჩუნდება');
    expect((await notes.get(trashed))?.deletedAt).toBeNull();
    expect((await notes.get(purged))?.deletedAt).toBeNull();
    expect((await notes.get(fresh))?.deletedAt).toBeNull(); // untouched
  });
});

describe('restoring while synced', () => {
  it('another device follows the restore, including notes it had deleted for good', async () => {
    const cloud = new FakeCloud();
    const mk = (name: string) => {
      const db = new TodoDB(`snap-sync-${name}-${crypto.randomUUID()}`);
      const engine = new SyncEngine({ db, uid: 'u', store: cloud.createStore('u'), pushDelayMs: 0, now: tick });
      return { db, engine, notes: createNotesRepository(db, tick) };
    };
    const settle = async (...ds: Array<{ engine: SyncEngine }>) => {
      for (let i = 0; i < 8; i += 1) {
        await Promise.all(ds.map((d) => d.engine.idle()));
        await sleep(8);
      }
    };
    const a = mk('a');
    const b = mk('b');
    const keep = await note(a.notes, 'ერთი', 'ძველი');
    const doomed = await note(a.notes, 'ორი', 'მნიშვნელოვანი');
    await a.engine.start();
    await b.engine.start();
    await settle(a, b);

    const svc = new SnapshotService({ db: a.db, store: new FakeSnapshotStore(), now: () => time });
    const snapshot = await svc.take('day');

    time += DAY;
    await a.notes.update(keep, { body: 'შეცვლილი' });
    await a.notes.moveToTrash(doomed);
    await a.notes.deleteForever(doomed);
    const extra = await note(a.notes, 'ზედმეტი', 'მერე შეიქმნა');
    await settle(a, b);
    expect(await b.notes.get(doomed)).toBeUndefined();

    await svc.restore(snapshot, 'whole');
    await settle(a, b);

    for (const d of [a, b]) {
      expect(await d.notes.get(keep)).toMatchObject({ body: 'ძველი', deletedAt: null });
      expect(await d.notes.get(doomed)).toMatchObject({ body: 'მნიშვნელოვანი', deletedAt: null });
      expect((await d.notes.get(extra))?.deletedAt).not.toBeNull();
    }
    expect(a.engine.getStatus().pending).toBe(0);
    expect(b.engine.getStatus().pending).toBe(0);
  });
});
