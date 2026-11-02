import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme';
import { useT } from '../../i18n';
import { formatCurrency } from '../../utils/currency';
import type { FriendFilter, FriendsSummary } from '../../hooks/useFriendInsights';
import Text from '../ui/Text';

interface Props {
  summary: FriendsSummary;
  filter: FriendFilter;
  onFilter: (f: FriendFilter) => void;
}

/**
 * "Owed to you | You owe" in the main currency. Each side is also the filter:
 * tap it to see just those people, tap again for everyone.
 */
const FriendsTotals: React.FC<Props> = ({ summary, filter, onFilter }) => {
  const t = useTheme();
  const { t: tr } = useT();

  const side = (key: Exclude<FriendFilter, 'all'>, label: string, amount: number, count: number) => {
    const selected = filter === key;
    const tone = key === 'owesYou' ? 'positive' : 'negative';
    const soft = key === 'owesYou' ? t.colors.positiveSoft : t.colors.negativeSoft;
    const empty = amount === 0;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected, disabled: empty }}
        disabled={empty}
        onPress={() => onFilter(selected ? 'all' : key)}
        style={({ pressed }) => ({
          flex: 1,
          minWidth: 0,
          padding: 12,
          borderRadius: 14,
          backgroundColor: selected ? soft : 'transparent',
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text variant="overline" tone={selected ? tone : 'tertiary'} numberOfLines={1}>
          {label}
        </Text>
        <Text variant="h2" tone={empty ? 'tertiary' : tone} tabular numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 4 }}>
          {formatCurrency(amount, summary.currency)}
        </Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ marginTop: 2 }}>
          {count > 0 ? tr('friends.peopleCount', { count }) : ' '}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={{
        backgroundColor: t.colors.surface,
        borderRadius: 20,
        padding: 6,
        borderWidth: t.isDark ? 1 : 0,
        borderColor: t.colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
        {side('owesYou', tr('friends.owedToYou'), summary.owedToYou, summary.owedCount)}
        <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: t.colors.border, marginVertical: 12 }} />
        {side('youOwe', tr('friends.youOwe'), summary.youOwe, summary.oweCount)}
      </View>
      {summary.otherCurrencies > 0 ? (
        <Text variant="caption" tone="tertiary" style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
          {tr('friends.otherCurrencies', { count: summary.otherCurrencies })}
        </Text>
      ) : null}
    </View>
  );
};

export default FriendsTotals;
