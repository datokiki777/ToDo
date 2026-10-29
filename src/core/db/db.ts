import Dexie, { type EntityTable } from 'dexie';
import type { Note } from '@/features/notes/model';

export class TodoDB extends Dexie {
  notes!: EntityTable<Note, 'id'>;

  constructor(name = 'todo-db') {
    super(name);
    // Add a new `this.version(n)` block for every schema change; never edit old ones.
    this.version(1).stores({
      notes: 'id, updatedAt, deletedAt, color',
    });
  }
}

export const db = new TodoDB();
