import { findUndefined, type CloudDoc, type CloudStore, type CloudWrite, type Collection } from '../cloud';

interface Stored {
  data: Record<string, unknown>;
  serverTime: number;
}

interface Subscription {
  uid: string;
  collection: Collection;
  since: number | null;
  seen: number;
  onDocs: (docs: CloudDoc[]) => void;
  onError: (code: string) => void;
  closed: boolean;
}

class CodedError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

/**
 * An in-memory stand-in for Firestore shared by several simulated devices. It stamps writes with
 * its own increasing clock, delivers changes to subscribers, and can go offline.
 */
export class FakeCloud {
  online = true;
  /** How many documents have been written in total. */
  writes = 0;
  /** The `since` value each subscription started with (newest last). */
  subscribedSince: Array<number | null> = [];
  /** Documents whose writes are refused with this code, by id. */
  refuse = new Map<string, string>();

  private clock = 1_000_000;
  private data = new Map<string, Map<string, Stored>>();
  private subscriptions = new Set<Subscription>();

  private bucket(uid: string, collection: Collection): Map<string, Stored> {
    const key = `${uid}/${collection}`;
    let bucket = this.data.get(key);
    if (!bucket) this.data.set(key, (bucket = new Map()));
    return bucket;
  }

  docs(uid: string, collection: Collection): Array<{ id: string } & Stored> {
    return [...this.bucket(uid, collection)].map(([id, stored]) => ({ id, ...stored }));
  }

  get(uid: string, collection: Collection, id: string): Stored | undefined {
    return this.bucket(uid, collection).get(id);
  }

  private deliver(sub: Subscription, onlyAtOrAfter: number | null, ids?: Set<string>) {
    if (!this.online || sub.closed) return;
    const docs: CloudDoc[] = [];
    for (const [id, stored] of this.bucket(sub.uid, sub.collection)) {
      if (ids && !ids.has(id)) continue;
      if (onlyAtOrAfter !== null && stored.serverTime < onlyAtOrAfter) continue;
      docs.push({ id, data: structuredClone(stored.data), serverTime: stored.serverTime });
    }
    for (const doc of docs) sub.seen = Math.max(sub.seen, doc.serverTime);
    setTimeout(() => !sub.closed && sub.onDocs(docs), 0);
  }

  /** Goes online/offline. Coming back, subscribers are caught up like a reconnecting listener. */
  setOnline(online: boolean): void {
    this.online = online;
    if (!online) return;
    for (const sub of this.subscriptions) this.deliver(sub, sub.seen);
  }

  /** Simulates the listener failing (e.g. permission denied). */
  failSubscribers(code: string): void {
    for (const sub of this.subscriptions) setTimeout(() => sub.onError(code), 0);
  }

  createStore(uid: string): CloudStore {
    return {
      subscribe: (collection, since, onDocs, onError) => {
        const sub: Subscription = { uid, collection, since, seen: since ?? 0, onDocs, onError, closed: false };
        this.subscribedSince.push(since);
        this.subscriptions.add(sub);
        this.deliver(sub, since);
        return () => {
          sub.closed = true;
          this.subscriptions.delete(sub);
        };
      },

      write: async (items: CloudWrite[]) => {
        if (!this.online) throw new CodedError('unavailable');
        for (const item of items) {
          const code = this.refuse.get(item.id);
          if (code) throw new CodedError(code);
          if (findUndefined(item.data)) throw new CodedError('invalid-argument');
        }
        const serverTime = ++this.clock;
        const touched = new Map<Collection, Set<string>>();
        for (const item of items) {
          this.bucket(uid, item.collection).set(item.id, { data: structuredClone(item.data), serverTime });
          if (!touched.has(item.collection)) touched.set(item.collection, new Set());
          touched.get(item.collection)!.add(item.id);
          this.writes += 1;
        }
        for (const sub of this.subscriptions) {
          const ids = sub.uid === uid ? touched.get(sub.collection) : undefined;
          if (ids) this.deliver(sub, null, ids);
        }
      },
    };
  }
}
