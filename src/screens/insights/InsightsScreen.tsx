/**
 * Spending insights. Numbers are computed on-device for every plan; Pro adds an
 * AI-written read-out. Charts follow the dataviz rules: one fixed color per
 * category, every bar directly labeled with name + value (never color alone),
 * thin 4px-rounded bars, 2px gaps between stacked segments.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { RootScreenProps } from '../../types/navigation';
import { useMonthInsights } from '../../hooks/useAI';
import { formatCurrency } from '../../utils/currency';
import { monthKey, monthLabel, shiftMonth } from '../../utils/insights';
import { CATEGORY_BY_ID, CATEGORY_CHART_ORDER } from '../../constants';
import Screen from '../../components/ui/Screen';
import Text from '../../components/ui/Text';
import Card from '../../components/ui/Card';
import Icon from '../../components/ui/Icon';
import IconButton from '../../components/ui/IconButton';
import Button from '../../components/ui/Button';
import Skeleton from '../../components/ui/Skeleton';
import Avatar from '../../components/ui/Avatar';
import { PlanTag } from '../../components/ui/Badge';
import ListRow, { SectionHeader } from '../../components/ui/ListRow';
import EmptyState from '../../components/ui/EmptyState';
import { categoryColor } from '../../components/ui/CategoryIcon';

const InsightsScreen: React.FC<RootScreenProps<'Insights'>> = ({ navigation }) => {
  const t = useTheme();
  const thisMonth = monthKey(new Date());
  const [month, setMonth] = useState(thisMonth);
  const { stats, narrative, aiEnabled } = useMonthInsights(month);

  const delta = stats && stats.previousTotal > 0 ? (stats.total - stats.previousTotal) / stats.previousTotal : null;
  const max = Math.max(...(stats?.byCategory.map((c) => c.amount) ?? [0]), 1);

  return (
    <Screen>
      {/* Month switcher */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: t.spacing.base }}>
        <IconButton icon="chevron-left" accessibilityLabel="Previous month" onPress={() => setMonth((m) => shiftMonth(m, -1))} />
        <Text variant="h3">{monthLabel(month)}</Text>
        <IconButton
          icon="chevron-right"
          accessibilityLabel="Next month"
          onPress={() => setMonth((m) => (m < thisMonth ? shiftMonth(m, 1) : m))}
          style={{ opacity: month < thisMonth ? 1 : 0.35 }}
        />
      </View>

      {!stats ? (
        <Skeleton height={140} radius={18} />
      ) : stats.count === 0 ? (
        <EmptyState emoji="📭" title="No shared spending" body={`Nothing was split in ${monthLabel(month)}.`} />
      ) : (
        <>
          {/* Hero stat */}
          <Card>
            <Text variant="overline" tone="tertiary">
              Your share
            </Text>
            <Text variant="display" tabular style={{ marginTop: 4 }}>
              {formatCurrency(stats.total)}
            </Text>
            {delta !== null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Icon name={delta > 0 ? 'trending-up' : 'trending-down'} size={18} color={t.colors.textSecondary} />
                <Text variant="label" tone="secondary">
                  {Math.abs(Math.round(delta * 100))}% {delta > 0 ? 'more' : 'less'} than {monthLabel(shiftMonth(month, -1)).split(' ')[0]} (
                  {formatCurrency(stats.previousTotal)})
                </Text>
              </View>
            ) : null}
            <Text variant="caption" tone="tertiary" style={{ marginTop: 4 }}>
              Across {stats.count} shared expense{stats.count === 1 ? '' : 's'}
            </Text>

            {/* Stacked proportion bar — fixed category order */}
            <View style={{ flexDirection: 'row', height: 12, marginTop: 16, gap: 2 }} accessibilityElementsHidden>
              {[...stats.byCategory]
                .sort((a, b) => CATEGORY_CHART_ORDER.indexOf(a.category) - CATEGORY_CHART_ORDER.indexOf(b.category))
                .map((c) => (
                  <View key={c.category} style={{ flex: c.amount, backgroundColor: categoryColor(c.category, t.isDark), borderRadius: 4 }} />
                ))}
            </View>
          </Card>

          {/* AI read-out */}
          <SectionHeader title="The read-out" />
          {aiEnabled ? (
            narrative.isLoading ? (
              <Card style={{ gap: 10 }}>
                <Skeleton width="80%" height={18} />
                <Skeleton width="95%" />
                <Skeleton width="70%" />
              </Card>
            ) : narrative.data ? (
              <Card style={{ borderWidth: 1.5, borderColor: t.colors.primary }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Icon name="auto-awesome" size={18} color={t.colors.primary} />
                  <Text variant="overline" tone="primary">
                    AI summary
                  </Text>
                </View>
                <Text variant="h3" style={{ marginTop: 8 }}>
                  {narrative.data.headline}
                </Text>
                <View style={{ gap: 8, marginTop: 10 }}>
                  {narrative.data.highlights.map((h) => (
                    <View key={h} style={{ flexDirection: 'row', gap: 8 }}>
                      <Text tone="primary">•</Text>
                      <Text style={{ flex: 1 }}>{h}</Text>
                    </View>
                  ))}
                </View>
                {narrative.data.tips.length ? (
                  <View style={{ marginTop: 14, padding: 12, borderRadius: t.radius.md, backgroundColor: t.colors.surfaceAlt, gap: 6 }}>
                    <Text variant="label">Tips</Text>
                    {narrative.data.tips.map((tip) => (
                      <Text key={tip} variant="caption" tone="secondary">
                        💡 {tip}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </Card>
            ) : (
              <Card variant="alt">
                <Text tone="secondary">Couldn’t load the summary right now.</Text>
                <Button title="Try again" size="sm" variant="secondary" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={() => narrative.refetch()} />
              </Card>
            )
          ) : (
            <Card variant="alt">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text variant="bodyStrong" style={{ flex: 1 }}>
                  Get a monthly AI read-out
                </Text>
                <PlanTag plan="pro" />
              </View>
              <Text tone="secondary" style={{ marginTop: 6 }}>
                Trends, who you split with most, and tips to keep balances small — written for you every month.
              </Text>
              <Button title="Unlock with Pro" variant="pro" size="sm" style={{ marginTop: 12, alignSelf: 'flex-start' }} onPress={() => navigation.navigate('Plans', { feature: 'ai_insights' })} />
            </Card>
          )}

          {/* Category bars — sorted by amount, each directly labeled */}
          <SectionHeader title="By category" />
          <Card style={{ gap: 14 }}>
            {stats.byCategory.map((c) => {
              const meta = CATEGORY_BY_ID[c.category];
              const pct = stats.total > 0 ? Math.round((c.amount / stats.total) * 100) : 0;
              return (
                <View key={c.category} accessible accessibilityLabel={`${meta.label}: ${formatCurrency(c.amount)}, ${pct} percent`}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ width: 26 }}>{meta.emoji}</Text>
                    <Text variant="label" style={{ flex: 1 }}>
                      {meta.label}
                    </Text>
                    <Text variant="caption" tone="tertiary" style={{ marginRight: 8 }}>
                      {pct}%
                    </Text>
                    <Text variant="label" tabular>
                      {formatCurrency(c.amount)}
                    </Text>
                  </View>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: t.colors.surfaceAlt }}>
                    <View
                      style={{
                        height: 8,
                        width: `${Math.max(2, (c.amount / max) * 100)}%`,
                        borderRadius: 4,
                        backgroundColor: categoryColor(c.category, t.isDark),
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </Card>

          {stats.topPeople.length ? (
            <>
              <SectionHeader title="Who you split with most" />
              <Card padding={4} style={{ paddingHorizontal: 12 }}>
                {stats.topPeople.map((p, i) => (
                  <ListRow
                    key={p.name}
                    divider={i < stats.topPeople.length - 1}
                    leading={<Avatar name={p.name} size="sm" />}
                    title={p.name}
                    subtitle="their shares"
                    trailing={<Text variant="bodyStrong" tabular>{formatCurrency(p.amount)}</Text>}
                  />
                ))}
              </Card>
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
};

export default InsightsScreen;
