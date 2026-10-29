import { useLiveQuery } from 'dexie-react-hooks';
import { notesRepository } from './repository';

/** All notes, kept up to date automatically. `undefined` while the first read is in flight. */
export function useNotes() {
  return useLiveQuery(() => notesRepository.getAll(), []);
}

/** One note. `undefined` = loading, `null` = does not exist. */
export function useNote(id: string | undefined) {
  return useLiveQuery(
    async () => (id ? ((await notesRepository.get(id)) ?? null) : null),
    [id],
  );
}
