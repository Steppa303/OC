import { create } from 'zustand';

/**
 * App-wide toast notifications (P7-03). One place to surface transient messages
 * — cable-refusal reasons, import failures, board hiccups — so errors are never
 * swallowed or shoved into a blocking alert(). Auto-dismiss after a timeout;
 * errors linger a little longer than info.
 */
export type ToastTone = 'info' | 'error';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, tone?: ToastTone) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;
const INFO_MS = 2800;
const ERROR_MS = 5000;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, tone = 'info') => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    setTimeout(() => get().dismiss(id), tone === 'error' ? ERROR_MS : INFO_MS);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper for non-React call sites. */
export function toast(message: string, tone: ToastTone = 'info'): void {
  useToastStore.getState().push(message, tone);
}
