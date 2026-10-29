import { db as defaultDb, type TodoDB } from '@/core/db/db';
import { newId } from '@/core/id';
import {
  DEFAULT_COLOR,
  isNoteEmpty,
  type Note,
  type NoteColor,
  type NoteKind,
} from './model';

export type NotePatch = Partial<
  Pick<Note, 'kind' | 'title' | 'body' | 'items' | 'color' | 'pinned' | 'archived'>
>;

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
}

export interface NotesRepository {
  getAll(): Promise<Note[]>;
  get(id: string): Promise<Note | undefined>;
  create(input?: { kind?: NoteKind; color?: NoteColor }): Promise<Note>;
  update(id: string, patch: NotePatch): Promise<void>;
  setArchived(id: string, archived: boolean): Promise<void>;
  moveToTrash(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  deleteForever(id: string): Promise<void>;
  emptyTrash(): Promise<number>;
  purgeEmpty(): Promise<number>;
  deleteIfEmpty(id: string): Promise<boolean>;
  importMany(notes: Note[]): Promise<ImportResult>;
}

/**
 * The only place that talks to the database about notes. UI code goes through this interface,
 * so a sync layer can later be added here without touching any component.
 */
export function createNotesRepository(
  db: TodoDB = defaultDb,
  now: () => number = Date.now,
): NotesRepository {
  return {
    getAll: () => db.notes.toArray(),

    get: (id) => db.notes.get(id),

    async create(input = {}) {
      const t = now();
      const note: Note = {
        id: newId(),
        kind: input.kind ?? 'text',
        title: '',
        body: '',
        items: [],
        color: input.color ?? DEFAULT_COLOR,
        pinned: false,
        archived: false,
        createdAt: t,
        updatedAt: t,
        deletedAt: null,
      };
      await db.notes.add(note);
      return note;
    },

    async update(id, patch) {
      // One atomic write: concurrent calls (autosave + a colour tap) never overwrite each other.
      await db.notes.update(id, { ...patch, updatedAt: now() });
    },

    async setArchived(id, archived) {
      await db.notes.update(id, {
        archived,
        ...(archived ? { pinned: false } : {}),
        updatedAt: now(),
      });
    },

    async moveToTrash(id) {
      const t = now();
      await db.notes.update(id, { deletedAt: t, updatedAt: t });
    },

    async restore(id) {
      await db.notes.update(id, { deletedAt: null, updatedAt: now() });
    },

    // NOTE: with sync this must become a tombstone instead of a hard delete.
    async deleteForever(id) {
      await db.notes.delete(id);
    },

    async emptyTrash() {
      return db.transaction('rw', db.notes, async () => {
        const ids = (await db.notes.toArray())
          .filter((note) => note.deletedAt !== null)
          .map((note) => note.id);
        await db.notes.bulkDelete(ids);
        return ids.length;
      });
    },

    /** Remove blank notes left behind when someone opens "new note" and leaves without typing. */
    async purgeEmpty() {
      return db.transaction('rw', db.notes, async () => {
        const ids = (await db.notes.toArray())
          .filter((note) => note.deletedAt === null && isNoteEmpty(note))
          .map((note) => note.id);
        await db.notes.bulkDelete(ids);
        return ids.length;
      });
    },

    /** Delete one note only if it is blank right now (checked and deleted in one transaction). */
    async deleteIfEmpty(id) {
      return db.transaction('rw', db.notes, async () => {
        const note = await db.notes.get(id);
        if (!note || note.deletedAt !== null || !isNoteEmpty(note)) return false;
        await db.notes.delete(id);
        return true;
      });
    },

    /** Merge notes by id; the copy with the newer `updatedAt` wins. */
    async importMany(notes) {
      return db.transaction('rw', db.notes, async () => {
        const result: ImportResult = { added: 0, updated: 0, skipped: 0 };
        const toWrite: Note[] = [];
        for (const incoming of notes) {
          const existing = await db.notes.get(incoming.id);
          if (!existing) {
            toWrite.push(incoming);
            result.added += 1;
          } else if (incoming.updatedAt > existing.updatedAt) {
            toWrite.push(incoming);
            result.updated += 1;
          } else {
            result.skipped += 1;
          }
        }
        await db.notes.bulkPut(toWrite);
        return result;
      });
    },
  };
}

export const notesRepository = createNotesRepository();
