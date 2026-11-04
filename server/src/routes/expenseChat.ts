/**
 * Reactions and comments under an expense. Anyone who can see the expense can
 * react or comment; everyone else involved is told (never the person who did it).
 *
 *   GET    /expenses/:id/activity                 reactions + comments
 *   PUT    /expenses/:id/reaction                 { emoji | null }  (one per person; null takes it back)
 *   POST   /expenses/:id/comments                 { text }
 *   DELETE /expenses/:id/comments/:commentId      (the author only; edit notes stay)
 *
 * Edits to the expense show up in the comments as notes ("Alex changed the
 * amount from $60 to $72"), written by PATCH /expenses/:id.
 *
 * Each write answers with the whole activity, so the app can show it straight away.
 */

import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../auth.js';
import { db, type ExpenseChange, type ExpenseDoc } from '../db/index.js';
import { deletedUser, fail, getVisibleExpense, isGroupMember, iso, route, toAmount, usersById } from '../domain/common.js';
import { nameOf, notify, type PushItem } from '../push.js';

export const expenseChatRouter = Router();
expenseChatRouter.use(requireUser);

/** The reactions on offer (the app shows the same set). */
export const REACTIONS = ['👍', '❤️', '😂', '😮', '🙏', '💸'] as const;
const COMMENT_MAX = 500;
/** Most comments one person can post in a minute, so a stuck button can't flood everyone. */
const COMMENTS_PER_MINUTE = 10;
/** Taking a reaction back and adding it again only notifies once in this window. */
const REACTION_QUIET_MS = 60 * 60 * 1000;
/** Comments sent to the app: the most recent ones. */
const COMMENTS_SHOWN = 200;
/** Real comments, not edit notes. */
const realComments = { edit: { $exists: false } } as const;

async function activity(expenseId: string, viewer: string) {
  const [reactions, latest] = await Promise.all([
    db.expenseReactions.find({ expenseId, emoji: { $ne: null } }).sort({ updatedAt: 1 }).toArray(),
    db.expenseComments.find({ expenseId }).sort({ createdAt: -1 }).limit(COMMENTS_SHOWN).toArray(),
  ]);
  const comments = latest.reverse();
  const edits = comments.flatMap((c) => c.edit ?? []);
  const payers = edits.flatMap((c) => (c.field === 'paidBy' ? [c.from, c.to] : []));
  const groupIds = edits.flatMap((c) => (c.field === 'group' ? [c.from, c.to] : [])).filter((g): g is string => !!g);
  const [users, groups] = await Promise.all([
    usersById([...reactions.map((r) => r.userId), ...comments.map((c) => c.userId), ...payers], viewer),
    groupIds.length ? db.groups.find({ _id: { $in: groupIds } }, { projection: { name: 1 } }).toArray() : Promise.resolve([]),
  ]);
  const user = (id: string) => users.get(id) ?? deletedUser(id);
  const groupName = (id: string | null) => (id ? (groups.find((g) => g._id === id)?.name ?? null) : null);
  // Amounts leave as decimals, people as profiles, groups as names (null: no group, or one that's gone).
  const change = (c: ExpenseChange) =>
    c.field === 'amount'
      ? { ...c, from: toAmount(c.from), to: toAmount(c.to) }
      : c.field === 'paidBy'
        ? { field: c.field, from: user(c.from), to: user(c.to) }
        : c.field === 'group'
          ? { field: c.field, from: groupName(c.from), to: groupName(c.to) }
          : c;
  return {
    reactions: reactions.map((r) => ({ userId: r.userId, user: user(r.userId), emoji: r.emoji!, updatedAt: iso(r.updatedAt)! })),
    comments: comments.map((c) => ({
      id: c._id,
      userId: c.userId,
      user: user(c.userId),
      text: c.text,
      createdAt: iso(c.createdAt)!,
      ...(c.edit ? { edit: c.edit.map(change) } : {}),
    })),
  };
}

/**
 * Who hears about a reaction or comment: everyone on the expense, plus anyone
 * who joined the conversation and can still see it. Never the person who did it.
 */
async function audience(e: ExpenseDoc, actor: string) {
  const commenters = await db.expenseComments.distinct('userId', { expenseId: e._id, ...realComments });
  const people = new Set(e.participants);
  for (const id of commenters) {
    if (people.has(id)) continue;
    if (e.groupId && (await isGroupMember(e.groupId, id))) people.add(id);
  }
  people.delete(actor);
  return [...people];
}

async function groupName(e: ExpenseDoc) {
  if (!e.groupId) return undefined;
  return (await db.groups.findOne({ _id: e.groupId }, { projection: { name: 1 } }))?.name;
}

expenseChatRouter.get(
  '/expenses/:id/activity',
  route(async (req, res) => {
    const me = req.user!.id;
    const e = await getVisibleExpense(String(req.params.id), me);
    res.json(await activity(e._id, me));
  }),
);

expenseChatRouter.put(
  '/expenses/:id/reaction',
  route(async (req, res) => {
    const me = req.user!.id;
    const { emoji } = z.object({ emoji: z.enum(REACTIONS).nullable() }).parse(req.body);
    const e = await getVisibleExpense(String(req.params.id), me);
    const now = new Date();
    const _id = `${e._id}:${me}`;
    const before = await db.expenseReactions.findOneAndUpdate(
      { _id },
      { $set: { emoji, updatedAt: now }, $setOnInsert: { expenseId: e._id, userId: me, notifiedAt: null } },
      { upsert: true, returnDocument: 'before' },
    );

    // Tell the others about a new reaction, but only once an hour per person per expense,
    // so trying a few faces (or taking one back and re-adding it) doesn't buzz everyone's phone.
    const quiet = before?.notifiedAt && now.getTime() - before.notifiedAt.getTime() < REACTION_QUIET_MS;
    if (emoji && emoji !== before?.emoji && !quiet) {
      // Claim the notification atomically, so two quick taps can't send two.
      const claimed = await db.expenseReactions.updateOne(
        { _id, notifiedAt: before?.notifiedAt ?? null },
        { $set: { notifiedAt: now } },
      );
      if (claimed.modifiedCount) {
        const [name, group, to] = await Promise.all([nameOf(me), groupName(e), audience(e, me)]);
        notify(
          to.map<PushItem>((userId) => ({
            userId,
            kind: 'expense_reaction',
            params: { name, title: e.title, group, emoji },
            data: { type: 'expense_reaction', expenseId: e._id },
          })),
        );
      }
    }
    res.json(await activity(e._id, me));
  }),
);

expenseChatRouter.post(
  '/expenses/:id/comments',
  route(async (req, res) => {
    const me = req.user!.id;
    const { text } = z.object({ text: z.string().trim().min(1).max(COMMENT_MAX) }).parse(req.body);
    const e = await getVisibleExpense(String(req.params.id), me);
    const recent = await db.expenseComments.countDocuments({ userId: me, createdAt: { $gt: new Date(Date.now() - 60_000) }, ...realComments });
    if (recent >= COMMENTS_PER_MINUTE) fail(429, 'You’re commenting too fast. Try again in a minute.', 'comment_rate');

    await db.expenseComments.insertOne({ _id: randomUUID(), expenseId: e._id, userId: me, text, createdAt: new Date() });
    const [name, to] = await Promise.all([nameOf(me), audience(e, me)]);
    const preview = text.length > 140 ? `${text.slice(0, 139)}…` : text;
    notify(
      to.map<PushItem>((userId) => ({
        userId,
        kind: 'expense_comment',
        params: { name, title: e.title, text: preview },
        data: { type: 'expense_comment', expenseId: e._id },
      })),
    );
    res.status(201).json(await activity(e._id, me));
  }),
);

expenseChatRouter.delete(
  '/expenses/:id/comments/:commentId',
  route(async (req, res) => {
    const me = req.user!.id;
    const e = await getVisibleExpense(String(req.params.id), me);
    const gone = await db.expenseComments.deleteOne({ _id: String(req.params.commentId), expenseId: e._id, userId: me, ...realComments });
    if (!gone.deletedCount) fail(404, 'Comment not found.');
    res.json(await activity(e._id, me));
  }),
);
