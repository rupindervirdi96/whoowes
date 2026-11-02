/**
 * "Watch an ad to unlock one more" — opens when an AI feature has no uses left
 * this month. Mounted once at the app root; features open it via runWithPass().
 *
 * Flow: the server starts an ad session (its clock starts) → the ad plays → the
 * app claims the unlock. The server refuses until the ad has run long enough by
 * its own clock, so the sheet counts down and retries until it's through.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Modal, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '../constants';
import { useAdGate, useAIPass } from '../hooks/useAIPass';
import { AIPassService } from '../services/aiPass';
import { realAdsAvailable, showRewardedAd, type AdOutcome } from '../services/ads';
import { useAuthStore } from '../store/authStore';
import { useShowToast } from '../store/uiStore';
import { useTheme } from '../theme';
import { useT, type TKey } from '../i18n';
import { formatFullDate } from '../utils/date';
import type { AIFeature, ApiError } from '../types';
import BottomSheet from './ui/BottomSheet';
import Button from './ui/Button';
import Icon from './ui/Icon';
import Text from './ui/Text';

const FEATURE_ICON: Record<AIFeature, string> = {
  receipt_scan: 'document-scanner',
  quick_add: 'bolt',
  split_assistant: 'call-split',
  insights: 'insights',
};

export const FEATURE_NAME: Record<AIFeature, TKey> = {
  receipt_scan: 'pass.feature.receipt_scan',
  quick_add: 'pass.feature.quick_add',
  split_assistant: 'pass.feature.split_assistant',
  insights: 'pass.feature.insights',
};

type Phase = 'offer' | 'loading' | 'unlocking' | 'dismissed' | 'failed';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const AdGateSheet: React.FC = () => {
  const t = useTheme();
  const { t: tr } = useT();
  const queryClient = useQueryClient();
  const showToast = useShowToast();
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const request = useAdGate((s) => s.request);
  const finish = useAdGate((s) => s.finish);
  const { data: status } = useAIPass();
  const [phase, setPhase] = useState<Phase>('offer');
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  // Stand-in ad for Expo Go / web during development.
  const [testAd, setTestAd] = useState<{ seconds: number; done: (o: AdOutcome) => void } | null>(null);
  // The sheet steps aside while the ad plays: an ad can't open over another pop-up on iPhone.
  const [adPlaying, setAdPlaying] = useState(false);
  const alive = useRef(true);

  const feature = request?.feature;
  const pass = status?.features.find((f) => f.feature === feature);
  const adSeconds = status?.adSeconds ?? 30;

  useEffect(() => {
    if (request) {
      setPhase('offer');
      setError(null);
    }
  }, [request]);
  useEffect(() => () => void (alive.current = false), []);

  const close = (unlocked: boolean) => finish(unlocked);

  const playAd = async (sessionId: string, seconds: number): Promise<AdOutcome> => {
    if (!realAdsAvailable() && !__DEV__) return 'unavailable';
    setAdPlaying(true);
    await sleep(350); // let the sheet finish sliding away
    try {
      if (realAdsAvailable()) return await showRewardedAd({ userId, sessionId });
      return await new Promise<AdOutcome>((done) => setTestAd({ seconds, done }));
    } finally {
      setAdPlaying(false);
    }
  };

  /** Asks the server for the unlock, waiting out the rest of the ad time if needed. */
  const claim = async (sessionId: string) => {
    for (let attempt = 0; attempt < 30 && alive.current; attempt++) {
      try {
        const next = await AIPassService.claimAd(sessionId);
        queryClient.setQueryData(QUERY_KEYS.AI_PASS, next);
        return true;
      } catch (e) {
        const err = e as ApiError;
        if (err.code !== 'ad_too_soon' && err.code !== 'ad_unverified') throw e;
        // Not long enough yet by the server's clock: count down and ask again.
        for (let s = Math.max(1, err.retryAfter ?? 2); s > 0; s--) {
          setCountdown(s);
          await sleep(1000);
        }
        setCountdown(0);
      }
    }
    return false;
  };

  const watch = async () => {
    if (!feature) return;
    setError(null);
    setPhase('loading');
    try {
      const session = await AIPassService.startAd(feature);
      const outcome = await playAd(session.sessionId, session.adSeconds);
      if (outcome === 'dismissed') return setPhase('dismissed');
      if (outcome === 'unavailable') {
        setError(tr(realAdsAvailable() || !__DEV__ ? 'pass.adFailed' : 'pass.adsNotHere'));
        return setPhase('failed');
      }
      setPhase('unlocking');
      if (!(await claim(session.sessionId))) {
        setError(tr('pass.adFailed'));
        return setPhase('failed');
      }
      showToast(tr('pass.unlocked', { feature: tr(FEATURE_NAME[feature]) }), 'success');
      close(true);
    } catch (e) {
      setError((e as ApiError).message || tr('pass.adFailed'));
      setPhase('failed');
    }
  };

  const busy = phase === 'loading' || phase === 'unlocking';
  const name = feature ? tr(FEATURE_NAME[feature]) : '';

  return (
    <>
      <BottomSheet visible={!!request && !adPlaying} onClose={() => !busy && close(false)}>
        {feature ? (
          <View style={{ alignItems: 'center', paddingTop: 4 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                backgroundColor: t.colors.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={FEATURE_ICON[feature]} size={30} color={t.colors.primary} />
            </View>
            <Text variant="h2" align="center" style={{ marginTop: t.spacing.base }}>
              {tr('pass.outTitle', { feature: name })}
            </Text>
            <Text tone="secondary" align="center" style={{ marginTop: 8 }}>
              {tr('pass.outBody', {
                count: pass?.freeLimit ?? 3,
                feature: name,
                date: status ? formatFullDate(status.resetsAt) : '',
              })}
            </Text>

            {phase === 'dismissed' ? (
              <Text variant="label" tone="warning" align="center" style={{ marginTop: t.spacing.base }}>
                {tr('pass.watchFully')}
              </Text>
            ) : null}
            {error ? (
              <Text variant="label" tone="negative" align="center" style={{ marginTop: t.spacing.base }}>
                {error}
              </Text>
            ) : null}

            <Button
              title={
                phase === 'loading'
                  ? tr('pass.loadingAd')
                  : phase === 'unlocking'
                    ? countdown > 0
                      ? tr('pass.unlockingIn', { seconds: countdown })
                      : tr('pass.unlocking')
                    : tr('pass.watchAd', { seconds: adSeconds })
              }
              icon={busy ? undefined : 'play-circle-outline'}
              size="lg"
              fullWidth
              loading={busy}
              onPress={watch}
              style={{ marginTop: t.spacing.xl }}
            />
            <Button title={tr('pass.notNow')} variant="ghost" fullWidth disabled={busy} onPress={() => close(false)} style={{ marginTop: 6 }} />
          </View>
        ) : null}
      </BottomSheet>

      {testAd ? (
        <TestAd
          seconds={testAd.seconds}
          onDone={(o) => {
            testAd.done(o);
            setTestAd(null);
          }}
        />
      ) : null}
    </>
  );
};

/**
 * Development stand-in for a video ad (Expo Go and web have no ad SDK): a full
 * screen that counts down the ad time. Closing early doesn't earn the reward.
 */
const TestAd: React.FC<{ seconds: number; onDone: (o: AdOutcome) => void }> = ({ seconds, onDone }) => {
  const { t: tr } = useT();
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  return (
    <Modal visible animationType="fade" onRequestClose={() => onDone(left <= 0 ? 'earned' : 'dismissed')}>
      <View style={{ flex: 1, backgroundColor: '#0E0C1D', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Icon name="smart-display" size={56} color="#FFFFFF" />
        <Text variant="h2" color="#FFFFFF" align="center" style={{ marginTop: 16 }}>
          {tr('pass.testAd')}
        </Text>
        <Text color="rgba(255,255,255,0.7)" align="center" style={{ marginTop: 8 }}>
          {tr('pass.testAdBody')}
        </Text>
        <Text variant="display" color="#FFFFFF" tabular style={{ marginTop: 32 }}>
          {Math.max(0, left)}
        </Text>
        <Button
          title={left > 0 ? tr('pass.closeAd') : tr('common.done')}
          variant={left > 0 ? 'ghost' : 'primary'}
          style={{ marginTop: 32, minWidth: 180 }}
          onPress={() => onDone(left <= 0 ? 'earned' : 'dismissed')}
        />
      </View>
    </Modal>
  );
};

export default AdGateSheet;
