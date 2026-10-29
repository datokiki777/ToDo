import { create } from 'zustand';
import type { NoteColor } from './model';

interface ListFilters {
  /** null = all groups. */
  groupId: string | null;
  color: NoteColor | null;
  setGroupId: (groupId: string | null) => void;
  setColor: (color: NoteColor | null) => void;
}

/** What the lists are filtered by. Kept for the session so it survives switching tabs. */
export const useListFilters = create<ListFilters>((set) => ({
  groupId: null,
  color: null,
  setGroupId: (groupId) => set({ groupId }),
  setColor: (color) => set({ color }),
}));
