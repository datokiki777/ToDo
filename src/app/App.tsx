import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { requestPersistence } from '@/core/storage';
import { ToastHost } from '@/core/ui/ToastHost';
import { NoteEditorPage } from '@/features/notes/pages/NoteEditorPage';
import { NotesPage } from '@/features/notes/pages/NotesPage';
import { notesRepository } from '@/features/notes/repository';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { AppShell } from './AppShell';
import { UpdatePrompt } from './UpdatePrompt';
import { useApplyTheme } from './useApplyTheme';

export default function App() {
  useApplyTheme();

  useEffect(() => {
    // Ask the browser to keep our data, and tidy blank notes left over from an interrupted session.
    void requestPersistence();
    void notesRepository.purgeEmpty();
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
