import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { usePassFor } from '../hooks/useAIPass';
import { useT } from '../i18n';
import type { AIFeature } from '../types';
import Badge from './ui/Badge';

/**
 * How much of an AI feature is left this month: "2 free left", "1 unlocked",
 * or "Ad" once the free uses are gone (the next use needs an ad).
 */
const PassTag: React.FC<{ feature: AIFeature; style?: StyleProp<ViewStyle> }> = ({ feature, style }) => {
  const { t } = useT();
  const { pass } = usePassFor(feature);
  if (!pass) return null;
  const freeLeft = Math.max(0, pass.freeLimit - pass.freeUsed);
  if (freeLeft > 0) return <Badge label={t('pass.freeLeft', { count: freeLeft })} tone="neutral" style={style} />;
  if (pass.unlocked > 0) return <Badge label={t('pass.unlockedLeft', { count: pass.unlocked })} tone="positive" style={style} />;
  return <Badge label={t('pass.adTag')} tone="info" icon="play-circle-outline" style={style} />;
};

export default PassTag;
