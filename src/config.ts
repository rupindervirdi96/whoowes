/**
 * Runtime configuration.
 *
 * Set EXPO_PUBLIC_API_URL (see .env.example) to talk to the WhoOwes server in /server.
 * Without it the app runs fully offline on the mock data layer.
 */

import { Platform } from 'react-native';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

/** True when no backend is configured: services use in-memory mocks. */
export const USE_MOCK_API = API_URL.length === 0;

export const API_TIMEOUT_MS = 30_000;

/** AI calls (receipt vision, insights) can take longer than normal requests. */
export const AI_TIMEOUT_MS = 90_000;

/**
 * AdMob rewarded ad unit ids (AdMob → Apps → Ad units), per platform. Not secret.
 * Unset, or in development, Google's test ad is shown instead.
 */
export const ADMOB_REWARDED_UNIT =
  (Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS : process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID) ?? '';

/** Where the privacy policy, terms and account deletion pages live (served by the server). */
export const LEGAL_URLS = {
  privacy: `${API_URL}/privacy`,
  terms: `${API_URL}/terms`,
};

/** Deep-link scheme registered in app.json. */
export const APP_SCHEME = 'whoowes';

/**
 * Link in invite messages. Defaults to the Google Play listing (whoowes.app is
 * someone else's domain). Set EXPO_PUBLIC_INVITE_URL once WhoOwes has its own site.
 */
export const INVITE_URL = process.env.EXPO_PUBLIC_INVITE_URL || 'https://play.google.com/store/apps/details?id=com.whoowes.app';
