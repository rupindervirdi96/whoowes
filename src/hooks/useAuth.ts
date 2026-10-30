import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AuthService, PhoneAuthService } from '../services';
import { LoginPayload, RegisterPayload, User } from '../types';
import { useAuthStore } from '../store/authStore';
import { useShowToast } from '../store/uiStore';
import type { MutationError } from './queryUtils';
import { translate } from '../i18n';

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const showToast = useShowToast();
  return useMutation({
    mutationFn: (payload: LoginPayload) => AuthService.login(payload),
    onSuccess: ({ user, token }) => setAuth(user, token),
    onError: (e: MutationError) => showToast(e.message ?? translate('toast.signInFailed'), 'error'),
  });
}

export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const showToast = useShowToast();
  return useMutation({
    mutationFn: (payload: RegisterPayload) => AuthService.register(payload),
    onSuccess: ({ user, token }) => {
      setAuth(user, token);
      showToast(translate('toast.welcome', { name: user.name.split(' ')[0] }), 'success');
    },
    onError: (e: MutationError) => showToast(e.message ?? translate('toast.signUpFailed'), 'error'),
  });
}

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => AuthService.logout(),
    onSettled: () => {
      clearAuth();
      queryClient.clear();
    },
  });
}

export function useUpdateProfile() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const showToast = useShowToast();
  return useMutation({
    mutationFn: (update: Partial<Pick<User, 'name' | 'phone' | 'avatarUrl' | 'email' | 'currency'>>) =>
      AuthService.updateProfile(user!, update),
    onSuccess: (updated) => {
      updateUser(updated);
      showToast(translate('toast.profileSaved'), 'success');
    },
    onError: (e: MutationError) => showToast(e.message ?? translate('toast.couldNotSave'), 'error'),
  });
}

export function useCurrentUser() {
  return useAuthStore((s) => s.user);
}

// ─── Phone sign-in ───────────────────────────────────────────────────────────

export function useStartPhoneSignIn() {
  const showToast = useShowToast();
  return useMutation({
    mutationFn: (phone: string) => PhoneAuthService.start(phone),
    onError: (e: MutationError) => showToast(e.message ?? translate('toast.couldNotSendCode'), 'error'),
  });
}

export function useVerifyPhoneCode() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const showToast = useShowToast();
  return useMutation({
    mutationFn: (input: { phone: string; code: string; name?: string; currency?: string }) => PhoneAuthService.verify(input),
    onSuccess: ({ user, token, isNewUser }) => {
      setAuth(user, token);
      if (isNewUser) showToast(translate('toast.welcome', { name: user.name.split(' ')[0] }), 'success');
    },
  });
}

/** Permanently deletes the account on the server, then signs out. */
export function useDeleteAccount() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const queryClient = useQueryClient();
  const showToast = useShowToast();
  return useMutation({
    mutationFn: () => AuthService.deleteAccount(),
    onSuccess: () => {
      clearAuth();
      queryClient.clear();
      showToast(translate('toast.accountDeleted'), 'info');
    },
    onError: (e: MutationError) => showToast(e.message ?? translate('toast.couldNotDeleteAccount'), 'error'),
  });
}
