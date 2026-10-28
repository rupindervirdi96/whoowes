/**
 * Billing routes.
 *
 *   GET  /billing/subscription   → the caller's plan, status and AI scan usage
 *   POST /billing/checkout       → Stripe Checkout URL for Plus/Pro (monthly/yearly)
 *   POST /billing/portal         → Stripe Customer Portal URL (switch plan, card, cancel, invoices)
 *   POST /billing/sync           → re-reads the caller's Google Play / App Store subscription (after a purchase)
 *   GET  /billing/return         → where Stripe sends the browser back; redirects into the app
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../auth.js';
import { env } from '../env.js';
import { PLANS } from '../plans.js';
import { effectiveSubscription, getAccount, planOf, scansUsed } from '../store.js';
import { ensureCustomer, priceIdFor, stripe, syncSubscription } from '../stripe.js';
import { syncStoreSubscription } from '../revenuecat.js';
import { limited } from './phone.js';

export const billingRouter = Router();

// Only redirect back into our own app (or local web dev) — never an arbitrary site.
const ALLOWED_RETURN = [/^whoowes:\/\//, /^exps?:\/\//, /^http:\/\/localhost(:\d+)?\//, /^http:\/\/127\.0\.0\.1(:\d+)?\//];
const returnUrlSchema = z
  .string()
  .max(500)
  .refine((u) => ALLOWED_RETURN.some((re) => re.test(u)), 'returnUrl must point back to the WhoOwes app');

async function subscriptionPayload(userId: string) {
  const sub = await effectiveSubscription(userId);
  const plan = await planOf(userId);
  return {
    plan,
    status: plan !== sub.plan ? 'active' : sub.status,
    interval: sub.interval,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    provider: sub.provider,
    productId: sub.productId,
    scansUsed: await scansUsed(userId),
    scansLimit: PLANS[plan].monthlyScanLimit,
  };
}

billingRouter.get('/subscription', requireUser, async (req, res, next) => {
  try {
    res.json(await subscriptionPayload(req.user!.id));
  } catch (err) {
    next(err);
  }
});

billingRouter.post('/checkout', requireUser, async (req, res, next) => {
  try {
    const body = z
      .object({ plan: z.enum(['plus', 'pro']), interval: z.enum(['month', 'year']), returnUrl: returnUrlSchema })
      .parse(req.body);
    const user = req.user!;
    const current = await effectiveSubscription(user.id);
    if (current.plan !== 'free' && current.provider && current.provider !== 'stripe') {
      return res.status(409).json({
        message: 'Your subscription is billed by the app store. Change it from the app on your phone.',
        code: 'store_subscription',
      });
    }
    const account = await getAccount(user.id);

    // Already subscribed: plan changes go through the portal so proration is handled by Stripe.
    if (account.subscriptionId && ['active', 'trialing', 'past_due'].includes(account.status)) {
      const portal = await stripe().billingPortal.sessions.create({
        customer: account.stripeCustomerId!,
        return_url: `${env.PUBLIC_URL}/billing/return?status=portal&to=${encodeURIComponent(body.returnUrl)}`,
      });
      return res.json({ url: portal.url });
    }

    const customer = await ensureCustomer(user);
    const price = await priceIdFor(body.plan, body.interval);
    const returnTo = encodeURIComponent(body.returnUrl);
    const firstSubscription = !account.subscriptionId;

    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: user.id,
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { userId: user.id },
        ...(firstSubscription && env.TRIAL_DAYS > 0 ? { trial_period_days: env.TRIAL_DAYS } : {}),
      },
      success_url: `${env.PUBLIC_URL}/billing/return?status=success&session_id={CHECKOUT_SESSION_ID}&to=${returnTo}`,
      cancel_url: `${env.PUBLIC_URL}/billing/return?status=cancel&to=${returnTo}`,
    });
    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

billingRouter.post('/portal', requireUser, async (req, res, next) => {
  try {
    const { returnUrl } = z.object({ returnUrl: returnUrlSchema }).parse(req.body);
    const account = await getAccount(req.user!.id);
    if (!account.stripeCustomerId) {
      return res.status(400).json({ message: 'No billing account yet — pick a plan first.', code: 'no_customer' });
    }
    const portal = await stripe().billingPortal.sessions.create({
      customer: account.stripeCustomerId,
      return_url: `${env.PUBLIC_URL}/billing/return?status=portal&to=${encodeURIComponent(returnUrl)}`,
    });
    res.json({ url: portal.url });
  } catch (err) {
    next(err);
  }
});

billingRouter.post('/sync', requireUser, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    if (limited(`billing-sync:${userId}`, 30, 10 * 60_000)) {
      return res.status(429).json({ message: 'Too many requests. Please wait a minute.', code: 'rate_limited' });
    }
    await syncStoreSubscription(userId);
    res.json(await subscriptionPayload(userId));
  } catch (err) {
    next(err);
  }
});

/**
 * Stripe redirects the in-app browser here. We sync the subscription right away
 * (webhooks remain the source of truth; this just avoids a race where the app
 * refetches before the webhook lands), then bounce back into the app.
 */
billingRouter.get('/return', async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : 'unknown';
  const to = typeof req.query.to === 'string' ? req.query.to : '';
  const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id : undefined;

  if (status === 'success' && sessionId) {
    try {
      const session = await stripe().checkout.sessions.retrieve(sessionId, { expand: ['subscription'] });
      if (session.subscription && typeof session.subscription !== 'string') {
        await syncSubscription(session.subscription, session.client_reference_id ?? undefined);
      }
    } catch (err) {
      console.warn('[billing] return sync failed (webhook will catch up):', (err as Error).message);
    }
  }

  const target = returnUrlSchema.safeParse(to);
  if (!target.success) {
    return res.status(200).type('html').send('<p>All done — you can return to the WhoOwes app.</p>');
  }
  const sep = target.data.includes('?') ? '&' : '?';
  res.redirect(302, `${target.data}${sep}status=${encodeURIComponent(status)}`);
});
