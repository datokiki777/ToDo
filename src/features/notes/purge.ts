import type { TodoDB } from '@/core/db/db';
import { noteKey } from '@/features/sync/keys';

/**
 * Deletes notes for good. For notes the cloud already knows about, a tombstone is left so the
 * deletion reaches other devices. Must run inside a transaction covering notes, sync, tombstones.
 */
export async function purgeNotes(db: TodoDB, ids: string[], now: number): Promise<void> {
  if (ids.length === 0) return;
  const known = await db.sync.bulkGet(ids.map(noteKey));
  const tombstones = ids.flatMap((id, i) => (known[i] ? [{ key: noteKey(id), updatedAt: now }] : []));
  if (tombstones.length > 0) await db.tombstones.bulkPut(tombstones);
  await db.notes.bulkDelete(ids);
}
