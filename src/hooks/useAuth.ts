/**
 * useAuth hook.
 * Provides convenient auth actions that combine Zustand store mutations
 * with AuthService calls.
 */

import { useMutation } from '@tanstack/react-query';
import { AuthService } from '../services';
import { LoginPayload, RegisterPayload } from '../types';
import { useAuthStore } from '../store/authStore';
import { useShowToast } from '../store/uiStore';

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const showToast = useShowToast();

  return useMutation({
    mutationFn: (payload: LoginPayload) => AuthService.login(payload),
    onSuccess: ({ user, token }) => {
      setAuth(user, token);
    },
    onError: (error: { message: string }) => {
      showToast(error.message ?? 'Login failed', 'error');
    },
  });
}

export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const showToast = useShowToast();

  return useMutation({
    mutationFn: (payload: RegisterPayload) => AuthService.register(payload),
    onSuccess: ({ user, token }) => {
      setAuth(user, token);
      showToast(`Welcome, ${user.name}!`, 'success');
    },
    onError: (error: { message: string }) => {
      showToast(error.message ?? 'Registration failed', 'error');
    },
  });
}

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const showToast = useShowToast();

  return useMutation({
    mutationFn: () => AuthService.logout(),
    onSuccess: () => {
      clearAuth();
    },
    onError: () => {
      // Force logout even if service call fails
      clearAuth();
      showToast('Logged out', 'info');
    },
  });
}

export function useUpdateProfile() {
  const updateUser = useAuthStore((s) => s.updateUser);
  const showToast = useShowToast();

  return useMutation({
    mutationFn: (update: Parameters<typeof AuthService.updateProfile>[0]) =>
      AuthService.updateProfile(update),
    onSuccess: (updatedUser) => {
      updateUser(updatedUser);
      showToast('Profile updated!', 'success');
    },
    onError: (error: { message: string }) => {
      showToast(error.message ?? 'Failed to update profile', 'error');
    },
  });
}

/**
 * Convenience hook to access current user from the store.
 */
export function useCurrentUser() {
  return useAuthStore((s) => s.user);
}

export function useIsAuthenticated() {
  return useAuthStore((s) => s.isAuthenticated);
}
