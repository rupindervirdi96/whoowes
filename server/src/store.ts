/**
 * Billing state in the database: each user's Stripe customer and subscription
 * (written by webhooks), monthly AI scan counts, and processed webhook ids.
 */

import { db, isDuplicateKey, type BillingAccountDoc } from './db/index.js';
import { devPlan } from './env.js';
import type { BillingInterval, PlanId } from './plans.js';

export type SubscriptionStatus = 'none' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete';

export interface BillingAccount {
  userId: string;
  stripeCustomerId?: string;
  subscriptionId?: string;
  plan: PlanId;
  status: SubscriptionStatus;
  interval?: BillingInterval;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

const toAccount = (d: BillingAccountDoc): BillingAccount => ({
  userId: d._id,
  stripeCustomerId: d.stripeCustomerId ?? undefined,
  subscriptionId: d.subscriptionId ?? undefined,
  plan: d.plan as PlanId,
  status: d.status as SubscriptionStatus,
  interval: (d.interval as BillingInterval | null) ?? undefined,
  currentPeriodEnd: d.currentPeriodEnd?.toISOString(),
  cancelAtPeriodEnd: d.cancelAtPeriodEnd,
});

export const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);

export async function getAccount(userId: string): Promise<BillingAccount> {
  const doc = await db.billingAccounts.findOne({ _id: userId });
  return doc ? toAccount(doc) : { userId, plan: 'free', status: 'none' };
}

export async function saveAccount(a: BillingAccount): Promise<void> {
  await db.billingAccounts.updateOne(
    { _id: a.userId },
    {
      $set: {
        stripeCustomerId: a.stripeCustomerId ?? null,
        subscriptionId: a.subscriptionId ?? null,
        plan: a.plan,
        status: a.status,
        interval: a.interval ?? null,
        currentPeriodEnd: a.currentPeriodEnd ? new Date(a.currentPeriodEnd) : null,
        cancelAtPeriodEnd: a.cancelAtPeriodEnd ?? false,
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
}

export async function findAccountByCustomer(customerId: string): Promise<BillingAccount | undefined> {
  const doc = await db.billingAccounts.findOne({ stripeCustomerId: customerId });
  return doc ? toAccount(doc) : undefined;
}

// ─── App store subscriptions (Google Play / App Store via RevenueCat) ────────

export interface StoreSubscription {
  store: string;
  productId: string;
  plan: PlanId;
  status: SubscriptionStatus;
  interval?: BillingInterval;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
}

/** Saves (or clears, with null) the user's app store subscription. Stripe fields are untouched. */
export async function saveStoreSubscription(userId: string, s: StoreSubscription | null): Promise<void> {
  const now = new Date();
  await db.billingAccounts.updateOne(
    { _id: userId },
    {
      $set: {
        store: s && {
          store: s.store,
          productId: s.productId,
          plan: s.plan,
          status: s.status,
          interval: s.interval ?? null,
          currentPeriodEnd: s.currentPeriodEnd ? new Date(s.currentPeriodEnd) : null,
          cancelAtPeriodEnd: s.cancelAtPeriodEnd,
          syncedAt: now,
        },
        updatedAt: now,
      },
      $setOnInsert: {
        stripeCustomerId: null,
        subscriptionId: null,
        plan: 'free',
        status: 'none',
        interval: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      },
    },
    { upsert: true },
  );
}

export type BillingProvider = 'stripe' | 'play_store' | 'app_store' | 'other_store';

/** What the user actually has: the better of their Stripe and app store subscriptions. */
export interface EffectiveSubscription {
  plan: PlanId;
  status: SubscriptionStatus;
  interval?: BillingInterval;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  provider?: BillingProvider;
  /** The store product id, for switching plans in the app. */
  productId?: string;
}

const RANK: Record<PlanId, number> = { free: 0, plus: 1, pro: 2 };
// Expiry and renewal webhooks normally update this in time; the day of slack
// only matters if RevenueCat can't reach the server for a while.
const STORE_SLACK_MS = 24 * 60 * 60_000;

const providerOf = (store: string): BillingProvider =>
  store === 'PLAY_STORE' ? 'play_store' : store === 'APP_STORE' || store === 'MAC_APP_STORE' ? 'app_store' : 'other_store';

export async function effectiveSubscription(userId: string): Promise<EffectiveSubscription> {
  const doc = await db.billingAccounts.findOne({ _id: userId });
  const web = doc ? toAccount(doc) : ({ userId, plan: 'free', status: 'none' } as BillingAccount);
  const s = doc?.store;
  const storeLive = s && s.plan !== 'free' && (!s.currentPeriodEnd || s.currentPeriodEnd.getTime() + STORE_SLACK_MS > Date.now());
  if (s && storeLive && RANK[s.plan as PlanId] > RANK[web.plan]) {
    return {
      plan: s.plan as PlanId,
      status: s.status as SubscriptionStatus,
      interval: (s.interval as BillingInterval | null) ?? undefined,
      currentPeriodEnd: s.currentPeriodEnd?.toISOString(),
      cancelAtPeriodEnd: s.cancelAtPeriodEnd,
      provider: providerOf(s.store),
      productId: s.productId,
    };
  }
  return {
    plan: web.plan,
    status: web.status,
    interval: web.interval,
    currentPeriodEnd: web.currentPeriodEnd,
    cancelAtPeriodEnd: web.cancelAtPeriodEnd ?? false,
    provider: web.subscriptionId ? 'stripe' : undefined,
  };
}

/** The plan to enforce for this user (honours DEV_PLAN on development servers). */
export async function planOf(userId: string): Promise<PlanId> {
  return devPlan ?? (await effectiveSubscription(userId)).plan;
}

export async function scansUsed(userId: string): Promise<number> {
  const doc = await db.aiUsage.findOne({ _id: `${userId}:${monthKey()}` });
  return doc?.scans ?? 0;
}

export async function recordScan(userId: string): Promise<void> {
  const month = monthKey();
  await db.aiUsage.updateOne({ _id: `${userId}:${month}` }, { $inc: { scans: 1 }, $setOnInsert: { userId, month } }, { upsert: true });
}

export async function isEventProcessed(eventId: string): Promise<boolean> {
  return !!(await db.processedEvents.findOne({ _id: eventId }));
}

/** Call only after an event was applied successfully, so failed ones get retried. */
export async function markEventProcessed(eventId: string): Promise<void> {
  try {
    await db.processedEvents.insertOne({ _id: eventId, processedAt: new Date() });
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
  }
}
