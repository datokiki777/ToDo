import type { TodoDB } from '@/core/db/db';
import { errorCode } from '@/core/errorCode';
import { newId } from '@/core/id';
import { isNoteEmpty, type Note } from '@/features/notes/model';
import {
  groupToCloud,
  noteToCloud,
  purgeToCloud,
  readRemoteGroup,
  readRemoteNote,
  type CloudDoc,
  type CloudStore,
  type CloudWrite,
  type Collection,
} from './cloud';
import { cursorKey, groupKey, META_UID, noteKey } from './keys';
import { decideGroup, decideNote } from './merge';

export type SyncState = 'off' | 'starting' | 'syncing' | 'idle' | 'error' | 'mismatch';

export interface SyncStatus {
  state: SyncState;
  lastSyncAt: number | null;
  /** Local changes not yet in the cloud. */
  pending: number;
  /** Cloud/Firestore error code when state is "error". */
  error: string | null;
  /** Counters for this session. */
  pulled: number;
  pushed: number;
  /** Copies made to keep text that would otherwise have been overwritten. */
  conflicts: number;
  /** Documents that could not be sent one by one (a note that is too big, or one the cloud refuses). */
  failed: number;
  /** Why: "too-large", or the error code the cloud answered with. */
  failedReason: string | null;
}

export interface EngineOptions {
  db: TodoDB;
  store: CloudStore;
  uid: string;
  now?: () => number;
  /** Text added to the title of a conflict copy. */
  conflictLabel?: () => string;
  onStatus?: (status: SyncStatus) => void;
  /** Wait this long after the last change before uploading. */
  pushDelayMs?: number;
}

interface PushItem extends CloudWrite {
  key: string;
  version: number;
  tombstone: boolean;
}

const BATCH = 400;

/** Problems with one document that should not block the others. */
/** Firestore's limit is 1 MiB per document; stay clearly below it. */
const MAX_DOC_BYTES = 900_000;
const sizeOf = (data: unknown) => new TextEncoder().encode(JSON.stringify(data)).length;

const perDocument = (code: string) => code === 'invalid-argument' || code === 'out-of-range';

export class SyncEngine {
  private readonly db: TodoDB;
  private readonly store: CloudStore;
  private readonly uid: string;
  private readonly now: () => number;
  private readonly pushDelay: number;

  private status: SyncStatus = {
    state: 'off',
    lastSyncAt: null,
    pending: 0,
    error: null,
    pulled: 0,
    pushed: 0,
    conflicts: 0,
    failed: 0,
    failedReason: null,
  };
  private started = false;
  private unsubscribers: Array<() => void> = [];
  private detachers: Array<() => void> = [];
  private ready = { notes: false, groups: false };
  private queue: Promise<void> = Promise.resolve();
  private running = 0;
  private pushTimer: ReturnType<typeof setTimeout> | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private retryDelay = 5_000;
  private needsResubscribe = false;
  private readonly failedIds = new Set<string>();

  constructor(private readonly options: EngineOptions) {
    this.db = options.db;
    this.store = options.store;
    this.uid = options.uid;
    this.now = options.now ?? Date.now;
    this.pushDelay = options.pushDelayMs ?? 2_500;
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  private set(patch: Partial<SyncStatus>) {
    const changed = (Object.keys(patch) as Array<keyof SyncStatus>).some((key) => this.status[key] !== patch[key]);
    if (!changed) return;
    this.status = { ...this.status, ...patch };
    this.options.onStatus?.(this.status);
  }

  /** Binds this device's data to the account (or notices it belongs to another one) and starts. */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.set({ state: 'starting', error: null });

    const bound = await this.db.sync.get(META_UID);
    if (bound && bound.value !== this.uid) {
      this.set({ state: 'mismatch' });
      return;
    }
    if (!bound) await this.db.sync.put({ key: META_UID, value: this.uid });

    this.attach();
    await this.subscribe();
    await this.refreshPending();
  }

  stop(): void {
    this.started = false;
    clearTimeout(this.pushTimer);
    clearTimeout(this.retryTimer);
    this.pushTimer = undefined;
    this.retryTimer = undefined;
    this.unsubscribers.forEach((off) => off());
    this.unsubscribers = [];
    this.detachers.forEach((off) => off());
    this.detachers = [];
    this.set({ state: 'off' });
  }

  /** Uploads waiting changes now and reconnects if the connection had failed. */
  syncNow(): void {
    if (!this.started || this.status.state === 'mismatch') return;
    clearTimeout(this.retryTimer);
    clearTimeout(this.pushTimer);
    this.pushTimer = undefined;
    // Asking again also gives the documents that failed before another chance.
    this.failedIds.clear();
    this.set({
      state: this.ready.notes && this.ready.groups ? 'syncing' : 'starting',
      error: null,
      failed: 0,
      failedReason: null,
    });
    this.enqueue(async () => {
      if (this.needsResubscribe) await this.subscribe();
      await this.push();
    });
  }

  /** Resolves when nothing is queued or scheduled. For tests. */
  async idle(): Promise<void> {
    for (let i = 0; i < 200; i += 1) {
      await this.queue;
      if (this.running === 0 && this.pushTimer === undefined) return;
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
  }

  // ---- plumbing ----------------------------------------------------------------------------

  private enqueue(task: () => Promise<void>): void {
    this.running += 1;
    this.queue = this.queue
      .then(task)
      .catch((error: unknown) => this.fail(errorCode(error)))
      .finally(() => {
        this.running -= 1;
      });
  }

  private attach(): void {
    const poke = () => this.schedulePush();
    for (const table of [this.db.notes, this.db.groups, this.db.tombstones]) {
      table.hook('creating', poke);
      table.hook('updating', poke);
      table.hook('deleting', poke);
      this.detachers.push(() => {
        table.hook('creating').unsubscribe(poke);
        table.hook('updating').unsubscribe(poke);
        table.hook('deleting').unsubscribe(poke);
      });
    }
    if (typeof window !== 'undefined') {
      const retry = () => {
        if (this.status.state === 'error') this.syncNow();
        else this.schedulePush(0);
      };
      const onVisible = () => document.visibilityState === 'visible' && retry();
      window.addEventListener('online', retry);
      document.addEventListener('visibilitychange', onVisible);
      this.detachers.push(() => {
        window.removeEventListener('online', retry);
        document.removeEventListener('visibilitychange', onVisible);
      });
    }
  }

  private schedulePush(delay: number = this.pushDelay): void {
    if (!this.started || this.status.state === 'mismatch') return;
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = undefined;
      this.enqueue(() => this.push());
    }, delay);
  }

  private fail(code: string): void {
    this.set({ state: 'error', error: code });
    clearTimeout(this.retryTimer);
    // Back off: 5 s, 15 s, 45 s ... up to 5 minutes. A person can always press "sync now".
    this.retryTimer = setTimeout(() => this.syncNow(), this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 3, 300_000);
  }

  /** `touched`: something was actually sent or received, so "last synced" moves forward. */
  private succeeded(touched = false): void {
    this.retryDelay = 5_000;
    const wasIdle = this.status.state === 'idle';
    this.set({
      state: 'idle',
      error: null,
      lastSyncAt: wasIdle && !touched ? this.status.lastSyncAt : this.now(),
    });
  }

  // ---- listening to the cloud --------------------------------------------------------------

  private async cursor(collection: Collection): Promise<number | null> {
    const row = await this.db.sync.get(cursorKey(collection));
    return typeof row?.value === 'number' ? row.value : null;
  }

  private async subscribe(): Promise<void> {
    this.unsubscribers.forEach((off) => off());
    this.unsubscribers = [];
    this.needsResubscribe = false;
    this.ready = { notes: false, groups: false };

    for (const collection of ['groups', 'notes'] as const) {
      const since = await this.cursor(collection);
      this.unsubscribers.push(
        this.store.subscribe(
          collection,
          since,
          (docs) =>
            this.enqueue(async () => {
              const changed = await this.applyRemote(collection, docs);
              this.ready[collection] = true;
              if (this.ready.notes && this.ready.groups && this.status.state !== 'syncing') this.succeeded(changed > 0);
              this.schedulePush(0); // cheap: finds nothing to send when everything is already in step
            }),
          (code) => {
            this.needsResubscribe = true;
            this.fail(code);
          },
        ),
      );
    }
  }

  /** Merges documents from the cloud into the local database. Never loses text silently. */
  async applyRemote(collection: Collection, docs: CloudDoc[]): Promise<number> {
    if (docs.length === 0) return 0;
    let applied = 0;
    let copies = 0;
    const { db } = this;

    await db.transaction('rw', [db.notes, db.groups, db.sync, db.tombstones], async () => {
      for (const doc of docs) {
        if (collection === 'notes') {
          const remote = readRemoteNote(doc);
          if (!remote) continue;
          const key = noteKey(doc.id);
          const local = await db.notes.get(doc.id);
          const tombstone = (await db.tombstones.get(key))?.updatedAt;
          const baseRow = await db.sync.get(key);
          const base = typeof baseRow?.value === 'number' ? baseRow.value : undefined;
          const decision = decideNote(local, tombstone, remote, base);

          if (decision.copy && local) {
            const lost = decision.copy === 'local' ? local : remote.kind === 'doc' ? remote.note : undefined;
            if (lost) {
              await db.notes.add(this.conflictCopy(lost));
              copies += 1;
            }
          }
          if (decision.action === 'apply' && remote.kind === 'doc') {
            await db.notes.put(remote.note);
            applied += 1;
          } else if (decision.action === 'delete') {
            await db.notes.delete(doc.id);
            applied += 1;
          }
          // Our pending deletion is settled once the cloud already has a deletion, or a newer note.
          if (tombstone !== undefined && (remote.kind === 'purged' || decision.action === 'apply')) {
            await db.tombstones.delete(key);
          }
          await db.sync.put({ key, value: decision.base });
        } else {
          const remote = readRemoteGroup(doc);
          if (!remote) continue;
          const key = groupKey(doc.id);
          const decision = decideGroup(await db.groups.get(doc.id), remote);
          if (decision.action === 'apply' && remote.kind === 'doc') {
            await db.groups.put(remote.group);
            applied += 1;
          }
          await db.sync.put({ key, value: decision.base });
        }
      }

      const newest = Math.max(0, ...docs.map((doc) => doc.serverTime));
      const previous = await this.cursor(collection);
      if (newest > 0 && newest > (previous ?? 0)) {
        await db.sync.put({ key: cursorKey(collection), value: newest });
      }
    });

    if (applied > 0 || copies > 0) {
      this.set({ pulled: this.status.pulled + applied, conflicts: this.status.conflicts + copies });
    }
    return applied + copies;
  }

  private conflictCopy(note: Note): Note {
    const label = this.options.conflictLabel?.() ?? '(copy)';
    const title = note.title.trim();
    const t = this.now();
    return {
      ...note,
      id: newId(),
      title: title === '' ? label : `${title} ${label}`,
      items: note.items.map((item) => ({ ...item, id: newId() })),
      pinned: false,
      archived: false,
      createdAt: t,
      updatedAt: t,
      deletedAt: null,
    };
  }

  // ---- sending to the cloud ----------------------------------------------------------------

  private async collectDirty(): Promise<PushItem[]> {
    const { db } = this;
    const [notes, groups, rows, tombstones] = await Promise.all([
      db.notes.toArray(),
      db.groups.toArray(),
      db.sync.toArray(),
      db.tombstones.toArray(),
    ]);
    const base = new Map<string, number>();
    for (const row of rows) if (typeof row.value === 'number') base.set(row.key, row.value);

    const items: PushItem[] = [];
    for (const note of notes) {
      // A note nobody has written anything in is not worth keeping in the cloud.
      if (note.deletedAt === null && isNoteEmpty(note)) continue;
      const known = base.get(noteKey(note.id));
      if (known === undefined || note.updatedAt > known) {
        items.push({
          key: noteKey(note.id),
          collection: 'notes',
          id: note.id,
          data: noteToCloud(note),
          version: note.updatedAt,
          tombstone: false,
        });
      }
    }
    for (const group of groups) {
      const known = base.get(groupKey(group.id));
      if (known === undefined || group.updatedAt > known) {
        items.push({
          key: groupKey(group.id),
          collection: 'groups',
          id: group.id,
          data: groupToCloud(group),
          version: group.updatedAt,
          tombstone: false,
        });
      }
    }
    for (const tombstone of tombstones) {
      const known = base.get(tombstone.key);
      if (known === undefined || tombstone.updatedAt >= known) {
        items.push({
          key: tombstone.key,
          collection: 'notes',
          id: tombstone.key.slice(2),
          data: purgeToCloud(tombstone.updatedAt),
          version: tombstone.updatedAt,
          tombstone: true,
        });
      }
    }
    return items.filter((item) => !this.failedIds.has(item.id));
  }

  private async refreshPending(): Promise<void> {
    this.set({ pending: (await this.collectDirty()).length });
  }

  private async markPushed(items: PushItem[]): Promise<void> {
    const { db } = this;
    await db.transaction('rw', [db.sync, db.tombstones], async () => {
      await db.sync.bulkPut(items.map((item) => ({ key: item.key, value: item.version })));
      for (const item of items) {
        if (!item.tombstone) continue;
        const current = await db.tombstones.get(item.key);
        if (current && current.updatedAt <= item.version) await db.tombstones.delete(item.key);
      }
    });
  }

  private async push(): Promise<void> {
    const items = await this.collectDirty();
    this.set({ pending: items.length });
    if (items.length === 0) {
      if (this.ready.notes && this.ready.groups && this.status.state !== 'error') this.succeeded();
      return;
    }
    this.set({ state: 'syncing' });

    let pushed = 0;
    // A document over the limit can never be accepted: say so at once instead of asking the cloud.
    const sendable: PushItem[] = [];
    for (const item of items) {
      if (sizeOf(item.data) > MAX_DOC_BYTES) {
        this.failedIds.add(item.id);
        this.set({ failed: this.status.failed + 1, failedReason: 'too-large' });
      } else {
        sendable.push(item);
      }
    }

    for (let i = 0; i < sendable.length; i += BATCH) {
      const chunk = sendable.slice(i, i + BATCH);
      try {
        await this.store.write(chunk.map(({ collection, id, data }) => ({ collection, id, data })));
        await this.markPushed(chunk);
        pushed += chunk.length;
      } catch (error) {
        const code = errorCode(error);
        if (!perDocument(code)) throw error;
        // One document is the problem: send the others one by one so they still get through.
        for (const item of chunk) {
          try {
            await this.store.write([{ collection: item.collection, id: item.id, data: item.data }]);
            await this.markPushed([item]);
            pushed += 1;
          } catch (single) {
            if (!perDocument(errorCode(single))) throw single;
            this.failedIds.add(item.id);
            this.set({ failed: this.status.failed + 1, failedReason: errorCode(single) });
          }
        }
      }
    }

    this.set({ pushed: this.status.pushed + pushed });
    await this.refreshPending();
    if (this.status.pending > 0) this.schedulePush();
    this.succeeded(pushed > 0);
  }
}
