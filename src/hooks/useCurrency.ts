import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AuthService } from '../services';
import { QUERY_KEYS } from '../constants';
import { useAuthStore } from '../store/authStore';
import { useShowToast } from '../store/uiStore';
import { deviceCurrency, isKnownCurrency } from '../utils/currency';
import { translate } from '../i18n';
import type { MutationError } from './queryUtils';

/** My default currency: what I picked, else the currency of my phone's region. */
export function useMyCurrency(): string {
  const saved = useAuthStore((s) => s.user?.currency);
  return isKnownCurrency(saved) ? saved : deviceCurrency();
}

/** Changes my default currency (used for new expenses, payments and totals). */
export function useSetMyCurrency() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const queryClient = useQueryClient();
  const showToast = useShowToast();
  return useMutation({
    mutationFn: (currency: string) => AuthService.updateProfile(user!, { currency }),
    onSuccess: (updated) => {
      updateUser(updated);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BALANCES });
    },
    onError: (e: MutationError) => showToast(e.message ?? translate('toast.couldNotSave'), 'error'),
  });
}

/**
 * Accounts made before currencies existed have none saved: store the phone's
 * region currency once, quietly. Mount once near the root.
 */
export function useEnsureCurrency() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const tried = useRef<string | null>(null);
  useEffect(() => {
    if (!user || isKnownCurrency(user.currency) || tried.current === user.id) return;
    tried.current = user.id;
    const currency = deviceCurrency();
    AuthService.updateProfile(user, { currency })
      .then((updated) => updateUser({ currency: updated.currency ?? currency }))
      .catch(() => updateUser({ currency })); // offline: keep it on the phone; it's saved next time
  }, [user, updateUser]);
}
