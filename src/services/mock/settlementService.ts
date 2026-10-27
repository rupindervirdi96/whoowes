/**
 * Mock Settlements Service.
 *
 * Two-step flow: the payer records a payment (pending) → the recipient
 * confirms or rejects it. Only confirmed payments change balances.
 */

import { Settlement, CreateSettlementPayload, RespondSettlementPayload } from '../../types';
import { generateId } from '../../utils/idGenerator';
import { nowISO } from '../../utils/date';
import { mockDelay } from './mockHelpers';
import { db, findUser } from './db';

const SettlementService = {
  async getSettlements(userId: string): Promise<Settlement[]> {
    await mockDelay();
    return db.settlements
      .filter((s) => s.fromUserId === userId || s.toUserId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getGroupSettlements(groupId: string): Promise<Settlement[]> {
    await mockDelay();
    return db.settlements.filter((s) => s.groupId === groupId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  /** Payments waiting on the current user to confirm. */
  async getPendingSettlements(userId: string): Promise<Settlement[]> {
    await mockDelay();
    return db.settlements.filter((s) => s.toUserId === userId && s.status === 'pending');
  },

  async getSettlement(settlementId: string): Promise<Settlement> {
    await mockDelay(250);
    return (
      db.settlements.find((s) => s.id === settlementId) ??
      Promise.reject({ message: 'Payment not found', statusCode: 404 })
    );
  },

  async createSettlement(fromUserId: string, payload: CreateSettlementPayload): Promise<Settlement> {
    await mockDelay(600);
    if (fromUserId === payload.toUserId) {
      return Promise.reject({ message: "You can't pay yourself", statusCode: 400 });
    }
    const now = nowISO();
    const settlement: Settlement = {
      id: generateId(),
      fromUserId,
      toUserId: payload.toUserId,
      fromUser: findUser(fromUserId),
      toUser: findUser(payload.toUserId),
      amount: payload.amount,
      currency: payload.currency ?? 'USD',
      note: payload.note,
      status: 'pending',
      groupId: payload.groupId,
      expenseIds: payload.expenseIds,
      initiatedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    db.settlements.push(settlement);
    return settlement;
  },

  async respondToSettlement(userId: string, payload: RespondSettlementPayload): Promise<Settlement> {
    await mockDelay(500);
    const idx = db.settlements.findIndex((s) => s.id === payload.settlementId);
    if (idx === -1) return Promise.reject({ message: 'Payment not found', statusCode: 404 });
    const s = db.settlements[idx];
    if (s.toUserId !== userId) {
      return Promise.reject({ message: 'Only the person being paid can confirm this', statusCode: 403 });
    }
    if (s.status !== 'pending') {
      return Promise.reject({ message: `This payment is already ${s.status}`, statusCode: 409 });
    }
    const now = nowISO();
    db.settlements[idx] = {
      ...s,
      status: payload.action === 'confirm' ? 'confirmed' : 'rejected',
      confirmedAt: payload.action === 'confirm' ? now : undefined,
      rejectedAt: payload.action === 'reject' ? now : undefined,
      updatedAt: now,
    };
    return db.settlements[idx];
  },

  async cancelSettlement(userId: string, settlementId: string): Promise<void> {
    await mockDelay(400);
    const s = db.settlements.find((x) => x.id === settlementId);
    if (!s) return Promise.reject({ message: 'Payment not found', statusCode: 404 });
    if (s.fromUserId !== userId) return Promise.reject({ message: 'Only the sender can cancel', statusCode: 403 });
    if (s.status !== 'pending') return Promise.reject({ message: 'Only pending payments can be cancelled', statusCode: 409 });
    db.settlements = db.settlements.filter((x) => x.id !== settlementId);
  },
};

export default SettlementService;
