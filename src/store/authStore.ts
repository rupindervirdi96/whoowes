/**
 * Authentication Store (Zustand)
 *
 * Manages the current user session:
 * - user and token
 * - session restoration on app startup
 * - login / logout actions
 *
 * Uses persist middleware to survive app restarts via AsyncStorage.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, AuthState } from '../types';

interface AuthStore extends AuthState {
  // Actions
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  updateUser: (update: Partial<User>) => void;
  setHydrated: (hydrated: boolean) => void;
  _hydrated: boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      // State
      user: null,
      token: null,
      isAuthenticated: false,
      _hydrated: false,

      // Set authenticated session
      setAuth: (user, token) =>
        set({ user, token, isAuthenticated: true }),

      // Clear on logout
      clearAuth: () =>
        set({ user: null, token: null, isAuthenticated: false }),

      // Update profile fields without re-authenticating
      updateUser: (update) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...update } : null,
        })),

      // Track hydration status (useful to avoid flicker on startup)
      setHydrated: (hydrated) => set({ _hydrated: hydrated }),
    }),
    {
      name: '@whoowes/auth',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
      // Only persist what is needed to restore sessions
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
