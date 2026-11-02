/**
 * AI passes: every AI feature has a few free uses a month; after that, each use
 * is unlocked by watching a rewarded ad.
 *
 * Everything is counted here, by the server's clock. The phone's date and time
 * are never used, so changing them can't reset anything.
 *
 * Ad unlocks:
 *   1. POST /ai/ad/start   the server notes the time and returns a session id
 *   2. the app shows the ad, passing the session id to AdMob (custom data)
 *   3. AdMob calls GET /ai/ad/ssv with a signed confirmation (server-side verification)
 *   4. POST /ai/ad/claim   counts once AD_UNLOCK_SECONDS of server time have passed
 *                          (and, if ADMOB_SSV_REQUIRED, once step 3 has arrived)
 */

import { createVerify, randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { db, type AIFeature } from './db/index.js';
import { env } from './env.js';
import { fail } from './domain/common.js';

export const AI_FEATURES: AIFeature[] = ['receipt_scan', 'quick_add', 'split_assistant', 'insights'];

/** This month by the server's clock (UTC): "2026-11". */
export const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);

/** When the free uses come back: the first moment of next month, UTC. */
export function nextReset(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

const usageId = (userId: string, month = monthKey()) => `${userId}:${month}`;

export interface FeaturePass {
  feature: AIFeature;
  freeLimit: number;
  freeUsed: number;
  /** Uses unlocked by ads and not spent yet. */
  unlocked: number;
  /** Uses available right now without watching an ad. */
  available: number;
}

export interface PassStatus {
  month: string;
  /** ISO time when free uses reset (server time). */
  resetsAt: string;
  adSeconds: number;
  features: FeaturePass[];
}

export async function passStatus(userId: string): Promise<PassStatus> {
  const doc = await db.aiUsage.findOne({ _id: usageId(userId) });
  return {
    month: monthKey(),
    resetsAt: nextReset().toISOString(),
    adSeconds: env.AD_UNLOCK_SECONDS,
    features: AI_FEATURES.map((feature) => {
      const freeUsed = doc?.free?.[feature] ?? 0;
      const unlocked = doc?.unlocked?.[feature] ?? 0;
      return {
        feature,
        freeLimit: env.AI_FREE_PER_MONTH,
        freeUsed,
        unlocked,
        available: Math.max(0, env.AI_FREE_PER_MONTH - freeUsed) + unlocked,
      };
    }),
  };
}

/** A use that's been taken. Give it back if the AI call fails, so a failure costs nothing. */
export interface TakenPass {
  refund: () => Promise<void>;
}

/**
 * Takes one use of a feature: a free one if any are left this month, otherwise
 * one unlocked by an ad. Throws 402 `ad_required` when there's neither.
 * Each step is a single conditional update, so two requests at once can't both
 * take the last use.
 */
export async function takePass(userId: string, feature: AIFeature): Promise<TakenPass> {
  const month = monthKey();
  const _id = usageId(userId, month);
  await db.aiUsage.updateOne({ _id }, { $setOnInsert: { userId, month } }, { upsert: true });

  const free = await db.aiUsage.updateOne(
    { _id, $expr: { $lt: [{ $ifNull: [`$free.${feature}`, 0] }, env.AI_FREE_PER_MONTH] } },
    { $inc: { [`free.${feature}`]: 1 } },
  );
  if (free.modifiedCount === 1) {
    return { refund: async () => void (await db.aiUsage.updateOne({ _id, [`free.${feature}`]: { $gte: 1 } }, { $inc: { [`free.${feature}`]: -1 } })) };
  }

  const unlocked = await db.aiUsage.updateOne(
    { _id, [`unlocked.${feature}`]: { $gte: 1 } },
    { $inc: { [`unlocked.${feature}`]: -1, [`adUsed.${feature}`]: 1 } },
  );
  if (unlocked.modifiedCount === 1) {
    return {
      refund: async () => void (await db.aiUsage.updateOne({ _id }, { $inc: { [`unlocked.${feature}`]: 1, [`adUsed.${feature}`]: -1 } })),
    };
  }

  fail(402, "You've used this month's free AI uses. Watch a short ad to unlock one more.", 'ad_required', undefined, { feature });
}

// ─── Ad unlocks ──────────────────────────────────────────────────────────────

const DAY = 24 * 60 * 60_000;

/** Starts an ad. The server's clock starts now. */
export async function startAd(userId: string, feature: AIFeature) {
  const today = await db.adSessions.countDocuments({ userId, startedAt: { $gt: new Date(Date.now() - DAY) } });
  if (today >= env.AD_UNLOCKS_PER_DAY) {
    fail(429, "That's the most ads for today. Your free uses come back on the 1st.", 'ad_limit');
  }
  const session = { _id: randomUUID(), userId, feature, startedAt: new Date(), verifiedAt: null, transactionId: null, claimedAt: null };
  await db.adSessions.insertOne(session);
  return { sessionId: session._id, adSeconds: env.AD_UNLOCK_SECONDS, verificationRequired: env.ADMOB_SSV_REQUIRED };
}

/**
 * Turns a watched ad into one use. Refused until the full ad time has passed on
 * the server's clock, and (when required) until AdMob has confirmed the reward.
 */
export async function claimAd(userId: string, sessionId: string) {
  const session = await db.adSessions.findOne({ _id: sessionId, userId });
  if (!session) fail(404, 'That ad session has expired. Try again.', 'ad_not_found');
  if (session.claimedAt) fail(409, 'This ad has already unlocked a use.', 'ad_claimed');

  const waitMs = session.startedAt.getTime() + env.AD_UNLOCK_SECONDS * 1000 - Date.now();
  if (waitMs > 0) {
    fail(425, 'Almost there. Finish the ad to unlock.', 'ad_too_soon', undefined, { retryAfter: Math.ceil(waitMs / 1000) });
  }
  if (env.ADMOB_SSV_REQUIRED && !session.verifiedAt) {
    fail(425, 'Waiting for the ad to be confirmed…', 'ad_unverified', undefined, { retryAfter: 2 });
  }
  // Mark claimed first, conditionally, so a double tap can't unlock two uses.
  const claimed = await db.adSessions.updateOne({ _id: sessionId, claimedAt: null }, { $set: { claimedAt: new Date() } });
  if (claimed.modifiedCount !== 1) fail(409, 'This ad has already unlocked a use.', 'ad_claimed');

  const month = monthKey();
  await db.aiUsage.updateOne(
    { _id: usageId(userId, month) },
    { $inc: { [`unlocked.${session.feature}`]: 1 }, $setOnInsert: { userId, month } },
    { upsert: true },
  );
  return passStatus(userId);
}

// ─── AdMob server-side verification ─────────────────────────────────────────

const KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';
let keyCache: { at: number; keys: Map<string, string> } | null = null;

async function verifierKey(keyId: string): Promise<string | undefined> {
  if (!keyCache || Date.now() - keyCache.at > DAY || !keyCache.keys.has(keyId)) {
    const res = await fetch(KEYS_URL);
    if (!res.ok) throw new Error(`AdMob keys ${res.status}`);
    const body = (await res.json()) as { keys: Array<{ keyId: number | string; pem: string }> };
    keyCache = { at: Date.now(), keys: new Map(body.keys.map((k) => [String(k.keyId), k.pem])) };
  }
  return keyCache.keys.get(keyId);
}

/**
 * GET /ai/ad/ssv — AdMob calls this when someone earns a reward. The query string
 * is signed by Google; anything that doesn't verify is ignored. Set this URL as
 * the ad unit's server-side verification callback in AdMob.
 */
export async function admobCallback(req: Request, res: Response) {
  try {
    const raw = req.originalUrl.split('?')[1] ?? '';
    const sigAt = raw.indexOf('&signature=');
    if (sigAt < 0) return res.status(400).send('unsigned');
    const message = raw.slice(0, sigAt); // everything before the signature is what Google signed
    const params = new URLSearchParams(raw);
    const signature = params.get('signature') ?? '';
    const keyId = params.get('key_id') ?? '';
    const pem = await verifierKey(keyId);
    if (!pem) return res.status(400).send('unknown key');
    const ok = createVerify('SHA256').update(message).verify(pem, Buffer.from(signature.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
    if (!ok) return res.status(400).send('bad signature');

    // The app sets user_id = the WhoOwes user id and custom_data = the ad session id.
    const sessionId = params.get('custom_data') ?? '';
    const userId = params.get('user_id') ?? '';
    const transactionId = params.get('transaction_id') ?? '';
    if (sessionId && userId) {
      await db.adSessions
        .updateOne({ _id: sessionId, userId, verifiedAt: null }, { $set: { verifiedAt: new Date(), transactionId: transactionId || null } })
        .catch(() => undefined); // a repeated transaction id is simply ignored
    }
    // Always 200 for a valid signature, so AdMob doesn't keep retrying.
    res.status(200).send('ok');
  } catch (err) {
    console.error('[ads] verification failed:', err instanceof Error ? err.message : err);
    res.status(500).send('error');
  }
}
