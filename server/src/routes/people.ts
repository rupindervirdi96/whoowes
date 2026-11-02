/**
 * People: my profile, finding users, friendships, reminders and contact matching.
 *
 *   GET    /me                          my profile
 *   PATCH  /me                          { name?, email?, avatarUrl?, currency? }
 *   DELETE /me                          delete my account (required by the app stores)
 *   POST   /me/push-tokens              { token, platform, lang }  → this phone gets my notifications
 *   POST   /me/push-tokens/remove       { token }  (on sign-out)
 *   GET    /users/search?q=             exact phone/email, or names of people I share a group with
 *   GET    /friends                     accepted friends
 *   GET    /friends/requests            pending requests, both directions
 *   POST   /friends                     { userId } | { emailOrPhone }  → send a request
 *   POST   /friends/requests/:id/accept
 *   POST   /friends/requests/:id/decline   (addressee declines, or requester cancels)
 *   PATCH  /friends/:userId              { nickname?, pinned? }  → private to me
 *   DELETE /friends/:userId
 *   POST   /friends/:userId/remind      { amount?, currency? }  → shows up in their "Needs your attention"
 *   GET    /reminders                   reminders sent to me in the last 14 days
 *   POST   /reminders/:id/dismiss
 *   POST   /contacts/match              { hashes: sha256(E.164)[] } → which contacts are on WhoOwes
 */

import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../auth.js';
import { db, isDuplicateKey, type FriendshipDoc, type UserDoc } from '../db/index.js';
import { stripe } from '../stripe.js';
import { getAccount, saveAccount } from '../store.js';
import { env } from '../env.js';
import {
  canTransactWith,
  escapeRegex,
  fail,
  iso,
  myGroupIds,
  pairKey,
  publicUser,
  route,
  toAmount,
  toCents,
  usersById,
} from '../domain/common.js';
import { limited } from './phone.js';
import { currencyCode } from '../currency.js';
import { isExpoPushToken, nameOf, notify } from '../push.js';

export const peopleRouter = Router();
peopleRouter.use(requireUser);

const HOUR = 60 * 60_000;

/** When I last reminded each of these people: Map<userId, Date>. */
async function lastRemindedBy(me: string, userIds: string[]) {
  if (!userIds.length) return new Map<string, Date>();
  const rows = await db.reminders
    .aggregate<{ _id: string; at: Date }>([
      { $match: { fromUserId: me, toUserId: { $in: userIds } } },
      { $group: { _id: '$toUserId', at: { $max: '$createdAt' } } },
    ])
    .toArray();
  return new Map(rows.map((r) => [r._id, r.at]));
}

/** Friend rows from my point of view (matches the app's Friend type). */
async function serializeFriendships(rows: FriendshipDoc[], me: string, reminded?: Map<string, Date>) {
  const users = await usersById(
    rows.flatMap((r) => [r.requesterId, r.addresseeId]),
    me,
  );
  return rows.map((r) => {
    if (r.status === 'pending' && r.addresseeId === me) {
      // Incoming: shaped as "they asked me" (userId = them, friendId = me).
      return { id: r._id, userId: r.requesterId, friendId: me, friendUser: users.get(r.requesterId)!, status: r.status, createdAt: iso(r.createdAt)! };
    }
    const other = r.requesterId === me ? r.addresseeId : r.requesterId;
    const prefs = r.prefs?.[me];
    return {
      id: r._id,
      userId: me,
      friendId: other,
      friendUser: users.get(other)!,
      status: r.status,
      createdAt: iso(r.createdAt)!,
      ...(r.respondedAt ? { friendsSince: iso(r.respondedAt)! } : {}),
      ...(prefs?.nickname ? { nickname: prefs.nickname } : {}),
      ...(prefs?.pinned ? { pinned: true } : {}),
      ...(reminded?.get(other) ? { lastRemindedAt: iso(reminded.get(other)!)! } : {}),
    };
  });
}

const mine = (me: string) => ({ $or: [{ requesterId: me }, { addresseeId: me }] });

// ─── Me ──────────────────────────────────────────────────────────────────────

peopleRouter.get(
  '/me',
  route(async (req, res) => {
    const u = await db.users.findOne({ _id: req.user!.id });
    res.json(publicUser(u!, req.user!.id));
  }),
);

peopleRouter.patch(
  '/me',
  route(async (req, res) => {
    const body = z
      .object({
        name: z.string().trim().min(1).max(80).optional(),
        email: z.union([z.literal(''), z.string().trim().email().max(200)]).optional(),
        avatarUrl: z.string().url().max(500).optional(),
        currency: currencyCode.optional(),
      })
      .parse(req.body);
    const set: Partial<UserDoc> = { updatedAt: new Date() };
    if (body.name !== undefined) set.name = body.name;
    if (body.currency !== undefined) set.currency = body.currency;
    if (body.avatarUrl !== undefined) set.avatarUrl = body.avatarUrl;
    if (body.email !== undefined) {
      set.email = body.email || null; // '' clears it
      set.emailLower = body.email ? body.email.toLowerCase() : null;
    }
    const u = await db.users.findOneAndUpdate({ _id: req.user!.id }, { $set: set }, { returnDocument: 'after' });
    res.json(publicUser(u!, req.user!.id));
  }),
);

peopleRouter.delete(
  '/me',
  route(async (req, res) => {
    const me = req.user!.id;
    // Stop any paid subscription first so nobody is billed for a deleted account.
    const account = await getAccount(me);
    if (account.subscriptionId && env.STRIPE_SECRET_KEY && ['active', 'trialing', 'past_due'].includes(account.status)) {
      await stripe().subscriptions.cancel(account.subscriptionId);
      await saveAccount({ ...account, plan: 'free', status: 'canceled' });
    }
    // Shared expenses and payments stay correct for everyone else, so the user is
    // anonymised rather than deleted: no name, number or email remains.
    await db.friendships.deleteMany(mine(me));
    await db.groups.updateMany({ 'members.userId': me }, { $pull: { members: { userId: me } } });
    await db.reminders.deleteMany({ $or: [{ fromUserId: me }, { toUserId: me }] });
    // Receipt readings and Quick Add text are personal; the expenses made from them stay.
    await db.receipts.deleteMany({ userId: me });
    await db.aiUsage.deleteMany({ userId: me });
    await db.pushTokens.deleteMany({ userId: me });
    // Google Play / App Store subscriptions can only be cancelled by the user in
    // the store; the app reminds them before deleting.
    await db.users.updateOne(
      { _id: me },
      {
        $set: {
          name: 'Deleted user',
          phone: `deleted:${me}`,
          phoneHash: '',
          email: null,
          emailLower: null,
          avatarUrl: null,
          updatedAt: new Date(),
        },
      },
    );
    res.status(204).end();
  }),
);

// ─── Push notifications ──────────────────────────────────────────────────────

peopleRouter.post(
  '/me/push-tokens',
  route(async (req, res) => {
    const me = req.user!.id;
    const body = z
      .object({
        token: z.string().max(200).refine(isExpoPushToken, 'Not an Expo push token'),
        platform: z.enum(['ios', 'android']),
        lang: z.enum(['en', 'fr', 'es', 'hi']).default('en'),
      })
      .parse(req.body);
    // A phone belongs to whoever signed in last, so a shared phone never gets someone else's alerts.
    const now = new Date();
    await db.pushTokens.updateOne(
      { _id: body.token },
      { $set: { userId: me, platform: body.platform, lang: body.lang, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
    res.status(204).end();
  }),
);

peopleRouter.post(
  '/me/push-tokens/remove',
  route(async (req, res) => {
    const { token } = z.object({ token: z.string().max(200) }).parse(req.body);
    await db.pushTokens.deleteOne({ _id: token, userId: req.user!.id });
    res.status(204).end();
  }),
);

// ─── Search ──────────────────────────────────────────────────────────────────

peopleRouter.get(
  '/users/search',
  route(async (req, res) => {
    const me = req.user!.id;
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) return res.json([]);
    let rows: UserDoc[];
    if (/^\+[1-9]\d{6,14}$/.test(q)) {
      rows = await db.users.find({ phone: q, _id: { $ne: me } }).toArray();
    } else if (q.includes('@')) {
      rows = await db.users.find({ emailLower: q.toLowerCase(), _id: { $ne: me } }).toArray();
    } else {
      // Names only match people I already share a group with, so the directory can't be browsed.
      const groups = await db.groups.find({ _id: { $in: await myGroupIds(me) } }, { projection: { members: 1 } }).toArray();
      const ids = [...new Set(groups.flatMap((g) => g.members.map((m) => m.userId)))].filter((id) => id !== me);
      rows = await db.users
        .find({ _id: { $in: ids }, name: { $regex: escapeRegex(q), $options: 'i' } })
        .limit(20)
        .toArray();
    }
    res.json(rows.map((r) => publicUser(r, me)));
  }),
);

// ─── Friends ─────────────────────────────────────────────────────────────────

peopleRouter.get(
  '/friends',
  route(async (req, res) => {
    const me = req.user!.id;
    const rows = await db.friendships.find({ status: 'accepted', ...mine(me) }).toArray();
    const others = rows.map((r) => (r.requesterId === me ? r.addresseeId : r.requesterId));
    const list = await serializeFriendships(rows, me, await lastRemindedBy(me, others));
    res.json(list.sort((a, b) => a.friendUser.name.localeCompare(b.friendUser.name)));
  }),
);

peopleRouter.get(
  '/friends/requests',
  route(async (req, res) => {
    const me = req.user!.id;
    const rows = await db.friendships.find({ status: 'pending', ...mine(me) }).sort({ createdAt: -1 }).toArray();
    res.json(await serializeFriendships(rows, me));
  }),
);

peopleRouter.post(
  '/friends',
  route(async (req, res) => {
    const me = req.user!.id;
    const body = z.object({ userId: z.string().optional(), emailOrPhone: z.string().trim().max(200).optional() }).parse(req.body);
    let targetId = body.userId;
    if (!targetId && body.emailOrPhone) {
      const v = body.emailOrPhone;
      const found = await db.users.findOne(v.includes('@') ? { emailLower: v.toLowerCase() } : { phone: v }, { projection: { _id: 1 } });
      targetId = found?._id;
      if (!targetId) fail(404, 'No WhoOwes account for {who}. Send them an invite instead.', 'not_found', { who: v });
    }
    if (!targetId) fail(400, 'Who do you want to add?');
    if (targetId === me) fail(400, "That's you!");
    if (!(await db.users.findOne({ _id: targetId }, { projection: { _id: 1 } }))) fail(404, 'That person is not on WhoOwes.', 'not_found');

    const pair = pairKey(me, targetId);
    const existing = await db.friendships.findOne({ pair });
    if (existing?.status === 'accepted') fail(409, 'You are already friends.');
    if (existing && existing.requesterId === me) fail(409, 'Request already sent.');
    let result: FriendshipDoc | null;
    if (existing) {
      // They already asked me: adding them back accepts it.
      result = await db.friendships.findOneAndUpdate(
        { _id: existing._id, status: 'pending' },
        { $set: { status: 'accepted', respondedAt: new Date() } },
        { returnDocument: 'after' },
      );
      if (!result) fail(409, 'That request changed. Refresh and try again.');
    } else {
      result = { _id: randomUUID(), requesterId: me, addresseeId: targetId, pair, status: 'pending', createdAt: new Date(), respondedAt: null };
      try {
        await db.friendships.insertOne(result);
      } catch (err) {
        // Both people tapped "Add" at the same moment: the unique pair index stops a duplicate.
        if (isDuplicateKey(err)) fail(409, 'Request already sent.');
        throw err;
      }
    }
    const name = await nameOf(me);
    notify([
      result!.status === 'accepted'
        ? { userId: targetId, kind: 'friend_accepted', params: { name }, data: { type: 'friend_accepted', userId: me } }
        : { userId: targetId, kind: 'friend_request', params: { name }, data: { type: 'friend_request', userId: me } },
    ]);
    res.status(201).json((await serializeFriendships([result], me))[0]);
  }),
);

peopleRouter.post(
  '/friends/requests/:id/accept',
  route(async (req, res) => {
    const me = req.user!.id;
    const row = await db.friendships.findOneAndUpdate(
      { _id: String(req.params.id), addresseeId: me, status: 'pending' },
      { $set: { status: 'accepted', respondedAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (!row) fail(404, 'Request not found.');
    notify([
      { userId: row.requesterId, kind: 'friend_accepted', params: { name: await nameOf(me) }, data: { type: 'friend_accepted', userId: me } },
    ]);
    res.json((await serializeFriendships([row], me))[0]);
  }),
);

peopleRouter.post(
  '/friends/requests/:id/decline',
  route(async (req, res) => {
    const me = req.user!.id;
    await db.friendships.deleteOne({ _id: String(req.params.id), status: 'pending', ...mine(me) });
    res.status(204).end();
  }),
);

peopleRouter.patch(
  '/friends/:userId',
  route(async (req, res) => {
    const me = req.user!.id;
    const other = String(req.params.userId);
    const body = z
      .object({
        nickname: z.string().trim().max(30).nullable().optional(),
        pinned: z.boolean().optional(),
      })
      .parse(req.body ?? {});
    const set: Record<string, unknown> = {};
    if (body.nickname !== undefined) set[`prefs.${me}.nickname`] = body.nickname || null;
    if (body.pinned !== undefined) set[`prefs.${me}.pinned`] = body.pinned;
    if (!Object.keys(set).length) fail(400, 'Nothing to change.');
    const row = await db.friendships.findOneAndUpdate(
      { pair: pairKey(me, other), status: 'accepted' },
      { $set: set },
      { returnDocument: 'after' },
    );
    if (!row) fail(404, 'You are not friends with this person.', 'not_found');
    res.json((await serializeFriendships([row], me, await lastRemindedBy(me, [other])))[0]);
  }),
);

peopleRouter.delete(
  '/friends/:userId',
  route(async (req, res) => {
    await db.friendships.deleteOne({ pair: pairKey(req.user!.id, String(req.params.userId)) });
    res.status(204).end();
  }),
);

// ─── Reminders ───────────────────────────────────────────────────────────────

peopleRouter.post(
  '/friends/:userId/remind',
  route(async (req, res) => {
    const me = req.user!.id;
    const to = String(req.params.userId);
    const { amount, currency } = z
      .object({ amount: z.number().positive().optional(), currency: currencyCode.optional() })
      .parse(req.body ?? {});
    if (!(await canTransactWith(me, to)) || to === me) fail(403, 'You can only remind friends or people in your groups.');
    const recent = await db.reminders.findOne({ fromUserId: me, toUserId: to, createdAt: { $gt: new Date(Date.now() - 12 * HOUR) } });
    if (recent) fail(429, 'You already sent a reminder today. Give them a little time.', 'rate_limited');
    await db.reminders.insertOne({
      _id: randomUUID(),
      fromUserId: me,
      toUserId: to,
      amountCents: amount ? toCents(amount) : null,
      currency: amount ? (currency ?? null) : null,
      createdAt: new Date(),
      dismissedAt: null,
    });
    notify([
      {
        userId: to,
        kind: 'reminder',
        params: { name: await nameOf(me), cents: amount ? toCents(amount) : null, currency: amount ? (currency ?? null) : null },
        data: { type: 'reminder', userId: me },
      },
    ]);
    res.status(201).json({ ok: true });
  }),
);

peopleRouter.get(
  '/reminders',
  route(async (req, res) => {
    const me = req.user!.id;
    const rows = await db.reminders
      .find({ toUserId: me, dismissedAt: null, createdAt: { $gt: new Date(Date.now() - 14 * 24 * HOUR) } })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();
    const users = await usersById(
      rows.map((r) => r.fromUserId),
      me,
    );
    res.json(
      rows.map((r) => ({
        id: r._id,
        fromUser: users.get(r.fromUserId),
        amount: r.amountCents == null ? undefined : toAmount(r.amountCents),
        currency: r.currency ?? undefined,
        createdAt: iso(r.createdAt),
      })),
    );
  }),
);

peopleRouter.post(
  '/reminders/:id/dismiss',
  route(async (req, res) => {
    await db.reminders.updateOne({ _id: String(req.params.id), toUserId: req.user!.id }, { $set: { dismissedAt: new Date() } });
    res.status(204).end();
  }),
);

// ─── Contacts ────────────────────────────────────────────────────────────────

peopleRouter.post(
  '/contacts/match',
  route(async (req, res) => {
    const me = req.user!.id;
    const { hashes } = z.object({ hashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(5000) }).parse(req.body);
    if (limited(`match:${me}`, 30, HOUR)) fail(429, 'Too many attempts. Please wait a few minutes and try again.', 'rate_limited');
    if (hashes.length === 0) return res.json({ matches: [] });
    const rows = await db.users.find({ phoneHash: { $in: hashes }, _id: { $ne: me } }).toArray();
    res.json({ matches: rows.map((u) => ({ hash: u.phoneHash, user: publicUser(u, me) })) });
  }),
);
