import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '../constants';
import { useAuthStore } from '../store/authStore';
import { computeUserBalances, computeTotals, computeGroupBalances } from '../utils/balanceEngine';
import { ExpenseService, SettlementService } from '../services';
import { ActivityItem, Expense, Settlement, User } from '../types';
import { useExpenses } from './useExpenses';
import { useGroupSettlements, useSettlements } from './useSettlements';
import { useGroup } from './useGroups';

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

/** My balance with every person, plus overall totals. */
export function useBalances() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: QUERY_KEYS.BALANCES,
    queryFn: async () => {
      const [expenses, settlements] = await Promise.all([
        ExpenseService.getExpenses(user!.id),
        SettlementService.getSettlements(user!.id),
      ]);
      const balances = computeUserBalances(expenses, settlements, user!.id, peopleIn(expenses, settlements));
      return { balances, totals: computeTotals(balances) };
    },
    enabled: !!user,
  });
}

/** One person's net balance with me (+ they owe me, − I owe them). */
export function useBalanceWith(userId: string) {
  const { data } = useBalances();
  return data?.balances.find((b) => b.userId === userId)?.netBalance ?? 0;
}

/** Each member's position in a group and the fewest payments that square it. */
export function useGroupBalances(groupId: string) {
  const { data: group } = useGroup(groupId);
  const { data: expenses } = useExpenses(groupId);
  const { data: settlements } = useGroupSettlements(groupId);
  return useMemo(() => {
    if (!group || !expenses || !settlements) return null;
    return computeGroupBalances(expenses, settlements, group.members.map((m) => m.user));
  }, [group, expenses, settlements]);
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
