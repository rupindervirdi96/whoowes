/**
 * Google Play (and later App Store) subscriptions through RevenueCat.
 *
 * Phone apps must sell subscriptions through the store, so on Android and iOS
 * this replaces Stripe Checkout. The flow:
 *   1. Signing in tells RevenueCat our user id, so purchases are tied to the account.
 *   2. The paywall buys a package from the RevenueCat "current" offering.
 *   3. The app asks our server to re-read the subscription (POST /billing/sync);
 *      the server trusts only RevenueCat, never the app.
 *
 * RevenueCat setup this code expects (see README → Payments):
 *   - Packages in the current offering named plus_monthly, plus_yearly, pro_monthly, pro_yearly
 *   - Entitlements named plus and pro
 *
 * In Expo Go the SDK runs in a preview mode without real purchases.
 */

import { Linking, Platform } from 'react-native';
import Purchases, { type PurchasesError, type PurchasesPackage } from 'react-native-purchases';
import { REVENUECAT_ANDROID_KEY, REVENUECAT_IOS_KEY, USE_MOCK_API } from '../config';
import { useAuthStore } from '../store/authStore';
import type { ApiError, BillingInterval, PlanId, Subscription } from '../types';
import apiClient from './api/apiClient';

type PaidPlan = Exclude<PlanId, 'free'>;

const apiKey = Platform.OS === 'android' ? REVENUECAT_ANDROID_KEY : Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : '';
const isNative = Platform.OS === 'android' || Platform.OS === 'ios';

/** The package identifier for a plan in the RevenueCat offering. */
export const packageIdFor = (plan: PaidPlan, interval: BillingInterval) => `${plan}_${interval === 'year' ? 'yearly' : 'monthly'}`;

let configured = false;
let identifiedAs: string | null = null;

function fail(message: string, code?: string): ApiError {
  return { message, statusCode: 0, code };
}

async function ensureIdentified() {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) throw fail('Please sign in again.');
  await StoreBilling.identify(userId);
}

async function syncWithServer(): Promise<Subscription> {
  const res = await apiClient.post<Subscription>('/billing/sync');
  return res.data;
}

export const StoreBilling = {
  /** True when this build sells subscriptions through the app store. */
  enabled: isNative && !USE_MOCK_API && apiKey.length > 0,

  /**
   * Phone builds without a RevenueCat key can't sell subscriptions at all
   * (store rules forbid Stripe there), so the paywall shows plans as unavailable.
   */
  unavailable: isNative && !USE_MOCK_API && apiKey.length === 0,

  storeName: Platform.OS === 'ios' ? 'the App Store' : 'Google Play',

  /** Ties RevenueCat to the signed-in user. Safe to call repeatedly. */
  async identify(userId: string) {
    if (!this.enabled || identifiedAs === userId) return;
    if (!configured) {
      Purchases.configure({ apiKey, appUserID: userId });
      configured = true;
    } else {
      await Purchases.logIn(userId);
    }
    identifiedAs = userId;
  },

  /** Call on sign-out so the next person on this phone doesn't inherit purchases. */
  async reset() {
    if (!configured || !identifiedAs) return;
    identifiedAs = null;
    try {
      await Purchases.logOut();
    } catch {
      // Already anonymous: nothing to do.
    }
  },

  /** Packages by identifier (plus_monthly, …), with prices in the user's currency. */
  async packages(): Promise<Partial<Record<string, PurchasesPackage>>> {
    await ensureIdentified();
    const offerings = await Purchases.getOfferings();
    const map: Partial<Record<string, PurchasesPackage>> = {};
    for (const p of offerings.current?.availablePackages ?? []) map[p.identifier] = p;
    return map;
  },

  /**
   * Opens the store's payment sheet. Returns completed: false if the user backs out.
   * `current` is the existing subscription: switching plans on Google Play
   * replaces it instead of starting a second subscription.
   */
  async purchase(plan: PaidPlan, interval: BillingInterval, current?: Subscription): Promise<{ completed: boolean; subscription?: Subscription }> {
    const pkg = (await this.packages())[packageIdFor(plan, interval)];
    if (!pkg) throw fail("That plan isn't available right now. Please try again later.");

    const change =
      Platform.OS === 'android' && current?.provider === 'play_store' && current.plan !== 'free' && current.productId
        ? {
            oldProductIdentifier: current.productId.split(':')[0],
            replacementMode: Purchases.STORE_REPLACEMENT_MODE.WITH_TIME_PRORATION,
          }
        : null;

    try {
      await Purchases.purchasePackage(pkg, null, change);
    } catch (err) {
      const e = err as PurchasesError;
      if (e?.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR || e?.userCancelled) return { completed: false };
      if (e?.code === Purchases.PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
        throw fail('Your payment is pending. Your plan will switch on as soon as it goes through.', 'payment_pending');
      }
      if (e?.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR) {
        throw fail(`Purchases aren't allowed on this device. Check your ${this.storeName} account.`);
      }
      throw fail(e?.message || "The purchase didn't go through. Please try again.");
    }
    return { completed: true, subscription: await syncWithServer() };
  },

  /** Re-applies purchases made on this store account (new phone, reinstall). */
  async restore(): Promise<Subscription> {
    await ensureIdentified();
    await Purchases.restorePurchases();
    return syncWithServer();
  },

  /** Opens the store's subscription page, where people change or cancel. */
  async manage() {
    let url: string | null = null;
    try {
      await ensureIdentified();
      url = (await Purchases.getCustomerInfo()).managementURL;
    } catch {
      // Fall back to the store's general subscriptions page.
    }
    await Linking.openURL(
      url ?? (Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions'),
    );
  },
};
