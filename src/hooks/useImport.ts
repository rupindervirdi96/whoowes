import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ImportService } from '../services';
import { QUERY_KEYS } from '../constants';
import type { SplitwiseImportPayload } from '../types';
import { useAuthStore } from '../store/authStore';
import { useShowToast } from '../store/uiStore';
import { translate } from '../i18n';
import { invalidateMoney, MutationError } from './queryUtils';

/** An import or takeover touches everything: people, groups, expenses and payments. */
function refreshAll(queryClient: QueryClient) {
  invalidateMoney(queryClient);
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FRIENDS });
}

export function useImportSplitwise() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const showToast = useShowToast();
  return useMutation({
    mutationFn: (payload: SplitwiseImportPayload) => ImportService.importSplitwise(userId, payload),
    onSuccess: () => refreshAll(queryClient),
    onError: (e: MutationError) => showToast(e.message ?? translate('import.failed'), 'error'),
  });
}

/** Requests for me to take over someone's Splitwise history. */
export function useHistoryClaims() {
  const userId = useAuthStore((s) => s.user?.id ?? '');
  return useQuery({ queryKey: QUERY_KEYS.HISTORY_CLAIMS, queryFn: () => ImportService.getClaims(), enabled: !!userId });
}

/** Ask a friend to take over a placeholder. */
export function useRequestClaim() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();
  return useMutation({
    mutationFn: ({ placeholderId, userId }: { placeholderId: string; userId: string; name: string }) => ImportService.requestClaim(placeholderId, userId),
    onSuccess: (_r, v) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FRIENDS });
      showToast(translate('placeholder.linkSent', { name: v.name.split(' ')[0] }), 'success');
    },
    onError: (e: MutationError) => showToast(e.message ?? translate('toast.couldNotUpdate'), 'error'),
  });
}

export function useAcceptClaim() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();
  return useMutation({
    mutationFn: (placeholderId: string) => ImportService.acceptClaim(placeholderId),
    onSuccess: () => {
      refreshAll(queryClient);
      showToast(translate('claim.accepted'), 'success');
    },
    onError: (e: MutationError) => showToast(e.message ?? translate('toast.couldNotUpdate'), 'error'),
  });
}

export function useDeclineClaim() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();
  return useMutation({
    mutationFn: (placeholderId: string) => ImportService.declineClaim(placeholderId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.HISTORY_CLAIMS }),
    onError: (e: MutationError) => showToast(e.message ?? translate('toast.couldNotUpdate'), 'error'),
  });
}
