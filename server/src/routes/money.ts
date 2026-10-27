/**
 * Groups, expenses, payments and receipts.
 *
 *   GET    /groups                          my groups
 *   GET    /groups/:id                      (members only)
 *   POST   /groups                          { name, description?, memberIds[] }  (members must be my friends)
 *   POST   /groups/:id/members              { userId }   (any member can add their friends)
 *   DELETE /groups/:id/members/:userId      (admins remove anyone; anyone can leave)
 *   DELETE /groups/:id                      (admins only; expenses stay, unlinked)
 *
 *   GET    /expenses?groupId=               mine (payer or in the split); with groupId, every expense in that group
 *   GET    /expenses/:id
 *   POST   /expenses                        validated: participants, split totals, group membership
 *   DELETE /expenses/:id                    (creator or payer)
 *   POST   /expenses/:id/splits/:userId/paid   (payer, or that person)
 *
 *   GET    /settlements?groupId=            mine; with groupId, every payment in that group
 *   GET    /settlements/pending             waiting for me to confirm
 *   GET    /settlements/:id
 *   POST   /settlements                     { toUserId, amount, currency?, note?, groupId? }
 *   POST   /settlements/:id/respond         { action: confirm | reject }  (recipient only)
 *   DELETE /settlements/:id                 (sender, while pending)
 *
 *   GET    /receipts/:id                    (owner)
 *   PATCH  /receipts/:id                    { parsedData }  (owner)
 */

import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../auth.js';
import { db, type ExpenseDoc, type ReceiptDoc, type SettlementDoc } from '../db/index.js';
import { areFriends, canTransactWith, fail, isGroupMember, iso, myGroupIds, route, toCents } from '../domain/common.js';
import { loadGroups, serializeExpenses, serializeSettlements } from '../domain/serialize.js';

export const moneyRouter = Router();
moneyRouter.use(requireUser);

const CATEGORIES = ['food', 'transport', 'accommodation', 'entertainment', 'utilities', 'shopping', 'health', 'other'] as const;
const currency = z.string().regex(/^[A-Z]{3}$/).default('USD');
const money = z.number().positive().max(10_000_000);

async function requireMember(groupId: string, userId: string) {
  if (!(await isGroupMember(groupId, userId))) fail(404, 'Group not found.');
}

async function myRole(groupId: string, userId: string) {
  const g = await db.groups.findOne({ _id: groupId, 'members.userId': userId }, { projection: { members: 1 } });
  return g?.members.find((m) => m.userId === userId)?.role;
}

const touchGroup = (groupId: string) => db.groups.updateOne({ _id: groupId }, { $set: { updatedAt: new Date() } });

// ─── Groups ──────────────────────────────────────────────────────────────────

moneyRouter.get(
  '/groups',
  route(async (req, res) => {
    const me = req.user!.id;
    const groups = await loadGroups(await myGroupIds(me), me);
    res.json(groups.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }),
);

moneyRouter.get(
  '/groups/:id',
  route(async (req, res) => {
    await requireMember(String(req.params.id), req.user!.id);
    res.json((await loadGroups([String(req.params.id)], req.user!.id))[0]);
  }),
);

moneyRouter.post(
  '/groups',
  route(async (req, res) => {
    const me = req.user!.id;
    const body = z
      .object({ name: z.string().trim().min(1).max(60), description: z.string().trim().max(200).optional(), memberIds: z.array(z.string()).max(100) })
      .parse(req.body);
    const memberIds = [...new Set(body.memberIds.filter((id) => id !== me))];
    for (const id of memberIds) if (!(await areFriends(me, id))) fail(403, 'You can only add friends to a group.');
    const id = randomUUID();
    const now = new Date();
    await db.groups.insertOne({
      _id: id,
      name: body.name,
      description: body.description || null,
      createdBy: me,
      members: [{ userId: me, role: 'admin', joinedAt: now }, ...memberIds.map((uid) => ({ userId: uid, role: 'member' as const, joinedAt: now }))],
      createdAt: now,
      updatedAt: now,
    });
    res.status(201).json((await loadGroups([id], me))[0]);
  }),
);

moneyRouter.post(
  '/groups/:id/members',
  route(async (req, res) => {
    const me = req.user!.id;
    const groupId = String(req.params.id);
    const { userId } = z.object({ userId: z.string() }).parse(req.body);
    await requireMember(groupId, me);
    if (!(await areFriends(me, userId))) fail(403, 'You can only add your friends.');
    // Only adds when they aren't already in it, so two quick taps can't add them twice.
    const added = await db.groups.updateOne(
      { _id: groupId, 'members.userId': { $ne: userId } },
      { $push: { members: { userId, role: 'member', joinedAt: new Date() } }, $set: { updatedAt: new Date() } },
    );
    if (added.modifiedCount === 0) fail(409, 'Already in this group.');
    res.json((await loadGroups([groupId], me))[0]);
  }),
);

moneyRouter.delete(
  '/groups/:id/members/:userId',
  route(async (req, res) => {
    const me = req.user!.id;
    const groupId = String(req.params.id);
    const target = String(req.params.userId);
    const role = await myRole(groupId, me);
    if (!role) fail(404, 'Group not found.');
    if (target !== me && role !== 'admin') fail(403, 'Only group admins can remove people.');
    await db.groups.updateOne({ _id: groupId }, { $pull: { members: { userId: target } }, $set: { updatedAt: new Date() } });
    const left = await loadGroups([groupId], me);
    res.json(left[0] ?? null);
  }),
);

moneyRouter.delete(
  '/groups/:id',
  route(async (req, res) => {
    const me = req.user!.id;
    const groupId = String(req.params.id);
    const role = await myRole(groupId, me);
    if (!role) fail(404, 'Group not found.');
    if (role !== 'admin') fail(403, 'Only group admins can delete the group.');
    await db.groups.deleteOne({ _id: groupId });
    // Expenses and payments keep their history, just without the group.
    await db.expenses.updateMany({ groupId }, { $set: { groupId: null } });
    await db.settlements.updateMany({ groupId }, { $set: { groupId: null } });
    res.status(204).end();
  }),
);

// ─── Expenses ────────────────────────────────────────────────────────────────

/** I can see an expense if I paid, I'm in the split, or it's in one of my groups. */
async function getVisibleExpense(id: string, me: string) {
  const e = await db.expenses.findOne({ _id: id });
  if (!e) fail(404, 'Expense not found.');
  if (e.participants.includes(me)) return e;
  if (e.groupId && (await isGroupMember(e.groupId, me))) return e;
  fail(404, 'Expense not found.');
}

moneyRouter.get(
  '/expenses',
  route(async (req, res) => {
    const me = req.user!.id;
    const groupId = typeof req.query.groupId === 'string' ? req.query.groupId : undefined;
    let rows: ExpenseDoc[];
    if (groupId) {
      await requireMember(groupId, me);
      rows = await db.expenses.find({ groupId }).sort({ date: -1 }).toArray();
    } else {
      rows = await db.expenses.find({ participants: me }).sort({ date: -1 }).toArray();
    }
    res.json(await serializeExpenses(rows, me));
  }),
);

moneyRouter.get(
  '/expenses/:id',
  route(async (req, res) => {
    const me = req.user!.id;
    res.json((await serializeExpenses([await getVisibleExpense(String(req.params.id), me)], me))[0]);
  }),
);

moneyRouter.post(
  '/expenses',
  route(async (req, res) => {
    const me = req.user!.id;
    const body = z
      .object({
        groupId: z.string().optional(),
        title: z.string().trim().min(1).max(120),
        description: z.string().trim().max(1000).optional(),
        amount: money,
        currency,
        category: z.enum(CATEGORIES),
        paidBy: z.string(),
        splitType: z.enum(['equal', 'custom', 'percentage', 'item_based']),
        splits: z.array(z.object({ userId: z.string(), amount: z.number().min(0), percentage: z.number().min(0).max(100).optional() })).min(1).max(100),
        items: z
          .array(z.object({ name: z.string().max(200), price: z.number(), quantity: z.number().int().min(1), assignedTo: z.array(z.string()) }))
          .max(300)
          .optional(),
        receiptId: z.string().optional(),
        date: z.string().datetime({ offset: true }).optional(),
      })
      .parse(req.body);

    // Everyone involved, once each.
    const splitIds = body.splits.map((s) => s.userId);
    if (new Set(splitIds).size !== splitIds.length) fail(400, 'Each person can only appear once in the split.');
    const people = new Set([body.paidBy, ...splitIds]);
    if (!people.has(me)) fail(403, 'You can only add expenses you are part of.');

    if (body.groupId) {
      await requireMember(body.groupId, me);
      for (const id of people) if (!(await isGroupMember(body.groupId, id))) fail(400, 'Everyone in the split must be in the group.');
    } else {
      for (const id of people) if (!(await canTransactWith(me, id))) fail(403, 'You can only split with friends or people in your groups.');
    }

    // Split amounts must add up to the total, to the cent.
    const total = toCents(body.amount);
    const shares = body.splits.map((s) => ({ ...s, cents: toCents(s.amount) }));
    const diff = total - shares.reduce((sum, s) => sum + s.cents, 0);
    if (Math.abs(diff) > shares.length) fail(400, 'The split amounts don’t add up to the total.', 'split_mismatch');
    if (diff !== 0) [...shares].sort((a, b) => b.cents - a.cents)[0].cents += diff; // absorb float rounding

    if (body.receiptId && !(await db.receipts.findOne({ _id: body.receiptId, userId: me }, { projection: { _id: 1 } }))) {
      fail(400, 'Receipt not found.');
    }

    const now = new Date();
    const expense: ExpenseDoc = {
      _id: randomUUID(),
      groupId: body.groupId ?? null,
      title: body.title,
      description: body.description ?? null,
      amountCents: total,
      currency: body.currency,
      category: body.category,
      paidBy: body.paidBy,
      splitType: body.splitType,
      splits: shares.map((s) => ({ userId: s.userId, amountCents: s.cents, percentage: s.percentage ?? null, paid: s.userId === body.paidBy })),
      participants: [...people],
      items: body.items ? body.items.map((it) => ({ ...it, id: randomUUID() })) : null,
      receiptId: body.receiptId ?? null,
      date: body.date ? new Date(body.date) : now,
      createdBy: me,
      createdAt: now,
      updatedAt: now,
    };
    await db.expenses.insertOne(expense);
    if (body.receiptId) await db.receipts.updateOne({ _id: body.receiptId }, { $set: { expenseId: expense._id } });
    if (body.groupId) await touchGroup(body.groupId);
    res.status(201).json((await serializeExpenses([expense], me))[0]);
  }),
);

moneyRouter.delete(
  '/expenses/:id',
  route(async (req, res) => {
    const me = req.user!.id;
    const e = await getVisibleExpense(String(req.params.id), me);
    if (e.createdBy !== me && e.paidBy !== me) fail(403, 'Only the person who added or paid for this can delete it.');
    await db.expenses.deleteOne({ _id: e._id });
    res.status(204).end();
  }),
);

moneyRouter.post(
  '/expenses/:id/splits/:userId/paid',
  route(async (req, res) => {
    const me = req.user!.id;
    const e = await getVisibleExpense(String(req.params.id), me);
    const target = String(req.params.userId);
    if (me !== e.paidBy && me !== target) fail(403, 'Only the payer or that person can mark this paid.');
    const updated = await db.expenses.findOneAndUpdate(
      { _id: e._id },
      { $set: { 'splits.$[s].paid': true, updatedAt: new Date() } },
      { arrayFilters: [{ 's.userId': target }], returnDocument: 'after' },
    );
    res.json((await serializeExpenses([updated!], me))[0]);
  }),
);

// ─── Settlements ─────────────────────────────────────────────────────────────

const sentOrReceived = (me: string) => ({ $or: [{ fromUserId: me }, { toUserId: me }] });

moneyRouter.get(
  '/settlements',
  route(async (req, res) => {
    const me = req.user!.id;
    const groupId = typeof req.query.groupId === 'string' ? req.query.groupId : undefined;
    let rows: SettlementDoc[];
    if (groupId) {
      await requireMember(groupId, me);
      rows = await db.settlements.find({ groupId }).sort({ createdAt: -1 }).toArray();
    } else {
      rows = await db.settlements.find(sentOrReceived(me)).sort({ createdAt: -1 }).toArray();
    }
    res.json(await serializeSettlements(rows, me));
  }),
);

moneyRouter.get(
  '/settlements/pending',
  route(async (req, res) => {
    const me = req.user!.id;
    const rows = await db.settlements.find({ toUserId: me, status: 'pending' }).sort({ createdAt: -1 }).toArray();
    res.json(await serializeSettlements(rows, me));
  }),
);

async function getMySettlement(id: string, me: string) {
  const row = await db.settlements.findOne({ _id: id, ...sentOrReceived(me) });
  if (!row) fail(404, 'Payment not found.');
  return row;
}

moneyRouter.get(
  '/settlements/:id',
  route(async (req, res) => {
    const me = req.user!.id;
    res.json((await serializeSettlements([await getMySettlement(String(req.params.id), me)], me))[0]);
  }),
);

moneyRouter.post(
  '/settlements',
  route(async (req, res) => {
    const me = req.user!.id;
    const body = z
      .object({
        toUserId: z.string(),
        amount: money,
        currency,
        note: z.string().trim().max(200).optional(),
        groupId: z.string().optional(),
        expenseIds: z.array(z.string()).max(200).optional(),
      })
      .parse(req.body);
    if (body.toUserId === me) fail(400, "You can't pay yourself.");
    if (body.groupId) {
      await requireMember(body.groupId, me);
      if (!(await isGroupMember(body.groupId, body.toUserId))) fail(400, 'They are not in this group.');
    } else if (!(await canTransactWith(me, body.toUserId))) {
      fail(403, 'You can only pay friends or people in your groups.');
    }
    const now = new Date();
    const doc: SettlementDoc = {
      _id: randomUUID(),
      fromUserId: me,
      toUserId: body.toUserId,
      amountCents: toCents(body.amount),
      currency: body.currency,
      note: body.note || null,
      status: 'pending',
      groupId: body.groupId ?? null,
      expenseIds: body.expenseIds ?? null,
      initiatedAt: now,
      confirmedAt: null,
      rejectedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.settlements.insertOne(doc);
    res.status(201).json((await serializeSettlements([doc], me))[0]);
  }),
);

moneyRouter.post(
  '/settlements/:id/respond',
  route(async (req, res) => {
    const me = req.user!.id;
    const { action } = z.object({ action: z.enum(['confirm', 'reject']) }).parse(req.body);
    const s = await getMySettlement(String(req.params.id), me);
    if (s.toUserId !== me) fail(403, 'Only the person being paid can confirm this.');
    if (s.status !== 'pending') fail(409, `This payment is already ${s.status}.`);
    const now = new Date();
    const confirmed = action === 'confirm';
    const row = await db.settlements.findOneAndUpdate(
      { _id: s._id, status: 'pending' },
      {
        $set: {
          status: confirmed ? 'confirmed' : 'rejected',
          confirmedAt: confirmed ? now : null,
          rejectedAt: confirmed ? null : now,
          updatedAt: now,
        },
      },
      { returnDocument: 'after' },
    );
    if (!row) fail(409, 'This payment was already answered.');
    if (confirmed) {
      // They've been paid: clear their reminders to the payer.
      await db.reminders.updateMany({ fromUserId: s.toUserId, toUserId: s.fromUserId, dismissedAt: null }, { $set: { dismissedAt: now } });
    }
    res.json((await serializeSettlements([row], me))[0]);
  }),
);

moneyRouter.delete(
  '/settlements/:id',
  route(async (req, res) => {
    const me = req.user!.id;
    const s = await getMySettlement(String(req.params.id), me);
    if (s.fromUserId !== me) fail(403, 'Only the sender can cancel.');
    if (s.status !== 'pending') fail(409, 'Only pending payments can be cancelled.');
    await db.settlements.deleteOne({ _id: s._id, status: 'pending' });
    res.status(204).end();
  }),
);

// ─── Receipts ────────────────────────────────────────────────────────────────

const serializeReceipt = (r: ReceiptDoc) => ({
  id: r._id,
  sourceType: r.sourceType,
  fileUri: '',
  fileName: r.fileName ?? undefined,
  mimeType: r.mimeType ?? undefined,
  parsedData: r.parsedData,
  aiPrompt: r.aiPrompt ?? undefined,
  expenseId: r.expenseId ?? undefined,
  createdAt: iso(r.createdAt)!,
});

moneyRouter.get(
  '/receipts/:id',
  route(async (req, res) => {
    const r = await db.receipts.findOne({ _id: String(req.params.id), userId: req.user!.id });
    if (!r) fail(404, 'Receipt not found.');
    res.json(serializeReceipt(r));
  }),
);

moneyRouter.patch(
  '/receipts/:id',
  route(async (req, res) => {
    const { parsedData } = z.object({ parsedData: z.record(z.string(), z.unknown()) }).parse(req.body);
    const r = await db.receipts.findOneAndUpdate(
      { _id: String(req.params.id), userId: req.user!.id },
      { $set: { parsedData } },
      { returnDocument: 'after' },
    );
    if (!r) fail(404, 'Receipt not found.');
    res.json(serializeReceipt(r));
  }),
);
