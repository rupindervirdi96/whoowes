/**
 * Moving over from Splitwise, and taking over a Splitwise history once you join.
 *
 *   POST /import/splitwise                 one Splitwise spreadsheet (a group or a friend), read by the app
 *        { target, people[], rows[] }      → { groupId, expenses, payments, skipped, alreadyHere, newPeople, created[] }
 *                                            created: the new placeholders ({ name, userId }), so the next file
 *                                            in a batch can match the same names to them.
 *   GET  /placeholders/claims              requests for me to take over someone's Splitwise history
 *   POST /placeholders/:id/claim           { userId }  ask a friend to take this placeholder over
 *   POST /placeholders/:id/claim/accept    (that friend) everything moves to my account
 *   POST /placeholders/:id/claim/decline   (that friend, or whoever asked)
 *
 * The app reads the file and sends each row as Splitwise wrote it: the date,
 * description, category, cost, currency, and each person's change in balance.
 * Every Splitwise name is either me, someone already on WhoOwes, or a new
 * placeholder for someone who isn't here yet.
 */

import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../auth.js';
import { db, type ExpenseDoc, type SettlementDoc, type UserDoc } from '../db/index.js';
import { areFriends, canTransactWith, fail, getPlaceholder, iso, isGroupMember, publicUser, route, toAmount, toCents, usersById } from '../domain/common.js';
import { categoryFor, importKey, planRow, type SplitwiseRow } from '../domain/splitwise.js';
import { createPlaceholder, knowsPlaceholder, takeOver } from '../domain/placeholders.js';
import { currencyCode } from '../currency.js';
import { nameOf, notify } from '../push.js';

export const importRouter = Router();
importRouter.use(requireUser);

const MAX_ROWS = 5000;
const amount = z.number().min(-10_000_000).max(10_000_000);

const importBody = z.object({
  target: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('newGroup'), name: z.string().trim().min(1).max(60) }),
    z.object({ kind: z.literal('group'), groupId: z.string() }),
    z.object({ kind: z.literal('none') }),
  ]),
  people: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        as: z.union([z.literal('me'), z.literal('new'), z.object({ userId: z.string() })]),
      }),
    )
    .min(2)
    .max(50),
  rows: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        description: z.string().max(300),
        category: z.string().max(80),
        cost: amount,
        currency: currencyCode,
        nets: z.array(amount).max(50),
      }),
    )
    .min(1)
    .max(MAX_ROWS),
});

/** Splitwise dates have no time; noon UTC keeps them on the same day everywhere. */
const dayOf = (d: string) => new Date(`${d}T12:00:00.000Z`);

const allEqual = (cents: number[]) => cents.length > 0 && Math.max(...cents) - Math.min(...cents) <= 1;

importRouter.post(
  '/import/splitwise',
  route(async (req, res) => {
    const me = req.user!.id;
    const body = importBody.parse(req.body);
    const { target, people } = body;

    // ── Who's who ──
    const mine = people.filter((p) => p.as === 'me');
    if (mine.length !== 1) fail(400, 'Choose which Splitwise name is you.', 'import_no_me');
    const realIds = people.flatMap((p) => (typeof p.as === 'object' ? [p.as.userId] : []));
    if (realIds.includes(me) || new Set(realIds).size !== realIds.length) fail(400, 'Each person can only be matched once.', 'import_duplicate_person');
    if (target.kind === 'group' && !(await isGroupMember(target.groupId, me))) fail(404, 'Group not found.');
    for (const id of realIds) {
      const u = await db.users.findOne({ _id: id }, { projection: { mergedInto: 1 } });
      if (!u || u.mergedInto) fail(400, 'That person is not on WhoOwes.', 'not_found');
      const allowed =
        target.kind === 'group' ? await isGroupMember(target.groupId, id) : target.kind === 'newGroup' ? await areFriends(me, id) : await canTransactWith(me, id);
      if (!allowed) {
        fail(403, target.kind === 'group' ? 'Everyone in the split must be in the group.' : 'You can only split with friends or people in your groups.');
      }
    }

    // ── Rows → expenses and payments ──
    const rows: SplitwiseRow[] = body.rows.map((r) => {
      if (r.nets.length !== people.length) fail(400, 'This file doesn’t look like a Splitwise export.', 'import_bad_file');
      return { date: r.date, description: r.description.trim(), category: r.category, costCents: toCents(r.cost), currency: r.currency, nets: r.nets.map(toCents) };
    });
    const planned = rows.map((r) => ({ row: r, key: importKey(r), parts: planRow(r) }));
    const useful = planned.filter((p) => p.parts.length > 0);
    const skipped = planned.length - useful.length;

    // Rows already brought over (by me, or by someone who put me on them) aren't added again.
    // Each part of a row has its own key (key#0, key#1 when several people paid); seeing any
    // part means the row is here. Identical rows in one file are kept: each copy covers one.
    const partKeys = (p: (typeof useful)[number]) => p.parts.map((_, i) => `${p.key}#${i}`);
    const keys = [...new Set(useful.flatMap(partKeys))];
    const scope = target.kind === 'group' ? [{ participants: me }, { groupId: target.groupId }] : [{ participants: me }];
    const pscope = target.kind === 'group' ? [{ fromUserId: me }, { toUserId: me }, { groupId: target.groupId }] : [{ fromUserId: me }, { toUserId: me }];
    const here = new Map<string, number>();
    const count = (k?: string) => k && here.set(k, (here.get(k) ?? 0) + 1);
    for (const e of await db.expenses.find({ importKey: { $in: keys }, $or: scope }, { projection: { importKey: 1 } }).toArray()) count(e.importKey);
    for (const s of await db.settlements.find({ importKey: { $in: keys }, $or: pscope }, { projection: { importKey: 1 } }).toArray()) count(s.importKey);
    const fresh = useful.filter((p) => {
      const mine = partKeys(p);
      if (Math.max(...mine.map((k) => here.get(k) ?? 0)) === 0) return true;
      for (const k of mine) here.set(k, Math.max(0, (here.get(k) ?? 0) - 1));
      return false;
    });
    const alreadyHere = useful.length - fresh.length;
    if (fresh.length === 0) {
      return res.json({ groupId: target.kind === 'group' ? target.groupId : null, expenses: 0, payments: 0, skipped, alreadyHere, newPeople: 0, created: [] });
    }

    // ── New people, and the group ──
    const ids: string[] = [];
    const created: Array<{ name: string; userId: string }> = [];
    for (const p of people) {
      if (p.as === 'me') ids.push(me);
      else if (p.as === 'new') {
        const u = await createPlaceholder(me, p.name);
        ids.push(u._id);
        created.push({ name: p.name, userId: u._id });
      } else ids.push(p.as.userId);
    }
    const newPeople = created.length;

    const now = new Date();
    const currencies = new Map<string, number>();
    for (const p of fresh) currencies.set(p.row.currency, (currencies.get(p.row.currency) ?? 0) + 1);
    const mainCurrency = [...currencies].sort((a, b) => b[1] - a[1])[0][0];
    let groupId: string | null = null;
    let groupName: string | undefined;
    if (target.kind === 'newGroup') {
      groupId = randomUUID();
      groupName = target.name;
      await db.groups.insertOne({
        _id: groupId,
        name: target.name,
        description: null,
        createdBy: me,
        members: [...new Set(ids)].map((userId) => ({ userId, role: userId === me ? ('admin' as const) : ('member' as const), joinedAt: now })),
        currency: mainCurrency,
        createdAt: now,
        updatedAt: now,
      });
    } else if (target.kind === 'group') {
      groupId = target.groupId;
      const g = await db.groups.findOne({ _id: groupId }, { projection: { name: 1 } });
      groupName = g?.name;
      for (const id of ids) {
        await db.groups.updateOne(
          { _id: groupId, 'members.userId': { $ne: id } },
          { $push: { members: { userId: id, role: 'member', joinedAt: now } }, $set: { updatedAt: now } },
        );
      }
    }

    // ── Write ──
    const expenses: ExpenseDoc[] = [];
    const payments: SettlementDoc[] = [];
    for (const { row, key, parts } of fresh) {
      const date = dayOf(row.date);
      for (const [n, part] of parts.entries()) {
        if (part.kind === 'payment') {
          payments.push({
            _id: randomUUID(),
            fromUserId: ids[part.from],
            toUserId: ids[part.to],
            amountCents: part.cents,
            currency: row.currency,
            note: null,
            status: 'confirmed',
            groupId,
            expenseIds: null,
            importKey: `${key}#${n}`,
            initiatedAt: date,
            confirmedAt: date,
            rejectedAt: null,
            createdAt: date,
            updatedAt: now,
          });
          continue;
        }
        const payer = ids[part.payer];
        const splits = part.shares.map((s) => ({ userId: ids[s.person], amountCents: s.cents, percentage: null, paid: ids[s.person] === payer }));
        expenses.push({
          _id: randomUUID(),
          groupId,
          title: (row.description || 'Splitwise expense').slice(0, 120),
          description: null,
          amountCents: part.amountCents,
          currency: row.currency,
          category: categoryFor(row.category),
          paidBy: payer,
          splitType: allEqual(splits.map((s) => s.amountCents)) && !part.severalPayers ? 'equal' : 'custom',
          splits,
          participants: [...new Set([payer, ...splits.map((s) => s.userId)])],
          items: null,
          receiptId: null,
          date,
          importKey: `${key}#${n}`,
          createdBy: me,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    for (let i = 0; i < expenses.length; i += 500) await db.expenses.insertMany(expenses.slice(i, i + 500));
    for (let i = 0; i < payments.length; i += 500) await db.settlements.insertMany(payments.slice(i, i + 500));

    // ── Tell the people already on WhoOwes, once, where it leaves them ──
    const placeholders = new Set(people.flatMap((p, i) => (p.as === 'new' ? [ids[i]] : [])));
    const others = [...new Set(ids)].filter((id) => id !== me && !placeholders.has(id));
    if (others.length) {
      const existing = await db.users.find({ _id: { $in: others }, placeholder: null }, { projection: { _id: 1 } }).toArray();
      const name = await nameOf(me);
      notify(
        existing.map(({ _id: userId }) => {
          const net = new Map<string, number>();
          const add = (c: string, v: number) => net.set(c, (net.get(c) ?? 0) + v);
          for (const e of expenses) {
            if (!e.participants.includes(userId)) continue;
            const own = e.splits.find((s) => s.userId === userId)?.amountCents ?? 0;
            add(e.currency, e.paidBy === userId ? e.amountCents - own : -own);
          }
          for (const s of payments) {
            if (s.fromUserId === userId) add(s.currency, s.amountCents);
            if (s.toUserId === userId) add(s.currency, -s.amountCents);
          }
          const [currency, cents] = [...net].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0] ?? [mainCurrency, 0];
          return {
            userId,
            kind: 'splitwise_imported' as const,
            params: {
              name,
              group: groupName,
              currency,
              ...(cents !== 0 ? { cents: Math.abs(cents), dir: cents > 0 ? ('owesYou' as const) : ('youOwe' as const) } : {}),
            },
            data: { type: 'splitwise_imported' as const, ...(groupId ? { groupId } : { userId: me }) },
          };
        }),
      );
    }

    res.status(201).json({ groupId, expenses: expenses.length, payments: payments.length, skipped, alreadyHere, newPeople, created });
  }),
);

// ─── Taking over a placeholder ───────────────────────────────────────────────

/** A placeholder's standing with everyone, per currency, in cents (+ they're owed). */
async function standingOf(id: string) {
  const net = new Map<string, number>();
  const add = (c: string, v: number) => net.set(c, (net.get(c) ?? 0) + v);
  const expenses = await db.expenses.find({ participants: id }, { projection: { paidBy: 1, splits: 1, currency: 1 } }).toArray();
  for (const e of expenses) {
    for (const s of e.splits) {
      if (s.paid || s.userId === e.paidBy) continue;
      if (e.paidBy === id) add(e.currency, s.amountCents);
      if (s.userId === id) add(e.currency, -s.amountCents);
    }
  }
  const payments = await db.settlements.find({ status: 'confirmed', $or: [{ fromUserId: id }, { toUserId: id }] }).toArray();
  for (const p of payments) add(p.currency, p.fromUserId === id ? p.amountCents : -p.amountCents);
  return { expenseCount: expenses.length, net };
}

importRouter.get(
  '/placeholders/claims',
  route(async (req, res) => {
    const me = req.user!.id;
    const rows = await db.users.find({ 'claim.userId': me, mergedInto: null }).sort({ 'claim.at': -1 }).limit(20).toArray();
    const askers = await usersById(
      rows.map((r) => r.claim!.by),
      me,
    );
    res.json(
      await Promise.all(
        rows.map(async (p: UserDoc) => {
          const { expenseCount, net } = await standingOf(p._id);
          const groups = await db.groups.find({ 'members.userId': p._id }, { projection: { name: 1 } }).toArray();
          return {
            id: p._id,
            name: p.name,
            by: askers.get(p.claim!.by),
            at: iso(p.claim!.at),
            expenseCount,
            groups: groups.map((g) => g.name),
            balances: [...net].filter(([, v]) => v !== 0).map(([currency, cents]) => ({ currency, amount: toAmount(cents) })),
          };
        }),
      ),
    );
  }),
);

importRouter.post(
  '/placeholders/:id/claim',
  route(async (req, res) => {
    const me = req.user!.id;
    const { userId } = z.object({ userId: z.string() }).parse(req.body);
    const p = await getPlaceholder(String(req.params.id));
    if (!p || !(await knowsPlaceholder(p, me))) fail(404, 'That person is not on WhoOwes.', 'not_found');
    if (userId === me) fail(400, "That's you!");
    const target = await db.users.findOne({ _id: userId });
    if (!target || target.placeholder || target.mergedInto) fail(404, 'That person is not on WhoOwes.', 'not_found');
    if (!(await areFriends(me, userId))) fail(403, 'You can only add your friends.');
    await db.users.updateOne({ _id: p._id }, { $set: { claim: { userId, by: me, at: new Date() } } });
    const { expenseCount } = await standingOf(p._id);
    notify([
      {
        userId,
        kind: 'history_claim',
        params: { name: await nameOf(me), title: p.name, count: expenseCount },
        data: { type: 'history_claim', userId: p._id },
      },
    ]);
    res.status(201).json({ ok: true });
  }),
);

importRouter.post(
  '/placeholders/:id/claim/accept',
  route(async (req, res) => {
    const me = req.user!.id;
    const p = await getPlaceholder(String(req.params.id));
    if (!p || p.claim?.userId !== me) fail(404, 'Request not found.');
    const by = p.claim.by;
    await takeOver(p._id, me);
    notify([
      {
        userId: by,
        kind: 'history_claimed',
        params: { name: await nameOf(me), title: p.name },
        data: { type: 'history_claimed', userId: me },
      },
    ]);
    const self = await db.users.findOne({ _id: me });
    res.json({ ok: true, user: publicUser(self!, me) });
  }),
);

importRouter.post(
  '/placeholders/:id/claim/decline',
  route(async (req, res) => {
    const me = req.user!.id;
    await db.users.updateOne(
      { _id: String(req.params.id), $or: [{ 'claim.userId': me }, { 'claim.by': me }] },
      { $set: { claim: null } },
    );
    res.status(204).end();
  }),
);
