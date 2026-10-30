import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { requestPersistence } from '@/core/storage';
import { ToastHost } from '@/core/ui/ToastHost';
import { NoteEditorPage } from '@/features/notes/pages/NoteEditorPage';
import { NotesPage } from '@/features/notes/pages/NotesPage';
import { useAccount } from '@/features/account/store';
import { initSync } from '@/features/sync/controller';
import { notesRepository } from '@/features/notes/repository';
import { TRASH_RETENTION_MS } from '@/features/notes/trash';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { AppShell } from './AppShell';
import { UpdatePrompt } from './UpdatePrompt';
import { useApplyTheme } from './useApplyTheme';

export default function App() {
  useApplyTheme();

  useEffect(() => {
    // Ask the browser to keep our data, and tidy blank notes left over from an interrupted session.
    // Start the account system a moment after the first screen is up, as a separate download.
    const startAccount = window.setTimeout(() => void useAccount.getState().init(), 0);
    const stopSync = initSync();
    void requestPersistence();
    void notesRepository.purgeEmpty();

    // Trash is kept for a fixed time, then deleted for good. Check on start and whenever the
    // app returns to the screen (an installed app often stays alive for days).
    const purgeTrash = () => void notesRepository.purgeExpiredTrash(TRASH_RETENTION_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') purgeTrash();
    };
    purgeTrash();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(startAccount);
      stopSync();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<NotesPage key="active" mode="active" />} />
          <Route path="archive" element={<NotesPage key="archive" mode="archive" />} />
          <Route path="trash" element={<NotesPage key="trash" mode="trash" />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="note/:id" element={<NoteEditorPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastHost />
      <UpdatePrompt />
    </HashRouter>
  );
}
