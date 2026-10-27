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
import { db } from '../db/index.js';
import { areFriends, canTransactWith, fail, isGroupMember, iso, route, toCents } from '../domain/common.js';
import { loadGroups, serializeExpenses, serializeSettlements, type ExpenseRow, type SettlementRow } from '../domain/serialize.js';

export const moneyRouter = Router();
moneyRouter.use(requireUser);

const CATEGORIES = ['food', 'transport', 'accommodation', 'entertainment', 'utilities', 'shopping', 'health', 'other'] as const;
const currency = z.string().regex(/^[A-Z]{3}$/).default('USD');
const money = z.number().positive().max(10_000_000);

async function requireMember(groupId: string, userId: string) {
  if (!(await isGroupMember(groupId, userId))) fail(404, 'Group not found.');
}

// ─── Groups ──────────────────────────────────────────────────────────────────

moneyRouter.get(
  '/groups',
  route(async (req, res) => {
    const me = req.user!.id;
    const { rows } = await db.query<{ group_id: string }>('select group_id from group_members where user_id = $1', [me]);
    const groups = await loadGroups(rows.map((r) => r.group_id), me);
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
    await db.tx(async (q) => {
      await q.query('insert into groups (id, name, description, created_by) values ($1, $2, $3, $4)', [id, body.name, body.description || null, me]);
      await q.query(`insert into group_members (group_id, user_id, role) values ($1, $2, 'admin')`, [id, me]);
      for (const uid of memberIds) await q.query(`insert into group_members (group_id, user_id, role) values ($1, $2, 'member')`, [id, uid]);
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
    if (await isGroupMember(groupId, userId)) fail(409, 'Already in this group.');
    await db.query(`insert into group_members (group_id, user_id, role) values ($1, $2, 'member')`, [groupId, userId]);
    await db.query('update groups set updated_at = now() where id = $1', [groupId]);
    res.json((await loadGroups([groupId], me))[0]);
  }),
);

moneyRouter.delete(
  '/groups/:id/members/:userId',
  route(async (req, res) => {
    const me = req.user!.id;
    const groupId = String(req.params.id);
    const target = String(req.params.userId);
    await requireMember(groupId, me);
    const myRole = await db.one<{ role: string }>('select role from group_members where group_id = $1 and user_id = $2', [groupId, me]);
    if (target !== me && myRole?.role !== 'admin') fail(403, 'Only group admins can remove people.');
    await db.query('delete from group_members where group_id = $1 and user_id = $2', [groupId, target]);
    await db.query('update groups set updated_at = now() where id = $1', [groupId]);
    const left = await loadGroups([groupId], me);
    res.json(left[0] ?? null);
  }),
);

moneyRouter.delete(
  '/groups/:id',
  route(async (req, res) => {
    const me = req.user!.id;
    const groupId = String(req.params.id);
    const role = await db.one<{ role: string }>('select role from group_members where group_id = $1 and user_id = $2', [groupId, me]);
    if (!role) fail(404, 'Group not found.');
    if (role.role !== 'admin') fail(403, 'Only group admins can delete the group.');
    await db.query('delete from groups where id = $1', [groupId]); // expenses keep their history (group_id → null)
    res.status(204).end();
  }),
);

// ─── Expenses ────────────────────────────────────────────────────────────────

const VISIBLE = `(e.paid_by = $1 or exists (select 1 from expense_splits s where s.expense_id = e.id and s.user_id = $1)
  or (e.group_id is not null and exists (select 1 from group_members m where m.group_id = e.group_id and m.user_id = $1)))`;

async function getVisibleExpense(id: string, me: string) {
  const row = await db.one<ExpenseRow>(`select e.* from expenses e where e.id = $2 and ${VISIBLE}`, [me, id]);
  if (!row) fail(404, 'Expense not found.');
  return row;
}

moneyRouter.get(
  '/expenses',
  route(async (req, res) => {
    const me = req.user!.id;
    const groupId = typeof req.query.groupId === 'string' ? req.query.groupId : undefined;
    let rows: ExpenseRow[];
    if (groupId) {
      await requireMember(groupId, me);
      rows = (await db.query<ExpenseRow>('select * from expenses where group_id = $1 order by date desc', [groupId])).rows;
    } else {
      rows = (
        await db.query<ExpenseRow>(
          `select e.* from expenses e where e.paid_by = $1 or exists (select 1 from expense_splits s where s.expense_id = e.id and s.user_id = $1)
           order by e.date desc`,
          [me],
        )
      ).rows;
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
    if (diff !== 0) shares.sort((a, b) => b.cents - a.cents)[0].cents += diff; // absorb float rounding

    if (body.receiptId) {
      const owned = await db.one('select 1 from receipts where id = $1 and user_id = $2', [body.receiptId, me]);
      if (!owned) fail(400, 'Receipt not found.');
    }

    const id = randomUUID();
    await db.tx(async (q) => {
      await q.query(
        `insert into expenses (id, group_id, title, description, amount_cents, currency, category, paid_by, split_type, items, receipt_id, date, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          id,
          body.groupId ?? null,
          body.title,
          body.description ?? null,
          total,
          body.currency,
          body.category,
          body.paidBy,
          body.splitType,
          body.items ? JSON.stringify(body.items.map((it) => ({ ...it, id: randomUUID() }))) : null,
          body.receiptId ?? null,
          body.date ?? new Date().toISOString(),
          me,
        ],
      );
      for (const s of shares) {
        await q.query('insert into expense_splits (expense_id, user_id, amount_cents, percentage, paid) values ($1, $2, $3, $4, $5)', [
          id,
          s.userId,
          s.cents,
          s.percentage ?? null,
          s.userId === body.paidBy,
        ]);
      }
      if (body.receiptId) await q.query('update receipts set expense_id = $1 where id = $2', [id, body.receiptId]);
      if (body.groupId) await q.query('update groups set updated_at = now() where id = $1', [body.groupId]);
    });
    const row = await db.one<ExpenseRow>('select * from expenses where id = $1', [id]);
    res.status(201).json((await serializeExpenses([row!], me))[0]);
  }),
);

moneyRouter.delete(
  '/expenses/:id',
  route(async (req, res) => {
    const me = req.user!.id;
    const e = await getVisibleExpense(String(req.params.id), me);
    if (e.created_by !== me && e.paid_by !== me) fail(403, 'Only the person who added or paid for this can delete it.');
    await db.query('delete from expenses where id = $1', [e.id]);
    res.status(204).end();
  }),
);

moneyRouter.post(
  '/expenses/:id/splits/:userId/paid',
  route(async (req, res) => {
    const me = req.user!.id;
    const e = await getVisibleExpense(String(req.params.id), me);
    const target = String(req.params.userId);
    if (me !== e.paid_by && me !== target) fail(403, 'Only the payer or that person can mark this paid.');
    await db.query('update expense_splits set paid = true where expense_id = $1 and user_id = $2', [e.id, target]);
    await db.query('update expenses set updated_at = now() where id = $1', [e.id]);
    res.json((await serializeExpenses([(await db.one<ExpenseRow>('select * from expenses where id = $1', [e.id]))!], me))[0]);
  }),
);

// ─── Settlements ─────────────────────────────────────────────────────────────

moneyRouter.get(
  '/settlements',
  route(async (req, res) => {
    const me = req.user!.id;
    const groupId = typeof req.query.groupId === 'string' ? req.query.groupId : undefined;
    let rows: SettlementRow[];
    if (groupId) {
      await requireMember(groupId, me);
      rows = (await db.query<SettlementRow>('select * from settlements where group_id = $1 order by created_at desc', [groupId])).rows;
    } else {
      rows = (
        await db.query<SettlementRow>('select * from settlements where from_user_id = $1 or to_user_id = $1 order by created_at desc', [me])
      ).rows;
    }
    res.json(await serializeSettlements(rows, me));
  }),
);

moneyRouter.get(
  '/settlements/pending',
  route(async (req, res) => {
    const me = req.user!.id;
    const { rows } = await db.query<SettlementRow>(
      `select * from settlements where to_user_id = $1 and status = 'pending' order by created_at desc`,
      [me],
    );
    res.json(await serializeSettlements(rows, me));
  }),
);

async function getMySettlement(id: string, me: string) {
  const row = await db.one<SettlementRow>('select * from settlements where id = $1 and (from_user_id = $2 or to_user_id = $2)', [id, me]);
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
    const row = await db.one<SettlementRow>(
      `insert into settlements (id, from_user_id, to_user_id, amount_cents, currency, note, status, group_id, expense_ids)
       values ($1, $2, $3, $4, $5, $6, 'pending', $7, $8) returning *`,
      [
        randomUUID(),
        me,
        body.toUserId,
        toCents(body.amount),
        body.currency,
        body.note || null,
        body.groupId ?? null,
        body.expenseIds ? JSON.stringify(body.expenseIds) : null,
      ],
    );
    res.status(201).json((await serializeSettlements([row!], me))[0]);
  }),
);

moneyRouter.post(
  '/settlements/:id/respond',
  route(async (req, res) => {
    const me = req.user!.id;
    const { action } = z.object({ action: z.enum(['confirm', 'reject']) }).parse(req.body);
    const s = await getMySettlement(String(req.params.id), me);
    if (s.to_user_id !== me) fail(403, 'Only the person being paid can confirm this.');
    if (s.status !== 'pending') fail(409, `This payment is already ${s.status}.`);
    const row = await db.one<SettlementRow>(
      `update settlements set status = $2, confirmed_at = case when $2 = 'confirmed' then now() end,
       rejected_at = case when $2 = 'rejected' then now() end, updated_at = now() where id = $1 returning *`,
      [s.id, action === 'confirm' ? 'confirmed' : 'rejected'],
    );
    if (action === 'confirm') {
      // They've been paid: clear their reminders to the payer.
      await db.query(
        'update reminders set dismissed_at = now() where from_user_id = $1 and to_user_id = $2 and dismissed_at is null',
        [s.to_user_id, s.from_user_id],
      );
    }
    res.json((await serializeSettlements([row!], me))[0]);
  }),
);

moneyRouter.delete(
  '/settlements/:id',
  route(async (req, res) => {
    const me = req.user!.id;
    const s = await getMySettlement(String(req.params.id), me);
    if (s.from_user_id !== me) fail(403, 'Only the sender can cancel.');
    if (s.status !== 'pending') fail(409, 'Only pending payments can be cancelled.');
    await db.query('delete from settlements where id = $1', [s.id]);
    res.status(204).end();
  }),
);

// ─── Receipts ────────────────────────────────────────────────────────────────

interface ReceiptRow {
  id: string;
  source_type: string;
  file_name: string | null;
  mime_type: string | null;
  parsed_data: unknown;
  ai_prompt: string | null;
  expense_id: string | null;
  created_at: Date;
}

const serializeReceipt = (r: ReceiptRow) => ({
  id: r.id,
  sourceType: r.source_type,
  fileUri: '',
  fileName: r.file_name ?? undefined,
  mimeType: r.mime_type ?? undefined,
  parsedData: r.parsed_data,
  aiPrompt: r.ai_prompt ?? undefined,
  expenseId: r.expense_id ?? undefined,
  createdAt: iso(r.created_at)!,
});

moneyRouter.get(
  '/receipts/:id',
  route(async (req, res) => {
    const r = await db.one<ReceiptRow>('select * from receipts where id = $1 and user_id = $2', [req.params.id, req.user!.id]);
    if (!r) fail(404, 'Receipt not found.');
    res.json(serializeReceipt(r));
  }),
);

moneyRouter.patch(
  '/receipts/:id',
  route(async (req, res) => {
    const { parsedData } = z.object({ parsedData: z.record(z.string(), z.unknown()) }).parse(req.body);
    const r = await db.one<ReceiptRow>('update receipts set parsed_data = $3 where id = $1 and user_id = $2 returning *', [
      req.params.id,
      req.user!.id,
      JSON.stringify(parsedData),
    ]);
    if (!r) fail(404, 'Receipt not found.');
    res.json(serializeReceipt(r));
  }),
);
