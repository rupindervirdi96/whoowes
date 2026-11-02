import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme';
import { useT } from '../../i18n';
import { categoryLabel } from '../../constants';
import { formatCurrency } from '../../utils/currency';
import { formatMonthYear } from '../../utils/date';
import type { SharedStats, WhoseTurn } from '../../utils/friendInsights';
import Card from '../ui/Card';
import CategoryIcon from '../ui/CategoryIcon';
import Text from '../ui/Text';

interface Props {
  /** First name of the friend. */
  name: string;
  turn: WhoseTurn | null;
  stats: SharedStats;
  friendsSince?: string;
}

/** "Next one's on Alex", a who-paid bar, and what you've split together. */
const TogetherCard: React.FC<Props> = ({ name, turn, stats, friendsSince }) => {
  const t = useTheme();
  const { t: tr } = useT();

  const headline = turn
    ? turn.next === 'them'
      ? tr('friend.turn.them', { name })
      : turn.next === 'me'
        ? tr('friend.turn.me')
        : tr('friend.turn.even')
    : null;

  const stat = (value: React.ReactNode, label: string, key: string) => (
    <View key={key} style={{ flex: 1, minWidth: 0 }}>
      {value}
      <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ marginTop: 4 }}>
        {label}
      </Text>
    </View>
  );

  return (
    <Card>
      {turn && headline ? (
        <View style={{ marginBottom: t.spacing.lg }}>
          <Text variant="h3">
            {headline}
          </Text>
          <Text variant="caption" tone="tertiary" style={{ marginTop: 4 }}>
            {tr('friend.turn.detail', { mine: turn.mine, total: turn.total })}
          </Text>
          {/* Who paid the last few bills: me on the left, them on the right. */}
          <View
            style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 12, gap: 2 }}
            accessible
            accessibilityLabel={`${tr('friend.turn.count', { name: tr('common.you'), count: turn.mine })}, ${tr('friend.turn.count', { name, count: turn.theirs })}`}
          >
            {turn.mine > 0 ? <View style={{ flex: turn.mine, backgroundColor: t.colors.primary }} /> : null}
            {turn.theirs > 0 ? <View style={{ flex: turn.theirs, backgroundColor: t.colors.primarySoft }} /> : null}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            <Text variant="caption" tone="secondary">
              {tr('friend.turn.count', { name: tr('common.you'), count: turn.mine })}
            </Text>
            <Text variant="caption" tone="secondary">
              {tr('friend.turn.count', { name, count: turn.theirs })}
            </Text>
          </View>
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.colors.border, marginTop: t.spacing.lg }} />
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 12 }}>
        {[
          stat(
            <Text variant="h3" tabular>
              {stats.count}
            </Text>,
            tr('friend.stats.expenses', { count: stats.count }),
            'count',
          ),
          stat(
            <Text variant="h3" tabular numberOfLines={1} adjustsFontSizeToFit>
              {formatCurrency(stats.total, stats.currency)}
            </Text>,
            tr('friend.stats.total'),
            'total',
          ),
          ...(stats.topCategory
            ? [
                stat(
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <CategoryIcon category={stats.topCategory} size={24} />
                    <Text variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {categoryLabel(stats.topCategory)}
                    </Text>
                  </View>,
                  tr('friend.stats.top'),
                  'top',
                ),
              ]
            : []),
        ]}
      </View>

      {friendsSince ? (
        <Text variant="caption" tone="tertiary" style={{ marginTop: t.spacing.lg }}>
          {tr('friend.friendsSince', { date: formatMonthYear(friendsSince) })}
        </Text>
      ) : null}
    </Card>
  );
};

export default TogetherCard;
