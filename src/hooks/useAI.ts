import { useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AIService } from '../services';
import type { QuickAddContext } from '../services';
import { QUERY_KEYS } from '../constants';
import type { ReceiptItem, User } from '../types';
import { useShowToast } from '../store/uiStore';
import { useCurrentUser } from './useAuth';
import { useExpenses } from './useExpenses';
import { useEntitlements, useHandlePaywallError } from './useBilling';
import { computeMonthStats } from '../utils/insights';
import type { MutationError } from './queryUtils';
import { translate, useLanguage } from '../i18n';
import { useMyCurrency } from './useCurrency';

export function useQuickAdd() {
  const showToast = useShowToast();
  const handlePaywall = useHandlePaywallError();
  return useMutation({
    mutationFn: ({ text, ctx }: { text: string; ctx: QuickAddContext }) => AIService.quickAdd(text, ctx),
    onError: (e: MutationError) => {
      if (!handlePaywall(e)) showToast(e.message ?? translate('toast.quickAddFailed'), 'error');
    },
  });
}

export function useAssignItems() {
  const showToast = useShowToast();
  const handlePaywall = useHandlePaywallError();
  return useMutation({
    mutationFn: ({ items, people, instruction }: { items: ReceiptItem[]; people: User[]; instruction: string }) =>
      AIService.assignItems(items, people, instruction),
    onError: (e: MutationError) => {
      if (!handlePaywall(e)) showToast(e.message ?? translate('toast.couldNotAssign'), 'error');
    },
  });
}

/**
 * Free users get the numbers; Pro users also get the AI write-up. Stats are for
 * one currency at a time (`currency`, or the one with the most spending).
 */
export function useMonthInsights(month: string, currency?: string) {
  const user = useCurrentUser();
  const preferred = useMyCurrency();
  const language = useLanguage();
  const { data: expenses } = useExpenses();
  const { can } = useEntitlements();
  const stats = useMemo(
    () => (expenses && user ? computeMonthStats(expenses, user.id, month, currency, preferred) : null),
    [expenses, user, month, currency, preferred],
  );
  const aiEnabled = can('ai_insights');
  const narrative = useQuery({
    queryKey: [...QUERY_KEYS.INSIGHTS(month), stats?.currency, language],
    queryFn: () => AIService.insights(stats!),
    enabled: !!stats && aiEnabled && stats.count > 0,
    staleTime: 10 * 60_000,
  });
  return { stats, narrative, aiEnabled };
}
