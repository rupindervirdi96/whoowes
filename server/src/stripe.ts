import Stripe from 'stripe';
import { env } from './env.js';
import { PRICES, planForLookupKey, type BillingInterval, type PaidPlanId } from './plans.js';
import { findAccountByCustomer, getAccount, saveAccount, type BillingAccount, type SubscriptionStatus } from './store.js';
import type { AuthUser } from './auth.js';

let client: Stripe | null = null;

/** Lazily created so the AI routes still work when Stripe isn't configured. */
export function stripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw Object.assign(new Error('Payments are not set up on this server yet.'), { status: 503, code: 'billing_unavailable' });
  }
  client ??= new Stripe(env.STRIPE_SECRET_KEY, { appInfo: { name: 'WhoOwes', version: '2.0.0' } });
  return client;
}

const priceCache = new Map<string, string>();

/** Resolves a plan/interval to a Stripe price id via its lookup key. */
export async function priceIdFor(plan: PaidPlanId, interval: BillingInterval): Promise<string> {
  const { lookupKey } = PRICES[plan][interval];
  const cached = priceCache.get(lookupKey);
  if (cached) return cached;
  const prices = await stripe().prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  const price = prices.data[0];
  if (!price) {
    throw Object.assign(new Error(`Stripe price "${lookupKey}" not found. Run "npm run stripe:setup".`), { status: 500 });
  }
  priceCache.set(lookupKey, price.id);
  return price.id;
}

/** Returns the user's Stripe customer, creating and saving one on first use. */
export async function ensureCustomer(user: AuthUser): Promise<string> {
  const account = await getAccount(user.id);
  if (account.stripeCustomerId) return account.stripeCustomerId;
  // Phone accounts may have no email; Checkout collects one for receipts.
  const customer = await stripe().customers.create({
    name: user.name,
    phone: user.phone,
    email: user.email || undefined,
    metadata: { userId: user.id },
  });
  await saveAccount({ ...account, stripeCustomerId: customer.id });
  return customer.id;
}

function mapStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'incomplete':
      return 'incomplete';
    default:
      return 'canceled'; // canceled, incomplete_expired, paused
  }
}

/**
 * Writes a Stripe subscription onto the matching account. Called from webhooks
 * and from the checkout return page (so the app sees the new plan immediately).
 */
export async function syncSubscription(sub: Stripe.Subscription, userIdHint?: string): Promise<BillingAccount | null> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const userId = userIdHint ?? sub.metadata?.userId ?? (await findAccountByCustomer(customerId))?.userId;
  if (!userId) {
    console.warn(`[billing] No user for customer ${customerId}; ignoring subscription ${sub.id}`);
    return null;
  }
  const account = await getAccount(userId);

  // A user should only have one live subscription; ignore stale events for an
  // older, already-replaced subscription.
  if (account.subscriptionId && account.subscriptionId !== sub.id && sub.status === 'canceled') return account;

  const item = sub.items.data[0];
  const match = planForLookupKey(item?.price.lookup_key);
  const status = mapStatus(sub.status);
  const keepsAccess = status === 'active' || status === 'trialing' || status === 'past_due';

  const next: BillingAccount = {
    ...account,
    stripeCustomerId: customerId,
    subscriptionId: sub.id,
    status,
    plan: keepsAccess && match ? match.plan : 'free',
    interval: match?.interval,
    // Current API versions report the billing period per subscription item.
    currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : undefined,
    cancelAtPeriodEnd: sub.cancel_at_period_end || !!sub.cancel_at,
  };
  await saveAccount(next);
  return next;
}
