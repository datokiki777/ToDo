import type { SnapshotMeta } from './model';

/** Where snapshots live. Firestore implements it; tests use an in-memory one. */
export interface SnapshotStore {
  list(): Promise<SnapshotMeta[]>;
  read(meta: SnapshotMeta): Promise<Uint8Array[]>;
  /** Writes the list entry and all pieces together, or nothing. */
  write(meta: SnapshotMeta, chunks: Uint8Array[]): Promise<void>;
  remove(metas: SnapshotMeta[]): Promise<void>;
}

/** The Firestore code is loaded only when needed, as a separate download. */
export async function createSnapshotStore(uid: string): Promise<SnapshotStore> {
  if (__FAKE_AUTH__) return (await import('./fakeHttpStore')).createFakeHttpSnapshotStore(uid);
  return (await import('./firestoreStore')).createFirestoreSnapshotStore(uid);
}
