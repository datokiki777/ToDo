import { create } from 'zustand';
import { db } from '@/core/db/db';
import i18n from '@/core/i18n';
import { useAccount } from '@/features/account/store';
import { downloadBackup } from '@/features/backup/backup';
import { snapshotsSettled, startSnapshots, stopSnapshots } from '@/features/snapshots/controller';
import { createCloudStore } from './cloudStore';
import { SyncEngine, type SyncStatus } from './engine';

const LOCK_NAME = 'todo-sync';

const OFF: SyncStatus = {
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

interface SyncUi {
  status: SyncStatus;
  /** Another window of this app is doing the syncing. */
  follower: boolean;
}

export const useSync = create<SyncUi>(() => ({ status: OFF, follower: false }));

let engine: SyncEngine | null = null;
let release: (() => void) | null = null;
let currentUid: string | null = null;

function stopEngine() {
  engine?.stop();
  engine = null;
  release?.();
  release = null;
  stopSnapshots();
  useSync.setState({ status: OFF, follower: false });
}

async function runEngine(uid: string) {
  const store = await createCloudStore(uid);
  if (currentUid !== uid) return;
  const mine = new SyncEngine({
    db,
    store,
    uid,
    conflictLabel: () => i18n.t('sync.conflictCopy'),
    onStatus: (status) => {
      if (engine !== mine) return;
      useSync.setState({ status });
      if (status.state === 'idle' && status.pending === 0) snapshotsSettled();
    },
  });
  engine = mine;
  await mine.start();
  // Hold this window's turn as the one that syncs until the account changes or the window closes.
  await new Promise<void>((resolve) => {
    release = resolve;
  });
}

function startEngine(uid: string) {
  stopEngine();
  currentUid = uid;
  useSync.setState({ status: { ...OFF, state: 'starting' } });
  // Any open window can browse and restore. A backup is only made once this device has synced.
  startSnapshots(uid, () => useSync.getState().status.lastSyncAt !== null);

  // Only one open window should sync at a time (an installed app plus a browser tab, say).
  if (typeof navigator !== 'undefined' && 'locks' in navigator) {
    void navigator.locks.request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
      if (lock) return runEngine(uid);
      useSync.setState({ follower: true });
      await navigator.locks.request(LOCK_NAME, async () => {
        useSync.setState({ follower: false });
        if (currentUid === uid) await runEngine(uid);
      });
    });
  } else {
    void runEngine(uid);
  }
}

/** Starts syncing whenever someone is signed in, and stops when they sign out. */
export function initSync(): () => void {
  const apply = (uid: string | null) => {
    if (uid === currentUid) return;
    if (uid) startEngine(uid);
    else {
      currentUid = null;
      stopEngine();
    }
  };
  apply(useAccount.getState().user?.uid ?? null);
  return useAccount.subscribe((state) => apply(state.user?.uid ?? null));
}

export function syncNow(): void {
  engine?.syncNow();
}

/**
 * This phone holds another account's notes. Save a backup of them, clear them, and start fresh
 * with the account that is signed in now.
 */
export async function resetLocalDataForCurrentAccount(): Promise<void> {
  const uid = currentUid;
  if (!uid) return;
  await downloadBackup(); // if this fails, nothing below runs and nothing is lost
  stopEngine();
  await db.transaction('rw', [db.notes, db.groups, db.sync, db.tombstones, db.pendingSnapshots], async () => {
    await Promise.all([
      db.notes.clear(),
      db.groups.clear(),
      db.sync.clear(),
      db.tombstones.clear(),
      db.pendingSnapshots.clear(), // a waiting backup belongs to the other account
    ]);
  });
  currentUid = null;
  startEngine(uid);
}
