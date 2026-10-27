import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SettlementService } from '../services';
import { QUERY_KEYS } from '../constants';
import { CreateSettlementPayload, RespondSettlementPayload } from '../types';
import { useAuthStore } from '../store/authStore';
import { useShowToast } from '../store/uiStore';
import { invalidateMoney, MutationError } from './queryUtils';

const useUserId = () => useAuthStore((s) => s.user?.id ?? '');

export function useSettlements() {
  const userId = useUserId();
  return useQuery({
    queryKey: QUERY_KEYS.SETTLEMENTS,
    queryFn: () => SettlementService.getSettlements(userId),
    enabled: !!userId,
  });
}

/** Every payment inside a group (members only), for the group's balances. */
export function useGroupSettlements(groupId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.GROUP_SETTLEMENTS(groupId),
    queryFn: () => SettlementService.getGroupSettlements(groupId),
    enabled: !!groupId,
  });
}

/** Payments waiting for me to confirm — polled so the badge stays fresh. */
export function usePendingSettlements() {
  const userId = useUserId();
  return useQuery({
    queryKey: QUERY_KEYS.PENDING_SETTLEMENTS,
    queryFn: () => SettlementService.getPendingSettlements(userId),
    enabled: !!userId,
    refetchInterval: 30_000,
  });
}

export function useSettlement(settlementId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.SETTLEMENT(settlementId),
    queryFn: () => SettlementService.getSettlement(settlementId),
    enabled: !!settlementId,
  });
}

export function useCreateSettlement() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const showToast = useShowToast();
  return useMutation({
    mutationFn: (payload: CreateSettlementPayload) => SettlementService.createSettlement(userId, payload),
    onSuccess: (s) => {
      invalidateMoney(queryClient);
      showToast(`Payment recorded — ${s.toUser.name.split(' ')[0]} will confirm it`, 'success');
    },
    onError: (e: MutationError) => showToast(e.message ?? 'Could not record payment', 'error'),
  });
}

export function useRespondToSettlement() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const showToast = useShowToast();
  return useMutation({
    mutationFn: (payload: RespondSettlementPayload) => SettlementService.respondToSettlement(userId, payload),
    onSuccess: (s) => {
      queryClient.setQueryData(QUERY_KEYS.SETTLEMENT(s.id), s);
      invalidateMoney(queryClient);
      showToast(s.status === 'confirmed' ? 'Payment confirmed ✓' : 'Payment declined', s.status === 'confirmed' ? 'success' : 'warning');
    },
    onError: (e: MutationError) => showToast(e.message ?? 'Could not respond', 'error'),
  });
}

export function useCancelSettlement() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const showToast = useShowToast();
  return useMutation({
    mutationFn: (settlementId: string) => SettlementService.cancelSettlement(userId, settlementId),
    onSuccess: () => {
      invalidateMoney(queryClient);
      showToast('Payment cancelled', 'info');
    },
    onError: (e: MutationError) => showToast(e.message ?? 'Could not cancel', 'error'),
  });
}
