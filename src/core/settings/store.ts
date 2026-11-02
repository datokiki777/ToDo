import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_LANGUAGE, type Language } from '@/core/i18n/languages';
import type { SortBy } from '@/features/notes/selectors';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ViewMode = 'list' | 'grid';

interface SettingsState {
  language: Language;
  theme: ThemePreference;
  viewMode: ViewMode;
  sortBy: SortBy;
  /** Cards show only the title (no first line), so they are lower and more fit on the screen. */
  compactCards: boolean;
  setLanguage: (language: Language) => void;
  setTheme: (theme: ThemePreference) => void;
  setViewMode: (viewMode: ViewMode) => void;
  setSortBy: (sortBy: SortBy) => void;
  setCompactCards: (compactCards: boolean) => void;
}

/** Small preferences only. Notes themselves live in IndexedDB, never here. */
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      language: DEFAULT_LANGUAGE,
      theme: 'system',
      viewMode: 'list',
      sortBy: 'date',
      compactCards: false,
      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
      setViewMode: (viewMode) => set({ viewMode }),
      setSortBy: (sortBy) => set({ sortBy }),
      setCompactCards: (compactCards) => set({ compactCards }),
    }),
    {
      name: 'todo.settings',
      partialize: ({ language, theme, viewMode, sortBy, compactCards }) => ({
        language,
        theme,
        viewMode,
        sortBy,
        compactCards,
      }),
    },
  ),
);
