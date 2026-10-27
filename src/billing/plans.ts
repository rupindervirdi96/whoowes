/**
 * Plan catalogue + entitlement rules.
 *
 * Keep in sync with server/src/plans.ts — the server is the source of truth for
 * enforcement; this copy drives the paywall UI and client-side gating.
 */

import type { Feature, PlanId, BillingInterval } from '../types';

export interface PlanDefinition {
  id: PlanId;
  name: string;
  tagline: string;
  /** Display prices in USD. Real prices live in Stripe (see server/scripts/stripe-setup.ts). */
  price: Record<BillingInterval, number>;
  monthlyScanLimit: number | null; // null = unlimited
  features: Feature[];
  perks: string[];
  highlight?: boolean;
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Split bills with friends',
    price: { month: 0, year: 0 },
    monthlyScanLimit: 3,
    features: ['receipt_scan'],
    perks: [
      'Unlimited expenses, friends and groups',
      'Smart settle-up suggestions',
      '3 AI receipt scans a month',
    ],
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    tagline: 'Less typing, more living',
    price: { month: 2.99, year: 24.99 },
    monthlyScanLimit: 30,
    features: ['receipt_scan', 'ai_quick_add', 'csv_export'],
    perks: [
      'Everything in Free',
      '30 AI receipt scans a month',
      'AI Quick Add — type it like a text',
      'CSV export',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'Your money, on autopilot',
    price: { month: 5.99, year: 49.99 },
    monthlyScanLimit: null,
    features: ['receipt_scan', 'ai_quick_add', 'ai_split_assistant', 'ai_insights', 'csv_export'],
    perks: [
      'Everything in Plus',
      'Unlimited AI receipt scans',
      'AI Split Assistant — "Sam had the wine"',
      'Monthly AI spending insights',
    ],
    highlight: true,
  },
};

export const PLAN_ORDER: PlanId[] = ['free', 'plus', 'pro'];

export const FEATURE_COPY: Record<Feature, { title: string; body: string; icon: string; minPlan: PlanId }> = {
  receipt_scan: {
    title: 'AI receipt scanning',
    body: 'Snap a receipt and every line item is read for you.',
    icon: 'document-scanner',
    minPlan: 'free',
  },
  ai_quick_add: {
    title: 'AI Quick Add',
    body: 'Type "Tacos $64 with Sam and Priya" and you are done.',
    icon: 'bolt',
    minPlan: 'plus',
  },
  ai_split_assistant: {
    title: 'AI Split Assistant',
    body: 'Tell it who had what and it assigns the items.',
    icon: 'auto-awesome',
    minPlan: 'pro',
  },
  ai_insights: {
    title: 'AI spending insights',
    body: 'A monthly read-out of where the money went — and who it went with.',
    icon: 'insights',
    minPlan: 'pro',
  },
  csv_export: {
    title: 'CSV export',
    body: 'Download every expense for your spreadsheet or accountant.',
    icon: 'file-download',
    minPlan: 'plus',
  },
};

export function planIncludes(plan: PlanId, feature: Feature): boolean {
  return PLANS[plan].features.includes(feature);
}

export function yearlySavingsPercent(plan: PlanDefinition): number {
  if (!plan.price.month) return 0;
  return Math.round((1 - plan.price.year / (plan.price.month * 12)) * 100);
}
