/**
 * Google Play (and later App Store) subscriptions, through RevenueCat.
 *
 * The app buys with the RevenueCat SDK, using our user id as RevenueCat's
 * "app user id". RevenueCat checks every purchase with Google, and this server
 * reads the result from RevenueCat's REST API:
 *   - right after a purchase (POST /billing/sync from the app), and
 *   - whenever RevenueCat sends a webhook (renewal, cancellation, expiry, refund…).
 *
 * RevenueCat setup this code relies on:
 *   - entitlements named exactly `plus` and `pro`
 *   - Google Play base plans whose ids contain "month" or "year" (e.g. `monthly`, `yearly`)
 */

import { timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { db } from './db/index.js';
import { env, revenueCatConfigured } from './env.js';
import type { BillingInterval, PaidPlanId } from './plans.js';
import { saveStoreSubscription, type StoreSubscription, type SubscriptionStatus } from './store.js';

const API = 'https://api.revenuecat.com/v1';

interface RcEntitlement {
  expires_date: string | null;
  grace_period_expires_date?: string | null;
  product_identifier: string;
  product_plan_identifier?: string | null;
}

interface RcSubscription {
  expires_date: string | null;
  grace_period_expires_date?: string | null;
  period_type?: string;
  store?: string;
  unsubscribe_detected_at?: string | null;
  billing_issues_detected_at?: string | null;
  product_plan_identifier?: string | null;
}

export interface RcSubscriber {
  entitlements?: Record<string, RcEntitlement>;
  subscriptions?: Record<string, RcSubscription>;
}

function unavailable(): never {
  throw Object.assign(new Error('App store subscriptions are not set up on this server yet.'), {
    status: 503,
    code: 'billing_unavailable',
  });
}

async function fetchSubscriber(appUserId: string): Promise<RcSubscriber> {
  if (!revenueCatConfigured) unavailable();
  const res = await fetch(`${API}/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${env.REVENUECAT_SECRET_KEY}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    console.error('[revenuecat] subscriber lookup failed', res.status, await res.text().catch(() => ''));
    throw Object.assign(new Error("We couldn't check your subscription. Please try again."), { status: 502, code: 'billing_upstream' });
  }
  const body = (await res.json()) as { subscriber?: RcSubscriber };
  return body.subscriber ?? {};
}

const latest = (...dates: (string | null | undefined)[]) =>
  dates.filter((d): d is string => !!d).sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;

/** Turns RevenueCat's view of a customer into the plan they should have. */
export function storeSubscriptionFrom(subscriber: RcSubscriber, now = Date.now()): StoreSubscription | null {
  for (const plan of ['pro', 'plus'] as PaidPlanId[]) {
    const ent = subscriber.entitlements?.[plan];
    if (!ent) continue;
    const ends = latest(ent.expires_date, ent.grace_period_expires_date);
    // No expiry date means a lifetime purchase.
    if (ent.expires_date && (!ends || Date.parse(ends) <= now)) continue;

    const productId = ent.product_identifier;
    const sub = subscriber.subscriptions?.[productId] ?? subscriber.subscriptions?.[productId.split(':')[0]];
    const planName = `${productId} ${sub?.product_plan_identifier ?? ent.product_plan_identifier ?? ''}`;
    const interval: BillingInterval = /year|annual|p1y/i.test(planName) ? 'year' : 'month';

    let status: SubscriptionStatus = 'active';
    if (sub?.period_type === 'trial') status = 'trialing';
    if (sub?.billing_issues_detected_at) status = 'past_due';

    return {
      store: sub?.store?.toUpperCase() ?? 'UNKNOWN',
      productId,
      plan,
      status,
      interval,
      currentPeriodEnd: ends ?? undefined,
      cancelAtPeriodEnd: !!sub?.unsubscribe_detected_at,
    };
  }
  return null;
}

/** Reads the user's subscriptions from RevenueCat and saves the result. */
export async function syncStoreSubscription(userId: string): Promise<StoreSubscription | null> {
  const s = storeSubscriptionFrom(await fetchSubscriber(userId));
  await saveStoreSubscription(userId, s);
  return s;
}

function sameSecret(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * POST /webhooks/revenuecat. RevenueCat recommends treating every event as
 * "something changed" and re-reading the customer, which is what this does.
 * A non-200 answer makes RevenueCat retry (5 times over about 80 minutes).
 */
export async function revenueCatWebhook(req: Request, res: Response) {
  if (!revenueCatConfigured || !env.REVENUECAT_WEBHOOK_AUTH) return res.status(503).send('RevenueCat is not configured');
  if (!sameSecret(req.header('authorization') ?? '', env.REVENUECAT_WEBHOOK_AUTH)) return res.status(401).send('Unauthorized');

  const event = (req.body as { event?: Record<string, unknown> })?.event ?? {};
  const strings = (v: unknown) => (Array.isArray(v) ? v : [v]).filter((x): x is string => typeof x === 'string');
  // Transfers name both sides; anonymous RevenueCat ids are never our users.
  const ids = [
    ...new Set(
      [event.app_user_id, event.original_app_user_id, event.aliases, event.transferred_from, event.transferred_to]
        .flatMap(strings)
        .filter((id) => !id.startsWith('$RCAnonymousID')),
    ),
  ];

  try {
    const users = ids.length ? await db.users.find({ _id: { $in: ids } }, { projection: { _id: 1 } }).toArray() : [];
    for (const u of users) await syncStoreSubscription(u._id);
    res.json({ received: true, users: users.length });
  } catch (err) {
    console.error('[revenuecat] webhook sync failed', err);
    res.status(500).send('Sync failed');
  }
}
