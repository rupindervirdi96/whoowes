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

/** Deep-link scheme registered in app.json — Stripe Checkout returns here. */
export const APP_SCHEME = 'whoowes';
