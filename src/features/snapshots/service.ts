import type { TodoDB } from '@/core/db/db';
import {
  dateKey,
  decodeSnapshot,
  encodeSnapshot,
  isExpired,
  stateHash,
  SnapshotError,
  type SnapshotData,
  type SnapshotKind,
  type SnapshotMeta,
} from './model';
import { restoreMissing, restoreWhole, type RestoreResult } from './restore';
import type { SnapshotStore } from './store';

const AT = 'meta:snapAt';
const DATE = 'meta:snapDate';
const HASH = 'meta:snapHash';

/** Within one day the snapshot is refreshed at most this often. */
const REFRESH_MS = 30 * 60 * 1000;

export type MaybeResult = 'written' | 'unchanged' | 'too-soon';

export interface ServiceOptions {
  db: TodoDB;
  store: SnapshotStore;
  now?: () => number;
  chunkBytes?: number;
}

export class SnapshotService {
  private readonly db: TodoDB;
  private readonly store: SnapshotStore;
  private readonly now: () => number;
  private readonly chunkBytes: number | undefined;

  constructor(options: ServiceOptions) {
    this.db = options.db;
    this.store = options.store;
    this.now = options.now ?? Date.now;
    this.chunkBytes = options.chunkBytes;
  }

  private async state() {
    const [notes, groups] = await Promise.all([this.db.notes.toArray(), this.db.groups.toArray()]);
    return { notes, groups };
  }

  private async remembered<T extends string | number>(key: string): Promise<T | undefined> {
    return (await this.db.sync.get(key))?.value as T | undefined;
  }

  /** Writes a snapshot of everything as it is now. */
  async take(kind: SnapshotKind): Promise<SnapshotMeta> {
    const { notes, groups } = await this.state();
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
    await this.store.write(meta, chunks);
    if (kind === 'day') {
      await this.db.sync.bulkPut([
        { key: AT, value: takenAt },
        { key: DATE, value: date },
        { key: HASH, value: stateHash(notes, groups) },
      ]);
    }
    return meta;
  }

  /**
   * The day's snapshot always ends up holding the day's last state: written the first time on a
   * new day, and refreshed (at most every 30 minutes) when something changed since.
   */
  async maybeTake(): Promise<MaybeResult> {
    const t = this.now();
    const { notes, groups } = await this.state();
    const hash = stateHash(notes, groups);
    const lastDate = await this.remembered<string>(DATE);
    const lastAt = await this.remembered<number>(AT);
    const lastHash = await this.remembered<string>(HASH);

    if (lastDate === dateKey(t)) {
      if (lastHash === hash) return 'unchanged';
      if (lastAt !== undefined && t - lastAt < REFRESH_MS) return 'too-soon';
    }
    await this.take('day');
    await this.cleanup();
    return 'written';
  }

  /** Removes snapshots older than the keep period. */
  async cleanup(): Promise<number> {
    const today = dateKey(this.now());
    const old = (await this.store.list()).filter((meta) => isExpired(meta.date, today));
    if (old.length > 0) await this.store.remove(old);
    return old.length;
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
   * Restores a snapshot. A copy of the present state is saved first, so the restore can itself be
   * undone from the list.
   */
  async restore(meta: SnapshotMeta, mode: 'whole' | 'missing'): Promise<RestoreResult> {
    const data = await this.load(meta); // fails before anything is touched if the snapshot is broken
    await this.take('before-restore');
    return mode === 'whole' ? restoreWhole(this.db, data, this.now) : restoreMissing(this.db, data, this.now);
  }
}
