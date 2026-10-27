/**
 * Billing service — subscription status, Stripe Checkout and the Customer Portal.
 *
 * Live mode (EXPO_PUBLIC_API_URL set): the server creates Stripe Checkout / Portal
 * sessions and the app opens them in an in-app browser. Stripe webhooks tell the
 * server when a subscription starts, renews or ends.
 *
 * Demo mode (no API URL): the plan is stored on-device so the paywall and AI
 * gates can be tried end-to-end without Stripe. Nothing is charged.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { USE_MOCK_API } from '../config';
import { STORAGE_KEYS } from '../constants';
import { PLANS } from '../billing/plans';
import type { BillingInterval, PlanId, Subscription } from '../types';
import apiClient from './api/apiClient';
import { mockDelay } from './mock/mockHelpers';

interface DemoState {
  plan: PlanId;
  interval?: BillingInterval;
  scans: Record<string, number>; // 'YYYY-MM' → count
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

const monthKey = () => new Date().toISOString().slice(0, 7);

async function readDemo(): Promise<DemoState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.DEMO_SUBSCRIPTION);
    if (raw) return JSON.parse(raw) as DemoState;
  } catch {
    // fall through to default
  }
  return { plan: 'free', scans: {} };
}

async function writeDemo(state: DemoState) {
  await AsyncStorage.setItem(STORAGE_KEYS.DEMO_SUBSCRIPTION, JSON.stringify(state));
}

function demoToSubscription(state: DemoState): Subscription {
  return {
    plan: state.plan,
    status: state.plan === 'free' ? 'none' : 'active',
    interval: state.interval,
    currentPeriodEnd: state.currentPeriodEnd,
    cancelAtPeriodEnd: state.cancelAtPeriodEnd,
    scansUsed: state.scans[monthKey()] ?? 0,
    scansLimit: PLANS[state.plan].monthlyScanLimit,
    isDemo: true,
  };
}

export const BillingService = {
  isDemo: USE_MOCK_API,

  async getSubscription(): Promise<Subscription> {
    if (USE_MOCK_API) {
      await mockDelay(200);
      return demoToSubscription(await readDemo());
    }
    const res = await apiClient.get<Subscription>('/billing/subscription');
    return res.data;
  },

  /**
   * Live: returns a Stripe Checkout URL to open.
   * Demo: activates the plan immediately and returns null.
   */
  async startCheckout(plan: Exclude<PlanId, 'free'>, interval: BillingInterval, returnUrl: string) {
    if (USE_MOCK_API) {
      await mockDelay(900);
      const state = await readDemo();
      const end = new Date();
      end.setMonth(end.getMonth() + (interval === 'year' ? 12 : 1));
      await writeDemo({ ...state, plan, interval, currentPeriodEnd: end.toISOString(), cancelAtPeriodEnd: false });
      return null;
    }
    const res = await apiClient.post<{ url: string }>('/billing/checkout', { plan, interval, returnUrl });
    return res.data.url;
  },

  /**
   * Live: returns a Stripe Customer Portal URL (change plan, update card, cancel, invoices).
   * Demo: toggles cancellation and returns null.
   */
  async openPortal(returnUrl: string) {
    if (USE_MOCK_API) {
      await mockDelay(400);
      const state = await readDemo();
      await writeDemo({ ...state, cancelAtPeriodEnd: !state.cancelAtPeriodEnd });
      return null;
    }
    const res = await apiClient.post<{ url: string }>('/billing/portal', { returnUrl });
    return res.data.url;
  },

  /** Demo only: drop back to Free. */
  async resetDemo() {
    const state = await readDemo();
    await writeDemo({ plan: 'free', scans: state.scans });
  },

  /** Demo only: the server counts scans itself in live mode. */
  async recordDemoScan() {
    const state = await readDemo();
    const key = monthKey();
    await writeDemo({ ...state, scans: { ...state.scans, [key]: (state.scans[key] ?? 0) + 1 } });
  },
};
