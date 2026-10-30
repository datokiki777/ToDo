import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { firebaseConfig } from '@/core/firebase/config';
import type { CloudDoc, CloudStore, CloudWrite, Collection } from './cloud';

const WRITE_TIMEOUT_MS = 20_000;

class CodedError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

/** A write that never gets an answer (no connection) must not hang the sync for ever. */
function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new CodedError('deadline-exceeded')), WRITE_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Everything lives under users/{uid}/notes and users/{uid}/groups. Each document carries a
 * `syncedAt` stamp written by Firestore itself, which is what other devices use to ask
 * "what changed since I last looked?" (device clocks cannot be trusted for that).
 */
export function createFirestoreStore(uid: string): CloudStore {
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const col = (name: Collection) => collection(db, 'users', uid, name);

  return {
    subscribe(name, since, onDocs, onError) {
      const q =
        since === null
          ? query(col(name))
          : query(col(name), where('syncedAt', '>=', Timestamp.fromMillis(since)), orderBy('syncedAt'));
      return onSnapshot(
        q,
        (snapshot) => {
          const docs: CloudDoc[] = [];
          for (const change of snapshot.docChanges()) {
            if (change.type === 'removed') continue;
            const d = change.doc;
            // Our own write, not yet confirmed by the server: its stamp is only an estimate.
            if (d.metadata.hasPendingWrites) continue;
            const stamp: unknown = d.get('syncedAt');
            docs.push({
              id: d.id,
              data: d.data(),
              serverTime: stamp instanceof Timestamp ? stamp.toMillis() : 0,
            });
          }
          onDocs(docs);
        },
        (error) => onError(error.code),
      );
    },

    async write(items: CloudWrite[]) {
      if (items.length > 450) throw new CodedError('invalid-argument');
      const batch = writeBatch(db);
      for (const item of items) {
        batch.set(doc(col(item.collection), item.id), { ...item.data, syncedAt: serverTimestamp() });
      }
      await withTimeout(batch.commit());
    },
  };
}
