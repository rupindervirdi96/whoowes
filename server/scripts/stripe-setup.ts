/**
 * Creates (or reuses) the WhoOwes products and prices in your Stripe account.
 * Idempotent: prices are matched by lookup key, so it's safe to run again.
 *
 *   npm run stripe:setup        (uses STRIPE_SECRET_KEY from .env — use a TEST key first)
 */

import Stripe from 'stripe';
import { PRICES, PLANS, type BillingInterval, type PaidPlanId } from '../src/plans.js';

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('Set STRIPE_SECRET_KEY in server/.env first.');
  process.exit(1);
}
if (key.startsWith('sk_live_')) {
  console.warn('⚠ Using a LIVE key — this creates real products. Ctrl+C within 5s to abort.');
  await new Promise((r) => setTimeout(r, 5000));
}

const stripe = new Stripe(key);

const DESCRIPTIONS: Record<PaidPlanId, string> = {
  plus: '30 AI receipt scans a month, AI Quick Add and CSV export.',
  pro: 'Unlimited AI receipt scans, AI Split Assistant and monthly AI insights.',
};

for (const plan of Object.keys(PRICES) as PaidPlanId[]) {
  const name = `WhoOwes ${PLANS[plan].name}`;
  const existing = await stripe.products.search({ query: `metadata['whoowes_plan']:'${plan}'` });
  const product =
    existing.data[0] ??
    (await stripe.products.create({ name, description: DESCRIPTIONS[plan], metadata: { whoowes_plan: plan } }));
  console.log(`✓ product ${product.name} (${product.id})`);

  for (const interval of Object.keys(PRICES[plan]) as BillingInterval[]) {
    const { lookupKey, unitAmount } = PRICES[plan][interval];
    const found = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
    if (found.data[0]) {
      console.log(`  ✓ ${lookupKey} already exists (${found.data[0].id})`);
      continue;
    }
    const price = await stripe.prices.create({
      product: product.id,
      currency: 'usd',
      unit_amount: unitAmount,
      recurring: { interval },
      lookup_key: lookupKey,
      nickname: `${name} (${interval}ly)`,
    });
    console.log(`  + created ${lookupKey} → ${price.id} ($${(unitAmount / 100).toFixed(2)}/${interval})`);
  }
}

console.log('\nNext: enable the Customer Portal (Dashboard → Settings → Billing → Customer portal),');
console.log('allow switching between these prices, then start the webhook listener: npm run stripe:listen');
