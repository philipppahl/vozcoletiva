import { create } from 'zustand';

/**
 * Minimal toast store (decision 0026) — used to surface background-mutation
 * failures so an optimistic change that gets rolled back isn't silent.
 */

export type ToastTone = 'error' | 'info';

export interface ToastItem {
  id: string;
  tone: ToastTone;
  message: string;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (tone: ToastTone, message: string) => void;
  dismiss: (id: string) => void;
}

const TTL_MS = 4000;

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (tone, message) => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : String(Date.now());
    set((s) => ({ toasts: [...s.toasts, { id, tone, message }] }));
    setTimeout(() => get().dismiss(id), TTL_MS);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper for use outside React (mutation callbacks). */
export const toast = {
  error: (message: string) => useToastStore.getState().push('error', message),
  info: (message: string) => useToastStore.getState().push('info', message),
};
