import type { Group } from '@/features/groups/model';
import { parseGroup } from '@/features/groups/model';
import { parseNote, type Note } from '@/features/notes/model';

export type Collection = 'notes' | 'groups';

/** One document as the cloud holds it. `serverTime` is the cloud's own clock (ms), 0 if unknown. */
export interface CloudDoc {
  id: string;
  data: Record<string, unknown>;
  serverTime: number;
}

export interface CloudWrite {
  collection: Collection;
  id: string;
  data: Record<string, unknown>;
}

/** What the sync engine needs from the cloud. Firestore implements it; tests use a fake. */
export interface CloudStore {
  /**
   * Reports documents changed at or after `since` (everything when null), now and as they change.
   * Called once with the current state, even when that is empty. Returns "stop".
   */
  subscribe(
    collection: Collection,
    since: number | null,
    onDocs: (docs: CloudDoc[]) => void,
    onError: (code: string) => void,
  ): () => void;
  /** Writes documents (replacing them); the cloud stamps each with its own time. */
  write(items: CloudWrite[]): Promise<void>;
}

/**
 * Firestore refuses a document with `undefined` anywhere in it. A record made by an older
 * version of the app may lack a newer field, so every optional field is written as null and
 * anything still undefined is dropped.
 */
export function withoutUndefined(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

/** The path of the first `undefined` found inside a value, or null. */
export function findUndefined(value: unknown, path = ''): string | null {
  if (value === undefined) return path || '(document)';
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const found = findUndefined(value[i], `${path}[${i}]`);
      if (found) return found;
    }
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, inner] of Object.entries(value)) {
      const found = findUndefined(inner, path ? `${path}.${key}` : key);
      if (found) return found;
    }
  }
  return null;
}

export function noteToCloud(note: Note): Record<string, unknown> {
  return withoutUndefined({
    kind: note.kind,
    title: note.title,
    body: note.body,
    items: note.items.map((item) => ({ id: item.id, text: item.text, done: item.done === true })),
    color: note.color,
    groupId: note.groupId ?? null,
    date: note.date ?? null,
    pinned: note.pinned === true,
    archived: note.archived === true,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    deletedAt: note.deletedAt ?? null,
  });
}

export function groupToCloud(group: Group): Record<string, unknown> {
  return withoutUndefined({
    name: group.name,
    icon: group.icon,
    color: group.color,
    noteColor: group.noteColor ?? null,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    deletedAt: group.deletedAt ?? null,
  });
}

/** A deletion marker: tells every device to remove its copy. Content is not kept. */
export function purgeToCloud(updatedAt: number): Record<string, unknown> {
  return { purged: true, updatedAt };
}

export type RemoteNote = { kind: 'doc'; note: Note } | { kind: 'purged'; updatedAt: number };
export type RemoteGroup = { kind: 'doc'; group: Group } | { kind: 'purged'; updatedAt: number };

function purgedAt(data: Record<string, unknown>): number | null {
  if (data.purged !== true) return null;
  return typeof data.updatedAt === 'number' && Number.isFinite(data.updatedAt) ? data.updatedAt : null;
}

/** Reads a cloud document defensively. Returns null for anything unusable. */
export function readRemoteNote(doc: CloudDoc): RemoteNote | null {
  const purged = purgedAt(doc.data);
  if (purged !== null) return { kind: 'purged', updatedAt: purged };
  const note = parseNote({ ...doc.data, id: doc.id });
  return note ? { kind: 'doc', note } : null;
}

export function readRemoteGroup(doc: CloudDoc): RemoteGroup | null {
  const purged = purgedAt(doc.data);
  if (purged !== null) return { kind: 'purged', updatedAt: purged };
  const group = parseGroup({ ...doc.data, id: doc.id });
  return group ? { kind: 'doc', group } : null;
}
