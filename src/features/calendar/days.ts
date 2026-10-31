import { isNoteEmpty, type Note } from '@/features/notes/model';

/** Notes grouped by their calendar day. Only live notes with something written in them. */
export function notesByDay(notes: Note[]): Map<string, Note[]> {
  const days = new Map<string, Note[]>();
  for (const note of notes) {
    if (note.date === null || note.deletedAt !== null || isNoteEmpty(note)) continue;
    const list = days.get(note.date);
    if (list) list.push(note);
    else days.set(note.date, [note]);
  }
  // Within a day: pinned first, then the most recently changed.
  for (const list of days.values()) {
    list.sort((a, b) => (a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : b.updatedAt - a.updatedAt));
  }
  return days;
}
