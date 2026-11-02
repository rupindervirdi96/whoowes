/**
 * AI passes: a few free uses of each AI feature a month, then one use per
 * rewarded ad.
 *
 * Live mode: the server counts everything by its own clock, so changing the
 * phone's date or time changes nothing. The app only shows what the server says.
 * Demo mode keeps the same rules in memory so every flow can be tried offline.
 */

import { USE_MOCK_API } from '../config';
import type { AIFeature, ApiError } from '../types';
import { translate } from '../i18n';
import apiClient from './api/apiClient';

export type { AIFeature };

export interface FeaturePass {
  feature: AIFeature;
  freeLimit: number;
  freeUsed: number;
  /** Uses unlocked by ads and not spent yet. */
  unlocked: number;
  /** Uses available right now without an ad. */
  available: number;
}

export interface PassStatus {
  month: string;
  /** When free uses come back (server time). */
  resetsAt: string;
  /** How long an ad must run before it unlocks a use. */
  adSeconds: number;
  features: FeaturePass[];
}

export interface AdSession {
  sessionId: string;
  adSeconds: number;
}

// ─── Demo mode (same rules, in memory) ───────────────────────────────────────

const FEATURES: AIFeature[] = ['receipt_scan', 'quick_add', 'split_assistant', 'insights'];
const DEMO_FREE = 3;
const DEMO_AD_SECONDS = 30;
const demo = {
  free: {} as Partial<Record<AIFeature, number>>,
  unlocked: {} as Partial<Record<AIFeature, number>>,
  sessions: new Map<string, { feature: AIFeature; startedAt: number; claimed: boolean }>(),
};

function demoStatus(): PassStatus {
  const now = new Date();
  return {
    month: now.toISOString().slice(0, 7),
    resetsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString(),
    adSeconds: DEMO_AD_SECONDS,
    features: FEATURES.map((feature) => {
      const freeUsed = demo.free[feature] ?? 0;
      const unlocked = demo.unlocked[feature] ?? 0;
      return { feature, freeLimit: DEMO_FREE, freeUsed, unlocked, available: Math.max(0, DEMO_FREE - freeUsed) + unlocked };
    }),
  };
}

/** Demo only: takes one use, like the server does, or throws `ad_required`. */
export function takeDemoPass(feature: AIFeature) {
  if ((demo.free[feature] ?? 0) < DEMO_FREE) {
    demo.free[feature] = (demo.free[feature] ?? 0) + 1;
    return;
  }
  if ((demo.unlocked[feature] ?? 0) > 0) {
    demo.unlocked[feature] = demo.unlocked[feature]! - 1;
    return;
  }
  const err: ApiError = { statusCode: 402, code: 'ad_required', feature, message: translate('pass.needAd') };
  throw err;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const AIPassService = {
  async getPass(): Promise<PassStatus> {
    if (USE_MOCK_API) return demoStatus();
    return (await apiClient.get<PassStatus>('/ai/pass')).data;
  },

  /** Tells the server an ad is starting; its clock starts now. */
  async startAd(feature: AIFeature): Promise<AdSession> {
    if (USE_MOCK_API) {
      const sessionId = `demo-${Date.now()}`;
      demo.sessions.set(sessionId, { feature, startedAt: Date.now(), claimed: false });
      return { sessionId, adSeconds: DEMO_AD_SECONDS };
    }
    return (await apiClient.post<AdSession>('/ai/ad/start', { feature })).data;
  },

  /**
   * Turns a watched ad into one use. The server refuses (`ad_too_soon`, with
   * `retryAfter` seconds) until the ad has run long enough by its clock.
   */
  async claimAd(sessionId: string): Promise<PassStatus> {
    if (USE_MOCK_API) {
      const s = demo.sessions.get(sessionId);
      if (!s || s.claimed) throw { code: 'ad_claimed', message: translate('pass.adFailed') } as ApiError;
      const wait = Math.ceil((s.startedAt + DEMO_AD_SECONDS * 1000 - Date.now()) / 1000);
      if (wait > 0) throw { code: 'ad_too_soon', retryAfter: wait, message: '' } as ApiError;
      s.claimed = true;
      demo.unlocked[s.feature] = (demo.unlocked[s.feature] ?? 0) + 1;
      return demoStatus();
    }
    return (await apiClient.post<PassStatus>('/ai/ad/claim', { sessionId })).data;
  },
};
