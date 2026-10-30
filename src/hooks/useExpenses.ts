import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ExpenseService, ReceiptService } from '../services';
import { QUERY_KEYS } from '../constants';
import { CreateExpensePayload } from '../types';
import { useAuthStore } from '../store/authStore';
import { useShowToast } from '../store/uiStore';
import { invalidateMoney, MutationError } from './queryUtils';
import { translate } from '../i18n';

export function useExpenses(groupId?: string) {
  const userId = useAuthStore((s) => s.user?.id ?? '');
  return useQuery({
    queryKey: groupId ? QUERY_KEYS.GROUP_EXPENSES(groupId) : QUERY_KEYS.EXPENSES,
    queryFn: () => ExpenseService.getExpenses(userId, groupId),
    enabled: !!userId,
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
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const showToast = useShowToast();
  return useMutation({
    mutationFn: async (payload: CreateExpensePayload) => {
      const expense = await ExpenseService.createExpense(userId, payload);
      if (payload.receiptId) await ReceiptService.linkToExpense(payload.receiptId, expense.id);
      return expense;
    },
    onSuccess: (e) => {
      invalidateMoney(queryClient);
      showToast(translate('toast.expenseAdded', { title: e.title }), 'success');
    },
    onError: (e: MutationError) => showToast(e.message ?? translate('toast.couldNotAddExpense'), 'error'),
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();
  return useMutation({
    mutationFn: (expenseId: string) => ExpenseService.deleteExpense(expenseId),
    onSuccess: () => {
      invalidateMoney(queryClient);
      showToast(translate('toast.expenseDeleted'), 'info');
    },
    onError: (e: MutationError) => showToast(e.message ?? translate('toast.couldNotDeleteExpense'), 'error'),
  });
}

export function useMarkSplitPaid() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();
  return useMutation({
    mutationFn: ({ expenseId, userId }: { expenseId: string; userId: string }) =>
      ExpenseService.markSplitPaid(expenseId, userId),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEYS.EXPENSE(updated.id), updated);
      invalidateMoney(queryClient);
      showToast(translate('toast.markedPaid'), 'success');
    },
    onError: (e: MutationError) => showToast(e.message ?? translate('toast.couldNotUpdate'), 'error'),
  });
}
