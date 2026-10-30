import type { TodoDB } from '@/core/db/db';
import type { Group } from '@/features/groups/model';
import type { Note } from '@/features/notes/model';
import {
  dateKey,
  decodeSnapshot,
  encodeSnapshot,
  expiredSnapshots,
  stateHash,
  SnapshotError,
  type SnapshotData,
  type SnapshotKind,
  type SnapshotMeta,
} from './model';
import { restoreMissing, restoreWhole, type RestoreResult } from './restore';
import type { SnapshotStore } from './store';

/** Fingerprint of the state at the moment of the last copy, to skip copies when nothing changed. */
const HASH = 'meta:snapHash';

export interface ServiceOptions {
  db: TodoDB;
  store: SnapshotStore;
  /** The account these copies belong to. */
  uid: string;
  now?: () => number;
  chunkBytes?: number;
}

export class SnapshotService {
  private readonly db: TodoDB;
  private readonly store: SnapshotStore;
  private readonly uid: string;
  private readonly now: () => number;
  private readonly chunkBytes: number | undefined;

  constructor(options: ServiceOptions) {
    this.db = options.db;
    this.store = options.store;
    this.uid = options.uid;
    this.now = options.now ?? Date.now;
    this.chunkBytes = options.chunkBytes;
  }

  private async state() {
    const [notes, groups] = await Promise.all([this.db.notes.toArray(), this.db.groups.toArray()]);
    return { notes, groups };
  }

  private async pack(kind: SnapshotKind, notes: Note[], groups: Group[]) {
    const takenAt = this.now();
    const data: SnapshotData = { version: 1, takenAt, notes, groups };
    const chunks = await encodeSnapshot(data, this.chunkBytes);
    const date = dateKey(takenAt);
    const meta: SnapshotMeta = {
      id: kind === 'day' ? date : `before-${takenAt}`,
      kind,
      date,
      takenAt,
      noteCount: notes.filter((n) => n.deletedAt === null).length,
      groupCount: groups.filter((g) => g.deletedAt === null).length,
      chunks: chunks.length,
      bytes: chunks.reduce((sum, c) => sum + c.length, 0),
    };
    return { meta, chunks };
  }

  /**
   * Step 1, when the app is left: keep a copy of everything as it is, on this device, under
   * today's date. Nothing is uploaded here, so it works with no connection. A later copy of the
   * same day replaces the earlier one, so a day ends up holding its last state.
   */
  async capture(): Promise<'captured' | 'unchanged'> {
    const { notes, groups } = await this.state();
    const hash = stateHash(notes, groups);
    if (hash === (await this.db.sync.get(HASH))?.value) return 'unchanged';

    const { meta, chunks } = await this.pack('day', notes, groups);
    await this.db.transaction('rw', [this.db.pendingSnapshots, this.db.sync], async () => {
      await this.db.pendingSnapshots.put({ id: meta.id, uid: this.uid, takenAt: meta.takenAt, meta, chunks });
      await this.db.sync.put({ key: HASH, value: hash });
    });
    return 'captured';
  }

  /** How many copies are waiting for an upload. */
  async waiting(): Promise<number> {
    return (await this.db.pendingSnapshots.toArray()).filter((p) => p.uid === this.uid).length;
  }

  /**
   * Step 2, whenever possible (next time the app opens, when the connection is back): upload the
   * waiting copies. Each keeps the day it was made, however much later it is uploaded.
   */
  async flush(): Promise<number> {
    const rows = (await this.db.pendingSnapshots.toArray())
      .filter((p) => p.uid === this.uid)
      .sort((a, b) => a.takenAt - b.takenAt);
    for (const row of rows) {
      await this.store.write(row.meta, row.chunks);
      // Only remove it if no newer copy of the same day has arrived while uploading.
      await this.db.transaction('rw', this.db.pendingSnapshots, async () => {
        const current = await this.db.pendingSnapshots.get(row.id);
        if (current && current.takenAt === row.takenAt) await this.db.pendingSnapshots.delete(row.id);
      });
    }
    if (rows.length > 0) await this.cleanup();
    return rows.length;
  }

  /**
   * Writes a copy of everything as it is now, straight to the cloud ("back up now", and the safety
   * copy before a restore).
   */
  async take(kind: SnapshotKind): Promise<SnapshotMeta> {
    const { notes, groups } = await this.state();
    const { meta, chunks } = await this.pack(kind, notes, groups);
    await this.store.write(meta, chunks);
    if (kind === 'day') {
      await this.db.transaction('rw', [this.db.pendingSnapshots, this.db.sync], async () => {
        await this.db.sync.put({ key: HASH, value: stateHash(notes, groups) });
        const waiting = await this.db.pendingSnapshots.get(meta.id);
        if (waiting && waiting.takenAt <= meta.takenAt) await this.db.pendingSnapshots.delete(meta.id);
      });
    }
    await this.cleanup();
    return meta;
  }

  /** Removes the oldest copies beyond the number we keep. */
  async cleanup(): Promise<number> {
    const doomed = expiredSnapshots(await this.store.list());
    if (doomed.length > 0) await this.store.remove(doomed);
    return doomed.length;
  }

  async list(): Promise<SnapshotMeta[]> {
    return (await this.store.list()).sort((a, b) => b.takenAt - a.takenAt);
  }

  async load(meta: SnapshotMeta): Promise<SnapshotData> {
    const chunks = await this.store.read(meta);
    if (chunks.length !== meta.chunks) throw new SnapshotError('missing');
    return decodeSnapshot(chunks);
  }

  /**
   * Restores a copy. A copy of the present state is saved first, so the restore can itself be
   * undone from the list.
   */
  async restore(meta: SnapshotMeta, mode: 'whole' | 'missing'): Promise<RestoreResult> {
    const data = await this.load(meta); // fails before anything is touched if the copy is broken
    await this.take('before-restore');
    return mode === 'whole' ? restoreWhole(this.db, data, this.now) : restoreMissing(this.db, data, this.now);
  }
}
