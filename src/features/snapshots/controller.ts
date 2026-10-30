import { create } from 'zustand';
import { db } from '@/core/db/db';
import { errorCode } from '@/core/errorCode';
import { type RestoreResult } from './restore';
import { SnapshotService } from './service';
import { createSnapshotStore } from './store';
import type { SnapshotData, SnapshotMeta } from './model';

interface SnapshotsUi {
  /** True once the backup service for the signed-in account is ready. */
  ready: boolean;
  /** Why saving or uploading a backup is failing, if it is (a missing connection is not an error). */
  error: string | null;
}

export const useSnapshots = create<SnapshotsUi>(() => ({ ready: false, error: null }));

let service: SnapshotService | null = null;
let generation = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let detach: (() => void) | null = null;

const OFFLINE = new Set(['unavailable', 'deadline-exceeded', 'cancelled', 'aborted']);

function remember(error: unknown) {
  const code = errorCode(error);
  // Not being able to upload right now is normal: the copy waits on the device.
  if (OFFLINE.has(code)) return;
  useSnapshots.setState({ error: code === 'unknown' && error instanceof Error ? error.message.slice(0, 80) : code });
}

/** Uploads backups that are waiting on this device. */
async function flush(): Promise<void> {
  timer = undefined;
  if (!service) return;
  try {
    await service.flush();
    useSnapshots.setState({ error: null });
  } catch (error) {
    remember(error);
  }
}

/** The app is being left: keep today's copy on the device, then try to upload it. */
async function closeDay(canCapture: () => boolean): Promise<void> {
  const mine = service;
  if (!mine || !canCapture()) return;
  try {
    await mine.capture();
  } catch (error) {
    remember(error);
    return;
  }
  await flush();
}

/**
 * @param canCapture says whether this device has caught up with the cloud at least once, so a
 *   half-loaded state is never saved as the day's copy.
 */
export function startSnapshots(uid: string, canCapture: () => boolean): void {
  stopSnapshots();
  const mine = generation;
  void createSnapshotStore(uid)
    .then((store) => {
      if (mine !== generation) return;
      service = new SnapshotService({ db, store, uid });
      useSnapshots.setState({ ready: true });

      const onVisibility = () => {
        if (document.visibilityState === 'hidden') void closeDay(canCapture);
        else void flush();
      };
      const onPageHide = () => void closeDay(canCapture);
      const onOnline = () => void flush();
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('pagehide', onPageHide);
      window.addEventListener('online', onOnline);
      detach = () => {
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('pagehide', onPageHide);
        window.removeEventListener('online', onOnline);
      };
      void flush(); // anything left waiting from the last time
    })
    .catch((error: unknown) => remember(error));
}

export function stopSnapshots(): void {
  generation += 1;
  service = null;
  clearTimeout(timer);
  timer = undefined;
  detach?.();
  detach = null;
  useSnapshots.setState({ ready: false, error: null });
}

/** Called when this device and the cloud are in step: a good moment to upload what is waiting. */
export function snapshotsSettled(): void {
  // Several "in step" messages in a row must not keep pushing the moment further away.
  if (timer === undefined) timer = setTimeout(() => void flush(), 3_000);
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
