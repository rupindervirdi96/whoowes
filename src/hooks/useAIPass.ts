import { useQuery, type QueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import { QUERY_KEYS } from '../constants';
import { AIPassService, type PassStatus } from '../services/aiPass';
import type { AIFeature, ApiError } from '../types';
import { useAuthStore } from '../store/authStore';

/** What's left of each AI feature this month, as the server counts it. */
export function useAIPass() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: QUERY_KEYS.AI_PASS,
    queryFn: () => AIPassService.getPass(),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

/** One feature's pass, or undefined while loading. */
export function usePassFor(feature: AIFeature) {
  const { data } = useAIPass();
  return { pass: data?.features.find((f) => f.feature === feature), status: data };
}

// ─── The "watch an ad to unlock" sheet ───────────────────────────────────────

interface AdGateState {
  /** The feature waiting for an unlock, and how to answer the caller. */
  request: { feature: AIFeature; resolve: (unlocked: boolean) => void } | null;
  open: (feature: AIFeature) => Promise<boolean>;
  finish: (unlocked: boolean) => void;
}

export const useAdGate = create<AdGateState>((set, get) => ({
  request: null,
  open: (feature) =>
    new Promise<boolean>((resolve) => {
      get().request?.resolve(false); // only one at a time
      set({ request: { feature, resolve } });
    }),
  finish: (unlocked) => {
    get().request?.resolve(unlocked);
    set({ request: null });
  },
}));

/** Thrown when the user closes the unlock sheet without watching: callers stay quiet. */
export const AD_CANCELLED: ApiError = { code: 'ad_cancelled', message: '', statusCode: 0 };
export const isAdCancelled = (e: unknown) => (e as ApiError)?.code === 'ad_cancelled';

/**
 * Runs an AI call against the user's pass. If no uses are left (by the last
 * count, or because the server says so) the unlock sheet opens; after an ad it
 * runs the call. Throws AD_CANCELLED if they decide not to watch.
 */
export async function runWithPass<T>(queryClient: QueryClient, feature: AIFeature, call: () => Promise<T>): Promise<T> {
  const known = queryClient.getQueryData<PassStatus>(QUERY_KEYS.AI_PASS)?.features.find((f) => f.feature === feature);
  try {
    // Ask first when we already know there's nothing left, so a receipt isn't uploaded for nothing.
    if (known && known.available <= 0 && !(await useAdGate.getState().open(feature))) throw AD_CANCELLED;
    try {
      return await call();
    } catch (e) {
      if ((e as ApiError)?.code !== 'ad_required') throw e;
      if (!(await useAdGate.getState().open(feature))) throw AD_CANCELLED;
      return await call();
    }
  } finally {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AI_PASS });
  }
}
