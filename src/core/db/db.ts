import Dexie, { type EntityTable } from 'dexie';
import type { Group } from '@/features/groups/model';
import type { Note } from '@/features/notes/model';

export class TodoDB extends Dexie {
  notes!: EntityTable<Note, 'id'>;
  groups!: EntityTable<Group, 'id'>;

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
  }
}

export const db = new TodoDB();
