import { parseGroup, type Group } from '@/features/groups/model';
import { parseNote, type Note } from '@/features/notes/model';

export const SNAPSHOT_KEEP_DAYS = 30;
/** Firestore documents are limited to 1 MiB, so a snapshot is split into pieces below that. */
export const CHUNK_BYTES = 700_000;

export type SnapshotKind = 'day' | 'before-restore';

/** What the list of snapshots shows, kept apart from the (larger) data itself. */
export interface SnapshotMeta {
  id: string;
  kind: SnapshotKind;
  /** Local calendar day, "2026-10-30". */
  date: string;
  takenAt: number;
  noteCount: number;
  groupCount: number;
  chunks: number;
  bytes: number;
}

export interface SnapshotData {
  version: 1;
  takenAt: number;
  notes: Note[];
  groups: Group[];
}

export class SnapshotError extends Error {
  constructor(readonly code: 'invalid' | 'missing') {
    super(code);
    this.name = 'SnapshotError';
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

/** The person's local calendar day for a moment in time. */
export function dateKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return dateKey(new Date(y, m - 1, d + days, 12).getTime());
}

/** Snapshots from the last `keepDays` days (today included) stay; older ones go. */
export function isExpired(date: string, today: string, keepDays: number = SNAPSHOT_KEEP_DAYS): boolean {
  return date < addDays(today, -(keepDays - 1));
}

/** A short fingerprint of "what the notes look like", to notice whether anything changed. */
export function stateHash(notes: Note[], groups: Group[]): string {
  const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const text = JSON.stringify([
    [...notes].sort(byId).map((n) => [n.id, n.updatedAt, n.deletedAt]),
    [...groups].sort(byId).map((g) => [g.id, g.updatedAt, g.deletedAt]),
  ]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16);
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Compresses a snapshot and cuts it into pieces that fit a Firestore document. */
export async function encodeSnapshot(data: SnapshotData, chunkBytes: number = CHUNK_BYTES): Promise<Uint8Array[]> {
  const zipped = await gzip(new TextEncoder().encode(JSON.stringify(data)));
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < zipped.length; i += chunkBytes) chunks.push(zipped.slice(i, i + chunkBytes));
  return chunks.length > 0 ? chunks : [zipped];
}

export async function decodeSnapshot(chunks: Uint8Array[]): Promise<SnapshotData> {
  try {
    const all = new Uint8Array(chunks.reduce((sum, c) => sum + c.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      all.set(chunk, offset);
      offset += chunk.length;
    }
    const raw: unknown = JSON.parse(new TextDecoder().decode(await gunzip(all)));
    if (typeof raw !== 'object' || raw === null) throw new SnapshotError('invalid');
    const r = raw as Record<string, unknown>;
    if (r.version !== 1 || !Array.isArray(r.notes) || !Array.isArray(r.groups)) throw new SnapshotError('invalid');
    return {
      version: 1,
      takenAt: typeof r.takenAt === 'number' ? r.takenAt : 0,
      notes: r.notes.map(parseNote).filter((n): n is Note => n !== null),
      groups: r.groups.map(parseGroup).filter((g): g is Group => g !== null),
    };
  } catch (error) {
    throw error instanceof SnapshotError ? error : new SnapshotError('invalid');
  }
}
