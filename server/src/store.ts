/**
 * Billing state in the database: each user's Stripe customer and subscription
 * (written by webhooks), monthly AI scan counts, and processed webhook ids.
 */

import { db } from './db/index.js';
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

interface Row {
  user_id: string;
  stripe_customer_id: string | null;
  subscription_id: string | null;
  plan: PlanId;
  status: SubscriptionStatus;
  billing_interval: BillingInterval | null;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
}

const toAccount = (r: Row): BillingAccount => ({
  userId: r.user_id,
  stripeCustomerId: r.stripe_customer_id ?? undefined,
  subscriptionId: r.subscription_id ?? undefined,
  plan: r.plan,
  status: r.status,
  interval: r.billing_interval ?? undefined,
  currentPeriodEnd: r.current_period_end?.toISOString(),
  cancelAtPeriodEnd: r.cancel_at_period_end,
});

export const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);

export async function getAccount(userId: string): Promise<BillingAccount> {
  const row = await db.one<Row>('select * from billing_accounts where user_id = $1', [userId]);
  return row ? toAccount(row) : { userId, plan: 'free', status: 'none' };
}

export async function saveAccount(a: BillingAccount): Promise<void> {
  await db.query(
    `insert into billing_accounts (user_id, stripe_customer_id, subscription_id, plan, status, billing_interval, current_period_end, cancel_at_period_end, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, now())
     on conflict (user_id) do update set
       stripe_customer_id = excluded.stripe_customer_id, subscription_id = excluded.subscription_id,
       plan = excluded.plan, status = excluded.status, billing_interval = excluded.billing_interval,
       current_period_end = excluded.current_period_end, cancel_at_period_end = excluded.cancel_at_period_end,
       updated_at = now()`,
    [
      a.userId,
      a.stripeCustomerId ?? null,
      a.subscriptionId ?? null,
      a.plan,
      a.status,
      a.interval ?? null,
      a.currentPeriodEnd ?? null,
      a.cancelAtPeriodEnd ?? false,
    ],
  );
}

export async function findAccountByCustomer(customerId: string): Promise<BillingAccount | undefined> {
  const row = await db.one<Row>('select * from billing_accounts where stripe_customer_id = $1', [customerId]);
  return row ? toAccount(row) : undefined;
}

/** The plan to enforce for this user (honours DEV_PLAN on development servers). */
export async function planOf(userId: string): Promise<PlanId> {
  return devPlan ?? (await getAccount(userId)).plan;
}

export async function scansUsed(userId: string): Promise<number> {
  const row = await db.one<{ scans: number }>('select scans from ai_usage where user_id = $1 and month = $2', [userId, monthKey()]);
  return row?.scans ?? 0;
}

export async function recordScan(userId: string): Promise<void> {
  await db.query(
    `insert into ai_usage (user_id, month, scans) values ($1, $2, 1)
     on conflict (user_id, month) do update set scans = ai_usage.scans + 1`,
    [userId, monthKey()],
  );
}

export async function isEventProcessed(eventId: string): Promise<boolean> {
  return !!(await db.one('select 1 from processed_events where id = $1', [eventId]));
}

/** Call only after an event was applied successfully, so failed ones get retried. */
export async function markEventProcessed(eventId: string): Promise<void> {
  await db.query('insert into processed_events (id) values ($1) on conflict do nothing', [eventId]);
}
