import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ExpenseService, ReceiptService } from '../services';
import { QUERY_KEYS } from '../constants';
import { CreateExpensePayload, ExpenseActivity, ExpenseReactionEmoji, UpdateExpensePayload } from '../types';
import { useAuthStore } from '../store/authStore';
import { useShowToast } from '../store/uiStore';
import { invalidateMoney, MutationError } from './queryUtils';
import { translate, type TKey } from '../i18n';

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

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const showToast = useShowToast();
  return useMutation({
    mutationFn: ({ expenseId, payload }: { expenseId: string; payload: UpdateExpensePayload }) =>
      ExpenseService.updateExpense(userId, expenseId, payload),
    onSuccess: (e) => {
      queryClient.setQueryData(QUERY_KEYS.EXPENSE(e.id), e);
      // Balances, lists and the expense's history (the edit note) all change.
      invalidateMoney(queryClient);
      showToast(translate('toast.expenseUpdated'), 'success');
    },
    onError: (e: MutationError) => showToast(e.message ?? translate('toast.couldNotUpdate'), 'error'),
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

// ─── Reactions and comments ──────────────────────────────────────────────────

/** While the expense is open, new reactions and comments show up within this long (push makes it instant). */
const ACTIVITY_POLL = 15_000;

/** Expense lists show comment counts: refresh them, but not every open conversation. */
function refreshExpenseLists(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.EXPENSES, predicate: (q) => q.queryKey[1] !== 'activity' });
}

export function useExpenseActivity(expenseId: string, { live = true }: { live?: boolean } = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.EXPENSE_ACTIVITY(expenseId),
    queryFn: () => ExpenseService.getActivity(expenseId),
    enabled: !!expenseId,
    staleTime: 5_000,
    refetchInterval: live ? ACTIVITY_POLL : false,
  });
}

/** Writes to the activity show at once; the server's answer then replaces the guess (or the guess is undone). */
function useActivityWrite<V>(
  expenseId: string,
  guess: (current: ExpenseActivity, vars: V) => ExpenseActivity,
  call: (vars: V) => Promise<ExpenseActivity>,
  failKey: TKey,
  /** Comment counts in expense lists change with comments, not reactions. */
  countsChange = false,
) {
  const queryClient = useQueryClient();
  const showToast = useShowToast();
  const key = QUERY_KEYS.EXPENSE_ACTIVITY(expenseId);
  return useMutation({
    mutationFn: call,
    onMutate: async (vars: V) => {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<ExpenseActivity>(key);
      queryClient.setQueryData<ExpenseActivity>(key, guess(before ?? { reactions: [], comments: [] }, vars));
      return { before };
    },
    onSuccess: (activity) => {
      queryClient.setQueryData(key, activity);
      if (countsChange) refreshExpenseLists(queryClient);
    },
    onError: (e: MutationError, _vars, ctx) => {
      if (ctx?.before) queryClient.setQueryData(key, ctx.before);
      showToast(e.message ?? translate(failKey), 'error');
    },
  });
}

export function useReactToExpense(expenseId: string) {
  const me = useAuthStore((s) => s.user);
  return useActivityWrite<ExpenseReactionEmoji | null>(
    expenseId,
    (a, emoji) => ({
      ...a,
      reactions: [
        ...a.reactions.filter((r) => r.userId !== me?.id),
        ...(emoji && me ? [{ userId: me.id, user: me, emoji, updatedAt: new Date().toISOString() }] : []),
      ],
    }),
    (emoji) => ExpenseService.react(me?.id ?? '', expenseId, emoji),
    'toast.couldNotUpdate',
  );
}

export function useAddComment(expenseId: string) {
  const me = useAuthStore((s) => s.user);
  return useActivityWrite<string>(
    expenseId,
    (a, text) => ({
      ...a,
      comments: me
        ? [...a.comments, { id: `sending-${Date.now()}`, userId: me.id, user: me, text: text.trim(), createdAt: new Date().toISOString(), sending: true }]
        : a.comments,
    }),
    (text) => ExpenseService.addComment(me?.id ?? '', expenseId, text),
    'comments.failed',
    true,
  );
}

export function useDeleteComment(expenseId: string) {
  const me = useAuthStore((s) => s.user?.id ?? '');
  return useActivityWrite<string>(
    expenseId,
    (a, commentId) => ({ ...a, comments: a.comments.filter((c) => c.id !== commentId) }),
    (commentId) => ExpenseService.deleteComment(me, expenseId, commentId),
    'toast.couldNotUpdate',
    true,
  );
}
