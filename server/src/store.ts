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

/** The plan to enforce for this user (honours DEV_PLAN on development servers). */
export async function planOf(userId: string): Promise<PlanId> {
  return devPlan ?? (await getAccount(userId)).plan;
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
