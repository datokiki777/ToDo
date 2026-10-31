import { isNoteColor, type NoteColor } from '@/features/notes/model';

export const GROUP_ICONS = [
  'folder',
  'briefcase',
  'home',
  'cart',
  'heart',
  'star',
  'book',
  'school',
  'car',
  'plane',
  'wallet',
  'dumbbell',
  'food',
  'music',
  'camera',
  'gift',
  'wrench',
  'building',
  'users',
  'phone',
  'mail',
  'idea',
  'tag',
  'leaf',
] as const;
export type GroupIconName = (typeof GROUP_ICONS)[number];
export const DEFAULT_GROUP_ICON: GroupIconName = 'folder';
export const DEFAULT_GROUP_COLOR: NoteColor = 'blue';
export const GROUP_NAME_MAX = 40;

/**
 * A named collection of notes (e.g. one per project or topic). Like notes, groups carry
 * `updatedAt` and `deletedAt` so they can be merged and synced later.
 */
export interface Group {
  id: string;
  name: string;
  icon: GroupIconName;
  /** The group's own colour: its icon and card. */
  color: NoteColor;
  /** The colour new notes in this group start with; null = no preference. Always changeable by hand. */
  noteColor: NoteColor | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export function isGroupIcon(value: unknown): value is GroupIconName {
  return typeof value === 'string' && (GROUP_ICONS as readonly string[]).includes(value);
}

export function normalizeGroupName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, GROUP_NAME_MAX);
}

export function parseGroup(raw: unknown): Group | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || r.id === '') return null;
  if (typeof r.name !== 'string') return null;
  const name = normalizeGroupName(r.name);
  if (name === '') return null;
  const updatedAt = typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? r.updatedAt : null;
  if (updatedAt === null) return null;
  const createdAt = typeof r.createdAt === 'number' && Number.isFinite(r.createdAt) ? r.createdAt : updatedAt;
  const deletedAt = typeof r.deletedAt === 'number' && Number.isFinite(r.deletedAt) ? r.deletedAt : null;
  return {
    id: r.id,
    name,
    icon: isGroupIcon(r.icon) ? r.icon : DEFAULT_GROUP_ICON,
    color: isNoteColor(r.color) ? r.color : DEFAULT_GROUP_COLOR,
    noteColor: isNoteColor(r.noteColor) ? r.noteColor : null,
    createdAt,
    updatedAt,
    deletedAt,
  };
}
