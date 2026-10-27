import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ReceiptService } from '../services';
import type { ReceiptFile } from '../services';
import { QUERY_KEYS } from '../constants';
import { ParsedReceipt, ReceiptSourceType } from '../types';
import { useShowToast } from '../store/uiStore';
import { useHandlePaywallError } from './useBilling';
import type { MutationError } from './queryUtils';

export function useReceipt(receiptId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.RECEIPT(receiptId),
    queryFn: () => ReceiptService.getReceipt(receiptId),
    enabled: !!receiptId,
    staleTime: Infinity,
  });
}

export function useScanReceipt() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();
  const handlePaywall = useHandlePaywallError();
  return useMutation({
    mutationFn: (input: {
      file: ReceiptFile;
      fileUri: string;
      fileName?: string;
      sourceType: ReceiptSourceType;
      instructions?: string;
    }) => ReceiptService.scanReceipt(input),
    onSuccess: (receipt) => {
      queryClient.setQueryData(QUERY_KEYS.RECEIPT(receipt.id), receipt);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SUBSCRIPTION }); // scan count changed
    },
    onError: (e: MutationError) => {
      if (!handlePaywall(e)) showToast(e.message ?? "Couldn't read that receipt", 'error');
    },
  });
}

export function useUpdateReceiptData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ receiptId, parsedData }: { receiptId: string; parsedData: ParsedReceipt }) =>
      ReceiptService.updateReceiptData(receiptId, parsedData),
    onSuccess: (receipt) => queryClient.setQueryData(QUERY_KEYS.RECEIPT(receipt.id), receipt),
  });
}
