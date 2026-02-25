/**
 * Balances hook.
 * Derives balance information from cached expenses and settlements.
 */

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '../constants';
import { useAuthStore } from '../store/authStore';
import { computeUserBalances, computeTotals, simplifyDebts } from '../utils/balanceEngine';
import { ExpenseService, SettlementService } from '../services';
import { User } from '../types';
import { MOCK_USERS } from '../constants/sampleData';

/**
 * Fetches all balance-related data and computes derived state.
 */
export function useBalances() {
  const currentUser = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: QUERY_KEYS.USER_BALANCES,
    queryFn: async () => {
      if (!currentUser) return null;

      // Fetch expenses and settlements in parallel
      const [expenses, settlements] = await Promise.all([
        ExpenseService.getExpenses(currentUser.id),
        SettlementService.getSettlements(currentUser.id),
      ]);

      // Build user map for balance engine
      const userMap: Record<string, User> = {};
      MOCK_USERS.forEach((u) => (userMap[u.id] = u));

      const balances = computeUserBalances(
        expenses,
        settlements,
        currentUser.id,
        MOCK_USERS,
      );

      const totals = computeTotals(balances);
      const simplifiedDebts = simplifyDebts(expenses, userMap);

      return { balances, totals, simplifiedDebts };
    },
    enabled: !!currentUser,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Dashboard summary - total owed and total owes.
 */
export function useDashboardSummary() {
  const currentUser = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: QUERY_KEYS.DASHBOARD_SUMMARY,
    queryFn: async () => {
      if (!currentUser) return null;

      const [expenses, settlements] = await Promise.all([
        ExpenseService.getExpenses(currentUser.id),
        SettlementService.getSettlements(currentUser.id),
      ]);

      const balances = computeUserBalances(
        expenses,
        settlements,
        currentUser.id,
        MOCK_USERS,
      );

      return {
        ...computeTotals(balances),
        recentExpenses: expenses.slice(0, 5),
        pendingSettlementCount: settlements.filter(
          (s) => s.toUserId === currentUser.id && s.status === 'pending',
        ).length,
      };
    },
    enabled: !!currentUser,
    staleTime: 1000 * 60 * 2,
  });
}
