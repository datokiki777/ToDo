import { create } from 'zustand';
import { db } from '@/core/db/db';
import { errorCode } from '@/core/errorCode';
import { type RestoreResult } from './restore';
import { SnapshotService } from './service';
import { createSnapshotStore } from './store';
import type { SnapshotData, SnapshotMeta } from './model';

interface SnapshotsUi {
  /** True once the snapshot service for the signed-in account is ready. */
  ready: boolean;
  /** When the last automatic snapshot of this session was written. */
  lastAt: number | null;
  /** Why automatic snapshots are failing, if they are. */
  error: string | null;
}

export const useSnapshots = create<SnapshotsUi>(() => ({ ready: false, lastAt: null, error: null }));

let service: SnapshotService | null = null;
let generation = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

export function startSnapshots(uid: string): void {
  stopSnapshots();
  const mine = generation;
  void createSnapshotStore(uid)
    .then((store) => {
      if (mine !== generation) return;
      service = new SnapshotService({ db, store });
      useSnapshots.setState({ ready: true });
    })
    .catch((error: unknown) => useSnapshots.setState({ error: errorCode(error) }));
}

export function stopSnapshots(): void {
  generation += 1;
  service = null;
  clearTimeout(timer);
  timer = undefined;
  useSnapshots.setState({ ready: false, lastAt: null, error: null });
}

async function automatic(): Promise<void> {
  timer = undefined;
  if (!service) return;
  try {
    const result = await service.maybeTake();
    if (result === 'written') useSnapshots.setState({ lastAt: Date.now(), error: null });
    // A change inside the 30-minute window is picked up later in the day.
    if (result === 'too-soon') scheduleAutomatic(31 * 60 * 1000);
  } catch (error) {
    const code = errorCode(error);
    useSnapshots.setState({ error: code === 'unknown' && error instanceof Error ? error.message.slice(0, 80) : code });
  }
}

function scheduleAutomatic(delayMs: number): void {
  clearTimeout(timer);
  timer = setTimeout(() => void automatic(), delayMs);
}

/** Called when this device and the cloud are in step: the right moment to look at snapshots. */
export function snapshotsSettled(): void {
  // Several "in step" messages in a row must not keep pushing the moment further away.
  if (timer === undefined) scheduleAutomatic(3_000);
}

function need(): SnapshotService {
  if (!service) throw Object.assign(new Error('not ready'), { code: 'unavailable' });
  return service;
}

export const listSnapshots = (): Promise<SnapshotMeta[]> => need().list();
export const loadSnapshot = (meta: SnapshotMeta): Promise<SnapshotData> => need().load(meta);
export const takeSnapshotNow = (): Promise<SnapshotMeta> => need().take('day');
export const restoreSnapshot = (meta: SnapshotMeta, mode: 'whole' | 'missing'): Promise<RestoreResult> =>
  need().restore(meta, mode);
