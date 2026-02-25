/**
 * Receipts React Query hooks.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ReceiptService } from '../services';
import { QUERY_KEYS } from '../constants';
import { ParsedReceipt, ReceiptSourceType } from '../types';
import { useShowToast } from '../store/uiStore';

export function useReceipt(receiptId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.RECEIPT(receiptId),
    queryFn: () => ReceiptService.getReceipt(receiptId),
    enabled: !!receiptId,
  });
}

interface ParseReceiptInput {
  fileUri: string;
  sourceType: ReceiptSourceType;
  fileName?: string;
  mimeType?: string;
  prompt?: string;
}

export function useParseReceipt() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();

  return useMutation({
    mutationFn: (input: ParseReceiptInput) =>
      ReceiptService.parseReceipt(
        input.fileUri,
        input.sourceType,
        input.fileName,
        input.mimeType,
        input.prompt,
      ),
    onSuccess: (receipt) => {
      queryClient.setQueryData(QUERY_KEYS.RECEIPT(receipt.id), receipt);
      showToast('Receipt parsed successfully!', 'success');
    },
    onError: (error: { message: string }) => {
      showToast(error.message ?? 'Failed to parse receipt', 'error');
    },
  });
}

interface UpdateReceiptInput {
  receiptId: string;
  parsedData: ParsedReceipt;
  prompt?: string;
}

export function useUpdateReceiptData() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();

  return useMutation({
    mutationFn: (input: UpdateReceiptInput) =>
      ReceiptService.updateReceiptData(input.receiptId, input.parsedData, input.prompt),
    onSuccess: (receipt) => {
      queryClient.setQueryData(QUERY_KEYS.RECEIPT(receipt.id), receipt);
    },
    onError: (error: { message: string }) => {
      showToast(error.message ?? 'Failed to update receipt', 'error');
    },
  });
}

interface ApplyAIPromptInput {
  receiptId: string;
  prompt: string;
}

export function useApplyAIPrompt() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();

  return useMutation({
    mutationFn: (input: ApplyAIPromptInput) =>
      ReceiptService.applyAIPrompt(input.receiptId, input.prompt),
    onSuccess: (receipt) => {
      queryClient.setQueryData(QUERY_KEYS.RECEIPT(receipt.id), receipt);
      showToast('AI instructions applied!', 'success');
    },
    onError: (error: { message: string }) => {
      showToast(error.message ?? 'Failed to apply AI instructions', 'error');
    },
  });
}
