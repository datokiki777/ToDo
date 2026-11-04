import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { noteFromShare } from '@/features/notes/received';
import { notesRepository } from '@/features/notes/repository';

/**
 * Receives what other apps share to ToDo (Android's share menu). The phone opens the app at
 * "/?title=…&text=…&url=…"; this makes a note from it and opens it, with the list underneath so
 * "back" lands there. The address is cleaned first, so a reload does not make a second note.
 */
export function ShareReceiver() {
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    if (!['title', 'text', 'url'].some((key) => params.has(key))) return;

    const shared = noteFromShare({ title: params.get('title'), text: params.get('text'), url: params.get('url') });
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.hash);
    if (!shared) return;

    navigate('/', { replace: true });
    void notesRepository
      .create({ kind: 'text' })
      .then(async (note) => {
        await notesRepository.update(note.id, { title: shared.title, body: shared.body });
        navigate(`/note/${note.id}`);
      });
  }, [navigate]);

  return null;
}
