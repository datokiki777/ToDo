import Dexie, { type EntityTable } from 'dexie';
import type { Group } from '@/features/groups/model';
import type { SnapshotMeta } from '@/features/snapshots/model';
import type { Note } from '@/features/notes/model';

/** Bookkeeping for cloud sync, kept next to the data it describes. */
export interface SyncRow {
  /** "n:<id>" / "g:<id>" = last version known to be in the cloud; "meta:..." = account and cursors. */
  key: string;
  value: number | string;
}

/** A note that was deleted for good locally and whose deletion still has to reach the cloud. */
export interface Tombstone {
  key: string;
  updatedAt: number;
}

/** A daily backup made when the app was left, waiting until it can be uploaded. */
export interface PendingSnapshot {
  /** The day it belongs to ("2026-10-30"), which is also its name in the cloud. */
  id: string;
  /** Only ever uploaded to the account it was made for. */
  uid: string;
  takenAt: number;
  meta: SnapshotMeta;
  chunks: Uint8Array[];
}

export class TodoDB extends Dexie {
  notes!: EntityTable<Note, 'id'>;
  groups!: EntityTable<Group, 'id'>;
  sync!: EntityTable<SyncRow, 'key'>;
  tombstones!: EntityTable<Tombstone, 'key'>;
  pendingSnapshots!: EntityTable<PendingSnapshot, 'id'>;

  constructor(name = 'todo-db') {
    super(name);
    // Add a new `this.version(n)` block for every schema change; never edit old ones.
    this.version(1).stores({
      notes: 'id, updatedAt, deletedAt, color',
    });
    // v2: groups, and a `groupId` on every note (existing notes get null = no group).
    this.version(2)
      .stores({
        notes: 'id, updatedAt, deletedAt, color, groupId',
        groups: 'id, updatedAt, deletedAt',
      })
      .upgrade((tx) =>
        tx
          .table('notes')
          .toCollection()
          .modify((note: { groupId?: string | null }) => {
            if (note.groupId === undefined) note.groupId = null;
          }),
      );
    // v3: sync bookkeeping. Nothing existing changes.
    this.version(3).stores({
      notes: 'id, updatedAt, deletedAt, color, groupId',
      groups: 'id, updatedAt, deletedAt',
      sync: 'key',
      tombstones: 'key',
    });
    // v4: backups waiting for an upload. Nothing existing changes.
    this.version(4).stores({
      notes: 'id, updatedAt, deletedAt, color, groupId',
      groups: 'id, updatedAt, deletedAt',
      sync: 'key',
      tombstones: 'key',
      pendingSnapshots: 'id',
    });
    // v5: notes made before calendars have no `date`, groups made before note colours have no
    // `noteColor`. Fill them in (null = none) so every record has every field. Nothing else changes,
    // and updatedAt stays as it was, so nothing looks edited.
    this.version(5)
      .stores({
        notes: 'id, updatedAt, deletedAt, color, groupId',
        groups: 'id, updatedAt, deletedAt',
        sync: 'key',
        tombstones: 'key',
        pendingSnapshots: 'id',
      })
      .upgrade(async (tx) => {
        await tx
          .table('notes')
          .toCollection()
          .modify((note: { date?: string | null }) => {
            if (note.date === undefined) note.date = null;
          });
        await tx
          .table('groups')
          .toCollection()
          .modify((group: { noteColor?: string | null }) => {
            if (group.noteColor === undefined) group.noteColor = null;
          });
      });
  }
}

export const db = new TodoDB();
