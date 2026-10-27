/**
 * Turns database documents into the JSON shapes the app uses (see src/types in the app).
 * Amounts leave the server as decimals (cents / 100).
 */

import { db, type ExpenseDoc, type SettlementDoc } from '../db/index.js';
import { deletedUser, iso, toAmount, usersById } from './common.js';

// ─── Groups ──────────────────────────────────────────────────────────────────

export async function loadGroups(ids: string[], viewer: string) {
  if (ids.length === 0) return [];
  const [groups, totals] = await Promise.all([
    db.groups.find({ _id: { $in: ids } }).toArray(),
    db.expenses
      .aggregate<{ _id: string; total: number; last: Date | null }>([
        { $match: { groupId: { $in: ids } } },
        { $group: { _id: '$groupId', total: { $sum: '$amountCents' }, last: { $max: '$date' } } },
      ])
      .toArray(),
  ]);
  const users = await usersById(
    groups.flatMap((g) => g.members.map((m) => m.userId)),
    viewer,
  );
  return groups.map((g) => {
    const t = totals.find((x) => x._id === g._id);
    const last = t?.last && t.last > g.updatedAt ? t.last : g.updatedAt;
    return {
      id: g._id,
      name: g.name,
      description: g.description ?? undefined,
      createdBy: g.createdBy,
      createdAt: iso(g.createdAt)!,
      updatedAt: iso(last)!,
      totalExpenses: toAmount(t?.total ?? 0),
      members: [...g.members]
        .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())
        .map((m) => ({ userId: m.userId, user: users.get(m.userId) ?? deletedUser(m.userId), role: m.role, joinedAt: iso(m.joinedAt)! })),
    };
  });
}

// ─── Expenses ────────────────────────────────────────────────────────────────

export async function serializeExpenses(docs: ExpenseDoc[], viewer: string) {
  if (docs.length === 0) return [];
  const users = await usersById(
    docs.flatMap((e) => [e.paidBy, ...e.splits.map((s) => s.userId)]),
    viewer,
  );
  const user = (id: string) => users.get(id) ?? deletedUser(id);
  return docs.map((e) => ({
    id: e._id,
    groupId: e.groupId,
    title: e.title,
    description: e.description ?? undefined,
    amount: toAmount(e.amountCents),
    currency: e.currency,
    category: e.category,
    paidBy: e.paidBy,
    paidByUser: user(e.paidBy),
    splitType: e.splitType,
    splits: e.splits.map((s) => ({
      userId: s.userId,
      user: user(s.userId),
      amount: toAmount(s.amountCents),
      percentage: s.percentage ?? undefined,
      paid: s.paid,
    })),
    items: e.items ?? undefined,
    receiptId: e.receiptId ?? undefined,
    date: iso(e.date)!,
    createdBy: e.createdBy,
    createdAt: iso(e.createdAt)!,
    updatedAt: iso(e.updatedAt)!,
  }));
}

// ─── Settlements ─────────────────────────────────────────────────────────────

export async function serializeSettlements(docs: SettlementDoc[], viewer: string) {
  const users = await usersById(
    docs.flatMap((s) => [s.fromUserId, s.toUserId]),
    viewer,
  );
  const user = (id: string) => users.get(id) ?? deletedUser(id);
  return docs.map((s) => ({
    id: s._id,
    fromUserId: s.fromUserId,
    toUserId: s.toUserId,
    fromUser: user(s.fromUserId),
    toUser: user(s.toUserId),
    amount: toAmount(s.amountCents),
    currency: s.currency,
    note: s.note ?? undefined,
    status: s.status,
    groupId: s.groupId ?? undefined,
    expenseIds: s.expenseIds ?? undefined,
    initiatedAt: iso(s.initiatedAt)!,
    confirmedAt: iso(s.confirmedAt),
    rejectedAt: iso(s.rejectedAt),
    createdAt: iso(s.createdAt)!,
    updatedAt: iso(s.updatedAt)!,
  }));
}
