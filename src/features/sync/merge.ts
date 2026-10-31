import type { Group } from '@/features/groups/model';
import type { Note } from '@/features/notes/model';
import type { RemoteGroup, RemoteNote } from './cloud';

/**
 * What to do when the cloud has a version of a note.
 * - noop: nothing differs.
 * - apply: take the cloud's version.
 * - keepLocal: ours is newer; it will be uploaded.
 * - delete: the note was deleted for good elsewhere; remove it here.
 * `base` is the version both sides now share; `copy` says which side's text to keep as a separate
 * note when both sides changed the text since they last agreed (so nobody's writing is lost).
 */
export interface NoteDecision {
  action: 'noop' | 'apply' | 'keepLocal' | 'delete';
  base: number;
  copy?: 'local' | 'remote';
}

function textOf(note: Pick<Note, 'title' | 'body' | 'items'>): string {
  return JSON.stringify([
    note.title.trim(),
    note.body.trim(),
    note.items.map((item) => [item.text.trim(), item.done]),
  ]);
}

export function textDiffers(a: Note, b: Note): boolean {
  return textOf(a) !== textOf(b);
}

/**
 * @param local      our copy, if any
 * @param tombstone  when we deleted it for good (not yet reported to the cloud), if we did
 * @param remote     the cloud's version
 * @param base       the version last known to be the same on both sides, if there ever was one
 */
export function decideNote(
  local: Note | undefined,
  tombstone: number | undefined,
  remote: RemoteNote,
  base: number | undefined,
): NoteDecision {
  const r = remote.kind === 'doc' ? remote.note.updatedAt : remote.updatedAt;

  if (remote.kind === 'purged') {
    if (!local) return { action: 'noop', base: r };
    // Edited after the deletion happened: the later edit wins and brings the note back.
    return local.updatedAt > r ? { action: 'keepLocal', base: r } : { action: 'delete', base: r };
  }

  if (!local) {
    // We deleted it for good; if that was after the cloud's version, our deletion stands.
    if (tombstone !== undefined && tombstone >= r) return { action: 'noop', base: r };
    return { action: 'apply', base: r };
  }

  if (r === local.updatedAt) return { action: 'noop', base: r };

  // Both sides changed the text since they last agreed: keep the losing text as a copy.
  const bothChanged = base !== undefined && local.updatedAt > base && r > base;
  const conflict = bothChanged && textDiffers(local, remote.note);

  if (r > local.updatedAt) {
    return conflict ? { action: 'apply', base: r, copy: 'local' } : { action: 'apply', base: r };
  }
  return conflict ? { action: 'keepLocal', base: r, copy: 'remote' } : { action: 'keepLocal', base: r };
}

export interface GroupDecision {
  action: 'noop' | 'apply' | 'keepLocal';
  base: number;
}

/** Groups are small and simple: the newest version wins. */
export function decideGroup(local: Group | undefined, remote: RemoteGroup): GroupDecision {
  const r = remote.kind === 'doc' ? remote.group.updatedAt : remote.updatedAt;
  if (remote.kind === 'purged') return { action: 'noop', base: r };
  if (!local) return { action: 'apply', base: r };
  if (r === local.updatedAt) return { action: 'noop', base: r };
  return r > local.updatedAt ? { action: 'apply', base: r } : { action: 'keepLocal', base: r };
}
