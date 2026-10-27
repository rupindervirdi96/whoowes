/**
 * Shared helpers for the data routes: errors, money, user profiles and the
 * relationship checks that decide who can see or do what.
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { db, type UserDoc } from '../db/index.js';

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
