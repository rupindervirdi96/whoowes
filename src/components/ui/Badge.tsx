import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import Text from './Text';
import Icon from './Icon';

export type BadgeTone = 'neutral' | 'primary' | 'positive' | 'negative' | 'warning' | 'info' | 'pro' | 'accent';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: string;
  style?: StyleProp<ViewStyle>;
}

const Badge: React.FC<BadgeProps> = ({ label, tone = 'neutral', icon, style }) => {
  const { colors: c } = useTheme();
  const map: Record<BadgeTone, [string, string]> = {
    neutral: [c.surfaceAlt, c.textSecondary],
    primary: [c.primarySoft, c.primary],
    positive: [c.positiveSoft, c.positive],
    negative: [c.negativeSoft, c.negative],
    warning: [c.warningSoft, c.warning],
    info: [c.infoSoft, c.info],
    pro: [c.proSoft, c.pro],
    accent: [c.accent, c.textOnAccent],
  };
  const [bg, fg] = map[tone];
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          alignSelf: 'flex-start',
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 999,
          backgroundColor: bg,
        },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={12} color={fg} /> : null}
      <Text variant="caption" weight="bold" color={fg}>
        {label}
      </Text>
    </View>
  );
};

/** Gold "PLUS"/"PRO" tag shown next to paid features. */
export const PlanTag: React.FC<{ plan?: 'plus' | 'pro'; style?: StyleProp<ViewStyle> }> = ({ plan = 'pro', style }) => (
  <Badge label={plan === 'pro' ? 'PRO' : 'PLUS'} tone="pro" icon="auto-awesome" style={style} />
);

export default Badge;
