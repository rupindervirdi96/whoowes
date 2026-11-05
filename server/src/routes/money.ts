/**
 * Groups, expenses, payments and receipts.
 *
 *   GET    /groups                          my groups
 *   GET    /groups/:id                      (members only)
 *   POST   /groups                          { name, description?, memberIds[], currency? }  (members must be my friends)
 *   PATCH  /groups/:id                      { name?, description?, currency? }  (any member)
 *   POST   /groups/:id/members              { userId }   (any member can add their friends)
 *   DELETE /groups/:id/members/:userId      (admins remove anyone; anyone can leave; the others are told)
 *   DELETE /groups/:id                      (admins only; expenses stay, unlinked)
 *
 *   GET    /expenses?groupId=               mine (payer or in the split); with groupId, every expense in that group
 *   GET    /expenses/:id
 *   POST   /expenses                        validated: participants, split totals, group membership
 *   PATCH  /expenses/:id                    same body; (creator or payer); everyone on it is told
 *   DELETE /expenses/:id                    (creator or payer)
 *   POST   /expenses/:id/splits/:userId/paid   (payer, or that person)
 *
 *   GET    /settlements?groupId=            mine; with groupId, every payment in that group
 *   GET    /settlements/pending             waiting for me to confirm
 *   GET    /settlements/:id
 *   POST   /settlements                     { toUserId, amount, currency?, note?, groupId?, fromUserId? }
 *                                            With someone not on WhoOwes yet it counts at once; fromUserId
 *                                            records that they paid me.
 *
 * Amounts are kept per currency and never converted: an expense or payment
 * without a currency uses the group's currency, then the user's, then USD.
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
import { db, type ExpenseChange, type ExpenseDoc, type ReceiptDoc, type SettlementDoc } from '../db/index.js';
import {
  areFriends,
  canSettleWith,
  canTransactWith,
  fail,
  getVisibleExpense,
  isGroupMember,
  isPlaceholder,
  iso,
  mainBalance,
  myGroupIds,
  pairNet,
  route,
  toCents,
} from '../domain/common.js';
import { loadGroups, serializeExpenses, serializeSettlements } from '../domain/serialize.js';
import { FALLBACK_CURRENCY, currencyCode } from '../currency.js';
import { nameOf, notify, type PushItem } from '../push.js';

export const moneyRouter = Router();
moneyRouter.use(requireUser);

const CATEGORIES = ['food', 'transport', 'accommodation', 'entertainment', 'utilities', 'shopping', 'health', 'other'] as const;
const money = z.number().positive().max(10_000_000);

/** The user's preferred currency. */
async function userCurrency(userId: string) {
  const u = await db.users.findOne({ _id: userId }, { projection: { currency: 1 } });
  return u?.currency ?? FALLBACK_CURRENCY;
}

/** Currency for a new expense or payment that didn't name one. */
async function defaultCurrency(userId: string, groupId?: string) {
  if (groupId) {
    const g = await db.groups.findOne({ _id: groupId }, { projection: { currency: 1 } });
    if (g?.currency) return g.currency;
  }
  return userCurrency(userId);
}

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
      .object({
        name: z.string().trim().min(1).max(60),
        description: z.string().trim().max(200).optional(),
        memberIds: z.array(z.string()).max(100),
        currency: currencyCode.optional(),
      })
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
      currency: body.currency ?? (await userCurrency(me)),
      createdAt: now,
      updatedAt: now,
    });
    if (memberIds.length) {
      const name = await nameOf(me);
      notify(
        memberIds.map((userId) => ({
          userId,
          kind: 'added_to_group' as const,
          params: { name, group: body.name },
          data: { type: 'added_to_group' as const, groupId: id },
        })),
      );
    }
    res.status(201).json((await loadGroups([id], me))[0]);
  }),
);

moneyRouter.patch(
  '/groups/:id',
  route(async (req, res) => {
    const me = req.user!.id;
    const groupId = String(req.params.id);
    const body = z
      .object({
        name: z.string().trim().min(1).max(60).optional(),
        description: z.string().trim().max(200).optional(),
        currency: currencyCode.optional(),
      })
      .parse(req.body);
    await requireMember(groupId, me);
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) set.name = body.name;
    if (body.description !== undefined) set.description = body.description || null;
    if (body.currency !== undefined) set.currency = body.currency; // only affects new expenses
    await db.groups.updateOne({ _id: groupId }, { $set: set });
    res.json((await loadGroups([groupId], me))[0]);
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
    const group = await db.groups.findOne({ _id: groupId }, { projection: { name: 1 } });
    notify([
      {
        userId,
        kind: 'added_to_group',
        params: { name: await nameOf(me), group: group?.name ?? '' },
        data: { type: 'added_to_group', groupId },
      },
    ]);
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
    const pulled = await db.groups.findOneAndUpdate(
      { _id: groupId, 'members.userId': target },
      { $pull: { members: { userId: target } }, $set: { updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (!pulled) fail(404, 'They are not in this group.');

    // Nobody left: the group goes, its history stays.
    if (pulled.members.length === 0) {
      await db.groups.deleteOne({ _id: groupId });
      await db.expenses.updateMany({ groupId }, { $set: { groupId: null } });
      await db.settlements.updateMany({ groupId }, { $set: { groupId: null } });
      return res.json(null);
    }
    // The last admin left: the longest-standing member takes over.
    if (!pulled.members.some((m) => m.role === 'admin')) {
      const next = [...pulled.members].sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())[0];
      await db.groups.updateOne({ _id: groupId, 'members.userId': next.userId }, { $set: { 'members.$.role': 'admin' } });
    }

    if (target === me) {
      // Tell everyone still in it, with what's still open between them and the person who left.
      const name = await nameOf(me);
      const items = await Promise.all(
        pulled.members.map(async (m) => {
          const open = mainBalance(await pairNet(m.userId, me, groupId));
          return {
            userId: m.userId,
            kind: 'member_left' as const,
            params: {
              name,
              group: pulled.name,
              ...(open ? { cents: Math.abs(open.cents), currency: open.currency, dir: open.cents > 0 ? ('owesYou' as const) : ('youOwe' as const) } : {}),
            },
            data: { type: 'member_left' as const, groupId, userId: me },
          };
        }),
      );
      notify(items);
    } else {
      notify([
        {
          userId: target,
          kind: 'removed_from_group',
          params: { name: await nameOf(me), group: pulled.name },
          data: { type: 'removed_from_group', groupId },
        },
      ]);
    }
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
    const group = await db.groups.findOneAndDelete({ _id: groupId });
    // Expenses and payments keep their history, just without the group.
    await db.expenses.updateMany({ groupId }, { $set: { groupId: null } });
    await db.settlements.updateMany({ groupId }, { $set: { groupId: null } });
    if (group) {
      const name = await nameOf(me);
      notify(
        group.members
          .filter((m) => m.userId !== me)
          .map((m) => ({
            userId: m.userId,
            kind: 'group_deleted' as const,
            params: { name, group: group.name },
            data: { type: 'group_deleted' as const, groupId },
          })),
      );
    }
    res.status(204).end();
  }),
);

// ─── Expenses ────────────────────────────────────────────────────────────────

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

const expenseBody = z.object({
  groupId: z.string().optional(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  amount: money,
  currency: currencyCode.optional(),
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
});
type ExpenseBody = z.infer<typeof expenseBody>;

/**
 * The checks every new or edited expense must pass: everyone once, me on it,
 * everyone allowed (same group, or friends / people I share a group with), and
 * split amounts that add up to the total, to the cent. Returns the people on
 * it and each share in cents.
 */
async function checkExpense(body: ExpenseBody, me: string) {
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

  const total = toCents(body.amount);
  const shares = body.splits.map((s) => ({ ...s, cents: toCents(s.amount) }));
  const diff = total - shares.reduce((sum, s) => sum + s.cents, 0);
  if (Math.abs(diff) > shares.length) fail(400, 'The split amounts don’t add up to the total.', 'split_mismatch');
  if (diff !== 0) [...shares].sort((a, b) => b.cents - a.cents)[0].cents += diff; // absorb float rounding
  return { people, total, shares };
}

moneyRouter.post(
  '/expenses',
  route(async (req, res) => {
    const me = req.user!.id;
    const body = expenseBody.parse(req.body);
    const { people, total, shares } = await checkExpense(body, me);

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
      currency: body.currency ?? (await defaultCurrency(me, body.groupId)),
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
    notify(await expenseNotifications(expense, me));
    res.status(201).json((await serializeExpenses([expense], me))[0]);
  }),
);

/**
 * Edit an expense (the person who added it, or who paid). Takes the same body as
 * creating one and replaces it. Shares that stay the same keep their "paid back";
 * a share that changes is open again. Everyone on it before or after is told what
 * it means for them, and the change is noted in the expense's conversation.
 */
moneyRouter.patch(
  '/expenses/:id',
  route(async (req, res) => {
    const me = req.user!.id;
    const before = await getVisibleExpense(String(req.params.id), me);
    if (before.createdBy !== me && before.paidBy !== me) fail(403, 'Only the person who added or paid for this can edit it.');
    const body = expenseBody.omit({ receiptId: true, items: true }).parse(req.body);
    const { people, total, shares } = await checkExpense(body, me);

    const oldShare = new Map(before.splits.map((s) => [s.userId, s]));
    const next: ExpenseDoc = {
      ...before,
      groupId: body.groupId ?? null,
      title: body.title,
      description: body.description ?? null,
      amountCents: total,
      currency: body.currency ?? before.currency,
      category: body.category,
      paidBy: body.paidBy,
      splitType: body.splitType,
      splits: shares.map((s) => {
        const old = oldShare.get(s.userId);
        const keepPaid = !!old?.paid && old.amountCents === s.cents && before.paidBy === body.paidBy;
        return { userId: s.userId, amountCents: s.cents, percentage: s.percentage ?? null, paid: s.userId === body.paidBy || keepPaid };
      }),
      participants: [...people],
      // Receipt lines stay as a record while the total still matches them.
      items: total === before.amountCents ? before.items : null,
      date: body.date ? new Date(body.date) : before.date,
      updatedAt: new Date(),
    };

    const changes = expenseChanges(before, next);
    if (changes.length === 0) return res.json((await serializeExpenses([before], me))[0]);

    // Only replace it if nobody else changed it in the meantime.
    const saved = await db.expenses.findOneAndReplace({ _id: before._id, updatedAt: before.updatedAt }, next, { returnDocument: 'after' });
    if (!saved) fail(409, 'Someone else just changed this expense. Open it again to see the latest.');
    for (const g of new Set([before.groupId, next.groupId])) if (g) await touchGroup(g);
    await db.expenseComments.insertOne({ _id: randomUUID(), expenseId: next._id, userId: me, text: '', createdAt: next.updatedAt, edit: changes });
    notify(await editNotifications(before, next, changes, me));
    res.json((await serializeExpenses([saved], me))[0]);
  }),
);

/** What an edit changed, for the expense's history and the notifications. */
function expenseChanges(a: ExpenseDoc, b: ExpenseDoc): ExpenseChange[] {
  const out: ExpenseChange[] = [];
  if (a.title !== b.title) out.push({ field: 'title', from: a.title, to: b.title });
  if (a.amountCents !== b.amountCents) out.push({ field: 'amount', from: a.amountCents, to: b.amountCents, currency: b.currency });
  if (a.currency !== b.currency) out.push({ field: 'currency', from: a.currency, to: b.currency });
  if (a.category !== b.category) out.push({ field: 'category', from: a.category, to: b.category });
  if (a.date.getTime() !== b.date.getTime()) out.push({ field: 'date', from: a.date.toISOString(), to: b.date.toISOString() });
  if (a.paidBy !== b.paidBy) out.push({ field: 'paidBy', from: a.paidBy, to: b.paidBy });
  const shareKey = (e: ExpenseDoc) =>
    [...e.splits]
      .sort((x, y) => x.userId.localeCompare(y.userId))
      .map((s) => `${s.userId}:${s.amountCents}`)
      .join(',');
  if (shareKey(a) !== shareKey(b)) out.push({ field: 'split' });
  if ((a.description ?? '') !== (b.description ?? '')) out.push({ field: 'note' });
  if ((a.groupId ?? null) !== (b.groupId ?? null)) out.push({ field: 'group', from: a.groupId ?? null, to: b.groupId ?? null });
  return out;
}

/** What one person gets back (+) or owes (-) on an expense, in cents. */
function standing(e: ExpenseDoc, userId: string) {
  if (!e.participants.includes(userId)) return null;
  const own = e.splits.find((s) => s.userId === userId)?.amountCents ?? 0;
  return e.paidBy === userId ? e.amountCents - own : -own;
}

/**
 * Who hears about an edit: everyone on it before or after, except whoever edited
 * it. Each is told what it now means for them, or what changed if their share didn't.
 */
async function editNotifications(before: ExpenseDoc, after: ExpenseDoc, changes: ExpenseChange[], me: string): Promise<PushItem[]> {
  const everyone = [...new Set([...before.participants, ...after.participants])].filter((id) => id !== me);
  if (!everyone.length) return [];
  const name = await nameOf(me);
  const fields = [...new Set(changes.map((c) => c.field))];
  return everyone.map((userId) => {
    const was = standing(before, userId);
    const now = standing(after, userId);
    const sameDirection = was !== null && now !== null && Math.sign(was) === Math.sign(now) && was !== 0;
    return {
      userId,
      kind: 'expense_edited' as const,
      params: {
        name,
        title: after.title,
        currency: after.currency,
        fields,
        ...(now === null
          ? { role: 'removed' as const }
          : now === was || now === 0
            ? { role: 'same' as const }
            : {
                role: now > 0 ? ('owed' as const) : ('owe' as const),
                cents: Math.abs(now),
                ...(sameDirection ? { wasCents: Math.abs(was!) } : {}),
              }),
      },
      data: { type: 'expense_edited' as const, expenseId: after._id },
    };
  });
}

moneyRouter.delete(
  '/expenses/:id',
  route(async (req, res) => {
    const me = req.user!.id;
    const e = await getVisibleExpense(String(req.params.id), me);
    if (e.createdBy !== me && e.paidBy !== me) fail(403, 'Only the person who added or paid for this can delete it.');
    await db.expenses.deleteOne({ _id: e._id });
    await Promise.all([db.expenseComments.deleteMany({ expenseId: e._id }), db.expenseReactions.deleteMany({ expenseId: e._id })]);
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
        currency: currencyCode.optional(),
        note: z.string().trim().max(200).optional(),
        groupId: z.string().optional(),
        expenseIds: z.array(z.string()).max(200).optional(),
        fromUserId: z.string().optional(),
      })
      .parse(req.body);
    // Someone not on WhoOwes yet can't confirm a payment, or record their own: it counts at once.
    let from = me;
    let withPlaceholder: boolean;
    if (body.fromUserId && body.fromUserId !== me) {
      if (body.toUserId !== me || !(await isPlaceholder(body.fromUserId))) fail(403, 'Only the person paying can record a payment.');
      from = body.fromUserId;
      withPlaceholder = true;
    } else {
      if (body.toUserId === me) fail(400, "You can't pay yourself.");
      withPlaceholder = await isPlaceholder(body.toUserId);
    }
    const other = from === me ? body.toUserId : from;
    if (body.groupId && (await isGroupMember(body.groupId, me)) && (await isGroupMember(body.groupId, other))) {
      // A payment inside a group we're both still in.
    } else if (!(await canSettleWith(me, other))) {
      fail(403, 'You can only pay friends, people in your groups, or people you still owe.');
    } else if (body.groupId) {
      // One of us has left the group: it becomes a direct payment.
      body.groupId = undefined;
    }
    const now = new Date();
    const doc: SettlementDoc = {
      _id: randomUUID(),
      fromUserId: from,
      toUserId: body.toUserId,
      amountCents: toCents(body.amount),
      currency: body.currency ?? (await defaultCurrency(me, body.groupId)),
      note: body.note || null,
      status: withPlaceholder ? 'confirmed' : 'pending',
      groupId: body.groupId ?? null,
      expenseIds: body.expenseIds ?? null,
      initiatedAt: now,
      confirmedAt: withPlaceholder ? now : null,
      rejectedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.settlements.insertOne(doc);
    if (!withPlaceholder) notify([
      {
        userId: doc.toUserId,
        kind: 'payment_recorded',
        params: { name: await nameOf(me), cents: doc.amountCents, currency: doc.currency },
        data: { type: 'payment_recorded', settlementId: doc._id },
      },
    ]);
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
    if (s.status !== 'pending') fail(409, s.status === 'confirmed' ? 'This payment is already confirmed.' : 'This payment was already declined.');
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
    notify([
      {
        userId: s.fromUserId,
        kind: confirmed ? 'payment_confirmed' : 'payment_declined',
        params: { name: await nameOf(me), cents: s.amountCents, currency: s.currency },
        data: { type: confirmed ? 'payment_confirmed' : 'payment_declined', settlementId: s._id },
      },
    ]);
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

/**
 * Who hears about a new expense: everyone on it except whoever added it, each
 * told what it means for them ("You owe $12.50" or "You get back $37.50").
 * People with nothing owed either way aren't disturbed.
 */
async function expenseNotifications(e: ExpenseDoc, me: string): Promise<PushItem[]> {
  const others = e.participants.filter((id) => id !== me);
  if (!others.length) return [];
  const name = await nameOf(me);
  const group = e.groupId ? (await db.groups.findOne({ _id: e.groupId }, { projection: { name: 1 } }))?.name : undefined;
  const items: PushItem[] = [];
  for (const userId of others) {
    const own = e.splits.find((s) => s.userId === userId)?.amountCents ?? 0;
    const isPayer = e.paidBy === userId;
    const cents = isPayer ? e.amountCents - own : own;
    if (cents <= 0) continue;
    items.push({
      userId,
      kind: isPayer ? 'expense_owed' : 'expense_owe',
      params: { name, title: e.title, group, cents, currency: e.currency },
      data: { type: 'expense_added', expenseId: e._id },
    });
  }
  return items;
}

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
