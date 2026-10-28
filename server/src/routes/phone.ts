/**
 * Phone sign-in.
 *
 *   POST /auth/phone/start    { phone }                 → texts a 6-digit code
 *   POST /auth/phone/verify   { phone, code, name? }    → { user, token, isNewUser }
 *
 * Codes are sent and checked by Twilio Verify. A development server without
 * Twilio credentials accepts 123456 instead, so the flow can be tried locally.
 *
 * App store reviewers can't receive our texts, so REVIEW_PHONE + REVIEW_CODE
 * (set on the server) give them one sign-in that skips Twilio.
 */

import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { signSession } from '../auth.js';
import { devCodesAllowed, env, reviewLogin, twilioConfigured } from '../env.js';
import { db } from '../db/index.js';
import { publicUser } from '../domain/common.js';

export const phoneRouter = Router();

const DEV_CODE = '123456';
export const hashPhone = (e164: string) => createHash('sha256').update(e164).digest('hex');
const findByPhone = (phone: string) => db.users.findOne({ phone });

const e164 = z.string().regex(/^\+[1-9]\d{6,14}$/, 'Phone number must be in international format, e.g. +14155550123');

// ─── Rate limits ─────────────────────────────────────────────────────────────
// Texting codes costs money and is a fraud target ("SMS pumping"), so sends are
// limited per number and per IP. In-memory: fine for one instance; use Redis
// (or your gateway's limiter) when you run several.

const hits = new Map<string, number[]>();
export function limited(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}
const clientIp = (req: Request) => req.ip ?? 'unknown';

function tooMany(message = 'Too many attempts. Please wait a few minutes and try again.') {
  return Object.assign(new Error(message), { status: 429, code: 'rate_limited' });
}

// ─── Twilio Verify ───────────────────────────────────────────────────────────

async function twilio(path: string, form: Record<string, string>) {
  const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
  const res = await fetch(`https://verify.twilio.com/v2/Services/${env.TWILIO_VERIFY_SERVICE_SID}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form),
  });
  const body = (await res.json().catch(() => ({}))) as { status?: string; message?: string; code?: number };
  return { ok: res.ok, httpStatus: res.status, body };
}

const isReviewPhone = (phone: string) => !!reviewLogin && phone === reviewLogin.phone;

async function sendCode(phone: string) {
  if (isReviewPhone(phone)) {
    console.log('[phone] reviewer sign-in started (no text sent)');
    return;
  }
  if (devCodesAllowed) {
    console.log(`[phone] dev mode: code for ${phone} is ${DEV_CODE}`);
    return;
  }
  if (!twilioConfigured) {
    throw Object.assign(new Error('Phone sign-in is not set up on this server yet.'), { status: 503, code: 'phone_unavailable' });
  }
  const r = await twilio('Verifications', { To: phone, Channel: 'sms' });
  if (!r.ok) {
    console.error('[phone] Twilio send failed', r.httpStatus, r.body.code, r.body.message);
    // 60200 = invalid number, 60203 = too many sends to this number
    if (r.body.code === 60200) throw Object.assign(new Error("That phone number doesn't look right."), { status: 400, code: 'invalid_phone' });
    if (r.body.code === 60203) throw tooMany();
    throw Object.assign(new Error("We couldn't send a code right now. Please try again."), { status: 502, code: 'sms_failed' });
  }
}

async function checkCode(phone: string, code: string): Promise<boolean> {
  if (isReviewPhone(phone)) {
    const a = Buffer.from(code);
    const b = Buffer.from(reviewLogin!.code);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  if (devCodesAllowed) return code === DEV_CODE;
  const r = await twilio('VerificationCheck', { To: phone, Code: code });
  if (r.httpStatus === 404) return false; // expired or already used
  if (!r.ok) {
    console.error('[phone] Twilio check failed', r.httpStatus, r.body.code, r.body.message);
    throw Object.assign(new Error("We couldn't check that code. Please try again."), { status: 502, code: 'sms_failed' });
  }
  return r.body.status === 'approved';
}

// ─── Routes ──────────────────────────────────────────────────────────────────

phoneRouter.post('/start', async (req, res, next) => {
  try {
    const { phone } = z.object({ phone: e164 }).parse(req.body);
    if (limited(`send:${phone}`, 5, 60 * 60_000) || limited(`send-ip:${clientIp(req)}`, 20, 60 * 60_000)) throw tooMany();
    await sendCode(phone);
    res.json({ isNewUser: !(await findByPhone(phone)), devCode: devCodesAllowed ? DEV_CODE : undefined });
  } catch (err) {
    next(err);
  }
});

phoneRouter.post('/verify', async (req, res, next) => {
  try {
    const body = z
      .object({ phone: e164, code: z.string().regex(/^\d{4,8}$/), name: z.string().trim().min(1).max(80).optional() })
      .parse(req.body);
    if (limited(`check:${body.phone}`, 10, 15 * 60_000)) throw tooMany();
    if (!(await checkCode(body.phone, body.code))) {
      return res.status(400).json({ message: "That code isn't right. Check the text and try again.", code: 'invalid_code' });
    }
    let user = await findByPhone(body.phone);
    const isNewUser = !user;
    if (!user) {
      if (!body.name) return res.status(400).json({ message: 'Tell us your name to finish signing up.', code: 'name_required' });
      // Upsert on the unique phone index: if two sign-ups race, both get the same account.
      const now = new Date();
      user = (await db.users.findOneAndUpdate(
        { phone: body.phone },
        {
          $setOnInsert: {
            _id: randomUUID(),
            phone: body.phone,
            phoneHash: hashPhone(body.phone),
            name: body.name,
            email: null,
            emailLower: null,
            avatarUrl: null,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true, returnDocument: 'after' },
      ))!;
    }
    res.json({ isNewUser, token: signSession(user._id), user: publicUser(user, user._id) });
  } catch (err) {
    next(err);
  }
});
