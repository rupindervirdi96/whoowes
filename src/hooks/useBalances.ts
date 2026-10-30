import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '../constants';
import { useAuthStore } from '../store/authStore';
import { computeUserBalances, computeTotals, computeGroupBalances } from '../utils/balanceEngine';
import { ExpenseService, SettlementService } from '../services';
import { ActivityItem, Expense, Settlement, User, UserBalance } from '../types';
import { useExpenses } from './useExpenses';
import { useGroupSettlements, useSettlements } from './useSettlements';
import { useGroup } from './useGroups';
import { useMyCurrency } from './useCurrency';

/** Everyone referenced by these expenses and payments. */
function peopleIn(expenses: Expense[], settlements: Settlement[]): User[] {
  const map = new Map<string, User>();
  for (const e of expenses) {
    map.set(e.paidByUser.id, e.paidByUser);
    e.splits.forEach((s) => map.set(s.user.id, s.user));
  }
  for (const s of settlements) {
    map.set(s.fromUser.id, s.fromUser);
    map.set(s.toUser.id, s.toUser);
  }
  return Array.from(map.values());
}

/** My balance with every person (one entry per person and currency), plus totals per currency. */
export function useBalances() {
  const user = useAuthStore((s) => s.user);
  const preferred = useMyCurrency();
  return useQuery({
    queryKey: [...QUERY_KEYS.BALANCES, preferred],
    queryFn: async () => {
      const [expenses, settlements] = await Promise.all([
        ExpenseService.getExpenses(user!.id),
        SettlementService.getSettlements(user!.id),
      ]);
      const balances = computeUserBalances(expenses, settlements, user!.id, peopleIn(expenses, settlements));
      return { balances, totals: computeTotals(balances, preferred) };
    },
    enabled: !!user,
  });
}

/** My open balances with one person (+ they owe me, − I owe them), one per currency. */
export function useBalancesWith(userId: string): UserBalance[] {
  const { data } = useBalances();
  const preferred = useMyCurrency();
  return useMemo(() => {
    const list = data?.balances.filter((b) => b.userId === userId) ?? [];
    return [...list].sort((a, b) => (a.currency === preferred ? -1 : b.currency === preferred ? 1 : Math.abs(b.netBalance) - Math.abs(a.netBalance)));
  }, [data, userId, preferred]);
}

/** Each member's position in a group and the fewest payments that square it, per currency. */
export function useGroupBalances(groupId: string) {
  const { data: group } = useGroup(groupId);
  const { data: expenses } = useExpenses(groupId);
  const { data: settlements } = useGroupSettlements(groupId);
  const mine = useMyCurrency();
  return useMemo(() => {
    if (!group || !expenses || !settlements) return null;
    return computeGroupBalances(expenses, settlements, group.members.map((m) => m.user), group.currency ?? mine);
  }, [group, expenses, settlements, mine]);
}

/** Expenses and payments merged into one newest-first timeline. */
export function useActivity() {
  const expensesQ = useExpenses();
  const settlementsQ = useSettlements();
  const items = useMemo<ActivityItem[]>(() => {
    const list: ActivityItem[] = [
      ...(expensesQ.data ?? []).map((e) => ({ kind: 'expense' as const, id: e.id, date: e.date, expense: e })),
      ...(settlementsQ.data ?? []).map((s) => ({
        kind: 'settlement' as const,
        id: s.id,
        date: s.updatedAt,
        settlement: s,
      })),
    ];
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [expensesQ.data, settlementsQ.data]);

  return {
    items,
    isLoading: expensesQ.isLoading || settlementsQ.isLoading,
    isRefetching: expensesQ.isRefetching || settlementsQ.isRefetching,
    refetch: () => Promise.all([expensesQ.refetch(), settlementsQ.refetch()]),
  };
}
