import type { CloudStore } from './cloud';

/** The Firestore code is loaded only when someone is signed in, as a separate download. */
export async function createCloudStore(uid: string): Promise<CloudStore> {
  if (__FAKE_AUTH__) return (await import('./fakeHttpStore')).createFakeHttpStore(uid);
  return (await import('./firestoreStore')).createFirestoreStore(uid);
}
