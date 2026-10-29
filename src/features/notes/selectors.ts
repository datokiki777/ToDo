import { matchesQuery, NOTE_COLORS, type Note, type NoteColor } from './model';

export type NotesView = 'active' | 'archive' | 'trash';
export type SortBy = 'date' | 'color';

export interface NotesQuery {
  view: NotesView;
  query: string;
  color: NoteColor | null;
  sortBy: SortBy;
}

function inView(note: Note, view: NotesView): boolean {
  if (view === 'trash') return note.deletedAt !== null;
  if (note.deletedAt !== null) return false;
  return view === 'archive' ? note.archived : !note.archived;
}

/** Pure list logic: filter by view, colour and search text, then sort. */
export function selectNotes(notes: Note[], { view, query, color, sortBy }: NotesQuery): Note[] {
  const colorRank = (c: NoteColor) => NOTE_COLORS.indexOf(c);
  return notes
    .filter((note) => inView(note, view))
    .filter((note) => color === null || note.color === color)
    .filter((note) => matchesQuery(note, query))
    .sort((a, b) => {
      if (view === 'active' && a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (view === 'trash') return (b.deletedAt ?? 0) - (a.deletedAt ?? 0);
      if (sortBy === 'color' && a.color !== b.color) return colorRank(a.color) - colorRank(b.color);
      return b.updatedAt - a.updatedAt;
    });
}
