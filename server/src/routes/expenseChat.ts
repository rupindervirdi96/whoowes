/**
 * Reactions and comments under an expense. Anyone who can see the expense can
 * react or comment; everyone else involved is told (never the person who did it).
 *
 *   GET    /expenses/:id/activity                 reactions + comments
 *   PUT    /expenses/:id/reaction                 { emoji | null }  (one per person; null takes it back)
 *   POST   /expenses/:id/comments                 { text }
 *   DELETE /expenses/:id/comments/:commentId      (the author only)
 *
 * Each write answers with the whole activity, so the app can show it straight away.
 */

import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../auth.js';
import { db, type ExpenseDoc } from '../db/index.js';
import { deletedUser, fail, getVisibleExpense, isGroupMember, iso, route, usersById } from '../domain/common.js';
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

async function activity(expenseId: string, viewer: string) {
  const [reactions, latest] = await Promise.all([
    db.expenseReactions.find({ expenseId, emoji: { $ne: null } }).sort({ updatedAt: 1 }).toArray(),
    db.expenseComments.find({ expenseId }).sort({ createdAt: -1 }).limit(COMMENTS_SHOWN).toArray(),
  ]);
  const comments = latest.reverse();
  const users = await usersById([...reactions.map((r) => r.userId), ...comments.map((c) => c.userId)], viewer);
  const user = (id: string) => users.get(id) ?? deletedUser(id);
  return {
    reactions: reactions.map((r) => ({ userId: r.userId, user: user(r.userId), emoji: r.emoji!, updatedAt: iso(r.updatedAt)! })),
    comments: comments.map((c) => ({ id: c._id, userId: c.userId, user: user(c.userId), text: c.text, createdAt: iso(c.createdAt)! })),
  };
}

/**
 * Who hears about a reaction or comment: everyone on the expense, plus anyone
 * who joined the conversation and can still see it. Never the person who did it.
 */
async function audience(e: ExpenseDoc, actor: string) {
  const commenters = await db.expenseComments.distinct('userId', { expenseId: e._id });
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
    const recent = await db.expenseComments.countDocuments({ userId: me, createdAt: { $gt: new Date(Date.now() - 60_000) } });
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
    const gone = await db.expenseComments.deleteOne({ _id: String(req.params.commentId), expenseId: e._id, userId: me });
    if (!gone.deletedCount) fail(404, 'Comment not found.');
    res.json(await activity(e._id, me));
  }),
);
