import { db as defaultDb, type TodoDB } from '@/core/db/db';
import { newId } from '@/core/id';
import type { NoteColor } from '@/features/notes/model';
import {
  DEFAULT_GROUP_COLOR,
  DEFAULT_GROUP_ICON,
  normalizeGroupName,
  type Group,
  type GroupIconName,
} from './model';

export interface GroupInput {
  name: string;
  icon?: GroupIconName;
  color?: NoteColor;
  /** Colour for new notes in the group; null clears it. */
  noteColor?: NoteColor | null;
}

export interface GroupsRepository {
  /** Live groups only, oldest first. */
  getAll(): Promise<Group[]>;
  /** Every group including deleted ones (for backups). */
  getAllIncludingDeleted(): Promise<Group[]>;
  create(input: GroupInput): Promise<Group>;
  update(id: string, patch: Partial<GroupInput>): Promise<void>;
  /** Deletes the group; its notes stay and simply lose the group. */
  remove(id: string): Promise<void>;
  importMany(groups: Group[]): Promise<void>;
}

export function createGroupsRepository(
  db: TodoDB = defaultDb,
  now: () => number = Date.now,
): GroupsRepository {
  return {
    async getAll() {
      return (await db.groups.toArray())
        .filter((group) => group.deletedAt === null)
        .sort((a, b) => a.createdAt - b.createdAt);
    },

    getAllIncludingDeleted: () => db.groups.toArray(),

    async create(input) {
      const name = normalizeGroupName(input.name);
      if (name === '') throw new RangeError('A group needs a name');
      const t = now();
      const group: Group = {
        id: newId(),
        name,
        icon: input.icon ?? DEFAULT_GROUP_ICON,
        color: input.color ?? DEFAULT_GROUP_COLOR,
        noteColor: input.noteColor ?? null,
        createdAt: t,
        updatedAt: t,
        deletedAt: null,
      };
      await db.groups.add(group);
      return group;
    },

    async update(id, patch) {
      const changes: Partial<Group> = { updatedAt: now() };
      if (patch.name !== undefined) {
        const name = normalizeGroupName(patch.name);
        if (name === '') throw new RangeError('A group needs a name');
        changes.name = name;
      }
      if (patch.icon !== undefined) changes.icon = patch.icon;
      if (patch.color !== undefined) changes.color = patch.color;
      if (patch.noteColor !== undefined) changes.noteColor = patch.noteColor;
      await db.groups.update(id, changes);
    },

    async remove(id) {
      await db.transaction('rw', db.groups, db.notes, async () => {
        const t = now();
        await db.groups.update(id, { deletedAt: t, updatedAt: t });
        await db.notes.where('groupId').equals(id).modify({ groupId: null, updatedAt: t });
      });
    },

    async importMany(groups) {
      await db.transaction('rw', db.groups, async () => {
        const toWrite: Group[] = [];
        for (const incoming of groups) {
          const existing = await db.groups.get(incoming.id);
          if (!existing || incoming.updatedAt > existing.updatedAt) toWrite.push(incoming);
        }
        await db.groups.bulkPut(toWrite);
      });
    },
  };
}

export const groupsRepository = createGroupsRepository();
