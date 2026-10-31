import { create } from 'zustand';
import { dateKey, shiftMonth } from '@/core/dates';

interface CalendarUi {
  year: number;
  /** 0-11 */
  month: number;
  /** The day whose notes are listed, "2026-10-30". */
  selected: string;
  select: (key: string) => void;
  shift: (delta: number) => void;
  goToday: () => void;
}

const start = () => {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth(), selected: dateKey(now) };
};

/** Where the calendar is looking. Kept for the session, so coming back from a note finds the same day. */
export const useCalendar = create<CalendarUi>((set, get) => ({
  ...start(),
  select: (key) => {
    const [y, m] = key.split('-').map(Number) as [number, number];
    set({ selected: key, year: y, month: m - 1 });
  },
  shift: (delta) => {
    const { year, month } = shiftMonth(get().year, get().month, delta);
    const now = new Date();
    const isCurrent = year === now.getFullYear() && month === now.getMonth();
    const first = dateKey(new Date(year, month, 1, 12));
    set({ year, month, selected: isCurrent ? dateKey(now) : first });
  },
  goToday: () => set(start()),
}));
