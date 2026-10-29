import { isNoteEmpty, matchesQuery, NOTE_COLORS, type Note, type NoteColor } from './model';

export type NotesView = 'active' | 'archive' | 'trash';
export type SortBy = 'date' | 'color';

export interface NotesQuery {
  view: NotesView;
  query: string;
  color: NoteColor | null;
  /** null = every group (and notes without a group). */
  groupId: string | null;
  sortBy: SortBy;
}

export function inView(note: Note, view: NotesView): boolean {
  if (view === 'trash') return note.deletedAt !== null;
  // Blank notes are never worth listing (a note being created, before its first word).
  if (note.deletedAt !== null || isNoteEmpty(note)) return false;
  return view === 'archive' ? note.archived : !note.archived;
}

/** Pure list logic: filter by view, colour and search text, then sort. */
export function selectNotes(notes: Note[], { view, query, color, groupId, sortBy }: NotesQuery): Note[] {
  const colorRank = (c: NoteColor) => NOTE_COLORS.indexOf(c);
  return notes
    .filter((note) => inView(note, view))
    .filter((note) => color === null || note.color === color)
    .filter((note) => groupId === null || note.groupId === groupId)
    .filter((note) => matchesQuery(note, query))
    .sort((a, b) => {
      if (view === 'active' && a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (view === 'trash') return (b.deletedAt ?? 0) - (a.deletedAt ?? 0);
      if (sortBy === 'color' && a.color !== b.color) return colorRank(a.color) - colorRank(b.color);
      return b.updatedAt - a.updatedAt;
    });
}

export interface NoteCounts {
  total: number;
  byGroup: Map<string, number>;
}

/** How many listed notes there are in total and per group, for the group cards. */
export function countNotes(notes: Note[], view: NotesView): NoteCounts {
  const byGroup = new Map<string, number>();
  let total = 0;
  for (const note of notes) {
    if (!inView(note, view)) continue;
    total += 1;
    if (note.groupId) byGroup.set(note.groupId, (byGroup.get(note.groupId) ?? 0) + 1);
  }
  return { total, byGroup };
}
