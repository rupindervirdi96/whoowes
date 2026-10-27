/**
 * UI Store (Zustand)
 *
 * - Toasts and the global confirm modal
 * - The "add expense" action sheet opened by the center tab button
 * - Theme preference (persisted)
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ToastMessage, ToastType, ModalState } from '../types';
import { generateId } from '../utils/idGenerator';
import { STORAGE_KEYS, TOAST_DURATION } from '../constants';

export type ThemePreference = 'system' | 'light' | 'dark';

interface UIStore {
  toasts: ToastMessage[];
  showToast: (message: string, type?: ToastType, duration?: number) => string;
  dismissToast: (id: string) => void;

  modal: ModalState;
  showModal: (options: Omit<ModalState, 'visible'>) => void;
  hideModal: () => void;

  addSheetOpen: boolean;
  /** Group to pre-select when the add sheet is opened from a group screen. */
  addSheetGroupId?: string;
  openAddSheet: (groupId?: string) => void;
  closeAddSheet: () => void;

  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      toasts: [],
      showToast: (message, type = 'info', duration = TOAST_DURATION.MEDIUM) => {
        const id = generateId();
        set((s) => ({ toasts: [...s.toasts.slice(-2), { id, type, message, duration }] }));
        setTimeout(() => get().dismissToast(id), duration);
        return id;
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      modal: { visible: false },
      showModal: (options) => set({ modal: { ...options, visible: true } }),
      hideModal: () => set({ modal: { visible: false } }),

      addSheetOpen: false,
      openAddSheet: (groupId) => set({ addSheetOpen: true, addSheetGroupId: groupId }),
      closeAddSheet: () => set({ addSheetOpen: false, addSheetGroupId: undefined }),

      themePreference: 'system',
      setThemePreference: (themePreference) => set({ themePreference }),
    }),
    {
      name: STORAGE_KEYS.UI_PREFS,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ themePreference: s.themePreference }),
    },
  ),
);

export const useShowToast = () => useUIStore((s) => s.showToast);
export const useShowModal = () => useUIStore((s) => s.showModal);
export const useModal = () => useUIStore((s) => s.modal);
export const useHideModal = () => useUIStore((s) => s.hideModal);
