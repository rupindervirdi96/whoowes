/**
 * Stripe webhooks — the source of truth for who is subscribed.
 *
 * Mounted with express.raw() in index.ts: the signature is computed over the
 * exact request bytes, so this route must see the body before any JSON parser.
 *
 * Subscribe your endpoint (Dashboard → Developers → Webhooks, or `stripe listen`) to:
 *   checkout.session.completed
 *   customer.subscription.created / updated / deleted
 *   invoice.payment_failed
 */

import type { Request, Response } from 'express';
import type Stripe from 'stripe';
import { env } from '../env.js';
import { isEventProcessed, markEventProcessed } from '../store.js';
import { stripe, syncSubscription } from '../stripe.js';

export async function stripeWebhook(req: Request, res: Response) {
  if (!env.STRIPE_WEBHOOK_SECRET) return res.status(503).send('Webhook secret not configured');

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(req.body as Buffer, req.header('stripe-signature') ?? '', env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.warn('[webhook] signature check failed:', (err as Error).message);
    return res.status(400).send('Invalid signature');
  }

  // Stripe may deliver an event more than once — apply each one once.
  if (await isEventProcessed(event.id)) return res.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode === 'subscription' && session.subscription) {
          const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
          const sub = await stripe().subscriptions.retrieve(subId);
          await syncSubscription(sub, session.client_reference_id ?? undefined);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscription(event.data.object);
        break;
      case 'invoice.payment_failed': {
        // Status moves to past_due via customer.subscription.updated; this is the
        // hook for sending a "please update your card" email or push.
        const invoice = event.data.object;
        console.info(`[webhook] payment failed for customer ${String(invoice.customer)}`);
        break;
      }
      default:
        break;
    }
    await markEventProcessed(event.id);
    res.json({ received: true });
  } catch (err) {
    console.error('[webhook] handler error', err);
    // 500 makes Stripe retry later.
    res.status(500).send('Handler error');
  }
}
