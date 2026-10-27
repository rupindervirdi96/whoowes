/**
 * People: my profile, finding users, friendships, reminders and contact matching.
 *
 *   GET    /me                          my profile
 *   PATCH  /me                          { name?, email?, avatarUrl? }
 *   DELETE /me                          delete my account (required by the app stores)
 *   GET    /users/search?q=             exact phone/email, or names of people I share a group with
 *   GET    /friends                     accepted friends
 *   GET    /friends/requests            pending requests, both directions
 *   POST   /friends                     { userId } | { emailOrPhone }  → send a request
 *   POST   /friends/requests/:id/accept
 *   POST   /friends/requests/:id/decline   (addressee declines, or requester cancels)
 *   DELETE /friends/:userId
 *   POST   /friends/:userId/remind      { amount? }  → shows up in their "Needs your attention"
 *   GET    /reminders                   reminders sent to me in the last 14 days
 *   POST   /reminders/:id/dismiss
 *   POST   /contacts/match              { hashes: sha256(E.164)[] } → which contacts are on WhoOwes
 */

import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../auth.js';
import { db } from '../db/index.js';
import { stripe } from '../stripe.js';
import { getAccount, saveAccount } from '../store.js';
import { env } from '../env.js';
import { canTransactWith, fail, iso, publicUser, route, toAmount, toCents, usersById, type UserRow } from '../domain/common.js';
import { limited } from './phone.js';

export const peopleRouter = Router();
peopleRouter.use(requireUser);

interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted';
  created_at: Date;
}

/** Friend rows from my point of view (matches the app's Friend type). */
async function serializeFriendships(rows: FriendshipRow[], me: string) {
  const users = await usersById(rows.flatMap((r) => [r.requester_id, r.addressee_id]), me);
  return rows.map((r) => {
    if (r.status === 'pending' && r.addressee_id === me) {
      // Incoming: shaped as "they asked me" (userId = them, friendId = me).
      return { id: r.id, userId: r.requester_id, friendId: me, friendUser: users.get(r.requester_id)!, status: r.status, createdAt: iso(r.created_at)! };
    }
    const other = r.requester_id === me ? r.addressee_id : r.requester_id;
    return { id: r.id, userId: me, friendId: other, friendUser: users.get(other)!, status: r.status, createdAt: iso(r.created_at)! };
  });
}

const pairQuery = `select * from friendships where (requester_id = $1 and addressee_id = $2) or (requester_id = $2 and addressee_id = $1)`;

// ─── Me ──────────────────────────────────────────────────────────────────────

peopleRouter.get(
  '/me',
  route(async (req, res) => {
    const u = await db.one<UserRow>('select * from users where id = $1', [req.user!.id]);
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
      })
      .parse(req.body);
    const u = await db.one<UserRow>(
      `update users set name = coalesce($2, name), email = case when $3::text is null then email when $3 = '' then null else $3 end,
       avatar_url = coalesce($4, avatar_url), updated_at = now() where id = $1 returning *`,
      [req.user!.id, body.name ?? null, body.email ?? null, body.avatarUrl ?? null],
    );
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
    // Shared expenses and payments stay correct for everyone else, so the row is
    // anonymised rather than deleted: no name, number or email remains.
    await db.tx(async (q) => {
      await q.query('delete from friendships where requester_id = $1 or addressee_id = $1', [me]);
      await q.query('delete from group_members where user_id = $1', [me]);
      await q.query('delete from reminders where from_user_id = $1 or to_user_id = $1', [me]);
      await q.query(
        `update users set name = 'Deleted user', phone = $2, phone_hash = '', email = null, avatar_url = null, updated_at = now() where id = $1`,
        [me, `deleted:${me}`],
      );
    });
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
    let rows: UserRow[];
    if (/^\+[1-9]\d{6,14}$/.test(q)) {
      rows = (await db.query<UserRow>('select * from users where phone = $1 and id <> $2', [q, me])).rows;
    } else if (q.includes('@')) {
      rows = (await db.query<UserRow>('select * from users where lower(email) = lower($1) and id <> $2', [q, me])).rows;
    } else {
      // Names only match people I already share a group with, so the directory can't be browsed.
      rows = (
        await db.query<UserRow>(
          `select distinct u.* from users u join group_members m on m.user_id = u.id
           where m.group_id in (select group_id from group_members where user_id = $1)
             and u.id <> $1 and u.name ilike $2 limit 20`,
          [me, `%${q.replace(/[%_\\]/g, '\\$&')}%`],
        )
      ).rows;
    }
    res.json(rows.map((r) => publicUser(r, me)));
  }),
);

// ─── Friends ─────────────────────────────────────────────────────────────────

peopleRouter.get(
  '/friends',
  route(async (req, res) => {
    const me = req.user!.id;
    const { rows } = await db.query<FriendshipRow>(
      `select * from friendships where status = 'accepted' and (requester_id = $1 or addressee_id = $1)`,
      [me],
    );
    const list = await serializeFriendships(rows, me);
    res.json(list.sort((a, b) => a.friendUser.name.localeCompare(b.friendUser.name)));
  }),
);

peopleRouter.get(
  '/friends/requests',
  route(async (req, res) => {
    const me = req.user!.id;
    const { rows } = await db.query<FriendshipRow>(
      `select * from friendships where status = 'pending' and (requester_id = $1 or addressee_id = $1) order by created_at desc`,
      [me],
    );
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
      const found = v.includes('@')
        ? await db.one<{ id: string }>('select id from users where lower(email) = lower($1)', [v])
        : await db.one<{ id: string }>('select id from users where phone = $1', [v]);
      targetId = found?.id;
      if (!targetId) fail(404, `No WhoOwes account for ${v}. Send them an invite instead.`, 'not_found');
    }
    if (!targetId) fail(400, 'Who do you want to add?');
    if (targetId === me) fail(400, "That's you!");
    if (!(await db.one('select 1 from users where id = $1', [targetId]))) fail(404, 'That person is not on WhoOwes.', 'not_found');

    const result = await db.tx(async (q) => {
      const existing = (await q.query<FriendshipRow>(pairQuery, [me, targetId])).rows[0];
      if (existing?.status === 'accepted') fail(409, 'You are already friends.');
      if (existing && existing.requester_id === me) fail(409, 'Request already sent.');
      if (existing) {
        // They already asked me: adding them back accepts it.
        return (
          await q.query<FriendshipRow>(`update friendships set status = 'accepted', responded_at = now() where id = $1 returning *`, [existing.id])
        ).rows[0];
      }
      return (
        await q.query<FriendshipRow>(
          `insert into friendships (id, requester_id, addressee_id, status) values ($1, $2, $3, 'pending') returning *`,
          [randomUUID(), me, targetId],
        )
      ).rows[0];
    });
    res.status(201).json((await serializeFriendships([result], me))[0]);
  }),
);

peopleRouter.post(
  '/friends/requests/:id/accept',
  route(async (req, res) => {
    const me = req.user!.id;
    const row = await db.one<FriendshipRow>(
      `update friendships set status = 'accepted', responded_at = now()
       where id = $1 and addressee_id = $2 and status = 'pending' returning *`,
      [req.params.id, me],
    );
    if (!row) fail(404, 'Request not found.');
    res.json((await serializeFriendships([row], me))[0]);
  }),
);

peopleRouter.post(
  '/friends/requests/:id/decline',
  route(async (req, res) => {
    const me = req.user!.id;
    await db.query(`delete from friendships where id = $1 and status = 'pending' and (addressee_id = $2 or requester_id = $2)`, [
      req.params.id,
      me,
    ]);
    res.status(204).end();
  }),
);

peopleRouter.delete(
  '/friends/:userId',
  route(async (req, res) => {
    await db.query(
      'delete from friendships where (requester_id = $1 and addressee_id = $2) or (requester_id = $2 and addressee_id = $1)',
      [req.user!.id, req.params.userId],
    );
    res.status(204).end();
  }),
);

// ─── Reminders ───────────────────────────────────────────────────────────────

peopleRouter.post(
  '/friends/:userId/remind',
  route(async (req, res) => {
    const me = req.user!.id;
    const to = String(req.params.userId);
    const { amount } = z.object({ amount: z.number().positive().optional() }).parse(req.body ?? {});
    if (!(await canTransactWith(me, to)) || to === me) fail(403, 'You can only remind friends or people in your groups.');
    const recent = await db.one(
      `select 1 from reminders where from_user_id = $1 and to_user_id = $2 and created_at > now() - interval '12 hours'`,
      [me, to],
    );
    if (recent) fail(429, 'You already sent a reminder today. Give them a little time.', 'rate_limited');
    await db.query('insert into reminders (id, from_user_id, to_user_id, amount_cents) values ($1, $2, $3, $4)', [
      randomUUID(),
      me,
      to,
      amount ? toCents(amount) : null,
    ]);
    res.status(201).json({ ok: true });
  }),
);

peopleRouter.get(
  '/reminders',
  route(async (req, res) => {
    const me = req.user!.id;
    const { rows } = await db.query<{ id: string; from_user_id: string; amount_cents: number | null; created_at: Date }>(
      `select id, from_user_id, amount_cents, created_at from reminders
       where to_user_id = $1 and dismissed_at is null and created_at > now() - interval '14 days'
       order by created_at desc limit 20`,
      [me],
    );
    const users = await usersById(rows.map((r) => r.from_user_id), me);
    res.json(
      rows.map((r) => ({
        id: r.id,
        fromUser: users.get(r.from_user_id),
        amount: r.amount_cents == null ? undefined : toAmount(r.amount_cents),
        createdAt: iso(r.created_at),
      })),
    );
  }),
);

peopleRouter.post(
  '/reminders/:id/dismiss',
  route(async (req, res) => {
    await db.query('update reminders set dismissed_at = now() where id = $1 and to_user_id = $2', [req.params.id, req.user!.id]);
    res.status(204).end();
  }),
);

// ─── Contacts ────────────────────────────────────────────────────────────────

peopleRouter.post(
  '/contacts/match',
  route(async (req, res) => {
    const me = req.user!.id;
    const { hashes } = z.object({ hashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(5000) }).parse(req.body);
    if (limited(`match:${me}`, 30, 60 * 60_000)) fail(429, 'Too many attempts. Please wait a few minutes and try again.', 'rate_limited');
    if (hashes.length === 0) return res.json({ matches: [] });
    const { rows } = await db.query<UserRow & { phone_hash: string }>(
      'select * from users where phone_hash = any($1::text[]) and id <> $2',
      [hashes, me],
    );
    res.json({ matches: rows.map((u) => ({ hash: u.phone_hash, user: publicUser(u, me) })) });
  }),
);
