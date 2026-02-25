/**
 * Expenses React Query hooks.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ExpenseService } from '../services';
import { QUERY_KEYS } from '../constants';
import { CreateExpensePayload } from '../types';
import { useAuthStore } from '../store/authStore';
import { useShowToast } from '../store/uiStore';

export function useExpenses(groupId?: string) {
  const userId = useAuthStore((s) => s.user?.id ?? '');
  return useQuery({
    queryKey: groupId ? QUERY_KEYS.GROUP_EXPENSES(groupId) : QUERY_KEYS.EXPENSES,
    queryFn: () => ExpenseService.getExpenses(userId, groupId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useExpense(expenseId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.EXPENSE(expenseId),
    queryFn: () => ExpenseService.getExpense(expenseId),
    enabled: !!expenseId,
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();

  return useMutation({
    mutationFn: (payload: CreateExpensePayload) =>
      ExpenseService.createExpense(payload),
    onSuccess: (newExpense) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.EXPENSES });
      if (newExpense.groupId) {
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.GROUP_EXPENSES(newExpense.groupId),
        });
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.GROUP_BALANCES(newExpense.groupId),
        });
      }
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USER_BALANCES });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD_SUMMARY });
      showToast('Expense added!', 'success');
    },
    onError: (error: { message: string }) => {
      showToast(error.message ?? 'Failed to add expense', 'error');
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();

  return useMutation({
    mutationFn: (expenseId: string) => ExpenseService.deleteExpense(expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.EXPENSES });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USER_BALANCES });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD_SUMMARY });
      showToast('Expense deleted', 'info');
    },
    onError: (error: { message: string }) => {
      showToast(error.message ?? 'Failed to delete expense', 'error');
    },
  });
}

export function useMarkSplitPaid() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();

  return useMutation({
    mutationFn: ({ expenseId, userId }: { expenseId: string; userId: string }) =>
      ExpenseService.markSplitPaid(expenseId, userId),
    onSuccess: (updatedExpense) => {
      queryClient.setQueryData(
        QUERY_KEYS.EXPENSE(updatedExpense.id),
        updatedExpense,
      );
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USER_BALANCES });
      showToast('Marked as paid', 'success');
    },
    onError: (error: { message: string }) => {
      showToast(error.message ?? 'Failed to update', 'error');
    },
  });
}
