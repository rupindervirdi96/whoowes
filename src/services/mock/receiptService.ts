/**
 * Receipt storage. Extraction itself is done by AIService (Claude on the server,
 * or demo data offline); this service keeps the parsed result around while the
 * user reviews it and links it to the expense they create.
 */

import { Receipt, ParsedReceipt, ReceiptSourceType } from '../../types';
import { generateId } from '../../utils/idGenerator';
import { nowISO } from '../../utils/date';
import { AIService, ReceiptFile } from '../ai';
import { mockDelay } from './mockHelpers';
import { db } from './db';

const ReceiptService = {
  async scanReceipt(input: {
    file: ReceiptFile;
    fileUri: string;
    fileName?: string;
    sourceType: ReceiptSourceType;
    instructions?: string;
  }): Promise<Receipt> {
    const parsedData = await AIService.extractReceipt(input.file, input.instructions);
    const receipt: Receipt = {
      id: generateId(),
      sourceType: input.sourceType,
      fileUri: input.fileUri,
      fileName: input.fileName,
      mimeType: input.file.mimeType,
      parsedData,
      aiPrompt: input.instructions,
      createdAt: nowISO(),
    };
    db.receipts.set(receipt.id, receipt);
    return receipt;
  },

  async getReceipt(receiptId: string): Promise<Receipt> {
    await mockDelay(150);
    return db.receipts.get(receiptId) ?? Promise.reject({ message: 'Receipt not found', statusCode: 404 });
  },

  async updateReceiptData(receiptId: string, parsedData: ParsedReceipt): Promise<Receipt> {
    const existing = db.receipts.get(receiptId);
    if (!existing) return Promise.reject({ message: 'Receipt not found', statusCode: 404 });
    const updated = { ...existing, parsedData };
    db.receipts.set(receiptId, updated);
    return updated;
  },

  async linkToExpense(receiptId: string, expenseId: string): Promise<void> {
    const receipt = db.receipts.get(receiptId);
    if (receipt) db.receipts.set(receiptId, { ...receipt, expenseId });
  },
};

export default ReceiptService;
