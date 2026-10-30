import Dexie, { type EntityTable } from 'dexie';
import type { Group } from '@/features/groups/model';
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

export class TodoDB extends Dexie {
  notes!: EntityTable<Note, 'id'>;
  groups!: EntityTable<Group, 'id'>;
  sync!: EntityTable<SyncRow, 'key'>;
  tombstones!: EntityTable<Tombstone, 'key'>;

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
  }
}

export const db = new TodoDB();
