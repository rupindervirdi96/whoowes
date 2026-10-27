/**
 * Plan catalogue — the source of truth for what each plan unlocks.
 * Mirrored for display in the app at src/billing/plans.ts.
 *
 * Prices live in Stripe and are found by lookup key (created by
 * `npm run stripe:setup`), so no price IDs need to be copied into env vars.
 */

export type PlanId = 'free' | 'plus' | 'pro';
export type PaidPlanId = Exclude<PlanId, 'free'>;
export type BillingInterval = 'month' | 'year';
export type Feature = 'receipt_scan' | 'ai_quick_add' | 'ai_split_assistant' | 'ai_insights' | 'csv_export';

export const PLANS: Record<PlanId, { name: string; monthlyScanLimit: number | null; features: Feature[] }> = {
  free: { name: 'Free', monthlyScanLimit: 3, features: ['receipt_scan'] },
  plus: { name: 'Plus', monthlyScanLimit: 30, features: ['receipt_scan', 'ai_quick_add', 'csv_export'] },
  pro: {
    name: 'Pro',
    monthlyScanLimit: null,
    features: ['receipt_scan', 'ai_quick_add', 'ai_split_assistant', 'ai_insights', 'csv_export'],
  },
};

/** Stripe price definitions (USD cents). Used by the setup script and checkout. */
export const PRICES: Record<PaidPlanId, Record<BillingInterval, { lookupKey: string; unitAmount: number }>> = {
  plus: {
    month: { lookupKey: 'whoowes_plus_monthly', unitAmount: 299 },
    year: { lookupKey: 'whoowes_plus_yearly', unitAmount: 2499 },
  },
  pro: {
    month: { lookupKey: 'whoowes_pro_monthly', unitAmount: 599 },
    year: { lookupKey: 'whoowes_pro_yearly', unitAmount: 4999 },
  },
};

export function planForLookupKey(lookupKey: string | null | undefined): { plan: PaidPlanId; interval: BillingInterval } | null {
  for (const plan of Object.keys(PRICES) as PaidPlanId[]) {
    for (const interval of Object.keys(PRICES[plan]) as BillingInterval[]) {
      if (PRICES[plan][interval].lookupKey === lookupKey) return { plan, interval };
    }
  }
  return null;
}

export function planIncludes(plan: PlanId, feature: Feature) {
  return PLANS[plan].features.includes(feature);
}

/** Feature → cheapest plan that includes it (for upgrade prompts). */
export function minPlanFor(feature: Feature): PlanId {
  return (['free', 'plus', 'pro'] as PlanId[]).find((p) => planIncludes(p, feature)) ?? 'pro';
}
