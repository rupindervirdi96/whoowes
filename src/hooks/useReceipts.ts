import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ReceiptService } from '../services';
import type { ReceiptFile } from '../services';
import { QUERY_KEYS } from '../constants';
import { ParsedReceipt, ReceiptSourceType } from '../types';
import { useShowToast } from '../store/uiStore';
import { isAdCancelled, runWithPass } from './useAIPass';
import type { MutationError } from './queryUtils';
import { translate } from '../i18n';

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
  return useMutation({
    mutationFn: (input: {
      file: ReceiptFile;
      fileUri: string;
      fileName?: string;
      sourceType: ReceiptSourceType;
      instructions?: string;
    }) => runWithPass(queryClient, 'receipt_scan', () => ReceiptService.scanReceipt(input)),
    onSuccess: (receipt) => {
      queryClient.setQueryData(QUERY_KEYS.RECEIPT(receipt.id), receipt);
    },
    onError: (e: MutationError) => {
      if (!isAdCancelled(e)) showToast(e.message ?? translate('toast.couldNotReadReceipt'), 'error');
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
