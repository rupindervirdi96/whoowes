import React, { useMemo, useState } from 'react';
import { Share, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { useActivity } from '../../hooks/useBalances';
import { useCurrentUser } from '../../hooks/useAuth';
import { useFeatureGate } from '../../hooks/useBilling';
import { ActivityItem } from '../../types';
import { formatMonthYear } from '../../utils/date';
import { expensesToCsv } from '../../utils/csv';
import { useT } from '../../i18n';
import Screen from '../../components/ui/Screen';
import TabHeader from '../../components/ui/TabHeader';
import IconButton from '../../components/ui/IconButton';
import Input from '../../components/ui/Input';
import { SegmentedControl } from '../../components/ui/Chip';
import { ListCard } from '../../components/ui/Card';
import Text from '../../components/ui/Text';
import { SkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import ExpenseRow from '../../components/ExpenseRow';
import SettlementRow from '../../components/SettlementRow';

type Filter = 'all' | 'expenses' | 'payments';

const ActivityScreen: React.FC = () => {
  const t = useTheme();
  const { t: tr } = useT();
  const navigation = useNavigation();
  const me = useCurrentUser()!;
  const activity = useActivity();
  const gate = useFeatureGate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = (i: ActivityItem) => {
      if (filter === 'expenses' && i.kind !== 'expense') return false;
      if (filter === 'payments' && i.kind !== 'settlement') return false;
      if (!q) return true;
      if (i.kind === 'expense') {
        return (
          i.expense.title.toLowerCase().includes(q) ||
          i.expense.category.includes(q) ||
          i.expense.splits.some((s) => s.user.name.toLowerCase().includes(q))
        );
      }
      return (
        i.settlement.fromUser.name.toLowerCase().includes(q) ||
        i.settlement.toUser.name.toLowerCase().includes(q) ||
        (i.settlement.note ?? '').toLowerCase().includes(q)
      );
    };
    const out: Array<{ title: string; items: ActivityItem[] }> = [];
    for (const item of activity.items.filter(match)) {
      const title = formatMonthYear(item.date);
      const last = out[out.length - 1];
      if (last?.title === title) last.items.push(item);
      else out.push({ title, items: [item] });
    }
    return out;
  }, [activity.items, search, filter]);

  const exportCsv = () => {
    if (!gate('csv_export')) return;
    const expenses = activity.items.flatMap((i) => (i.kind === 'expense' ? [i.expense] : []));
    Share.share({ title: tr('activity.exportTitle'), message: expensesToCsv(expenses, me.id) });
  };

  return (
    <Screen edges={['top']} refreshing={activity.isRefetching} onRefresh={activity.refetch}>
      <TabHeader
        title={tr('tab.activity')}
        right={
          <>
            <IconButton icon="insights" variant="soft" accessibilityLabel={tr('account.insights')} onPress={() => navigation.navigate('Insights')} />
            <IconButton icon="file-download" variant="soft" accessibilityLabel={tr('activity.export')} onPress={exportCsv} />
          </>
        }
      />
      <Input icon="search" value={search} onChangeText={setSearch} placeholder={tr('common.search')} containerStyle={{ marginBottom: t.spacing.md }} />
      <SegmentedControl
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: tr('common.all') },
          { value: 'expenses', label: tr('group.tab.expenses') },
          { value: 'payments', label: tr('friend.payments') },
        ]}
      />

      {activity.isLoading ? (
        <View style={{ marginTop: t.spacing.xl }}>
          <SkeletonList rows={6} />
        </View>
      ) : sections.length === 0 ? (
        <EmptyState emoji="🗂️" title={tr('activity.empty.title')} body={search ? tr('activity.noResults', { query: search }) : tr('activity.empty.body')} />
      ) : (
        sections.map((section) => (
          <View key={section.title} style={{ marginTop: t.spacing.xl }}>
            <Text variant="label" tone="tertiary" style={{ marginBottom: t.spacing.sm, marginLeft: 4 }}>
              {section.title}
            </Text>
            <ListCard>
              {section.items.map((item, i) =>
                item.kind === 'expense' ? (
                  <ExpenseRow key={`e-${item.id}`} expense={item.expense} myId={me.id} divider={i < section.items.length - 1} />
                ) : (
                  <SettlementRow key={`s-${item.id}`} settlement={item.settlement} myId={me.id} divider={i < section.items.length - 1} />
                ),
              )}
            </ListCard>
          </View>
        ))
      )}
    </Screen>
  );
};

export default ActivityScreen;
