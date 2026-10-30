/**
 * Phone sign-in.
 *
 *   POST /auth/phone/start    { phone }                 → texts a 6-digit code
 *   POST /auth/phone/verify   { phone, code, name?, currency? }  → { user, token, isNewUser }
 *
 * The text goes out in the app's language (Accept-Language: en, fr, es or hi).
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
import { currencyCode } from '../currency.js';
import { langOf, type Lang } from '../i18n.js';

export const phoneRouter = Router();

const DEV_CODE = '123456';
export const hashPhone = (e164: string) => createHash('sha256').update(e164).digest('hex');
const findByPhone = (phone: string) => db.users.findOne({ phone });

const e164 = z.string().regex(/^\+[1-9]\d{6,14}$/, 'Phone number must be in international format, e.g. +14155550123');

// ─── Rate limits ─────────────────────────────────────────────────────────────
// A resend costs a cent or two, so a person who mistypes their number only waits
// a few minutes. The per-IP cap is what stops bots texting thousands of numbers
// ("SMS pumping"); Twilio's Fraud Guard and Geo permissions back it up.
// In-memory: fine for one instance; use Redis (or your gateway's limiter) when you run several.

const MINUTE = 60_000;
const hits = new Map<string, number[]>();

/** 0 if allowed (and counted), otherwise the milliseconds until the next try is allowed. */
export function limited(key: string, max: number, windowMs: number): number {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.set(key, recent);
  if (recent.length >= max) return recent[0] + windowMs - now;
  recent.push(now);
  return 0;
}
const clientIp = (req: Request) => req.ip ?? 'unknown';

function tooMany(waitMs: number) {
  const minutes = Math.max(1, Math.ceil(waitMs / MINUTE));
  return Object.assign(new Error('Too many attempts. Please wait {minutes} min and try again.'), {
    status: 429,
    code: 'rate_limited',
    params: { minutes },
  });
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

async function sendCode(phone: string, lang: Lang) {
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
  // Twilio Verify writes the text itself, in the app's language.
  const r = await twilio('Verifications', { To: phone, Channel: 'sms', Locale: lang });
  if (!r.ok) {
    console.error('[phone] Twilio send failed', r.httpStatus, r.body.code, r.body.message);
    // 60200 = invalid number, 60203 = too many sends to this number
    if (r.body.code === 60200) throw Object.assign(new Error("That phone number doesn't look right."), { status: 400, code: 'invalid_phone' });
    // Twilio's own cap: 5 sends to one number in 10 minutes.
    if (r.body.code === 60203) throw tooMany(10 * MINUTE);
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
  // 60202: five wrong tries on this code; Twilio won't accept it any more.
  if (r.body.code === 60202) {
    throw Object.assign(new Error('Too many wrong codes. Ask for a new code and try again.'), { status: 429, code: 'code_locked' });
  }
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
    // Per number: 3 codes per 3 minutes. Per IP: 20 an hour.
    const wait = limited(`send:${phone}`, 3, 3 * MINUTE) || limited(`send-ip:${clientIp(req)}`, 20, 60 * MINUTE);
    if (wait) throw tooMany(wait);
    await sendCode(phone, langOf(req));
    res.json({ isNewUser: !(await findByPhone(phone)), devCode: devCodesAllowed ? DEV_CODE : undefined });
  } catch (err) {
    next(err);
  }
});

phoneRouter.post('/verify', async (req, res, next) => {
  try {
    const body = z
      .object({
        phone: e164,
        code: z.string().regex(/^\d{4,8}$/),
        name: z.string().trim().min(1).max(80).optional(),
        // New accounts start with the currency of the phone's region.
        currency: currencyCode.optional(),
      })
      .parse(req.body);
    // Wrong codes cost nothing; Twilio also locks a code after 5 wrong tries.
    const wait = limited(`check:${body.phone}`, 10, 3 * MINUTE);
    if (wait) throw tooMany(wait);
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
            currency: body.currency ?? null,
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
