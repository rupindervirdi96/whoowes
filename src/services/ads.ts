/**
 * Rewarded ads (Google AdMob), used to unlock one more AI use.
 *
 * The ad library is native code, so it only exists in real builds (EAS / Play
 * Store), not in Expo Go or on the web. There, during development, the unlock
 * sheet shows a 30-second stand-in ad instead, so the whole flow can be tried.
 *
 * Each ad carries the WhoOwes user id and the server's ad session id. AdMob
 * passes them to the server's verification callback (/ai/ad/ssv), which is how
 * the server knows the ad was really watched.
 */

import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { ADMOB_REWARDED_UNIT } from '../config';

type AdsModule = typeof import('react-native-google-mobile-ads');

let mod: AdsModule | null | undefined;
function lib(): AdsModule | null {
  if (mod !== undefined) return mod;
  const expoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  if (Platform.OS === 'web' || expoGo) return (mod = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('react-native-google-mobile-ads') as AdsModule;
  } catch {
    mod = null; // a build without the native module
  }
  return mod;
}

/** True when real ads can be shown on this device. */
export const realAdsAvailable = () => !!lib();

let ready: Promise<boolean> | null = null;

/**
 * Asks for ad consent where the law requires it (EEA, UK, some US states), then
 * starts the ad SDK. Runs once; later calls reuse the answer.
 */
function prepare(): Promise<boolean> {
  const ads = lib();
  if (!ads) return Promise.resolve(false);
  ready ??= (async () => {
    try {
      await ads.AdsConsent.gatherConsent();
    } catch {
      // No consent form available (e.g. offline): ads may still be allowed below.
    }
    const info = await ads.AdsConsent.getConsentInfo().catch(() => null);
    if (info && !info.canRequestAds) return false;
    await ads.default().initialize();
    return true;
  })().catch(() => {
    ready = null; // try again next time
    return false;
  });
  return ready;
}

export type AdOutcome = 'earned' | 'dismissed' | 'unavailable';

/**
 * Loads and shows one rewarded ad. Resolves 'earned' once the viewer has
 * watched enough to get the reward and closed the ad.
 */
export async function showRewardedAd(opts: { userId: string; sessionId: string }): Promise<AdOutcome> {
  const ads = lib();
  if (!ads || !(await prepare())) return 'unavailable';
  const unitId = __DEV__ || !ADMOB_REWARDED_UNIT ? ads.TestIds.REWARDED : ADMOB_REWARDED_UNIT;
  const ad = ads.RewardedAd.createForAdRequest(unitId, {
    serverSideVerificationOptions: { userId: opts.userId, customData: opts.sessionId },
  });
  return new Promise<AdOutcome>((resolve) => {
    let earned = false;
    let done = false;
    const finish = (outcome: AdOutcome) => {
      if (done) return;
      done = true;
      clearTimeout(loadTimeout);
      unsubscribe.forEach((u) => u());
      resolve(outcome);
    };
    // Give up if no ad arrives in 20 s (no fill, or a slow network).
    const loadTimeout = setTimeout(() => finish('unavailable'), 20_000);
    const unsubscribe = [
      ad.addAdEventListener(ads.RewardedAdEventType.LOADED, () => {
        clearTimeout(loadTimeout);
        ad.show().catch(() => finish('unavailable'));
      }),
      ad.addAdEventListener(ads.RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      }),
      ad.addAdEventListener(ads.AdEventType.CLOSED, () => finish(earned ? 'earned' : 'dismissed')),
      ad.addAdEventListener(ads.AdEventType.ERROR, () => finish('unavailable')),
    ];
    ad.load();
  });
}
