/**
 * Mock Receipt Service.
 *
 * Handles receipt upload and simulated AI parsing.
 *
 * When connecting to a real backend:
 * 1. Upload file to cloud storage (e.g., S3) via POST /receipts/upload
 * 2. Trigger AI parsing via POST /receipts/:id/parse (GPT-4 Vision, AWS Textract, etc.)
 * 3. Return structured ParsedReceipt data
 *
 * The AI prompt can be sent along with the image for custom extraction instructions.
 */

import { Receipt, ParsedReceipt, ReceiptSourceType } from '../../types';
import { MOCK_PARSED_RECEIPT } from '../../constants/sampleData';
import { generateId } from '../../utils/idGenerator';
import { nowISO } from '../../utils/date';
import { mockDelay } from './mockHelpers';

// In-memory store
const receipts: Map<string, Receipt> = new Map();

const ReceiptService = {
  /**
   * Upload a receipt file and simulate AI parsing.
   *
   * @param fileUri - Local URI of the image or PDF file
   * @param sourceType - How the file was obtained
   * @param prompt - Optional natural language instructions for AI extraction
   *                 E.g., "Split drinks to John and food equally"
   *
   * Real backend integration point:
   * - POST /receipts with multipart/form-data
   * - Response includes receipt ID and initial parsing result
   */
  async parseReceipt(
    fileUri: string,
    sourceType: ReceiptSourceType,
    fileName?: string,
    mimeType?: string,
    prompt?: string,
  ): Promise<Receipt> {
    // Simulate parsing delay (AI takes time)
    await mockDelay(1500);

    const receiptId = generateId();

    // MOCK: Return simulated parsed data
    // In production, this would be the AI-extracted result
    const parsedData: ParsedReceipt = {
      ...MOCK_PARSED_RECEIPT,
      // Slightly randomize totals to simulate different receipts
      total: parseFloat((MOCK_PARSED_RECEIPT.total + Math.random() * 20).toFixed(2)),
    };

    const receipt: Receipt = {
      id: receiptId,
      sourceType,
      fileUri,
      fileName,
      mimeType,
      parsedData,
      aiPrompt: prompt,
      createdAt: nowISO(),
    };

    receipts.set(receiptId, receipt);
    return receipt;
  },

  /**
   * Get a receipt by ID.
   * Real backend: GET /receipts/:id
   */
  async getReceipt(receiptId: string): Promise<Receipt> {
    await mockDelay(300);
    const receipt = receipts.get(receiptId);
    if (!receipt) {
      return Promise.reject({ message: 'Receipt not found', statusCode: 404 });
    }
    return receipt;
  },

  /**
   * Update receipt parsed data (user edits after AI extraction).
   * Real backend: PATCH /receipts/:id
   */
  async updateReceiptData(
    receiptId: string,
    parsedData: ParsedReceipt,
    prompt?: string,
  ): Promise<Receipt> {
    await mockDelay(400);
    const existing = receipts.get(receiptId);
    if (!existing) {
      return Promise.reject({ message: 'Receipt not found', statusCode: 404 });
    }
    const updated: Receipt = { ...existing, parsedData, aiPrompt: prompt };
    receipts.set(receiptId, updated);
    return updated;
  },

  /**
   * Link a receipt to an expense after creation.
   * Real backend: PATCH /receipts/:id { expenseId }
   */
  async linkToExpense(receiptId: string, expenseId: string): Promise<void> {
    const receipt = receipts.get(receiptId);
    if (receipt) {
      receipts.set(receiptId, { ...receipt, expenseId });
    }
  },

  /**
   * Apply AI prompt instructions to re-process a receipt.
   * This simulates sending the prompt + receipt back to the AI.
   *
   * Real backend integration point:
   * - POST /receipts/:id/reparse { prompt }
   * - Triggers GPT-4V or similar with updated instructions
   */
  async applyAIPrompt(receiptId: string, prompt: string): Promise<Receipt> {
    await mockDelay(1200);
    const receipt = receipts.get(receiptId);
    if (!receipt) {
      return Promise.reject({ message: 'Receipt not found', statusCode: 404 });
    }
    // Mock: Just update the prompt and return same data
    // In production, this would re-run the AI with the new prompt
    const updated: Receipt = { ...receipt, aiPrompt: prompt };
    receipts.set(receiptId, updated);
    return updated;
  },
};

export default ReceiptService;
