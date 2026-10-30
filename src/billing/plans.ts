/**
 * Plan catalogue + entitlement rules.
 *
 * Keep in sync with server/src/plans.ts — the server is the source of truth for
 * enforcement; this copy drives the paywall UI and client-side gating.
 */

import type { Feature, PlanId, BillingInterval } from '../types';
import { translate, type TKey } from '../i18n';

export interface PlanDefinition {
  id: PlanId;
  /** Brand name, not translated (except "Free", see planName). */
  name: string;
  taglineKey: TKey;
  /** Display prices in USD for the web (Stripe). App stores show their own local prices. */
  price: Record<BillingInterval, number>;
  monthlyScanLimit: number | null; // null = unlimited
  features: Feature[];
  perkKeys: TKey[];
  highlight?: boolean;
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free',
    taglineKey: 'plan.free.tagline',
    price: { month: 0, year: 0 },
    monthlyScanLimit: 3,
    features: ['receipt_scan'],
    perkKeys: ['plan.free.perk1', 'plan.free.perk2', 'plan.free.perk3'],
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    taglineKey: 'plan.plus.tagline',
    price: { month: 2.99, year: 24.99 },
    monthlyScanLimit: 30,
    features: ['receipt_scan', 'ai_quick_add', 'csv_export'],
    perkKeys: ['plan.plus.perk1', 'plan.plus.perk2', 'plan.plus.perk3', 'plan.plus.perk4'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    taglineKey: 'plan.pro.tagline',
    price: { month: 5.99, year: 49.99 },
    monthlyScanLimit: null,
    features: ['receipt_scan', 'ai_quick_add', 'ai_split_assistant', 'ai_insights', 'csv_export'],
    perkKeys: ['plan.pro.perk1', 'plan.pro.perk2', 'plan.pro.perk3', 'plan.pro.perk4'],
    highlight: true,
  },
};

/** "Free" is translated; Plus and Pro are names. */
export const planName = (id: PlanId) => (id === 'free' ? translate('plan.free.name') : PLANS[id].name);

export const PLAN_ORDER: PlanId[] = ['free', 'plus', 'pro'];

export const FEATURE_COPY: Record<Feature, { titleKey: TKey; bodyKey: TKey; icon: string; minPlan: PlanId }> = {
  receipt_scan: {
    titleKey: 'feature.receipt_scan.title',
    bodyKey: 'feature.receipt_scan.body',
    icon: 'document-scanner',
    minPlan: 'free',
  },
  ai_quick_add: {
    titleKey: 'feature.ai_quick_add.title',
    bodyKey: 'feature.ai_quick_add.body',
    icon: 'bolt',
    minPlan: 'plus',
  },
  ai_split_assistant: {
    titleKey: 'feature.ai_split_assistant.title',
    bodyKey: 'feature.ai_split_assistant.body',
    icon: 'auto-awesome',
    minPlan: 'pro',
  },
  ai_insights: {
    titleKey: 'feature.ai_insights.title',
    bodyKey: 'feature.ai_insights.body',
    icon: 'insights',
    minPlan: 'pro',
  },
  csv_export: {
    titleKey: 'feature.csv_export.title',
    bodyKey: 'feature.csv_export.body',
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
