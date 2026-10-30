import type { TodoDB } from '@/core/db/db';
import type { Group } from '@/features/groups/model';
import { isNoteEmpty, type Note } from '@/features/notes/model';
import { textDiffers } from '@/features/sync/merge';
import { noteKey } from '@/features/sync/keys';
import type { SnapshotData } from './model';

export interface RestorePreview {
  /** Notes (not in the trash) the snapshot holds. */
  inSnapshot: number;
  /** Notes (not in the trash) there are now. */
  now: number;
  /** Notes that come back, because they are missing or in the trash now. */
  returning: number;
  /** Notes whose text will be replaced by the snapshot's version. */
  changing: number;
  /** Notes made after the snapshot, which move to the trash. */
  toTrash: number;
}

const live = (n: Note) => n.deletedAt === null && !isNoteEmpty(n);

export function previewRestore(current: { notes: Note[] }, snapshot: SnapshotData): RestorePreview {
  const now = new Map(current.notes.map((n) => [n.id, n]));
  const inSnap = new Map(snapshot.notes.map((n) => [n.id, n]));
  let returning = 0;
  let changing = 0;
  for (const note of snapshot.notes.filter(live)) {
    const here = now.get(note.id);
    if (!here || here.deletedAt !== null) returning += 1;
    else if (textDiffers(here, note)) changing += 1;
  }
  const toTrash = current.notes.filter((n) => live(n) && !inSnap.has(n.id)).length;
  return {
    inSnapshot: snapshot.notes.filter(live).length,
    now: current.notes.filter(live).length,
    returning,
    changing,
    toTrash,
  };
}

export interface RestoreResult {
  restored: number;
  trashed: number;
}

/** A moment guaranteed to be newer than anything already stored, so the restore wins everywhere. */
async function restoreTime(db: TodoDB, now: number): Promise<number> {
  const newest = Math.max(
    0,
    ...(await db.notes.toArray()).map((n) => n.updatedAt),
    ...(await db.groups.toArray()).map((g) => g.updatedAt),
    ...(await db.tombstones.toArray()).map((t) => t.updatedAt),
  );
  return Math.max(now, newest + 1);
}

/**
 * Makes the app look like the snapshot. Nothing is destroyed: notes made later go to the trash,
 * and everything gets a fresh timestamp so that every synced device follows.
 */
export async function restoreWhole(db: TodoDB, snapshot: SnapshotData, now: () => number = Date.now): Promise<RestoreResult> {
  return db.transaction('rw', [db.notes, db.groups, db.sync, db.tombstones], async () => {
    const t = await restoreTime(db, now());
    const inSnap = new Set(snapshot.notes.map((n) => n.id));
    let restored = 0;
    let trashed = 0;

    for (const note of snapshot.notes) {
      // A note that was in the trash then gets a fresh 30 days, so it is not deleted at once.
      await db.notes.put({ ...note, updatedAt: t, deletedAt: note.deletedAt === null ? null : t });
      await db.tombstones.delete(noteKey(note.id));
      restored += 1;
    }
    for (const note of await db.notes.toArray()) {
      if (inSnap.has(note.id) || note.deletedAt !== null || isNoteEmpty(note)) continue;
      await db.notes.update(note.id, { deletedAt: t, updatedAt: t });
      trashed += 1;
    }

    const groupsInSnap = new Set(snapshot.groups.map((g) => g.id));
    for (const group of snapshot.groups) {
      await db.groups.put({ ...group, updatedAt: t, deletedAt: group.deletedAt === null ? null : t });
    }
    for (const group of await db.groups.toArray()) {
      if (groupsInSnap.has(group.id) || group.deletedAt !== null) continue;
      await db.groups.update(group.id, { deletedAt: t, updatedAt: t });
    }
    return { restored, trashed };
  });
}

/** Brings back only what is lost now (missing or in the trash). Everything else stays untouched. */
export async function restoreMissing(db: TodoDB, snapshot: SnapshotData, now: () => number = Date.now): Promise<RestoreResult> {
  return db.transaction('rw', [db.notes, db.groups, db.sync, db.tombstones], async () => {
    const t = await restoreTime(db, now());
    let restored = 0;

    for (const group of snapshot.groups) {
      const here = await db.groups.get(group.id);
      if (group.deletedAt === null && (!here || here.deletedAt !== null)) {
        await db.groups.put({ ...group, updatedAt: t, deletedAt: null });
      }
    }
    for (const note of snapshot.notes) {
      if (!live(note)) continue;
      const here: Note | undefined = await db.notes.get(note.id);
      if (here && here.deletedAt === null) continue;
      await db.notes.put({ ...note, updatedAt: t, deletedAt: null });
      await db.tombstones.delete(noteKey(note.id));
      restored += 1;
    }
    return { restored, trashed: 0 };
  });
}

export type { Group };
