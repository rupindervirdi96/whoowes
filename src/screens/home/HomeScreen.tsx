import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '../../constants';
import { useRefreshOnFocus } from '../../hooks/queryUtils';
import { useTheme } from '../../theme';
import { useCurrentUser } from '../../hooks/useAuth';
import { useBalances, useActivity } from '../../hooks/useBalances';
import { useInbox } from '../../hooks/useInbox';
import IconButton from '../../components/ui/IconButton';
import { useUIStore } from '../../store/uiStore';
import { formatCurrency } from '../../utils/currency';
import { firstName } from '../../utils/money';
import Screen from '../../components/ui/Screen';
import Text from '../../components/ui/Text';
import Card, { ListCard } from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import ListRow, { RowAmount, SectionHeader } from '../../components/ui/ListRow';
import { SkeletonList } from '../../components/ui/Skeleton';
import BalanceHero from '../../components/BalanceHero';
import ExpenseRow from '../../components/ExpenseRow';
import SettlementRow from '../../components/SettlementRow';
import EmptyState from '../../components/ui/EmptyState';
import InboxSheet from '../../components/InboxSheet';
import { useT, type TKey } from '../../i18n';
import { useMyCurrency } from '../../hooks/useCurrency';

function greetingKey(): TKey {
  const h = new Date().getHours();
  return h < 12 ? 'home.morning' : h < 18 ? 'home.afternoon' : 'home.evening';
}

const HomeScreen: React.FC = () => {
  const t = useTheme();
  const { t: tr } = useT();
  const navigation = useNavigation();
  const user = useCurrentUser()!;
  const myCurrency = useMyCurrency();
  const openAddSheet = useUIStore((s) => s.openAddSheet);
  const balancesQ = useBalances();
  const activity = useActivity();
  const inbox = useInbox();
  const [inboxOpen, setInboxOpen] = useState(false);
  const queryClient = useQueryClient();

  // Balances, activity, payments to confirm, friend requests and reminders.
  const screenKeys = [QUERY_KEYS.BALANCES, QUERY_KEYS.EXPENSES, QUERY_KEYS.SETTLEMENTS, QUERY_KEYS.FRIENDS, QUERY_KEYS.REMINDERS];
  useRefreshOnFocus(screenKeys);

  const totals = balancesQ.data?.totals ?? [];
  const balances = balancesQ.data?.balances ?? [];

  return (
    <Screen
      edges={['top']}
      refreshing={balancesQ.isRefetching}
      onRefresh={() => {
        for (const queryKey of screenKeys) queryClient.refetchQueries({ queryKey: [...queryKey], type: 'active' });
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: t.spacing.sm, marginBottom: t.spacing.lg }}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" tone="tertiary">
            {tr(greetingKey())}
          </Text>
          <Text variant="h2" numberOfLines={1}>
            {firstName(user.name)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconButton
            icon={inbox.count ? 'notifications' : 'notifications-none'}
            badge={inbox.count}
            accessibilityLabel={inbox.count ? tr('home.inbox.a11yCount', { count: inbox.count }) : tr('home.inbox.title')}
            onPress={() => setInboxOpen(true)}
          />
          <Pressable onPress={() => navigation.navigate('Account')} accessibilityLabel={tr('nav.account')} accessibilityRole="button" hitSlop={8}>
            <Avatar name={user.name} uri={user.avatarUrl} size="md" />
          </Pressable>
        </View>
      </View>

      <BalanceHero totals={totals} currency={myCurrency} onSettleUp={() => navigation.navigate('SettleUp')} />

      {/* People balances */}
      <SectionHeader title={tr('home.balances')} action={balances.length > 4 ? tr('common.seeAll') : undefined} onAction={() => navigation.navigate('Main', { screen: 'Friends' })} />
      {balancesQ.isLoading ? (
        <SkeletonList rows={3} />
      ) : balances.length === 0 ? (
        <Card variant="alt">
          <Text tone="secondary">{tr('home.settledWithEveryone')}</Text>
        </Card>
      ) : (
        <ListCard>
          {balances.slice(0, 4).map((b, i, arr) => {
            const owesMe = b.netBalance > 0;
            const direction = owesMe ? tr('balance.owesYou') : tr('balance.youOwe');
            const amount = formatCurrency(Math.abs(b.netBalance), b.currency);
            return (
              <ListRow
                key={`${b.userId}|${b.currency}`}
                leading={<Avatar name={b.user.name} uri={b.user.avatarUrl} />}
                title={b.user.name}
                subtitle={direction}
                divider={i < arr.length - 1}
                accessibilityLabel={`${b.user.name}, ${direction} ${amount}`}
                onPress={() => navigation.navigate('FriendDetail', { friendId: b.userId })}
                trailing={<RowAmount amount={amount} tone={owesMe ? 'positive' : 'negative'} />}
              />
            );
          })}
        </ListCard>
      )}

      {/* Recent activity */}
      <SectionHeader title={tr('home.recent')} action={tr('common.seeAll')} onAction={() => navigation.navigate('Main', { screen: 'Activity' })} />
      {activity.isLoading ? (
        <SkeletonList rows={3} />
      ) : activity.items.length === 0 ? (
        <EmptyState emoji="🧾" title={tr('home.empty.title')} body={tr('home.empty.body')} actionLabel={tr('common.addExpense')} onAction={() => openAddSheet()} />
      ) : (
        <ListCard>
          {activity.items.slice(0, 4).map((item, i, arr) =>
            item.kind === 'expense' ? (
              <ExpenseRow key={`e-${item.id}`} expense={item.expense} myId={user.id} divider={i < arr.length - 1} />
            ) : (
              <SettlementRow key={`s-${item.id}`} settlement={item.settlement} myId={user.id} divider={i < arr.length - 1} />
            ),
          )}
        </ListCard>
      )}
      <InboxSheet visible={inboxOpen} onClose={() => setInboxOpen(false)} />
    </Screen>
  );
};

export default HomeScreen;
