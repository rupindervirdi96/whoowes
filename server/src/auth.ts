/**
 * Sessions: after phone verification the server issues an HS256 JWT (30 days).
 * Every protected route reads `Authorization: Bearer <token>`, verifies it and
 * checks the user still exists.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { jwtSecret } from './env.js';
import { db } from './db/index.js';

export interface AuthUser {
  id: string;
  name: string;
  /** May be empty: phone accounts have no email until they add one. */
  email: string;
  phone: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const b64url = (b: Buffer | string) =>
  Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const b64urlDecode = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const SESSION_SECONDS = 60 * 60 * 24 * 30;

export function signSession(userId: string): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({ sub: userId, iat: now, exp: now + SESSION_SECONDS }));
  const signature = b64url(createHmac('sha256', jwtSecret).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${signature}`;
}

/** Returns the user id if the token is genuine and unexpired. */
export function verifySession(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  try {
    if (JSON.parse(b64urlDecode(header).toString('utf8')).alg !== 'HS256') return null;
    const expected = createHmac('sha256', jwtSecret).update(`${header}.${payload}`).digest();
    const given = b64urlDecode(signature);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const claims = JSON.parse(b64urlDecode(payload).toString('utf8')) as { sub?: string; exp?: number };
    if (!claims.sub || (claims.exp && claims.exp * 1000 < Date.now())) return null;
    return claims.sub;
  } catch {
    return null;
  }
}

const unauthorized = (res: Response) => res.status(401).json({ message: 'Please sign in again.', code: 'unauthorized' });

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
    const userId = token ? verifySession(token) : null;
    if (!userId) return unauthorized(res);
    const user = await db.users.findOne({ _id: userId }, { projection: { name: 1, email: 1, phone: 1 } });
    if (!user) return unauthorized(res);
    req.user = { id: user._id, name: user.name, email: user.email ?? '', phone: user.phone };
    next();
  } catch (err) {
    next(err);
  }
}
