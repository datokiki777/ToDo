import { useCallback, useEffect, useRef } from 'react';
import { contentForSave, type NoteContent } from './model';
import { notesRepository } from './repository';

/**
 * Saves the editor's draft shortly after typing stops, and always when the page is hidden or the
 * editor closes, so a note is never lost to a quick app switch. `flush` resolves when everything typed
 * so far has reached the database.
 */
export function useAutosave(id: string, draft: NoteContent, enabled: boolean, delayMs = 400) {
  const latest = useRef(draft);
  latest.current = draft;
  const saved = useRef<string | null>(null);
  if (saved.current === null) saved.current = JSON.stringify(contentForSave(draft));
  const timer = useRef<number | undefined>(undefined);
  // Saves run one after another; every `flush` resolves only when all saves so far are written.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const flush = useCallback((): Promise<void> => {
    window.clearTimeout(timer.current);
    if (enabled) {
      const patch = contentForSave(latest.current);
      const snapshot = JSON.stringify(patch);
      if (snapshot !== saved.current) {
        saved.current = snapshot;
        queue.current = queue.current
          .then(() => notesRepository.update(id, patch))
          .catch((error: unknown) => console.error('Saving the note failed', error));
      }
    }
    return queue.current;
  }, [id, enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (JSON.stringify(contentForSave(draft)) === saved.current) return;
    timer.current = window.setTimeout(() => void flush(), delayMs);
    return () => window.clearTimeout(timer.current);
  }, [draft, enabled, delayMs, flush]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    const onPageHide = () => void flush();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      void flush();
    };
  }, [flush]);

  const snapshot = (content: NoteContent) => JSON.stringify(contentForSave(content));
  return {
    flush,
    /** True while the person has typed something that has not been saved yet. */
    hasUnsaved: () => snapshot(latest.current) !== saved.current,
    /** What the saved version looks like, comparable with `snapshotOf`. */
    savedSnapshot: () => saved.current,
    snapshotOf: snapshot,
    /** Treat this content as already saved (it just came from outside, e.g. another device). */
    rebase: (content: NoteContent) => {
      saved.current = snapshot(content);
    },
  };
}
