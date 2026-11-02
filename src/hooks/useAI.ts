import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AIService } from '../services';
import type { QuickAddContext } from '../services';
import { QUERY_KEYS } from '../constants';
import type { ReceiptItem, User } from '../types';
import { useShowToast } from '../store/uiStore';
import { useCurrentUser } from './useAuth';
import { useExpenses } from './useExpenses';
import { isAdCancelled, runWithPass } from './useAIPass';
import { computeMonthStats } from '../utils/insights';
import type { MutationError } from './queryUtils';
import { translate, useLanguage } from '../i18n';
import { useMyCurrency } from './useCurrency';

export function useQuickAdd() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();
  return useMutation({
    mutationFn: ({ text, ctx }: { text: string; ctx: QuickAddContext }) =>
      runWithPass(queryClient, 'quick_add', () => AIService.quickAdd(text, ctx)),
    onError: (e: MutationError) => {
      if (!isAdCancelled(e)) showToast(e.message ?? translate('toast.quickAddFailed'), 'error');
    },
  });
}

export function useAssignItems() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();
  return useMutation({
    mutationFn: ({ items, people, instruction }: { items: ReceiptItem[]; people: User[]; instruction: string }) =>
      runWithPass(queryClient, 'split_assistant', () => AIService.assignItems(items, people, instruction)),
    onError: (e: MutationError) => {
      if (!isAdCancelled(e)) showToast(e.message ?? translate('toast.couldNotAssign'), 'error');
    },
  });
}

/**
 * A month's numbers (computed on the phone, always free) and its AI write-up.
 * A write-up made earlier loads by itself at no cost; a new one is written only
 * when asked for (`write`), and uses an insights pass. Stats are for one
 * currency at a time (`currency`, or the one with the most spending).
 */
export function useMonthInsights(month: string, currency?: string) {
  const queryClient = useQueryClient();
  const showToast = useShowToast();
  const user = useCurrentUser();
  const preferred = useMyCurrency();
  const language = useLanguage();
  const { data: expenses } = useExpenses();
  const stats = useMemo(
    () => (expenses && user ? computeMonthStats(expenses, user.id, month, currency, preferred) : null),
    [expenses, user, month, currency, preferred],
  );
  const key = [...QUERY_KEYS.INSIGHTS(month), stats?.currency, language, stats ? JSON.stringify(stats) : ''];
  const narrative = useQuery({
    queryKey: key,
    queryFn: () => AIService.insights(stats!, { cachedOnly: true }),
    enabled: !!stats && stats.count > 0,
    staleTime: 10 * 60_000,
  });
  const write = useMutation({
    mutationFn: () => runWithPass(queryClient, 'insights', () => AIService.insights(stats!)),
    onSuccess: (result) => queryClient.setQueryData(key, result),
    onError: (e: MutationError) => {
      if (!isAdCancelled(e)) showToast(e.message ?? translate('toast.insightsFailed'), 'error');
    },
  });
  return { stats, narrative, write };
}
