/**
 * Subscription + entitlement hooks.
 *
 * Phone apps (Android / iOS) buy through the app store with RevenueCat; see
 * services/storeBilling.ts. The server re-reads the purchase from RevenueCat.
 *
 * Web (live mode) uses Stripe:
 *   app → POST /billing/checkout → Stripe Checkout (in-app browser)
 *   → Stripe redirects to the server's /billing/return → server redirects to whoowes://billing/…
 *   → browser closes → we refetch the subscription (webhooks have updated it by then).
 */

import { useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { BillingService } from '../services';
import { StoreBilling } from '../services/storeBilling';
import { QUERY_KEYS } from '../constants';
import { PLANS, planIncludes } from '../billing/plans';
import type { ApiError, BillingInterval, Feature, PlanId, Subscription } from '../types';
import { useAuthStore } from '../store/authStore';
import { useShowToast } from '../store/uiStore';

export function useSubscription() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: QUERY_KEYS.SUBSCRIPTION,
    queryFn: () => BillingService.getSubscription(),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

/** Current plan + helpers. Defaults to Free while loading. */
export function useEntitlements() {
  const { data: sub, isLoading } = useSubscription();
  const plan: PlanId = sub?.plan ?? 'free';
  return {
    plan,
    planName: PLANS[plan].name,
    subscription: sub,
    isLoading,
    isPaid: plan !== 'free',
    can: (feature: Feature) => planIncludes(plan, feature),
    scansLeft: sub?.scansLimit == null ? Infinity : Math.max(0, sub.scansLimit - sub.scansUsed),
  };
}

/**
 * Returns `guard(feature)`: true when the user may use it, otherwise opens the
 * paywall focused on that feature and returns false.
 */
export function useFeatureGate() {
  const navigation = useNavigation();
  const { can } = useEntitlements();
  return useCallback(
    (feature: Feature) => {
      if (can(feature)) return true;
      navigation.navigate('Plans', { feature });
      return false;
    },
    [can, navigation],
  );
}

/** Turns a 402 from the AI endpoints into a trip to the paywall. Returns true if handled. */
export function useHandlePaywallError() {
  const navigation = useNavigation();
  const showToast = useShowToast();
  const queryClient = useQueryClient();
  return useCallback(
    (error: unknown) => {
      const e = error as ApiError;
      if (e?.code === 'upgrade_required' || e?.code === 'quota_exceeded') {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SUBSCRIPTION });
        if (e.code === 'quota_exceeded') showToast(e.message, 'warning');
        navigation.navigate('Plans', { feature: e.feature });
        return true;
      }
      return false;
    },
    [navigation, queryClient, showToast],
  );
}

/** Keeps RevenueCat pointed at whoever is signed in. Mount once, near the root. */
export function useStoreIdentity() {
  const userId = useAuthStore((s) => s.user?.id);
  useEffect(() => {
    if (!StoreBilling.enabled) return;
    (userId ? StoreBilling.identify(userId) : StoreBilling.reset()).catch((e) =>
      console.warn('[billing] store sign-in failed', e),
    );
  }, [userId]);
}

/** Store prices for the paywall, in the user's own currency. Empty off-store. */
export function useStorePackages() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['store-packages', userId],
    queryFn: () => StoreBilling.packages(),
    enabled: StoreBilling.enabled && !!userId,
    staleTime: 10 * 60_000,
    retry: 1,
  });
}

export function useCheckout() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();
  return useMutation({
    mutationFn: async ({ plan, interval }: { plan: Exclude<PlanId, 'free'>; interval: BillingInterval }) => {
      if (StoreBilling.enabled) {
        const current = queryClient.getQueryData<Subscription>(QUERY_KEYS.SUBSCRIPTION);
        const result = await StoreBilling.purchase(plan, interval, current);
        if (result.subscription) queryClient.setQueryData(QUERY_KEYS.SUBSCRIPTION, result.subscription);
        return { plan, completed: result.completed };
      }
      if (StoreBilling.unavailable) {
        throw { message: `Subscriptions aren't available in this version yet.`, statusCode: 0 } satisfies ApiError;
      }
      const returnUrl = Linking.createURL('billing/return');
      const url = await BillingService.startCheckout(plan, interval, returnUrl);
      if (url) {
        const result = await WebBrowser.openAuthSessionAsync(url, returnUrl);
        const success = result.type === 'success' && result.url.includes('status=success');
        return { plan, completed: success };
      }
      return { plan, completed: true }; // demo mode activates instantly
    },
    onSuccess: ({ plan, completed }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SUBSCRIPTION });
      if (completed) showToast(`Welcome to WhoOwes ${PLANS[plan].name} ✨`, 'success');
    },
    onError: (e: ApiError) => showToast(e.message ?? 'Checkout failed', 'error'),
  });
}

export function useManageSubscription() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();
  return useMutation({
    mutationFn: async () => {
      const current = queryClient.getQueryData<Subscription>(QUERY_KEYS.SUBSCRIPTION);
      if (current?.provider && current.provider !== 'stripe') {
        // Store subscriptions can only be changed or cancelled in the store.
        await StoreBilling.manage();
        return;
      }
      const returnUrl = Linking.createURL('billing/portal-return');
      const url = await BillingService.openPortal(returnUrl);
      if (url) await WebBrowser.openAuthSessionAsync(url, returnUrl);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SUBSCRIPTION }),
    onError: (e: ApiError) => showToast(e.message ?? 'Could not open billing', 'error'),
  });
}

export function useRestorePurchases() {
  const queryClient = useQueryClient();
  const showToast = useShowToast();
  return useMutation({
    mutationFn: () => StoreBilling.restore(),
    onSuccess: (sub) => {
      queryClient.setQueryData(QUERY_KEYS.SUBSCRIPTION, sub);
      showToast(sub.plan === 'free' ? 'No active subscription found on this account.' : `Restored WhoOwes ${PLANS[sub.plan].name}`, sub.plan === 'free' ? 'info' : 'success');
    },
    onError: (e: ApiError) => showToast(e.message ?? "Couldn't restore purchases", 'error'),
  });
}

export function useResetDemoPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => BillingService.resetDemo(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SUBSCRIPTION }),
  });
}
