/**
 * Settlements React Query hooks.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SettlementService } from '../services';
import { QUERY_KEYS } from '../constants';
import { CreateSettlementPayload, RespondSettlementPayload } from '../types';
import { useAuthStore } from '../store/authStore';
import { useShowToast } from '../store/uiStore';

export function useSettlements() {
  const userId = useAuthStore((s) => s.user?.id ?? '');
  return useQuery({
    queryKey: QUERY_KEYS.SETTLEMENTS,
    queryFn: () => SettlementService.getSettlements(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
  });
}

export function usePendingSettlements() {
  const userId = useAuthStore((s) => s.user?.id ?? '');
  return useQuery({
    queryKey: QUERY_KEYS.PENDING_SETTLEMENTS,
    queryFn: () => SettlementService.getPendingSettlements(userId),
    enabled: !!userId,
    // Poll every 30s to catch incoming confirmations
    refetchInterval: 1000 * 30,
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
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const showToast = useShowToast();

  return useMutation({
    mutationFn: (payload: CreateSettlementPayload) =>
      SettlementService.createSettlement(userId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SETTLEMENTS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PENDING_SETTLEMENTS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USER_BALANCES });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD_SUMMARY });
      showToast('Settlement initiated! Waiting for confirmation.', 'success');
    },
    onError: (error: { message: string }) => {
      showToast(error.message ?? 'Failed to initiate settlement', 'error');
    },
  });
}

export function useRespondToSettlement() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const showToast = useShowToast();

  return useMutation({
    mutationFn: (payload: RespondSettlementPayload) =>
      SettlementService.respondToSettlement(userId, payload),
    onSuccess: (settlement) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SETTLEMENTS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PENDING_SETTLEMENTS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USER_BALANCES });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD_SUMMARY });
      queryClient.setQueryData(
        QUERY_KEYS.SETTLEMENT(settlement.id),
        settlement,
      );
      const action = settlement.status === 'confirmed' ? 'confirmed' : 'rejected';
      showToast(
        `Settlement ${action}!`,
        settlement.status === 'confirmed' ? 'success' : 'warning',
      );
    },
    onError: (error: { message: string }) => {
      showToast(error.message ?? 'Failed to respond', 'error');
    },
  });
}

export function useCancelSettlement() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const showToast = useShowToast();

  return useMutation({
    mutationFn: (settlementId: string) =>
      SettlementService.cancelSettlement(userId, settlementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SETTLEMENTS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PENDING_SETTLEMENTS });
      showToast('Settlement cancelled', 'info');
    },
    onError: (error: { message: string }) => {
      showToast(error.message ?? 'Failed to cancel settlement', 'error');
    },
  });
}
