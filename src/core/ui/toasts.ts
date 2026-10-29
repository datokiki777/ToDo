import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ShowOptions {
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

interface ToastState {
  toasts: Toast[];
  show: (message: string, options?: ShowOptions) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  show: (message, options = {}) => {
    const id = nextId++;
    const toast: Toast = { id, message, actionLabel: options.actionLabel, onAction: options.onAction };
    set((state) => ({ toasts: [...state.toasts.slice(-2), toast] }));
    window.setTimeout(() => get().dismiss(id), options.durationMs ?? 5000);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));
