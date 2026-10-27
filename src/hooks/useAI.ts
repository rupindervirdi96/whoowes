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

export function useQuickAdd() {
  const showToast = useShowToast();
  const handlePaywall = useHandlePaywallError();
  return useMutation({
    mutationFn: ({ text, ctx }: { text: string; ctx: QuickAddContext }) => AIService.quickAdd(text, ctx),
    onError: (e: MutationError) => {
      if (!handlePaywall(e)) showToast(e.message ?? "Couldn't understand that — try rephrasing", 'error');
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
      if (!handlePaywall(e)) showToast(e.message ?? 'Could not assign items', 'error');
    },
  });
}

/** Free users get the numbers; Pro users also get the AI write-up. */
export function useMonthInsights(month: string) {
  const user = useCurrentUser();
  const { data: expenses } = useExpenses();
  const { can } = useEntitlements();
  const stats = useMemo(
    () => (expenses && user ? computeMonthStats(expenses, user.id, month) : null),
    [expenses, user, month],
  );
  const aiEnabled = can('ai_insights');
  const narrative = useQuery({
    queryKey: QUERY_KEYS.INSIGHTS(month),
    queryFn: () => AIService.insights(stats!),
    enabled: !!stats && aiEnabled && stats.count > 0,
    staleTime: 10 * 60_000,
  });
  return { stats, narrative, aiEnabled };
}
