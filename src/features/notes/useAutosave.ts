import { useCallback, useEffect, useRef } from 'react';
import { contentForSave, type NoteContent } from './model';
import { notesRepository } from './repository';

/**
 * Saves the editor's draft shortly after typing stops, and always when the page is hidden or the
 * editor closes, so a note is never lost to a quick app switch. Returns `flush` for explicit saves.
 */
export function useAutosave(id: string, draft: NoteContent, enabled: boolean, delayMs = 400) {
  const latest = useRef(draft);
  latest.current = draft;
  const saved = useRef<string | null>(null);
  if (saved.current === null) saved.current = JSON.stringify(contentForSave(draft));
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (!enabled) return;
    const patch = contentForSave(latest.current);
    const snapshot = JSON.stringify(patch);
    if (snapshot === saved.current) return;
    saved.current = snapshot;
    await notesRepository.update(id, patch);
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

  return flush;
}
