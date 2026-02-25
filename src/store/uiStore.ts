/**
 * UI Store (Zustand)
 *
 * Manages global UI state:
 * - Toast notifications
 * - Confirmation modals
 * - Global loading indicator
 * - Theme preference (light/dark)
 */

import { create } from 'zustand';
import { ToastMessage, ToastType, ModalState } from '../types';
import { generateId } from '../utils/idGenerator';
import { TOAST_DURATION } from '../constants';

interface UIStore {
  // Toast
  toasts: ToastMessage[];
  showToast: (message: string, type?: ToastType, duration?: number) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;

  // Modal
  modal: ModalState;
  showModal: (options: Omit<ModalState, 'visible'>) => void;
  hideModal: () => void;

  // Global loading
  globalLoading: boolean;
  setGlobalLoading: (loading: boolean) => void;

  // Theme
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (value: boolean) => void;
}

export const useUIStore = create<UIStore>((set, get) => ({
  // ── Toast ──────────────────────────────────────────────
  toasts: [],

  showToast: (message, type = 'info', duration = TOAST_DURATION.MEDIUM) => {
    const id = generateId();
    const toast: ToastMessage = { id, type, message, duration };
    set((state) => ({ toasts: [...state.toasts, toast] }));

    // Auto-dismiss after duration
    setTimeout(() => {
      get().dismissToast(id);
    }, duration);

    return id;
  },

  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  clearToasts: () => set({ toasts: [] }),

  // ── Modal ──────────────────────────────────────────────
  modal: { visible: false },

  showModal: (options) =>
    set({ modal: { ...options, visible: true } }),

  hideModal: () =>
    set({ modal: { visible: false } }),

  // ── Loading ────────────────────────────────────────────
  globalLoading: false,
  setGlobalLoading: (loading) => set({ globalLoading: loading }),

  // ── Theme ──────────────────────────────────────────────
  isDarkMode: false,
  toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
  setDarkMode: (value) => set({ isDarkMode: value }),
}));

// Convenience selector hooks
export const useToasts = () => useUIStore((s) => s.toasts);
export const useShowToast = () => useUIStore((s) => s.showToast);
export const useModal = () => useUIStore((s) => s.modal);
export const useShowModal = () => useUIStore((s) => s.showModal);
export const useHideModal = () => useUIStore((s) => s.hideModal);
export const useIsDarkMode = () => useUIStore((s) => s.isDarkMode);
