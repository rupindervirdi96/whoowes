/**
 * Mock Settlements Service.
 *
 * Handles the two-way settlement confirmation flow:
 * 1. User A initiates payment → status: 'pending'
 * 2. User B confirms → status: 'confirmed', balances update
 * 2b. User B rejects → status: 'rejected'
 *
 * Real backend endpoints:
 * GET /settlements, POST /settlements, PATCH /settlements/:id/confirm, etc.
 */

import {
  Settlement,
  CreateSettlementPayload,
  RespondSettlementPayload,
  User,
} from '../../types';
import { MOCK_SETTLEMENTS, MOCK_USERS } from '../../constants/sampleData';
import { generateId } from '../../utils/idGenerator';
import { nowISO } from '../../utils/date';
import { mockDelay } from './mockHelpers';

let settlements: Settlement[] = [...MOCK_SETTLEMENTS];
const users: User[] = [...MOCK_USERS];

const SettlementService = {
  /**
   * Get all settlements for the current user.
   * Includes both sent and received.
   * Real backend: GET /settlements
   */
  async getSettlements(userId: string): Promise<Settlement[]> {
    await mockDelay();
    return settlements
      .filter((s) => s.fromUserId === userId || s.toUserId === userId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  },

  /**
   * Get pending settlements that require action from the current user.
   * (i.e., settlements where current user is the receiver and status is pending)
   * Real backend: GET /settlements?status=pending&role=receiver
   */
  async getPendingSettlements(userId: string): Promise<Settlement[]> {
    await mockDelay();
    return settlements.filter(
      (s) => s.toUserId === userId && s.status === 'pending',
    );
  },

  /**
   * Get a single settlement by ID.
   * Real backend: GET /settlements/:id
   */
  async getSettlement(settlementId: string): Promise<Settlement> {
    await mockDelay();
    const settlement = settlements.find((s) => s.id === settlementId);
    if (!settlement) {
      return Promise.reject({ message: 'Settlement not found', statusCode: 404 });
    }
    return settlement;
  },

  /**
   * Initiate a new settlement (User A pays User B).
   * Real backend: POST /settlements
   */
  async createSettlement(
    fromUserId: string,
    payload: CreateSettlementPayload,
  ): Promise<Settlement> {
    await mockDelay(600);

    const fromUser = users.find((u) => u.id === fromUserId);
    const toUser = users.find((u) => u.id === payload.toUserId);

    if (!fromUser)
      return Promise.reject({ message: 'Sender not found', statusCode: 404 });
    if (!toUser)
      return Promise.reject({ message: 'Recipient not found', statusCode: 404 });
    if (fromUserId === payload.toUserId)
      return Promise.reject({ message: "Can't settle with yourself", statusCode: 400 });

    const newSettlement: Settlement = {
      id: generateId(),
      fromUserId,
      toUserId: payload.toUserId,
      fromUser,
      toUser,
      amount: payload.amount,
      currency: payload.currency ?? 'USD',
      note: payload.note,
      status: 'pending',
      groupId: payload.groupId,
      expenseIds: payload.expenseIds,
      initiatedAt: nowISO(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };

    settlements.push(newSettlement);
    return newSettlement;
  },

  /**
   * Respond to a pending settlement (confirm or reject).
   * Only the recipient (toUser) can confirm or reject.
   * Real backend: PATCH /settlements/:id { action: 'confirm' | 'reject' }
   */
  async respondToSettlement(
    userId: string,
    payload: RespondSettlementPayload,
  ): Promise<Settlement> {
    await mockDelay(500);

    const idx = settlements.findIndex((s) => s.id === payload.settlementId);
    if (idx === -1)
      return Promise.reject({ message: 'Settlement not found', statusCode: 404 });

    const settlement = settlements[idx];

    if (settlement.toUserId !== userId) {
      return Promise.reject({
        message: 'Only the recipient can confirm or reject this settlement',
        statusCode: 403,
      });
    }

    if (settlement.status !== 'pending') {
      return Promise.reject({
        message: `Settlement is already ${settlement.status}`,
        statusCode: 409,
      });
    }

    const now = nowISO();
    const updated: Settlement = {
      ...settlement,
      status: payload.action === 'confirm' ? 'confirmed' : 'rejected',
      confirmedAt: payload.action === 'confirm' ? now : undefined,
      rejectedAt: payload.action === 'reject' ? now : undefined,
      updatedAt: now,
    };

    settlements[idx] = updated;
    return updated;
  },

  /**
   * Cancel a pending settlement (only initiator can cancel).
   * Real backend: DELETE /settlements/:id
   */
  async cancelSettlement(userId: string, settlementId: string): Promise<void> {
    await mockDelay(400);
    const settlement = settlements.find((s) => s.id === settlementId);
    if (!settlement)
      return Promise.reject({ message: 'Settlement not found', statusCode: 404 });
    if (settlement.fromUserId !== userId)
      return Promise.reject({ message: 'Only the initiator can cancel', statusCode: 403 });
    if (settlement.status !== 'pending')
      return Promise.reject({ message: 'Can only cancel pending settlements', statusCode: 409 });
    settlements = settlements.filter((s) => s.id !== settlementId);
  },
};

export default SettlementService;
