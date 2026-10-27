import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import Text from './Text';
import Icon from './Icon';

interface ListRowProps {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  /** Hairline under the row, inset to line up with the text. */
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
  titleTone?: 'default' | 'negative' | 'primary';
  accessibilityLabel?: string;
}

const ListRow: React.FC<ListRowProps> = ({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  chevron,
  divider,
  style,
  titleTone = 'default',
  accessibilityLabel,
}) => {
  const t = useTheme();
  const content = (pressed = false) => (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, opacity: pressed ? 0.6 : 1 }, style]}>
      {leading}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong" tone={titleTone} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ marginTop: 3 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {chevron ? <Icon name="chevron-right" size={20} color={t.colors.textTertiary} /> : null}
      {divider ? (
        <View
          style={{
            position: 'absolute',
            left: leading ? 54 : 0,
            right: 0,
            bottom: 0,
            height: StyleSheet.hairlineWidth,
            backgroundColor: t.colors.border,
          }}
        />
      ) : null}
    </View>
  );

  if (!onPress) return content();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}>
      {({ pressed }) => content(pressed)}
    </Pressable>
  );
};

/** Right-hand money column for rows: amount on top, a quiet caption underneath. */
export const RowAmount: React.FC<{
  amount: string;
  caption?: string;
  tone?: 'default' | 'positive' | 'negative' | 'secondary' | 'tertiary';
  captionTone?: 'tertiary' | 'warning' | 'negative';
}> = ({ amount, caption, tone = 'default', captionTone = 'tertiary' }) => (
  <View style={{ alignItems: 'flex-end' }}>
    <Text variant="bodyStrong" tone={tone} tabular>
      {amount}
    </Text>
    {caption ? (
      <Text variant="caption" tone={captionTone} style={{ marginTop: 3 }}>
        {caption}
      </Text>
    ) : null}
  </View>
);

export const SectionHeader: React.FC<{
  title: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}> = ({ title, action, onAction, style }) => {
  const t = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: t.spacing.section,
          marginBottom: t.spacing.md,
        },
        style,
      ]}
    >
      <Text variant="h3">{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Text variant="label" tone="primary">
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
};

export default ListRow;
