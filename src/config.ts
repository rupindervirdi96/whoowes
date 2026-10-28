/**
 * Runtime configuration.
 *
 * Set EXPO_PUBLIC_API_URL (see .env.example) to talk to the WhoOwes server in /server.
 * Without it the app runs fully offline on the mock data layer — including a
 * demo checkout that unlocks paid plans without charging anything.
 */

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

/** True when no backend is configured: services use in-memory mocks. */
export const USE_MOCK_API = API_URL.length === 0;

export const API_TIMEOUT_MS = 30_000;

/** AI calls (receipt vision, insights) can take longer than normal requests. */
export const AI_TIMEOUT_MS = 90_000;

/**
 * RevenueCat public SDK keys (Project settings → API keys). Not secret: they can
 * only start purchases. Set per platform to turn on store subscriptions there.
 */
export const REVENUECAT_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';
export const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';

/** Where the privacy policy, terms and account deletion pages live (served by the server). */
export const LEGAL_URLS = {
  privacy: `${API_URL}/privacy`,
  terms: `${API_URL}/terms`,
};

/** Deep-link scheme registered in app.json — Stripe Checkout returns here. */
export const APP_SCHEME = 'whoowes';
