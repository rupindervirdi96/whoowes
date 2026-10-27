/**
 * Shared helpers for the data routes: errors, money, user profiles and the
 * relationship checks that decide who can see or do what.
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { db, type Queryable } from '../db/index.js';

/** Throw from a route; the error handler turns it into JSON. */
export function fail(status: number, message: string, code?: string): never {
  throw Object.assign(new Error(message), { status, code });
}

/** Wraps an async route so thrown errors reach Express. */
export const route =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

export const toCents = (amount: number) => Math.round(amount * 100);
export const toAmount = (cents: number) => Math.round(cents) / 100;
export const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : undefined);

// ─── Users ───────────────────────────────────────────────────────────────────

export interface UserRow {
  id: string;
  phone: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  created_at: Date;
  updated_at: Date;
}

/** What the app sees about a person. Phone and email are only shown to their owner. */
export function publicUser(u: UserRow, viewerId: string) {
  const self = u.id === viewerId;
  return {
    id: u.id,
    name: u.name,
    email: self ? (u.email ?? '') : '',
    phone: self ? u.phone : undefined,
    avatarUrl: u.avatar_url ?? undefined,
    createdAt: iso(u.created_at)!,
    updatedAt: iso(u.updated_at)!,
  };
}
export type PublicUser = ReturnType<typeof publicUser>;

export async function usersById(ids: Iterable<string>, viewerId: string, q: Queryable = db) {
  const list = [...new Set(ids)];
  const map = new Map<string, PublicUser>();
  if (list.length === 0) return map;
  const { rows } = await q.query<UserRow>('select * from users where id = any($1::text[])', [list]);
  for (const r of rows) map.set(r.id, publicUser(r, viewerId));
  return map;
}

export const deletedUser = (id: string): PublicUser => ({
  id,
  name: 'Deleted user',
  email: '',
  avatarUrl: undefined,
  phone: undefined,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
});

// ─── Relationships ───────────────────────────────────────────────────────────

export async function areFriends(a: string, b: string, q: Queryable = db) {
  return !!(await q
    .query(
      `select 1 from friendships where status = 'accepted'
       and ((requester_id = $1 and addressee_id = $2) or (requester_id = $2 and addressee_id = $1))`,
      [a, b],
    )
    .then((r) => r.rows[0]));
}

export async function isGroupMember(groupId: string, userId: string, q: Queryable = db) {
  return !!(await q.query('select 1 from group_members where group_id = $1 and user_id = $2', [groupId, userId]).then((r) => r.rows[0]));
}

export async function shareAGroup(a: string, b: string, q: Queryable = db) {
  return !!(await q
    .query(
      'select 1 from group_members x join group_members y on x.group_id = y.group_id where x.user_id = $1 and y.user_id = $2 limit 1',
      [a, b],
    )
    .then((r) => r.rows[0]));
}

/** People I can split with or pay: friends, or anyone I share a group with. */
export async function canTransactWith(me: string, other: string, q: Queryable = db) {
  if (me === other) return true;
  return (await areFriends(me, other, q)) || (await shareAGroup(me, other, q));
}
