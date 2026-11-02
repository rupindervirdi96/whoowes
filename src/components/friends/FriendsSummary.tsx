import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme';
import { useT } from '../../i18n';
import { formatCurrency } from '../../utils/currency';
import type { FriendFilter, FriendsSummary as Summary } from '../../hooks/useFriendInsights';
import Card from '../ui/Card';
import Chip from '../ui/Chip';
import Text from '../ui/Text';

/** "Owed to you | You owe" across all friends, in the main currency. */
export const FriendsTotals: React.FC<{ summary: Summary }> = ({ summary }) => {
  const t = useTheme();
  const { t: tr } = useT();
  const column = (label: string, amount: number, tone: 'positive' | 'negative') => (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text variant="overline" tone="tertiary">
        {label}
      </Text>
      <Text variant="h2" tone={amount > 0 ? tone : 'tertiary'} tabular numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 6 }}>
        {formatCurrency(amount, summary.currency)}
      </Text>
    </View>
  );
  return (
    <Card style={{ marginTop: t.spacing.base }}>
      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 16 }}>
        {column(tr('friends.owedToYou'), summary.owedToYou, 'positive')}
        <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: t.colors.border }} />
        {column(tr('friends.youOwe'), summary.youOwe, 'negative')}
      </View>
      {summary.otherCurrencies > 0 ? (
        <Text variant="caption" tone="tertiary" style={{ marginTop: 10 }}>
          {tr('friends.otherCurrencies', { count: summary.otherCurrencies })}
        </Text>
      ) : null}
    </Card>
  );
};

type Counts = Record<FriendFilter, number>;

/** Shown only when it would actually narrow the list. */
export function filtersUseful(counts: Counts) {
  return [counts.owesYou, counts.youOwe, counts.settled].filter((n) => n > 0).length >= 2;
}

/** All · Owe you · You owe · Settled. Empty groups are left out. */
export const FriendFilters: React.FC<{ value: FriendFilter; onChange: (f: FriendFilter) => void; counts: Counts }> = ({
  value,
  onChange,
  counts,
}) => {
  const t = useTheme();
  const { t: tr } = useT();
  const options: { key: FriendFilter; label: string }[] = [
    { key: 'all', label: tr('friends.filter.all') },
    { key: 'owesYou', label: tr('friends.filter.owesYou', { count: counts.owesYou }) },
    { key: 'youOwe', label: tr('friends.filter.youOwe', { count: counts.youOwe }) },
    { key: 'settled', label: tr('friends.filter.settled', { count: counts.settled }) },
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginTop: t.spacing.md, marginHorizontal: -t.spacing.gutter }}
      contentContainerStyle={{ gap: 8, paddingHorizontal: t.spacing.gutter }}
    >
      {options
        .filter((o) => o.key === 'all' || counts[o.key] > 0 || o.key === value)
        .map((o) => (
          <Chip key={o.key} label={o.label} selected={value === o.key} onPress={() => onChange(o.key)} />
        ))}
    </ScrollView>
  );
};
