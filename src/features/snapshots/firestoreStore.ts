import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  Bytes,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  writeBatch,
} from 'firebase/firestore';
import { firebaseConfig } from '@/core/firebase/config';
import type { SnapshotKind, SnapshotMeta } from './model';
import type { SnapshotStore } from './store';

class CodedError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new CodedError('deadline-exceeded')), TIMEOUT_MS);
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

const KINDS: SnapshotKind[] = ['day', 'before-restore'];

function readMeta(id: string, data: Record<string, unknown>): SnapshotMeta | null {
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const kind = KINDS.find((k) => k === data.kind);
  const takenAt = num(data.takenAt);
  const chunks = num(data.chunks);
  if (!kind || takenAt === null || chunks === null || typeof data.date !== 'string') return null;
  return {
    id,
    kind,
    date: data.date,
    takenAt,
    noteCount: num(data.noteCount) ?? 0,
    groupCount: num(data.groupCount) ?? 0,
    chunks,
    bytes: num(data.bytes) ?? 0,
  };
}

/**
 * Snapshots live under users/{uid}/snapshots/{id} (the list entry) and
 * users/{uid}/snapshotChunks/{id}_{n} (the compressed data pieces).
 */
export function createFirestoreSnapshotStore(uid: string): SnapshotStore {
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const metas = collection(db, 'users', uid, 'snapshots');
  const chunkDoc = (id: string, index: number) => doc(db, 'users', uid, 'snapshotChunks', `${id}_${index}`);

  return {
    async list() {
      const snapshot = await withTimeout(getDocs(metas));
      return snapshot.docs.flatMap((d) => {
        const meta = readMeta(d.id, d.data());
        return meta ? [meta] : [];
      });
    },

    async read(meta) {
      const docs = await withTimeout(
        Promise.all(Array.from({ length: meta.chunks }, (_, i) => getDoc(chunkDoc(meta.id, i)))),
      );
      return docs.map((d) => {
        const bytes: unknown = d.get('data');
        if (!(bytes instanceof Bytes)) throw new CodedError('data-loss');
        return bytes.toUint8Array();
      });
    },

    async write(meta, chunks) {
      const batch = writeBatch(db);
      const { id, ...fields } = meta;
      batch.set(doc(metas, id), fields);
      chunks.forEach((chunk, index) => batch.set(chunkDoc(id, index), { index, data: Bytes.fromUint8Array(chunk) }));
      await withTimeout(batch.commit());
    },

    async remove(items) {
      for (let i = 0; i < items.length; i += 20) {
        const batch = writeBatch(db);
        for (const meta of items.slice(i, i + 20)) {
          batch.delete(doc(metas, meta.id));
          for (let n = 0; n < meta.chunks; n += 1) batch.delete(chunkDoc(meta.id, n));
        }
        await withTimeout(batch.commit());
      }
    },
  };
}
