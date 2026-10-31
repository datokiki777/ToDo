import type { NoteColor } from '@/features/notes/model';
import type { Group } from './model';

/**
 * The colour a brand-new note starts with. A colour filter on the list wins (so the new note
 * stays visible there), then the group's default, then nothing (the app's own default).
 */
export function colorForNewNote(filterColor: NoteColor | null, group: Pick<Group, 'noteColor'> | null): NoteColor | undefined {
  return filterColor ?? group?.noteColor ?? undefined;
}

/**
 * The colour to give a note when it is put into a group. Only a note nothing is written in yet
 * takes the group's colour; a note with content keeps the colour it has.
 */
export function colorWhenJoining(noteIsBlank: boolean, group: Pick<Group, 'noteColor'> | null): NoteColor | undefined {
  return noteIsBlank ? (group?.noteColor ?? undefined) : undefined;
}
