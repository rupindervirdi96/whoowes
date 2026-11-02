import React from 'react';
import { View } from 'react-native';
import { useAIPass } from '../hooks/useAIPass';
import { useTheme } from '../theme';
import { useT } from '../i18n';
import { formatShortDate } from '../utils/date';
import { FEATURE_NAME } from './AdGateSheet';
import Card from './ui/Card';
import Icon from './ui/Icon';
import Text from './ui/Text';

/**
 * This month's AI uses, per feature: free ones used of the allowance, plus any
 * unlocked by ads. Counted by the server, so the phone's clock can't change it.
 */
const AIPassCard: React.FC = () => {
  const t = useTheme();
  const { t: tr } = useT();
  const { data } = useAIPass();
  if (!data) return null;
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="auto-awesome" size={22} color={t.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="overline" tone="tertiary">
            {tr('pass.title')}
          </Text>
          <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
            {tr('pass.resets', { date: formatShortDate(data.resetsAt) })}
          </Text>
        </View>
      </View>

      <View style={{ gap: 12, marginTop: t.spacing.base }}>
        {data.features.map((f) => {
          const used = Math.min(f.freeUsed, f.freeLimit);
          const out = used >= f.freeLimit;
          return (
            <View key={f.feature}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text variant="caption" tone="secondary" style={{ textTransform: 'capitalize' }}>
                  {tr(FEATURE_NAME[f.feature])}
                </Text>
                <Text variant="caption" weight="bold" tone={out && f.unlocked === 0 ? 'tertiary' : 'default'}>
                  {f.unlocked > 0
                    ? `${tr('pass.freeUsedOf', { used, limit: f.freeLimit })} · ${tr('pass.unlockedLeft', { count: f.unlocked })}`
                    : tr('pass.freeUsedOf', { used, limit: f.freeLimit })}
                </Text>
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: t.colors.surfaceAlt, overflow: 'hidden' }}>
                <View style={{ height: 6, width: `${(used / Math.max(f.freeLimit, 1)) * 100}%`, backgroundColor: out ? t.colors.textTertiary : t.colors.primary }} />
              </View>
            </View>
          );
        })}
      </View>

      <Text variant="caption" tone="tertiary" style={{ marginTop: t.spacing.base }}>
        {tr('pass.explain', { count: data.features[0]?.freeLimit ?? 3, seconds: data.adSeconds })}
      </Text>
    </Card>
  );
};

export default AIPassCard;
