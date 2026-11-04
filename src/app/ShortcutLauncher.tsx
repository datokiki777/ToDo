import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { notesRepository } from '@/features/notes/repository';

const SHORTCUT = /^\/new\/(text|checklist)$/;

/**
 * Handles the app-icon shortcuts ("#/new/text", "#/new/checklist"): the list goes into the
 * history first, then a blank note is made and opened on top of it, so "back" from the note
 * lands on the list instead of leaving the app. Always mounted, so it outlives the navigation.
 */
export function ShortcutLauncher() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const busy = useRef(false);
  const kind = SHORTCUT.exec(pathname)?.[1];

  useEffect(() => {
    if (!kind || busy.current) return; // one note, however many times this runs
    busy.current = true;
    navigate('/', { replace: true });
    notesRepository
      .create({ kind: kind === 'checklist' ? 'checklist' : 'text' })
      .then((note) => navigate(`/note/${note.id}`))
      .finally(() => {
        busy.current = false;
      });
  }, [kind, navigate]);

  return null;
}
