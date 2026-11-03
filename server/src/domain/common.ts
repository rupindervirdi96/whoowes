/**
 * Shared helpers for the data routes: errors, money, user profiles and the
 * relationship checks that decide who can see or do what.
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { db, type UserDoc } from '../db/index.js';

/**
 * Throw from a route; the error handler turns it into JSON. Write the message in
 * English with {placeholders}; it is translated to the user's language on the way out.
 * `data` is sent along as-is (e.g. { retryAfter: 12 }).
 */
export function fail(
  status: number,
  message: string,
  code?: string,
  params?: Record<string, string | number>,
  data?: Record<string, unknown>,
): never {
  throw Object.assign(new Error(message), { status, code, params, data });
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

/** One key per pair of people, whichever way round they are given. */
export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Escapes text for use inside a regular expression. */
export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ─── Users ───────────────────────────────────────────────────────────────────

/** What the app sees about a person. Phone and email are only shown to their owner. */
export function publicUser(u: UserDoc, viewerId: string) {
  const self = u._id === viewerId;
  return {
    id: u._id,
    name: u.name,
    email: self ? (u.email ?? '') : '',
    phone: self ? u.phone : undefined,
    avatarUrl: u.avatarUrl ?? undefined,
    /** Preferred currency (only sent to its owner). */
    currency: self ? (u.currency ?? undefined) : undefined,
    createdAt: iso(u.createdAt)!,
    updatedAt: iso(u.updatedAt)!,
  };
}
export type PublicUser = ReturnType<typeof publicUser>;

export async function usersById(ids: Iterable<string>, viewerId: string) {
  const list = [...new Set(ids)];
  const map = new Map<string, PublicUser>();
  if (list.length === 0) return map;
  for (const u of await db.users.find({ _id: { $in: list } }).toArray()) map.set(u._id, publicUser(u, viewerId));
  return map;
}

export const deletedUser = (id: string): PublicUser => ({
  id,
  name: 'Deleted user',
  email: '',
  avatarUrl: undefined,
  phone: undefined,
  currency: undefined,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
});

// ─── Relationships ───────────────────────────────────────────────────────────

export async function areFriends(a: string, b: string) {
  return !!(await db.friendships.findOne({ pair: pairKey(a, b), status: 'accepted' }, { projection: { _id: 1 } }));
}

export async function isGroupMember(groupId: string, userId: string) {
  return !!(await db.groups.findOne({ _id: groupId, 'members.userId': userId }, { projection: { _id: 1 } }));
}

/** I can see an expense if I paid, I'm in the split, or it's in one of my groups. */
export async function getVisibleExpense(id: string, me: string) {
  const e = await db.expenses.findOne({ _id: id });
  if (!e) fail(404, 'Expense not found.');
  if (e.participants.includes(me)) return e;
  if (e.groupId && (await isGroupMember(e.groupId, me))) return e;
  fail(404, 'Expense not found.');
}

/** Ids of the groups I'm in. */
export async function myGroupIds(userId: string) {
  return (await db.groups.find({ 'members.userId': userId }, { projection: { _id: 1 } }).toArray()).map((g) => g._id);
}

export async function shareAGroup(a: string, b: string) {
  return !!(await db.groups.findOne({ 'members.userId': { $all: [a, b] } }, { projection: { _id: 1 } }));
}

/** People I can split with or pay: friends, or anyone I share a group with. */
export async function canTransactWith(me: string, other: string) {
  if (me === other) return true;
  return (await areFriends(me, other)) || (await shareAGroup(me, other));
}

/**
 * What b owes a, per currency, in cents (negative: a owes b). Unpaid splits and
 * confirmed payments between just these two; optionally only inside one group.
 */
export async function pairNet(a: string, b: string, groupId?: string): Promise<Map<string, number>> {
  const net = new Map<string, number>();
  const add = (currency: string, cents: number) => net.set(currency, (net.get(currency) ?? 0) + cents);
  const inGroup = groupId ? { groupId } : {};
  const expenses = await db.expenses
    .find({ participants: { $all: [a, b] }, paidBy: { $in: [a, b] }, ...inGroup }, { projection: { paidBy: 1, splits: 1, currency: 1 } })
    .toArray();
  for (const e of expenses) {
    const debtor = e.paidBy === a ? b : a;
    const split = e.splits.find((s) => s.userId === debtor && !s.paid);
    if (split) add(e.currency, e.paidBy === a ? split.amountCents : -split.amountCents);
  }
  const payments = await db.settlements
    .find({ status: 'confirmed', $or: [{ fromUserId: a, toUserId: b }, { fromUserId: b, toUserId: a }], ...inGroup })
    .toArray();
  for (const p of payments) add(p.currency, p.fromUserId === a ? p.amountCents : -p.amountCents);
  for (const [c, v] of net) if (v === 0) net.delete(c);
  return net;
}

/** The biggest open amount between two people, signed like pairNet; null when square. */
export function mainBalance(net: Map<string, number>): { currency: string; cents: number } | null {
  let best: { currency: string; cents: number } | null = null;
  for (const [currency, cents] of net) if (!best || Math.abs(cents) > Math.abs(best.cents)) best = { currency, cents };
  return best;
}

/**
 * People I can pay or remind: anyone I can split with, plus anyone I still have
 * money open with. Leaving a group, or the group being deleted, never strands a debt.
 */
export async function canSettleWith(me: string, other: string) {
  if (me === other) return false;
  return (await canTransactWith(me, other)) || (await pairNet(me, other)).size > 0;
}
