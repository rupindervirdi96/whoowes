import React from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { useCurrentUser } from '../../hooks/useAuth';
import { useBalances, useActivity } from '../../hooks/useBalances';
import { usePendingSettlements } from '../../hooks/useSettlements';
import { useFriendRequests, useAcceptFriendRequest, useReminders, useDismissReminder } from '../../hooks/useFriends';
import IconButton from '../../components/ui/IconButton';
import { useContactMatches } from '../../hooks/useContacts';
import { useUIStore } from '../../store/uiStore';
import { formatCurrency } from '../../utils/currency';
import { firstName } from '../../utils/money';
import Screen from '../../components/ui/Screen';
import Text from '../../components/ui/Text';
import Card, { ListCard } from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';
import ListRow, { RowAmount, SectionHeader } from '../../components/ui/ListRow';
import { SkeletonList } from '../../components/ui/Skeleton';
import BalanceHero from '../../components/BalanceHero';
import ExpenseRow from '../../components/ExpenseRow';
import SettlementRow from '../../components/SettlementRow';
import EmptyState from '../../components/ui/EmptyState';
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
  const { data: pending = [] } = usePendingSettlements();
  const { data: requests } = useFriendRequests();
  const accept = useAcceptFriendRequest();
  const { data: reminders = [] } = useReminders();
  const dismissReminder = useDismissReminder();
  const contacts = useContactMatches();

  const totals = balancesQ.data?.totals ?? [];
  const balances = balancesQ.data?.balances ?? [];
  const incoming = requests?.incoming ?? [];
  const newOnWhoOwes = contacts.data?.onWhoOwes.filter((m) => m.state === 'none') ?? [];
  const askForContacts = contacts.data?.permission === 'undetermined';
  const contactsRow = newOnWhoOwes.length > 0 || askForContacts;
  const todo = pending.length + reminders.length + incoming.length + (contactsRow ? 1 : 0);

  return (
    <Screen
      edges={['top']}
      refreshing={balancesQ.isRefetching}
      onRefresh={() => {
        balancesQ.refetch();
        activity.refetch();
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
        <Pressable onPress={() => navigation.navigate('Account')} accessibilityLabel={tr('nav.account')} accessibilityRole="button" hitSlop={8}>
          <Avatar name={user.name} uri={user.avatarUrl} size="md" />
        </Pressable>
      </View>

      <BalanceHero totals={totals} currency={myCurrency} onSettleUp={() => navigation.navigate('SettleUp')} />

      {/* Things waiting on me */}
      {todo > 0 ? (
        <>
          <SectionHeader title={tr('home.attention')} />
          <ListCard>
            {pending.map((s, i) => (
              <ListRow
                key={s.id}
                leading={<Avatar name={s.fromUser.name} />}
                title={tr('home.paidYouAmount', { name: firstName(s.fromUser.name), amount: formatCurrency(s.amount, s.currency) })}
                subtitle={tr('home.confirmYouGotIt')}
                chevron
                divider={i < todo - 1}
                onPress={() => navigation.navigate('SettlementDetail', { settlementId: s.id })}
              />
            ))}
            {reminders.map((r, i) => (
              <ListRow
                key={r.id}
                leading={<Avatar name={r.fromUser.name} uri={r.fromUser.avatarUrl} />}
                title={tr('home.sentReminder', { name: firstName(r.fromUser.name) })}
                subtitle={r.amount ? tr('home.about', { amount: formatCurrency(r.amount, r.currency ?? myCurrency) }) : tr('home.settleWhenYouCan')}
                divider={pending.length + i < todo - 1}
                trailing={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <IconButton
                      icon="close"
                      variant="ghost"
                      size={36}
                      accessibilityLabel={tr('home.dismissReminder')}
                      onPress={() => dismissReminder.mutate(r.id)}
                    />
                    <Button title={tr('home.settle')} size="sm" onPress={() => navigation.navigate('SettleUp', { userId: r.fromUser.id, currency: r.currency })} />
                  </View>
                }
              />
            ))}
            {incoming.map((r, i) => (
              <ListRow
                key={r.id}
                leading={<Avatar name={r.friendUser.name} />}
                title={firstName(r.friendUser.name)}
                subtitle={tr('friends.wantsToBeFriends')}
                divider={pending.length + reminders.length + i < todo - 1}
                trailing={<Button title={tr('common.accept')} size="sm" onPress={() => accept.mutate(r.id)} loading={accept.isPending && accept.variables === r.id} />}
              />
            ))}
            {contactsRow ? (
              <ListRow
                leading={
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="contacts" size={20} color={t.colors.primary} />
                  </View>
                }
                title={
                  newOnWhoOwes.length === 0
                    ? tr('home.findFromContacts')
                    : newOnWhoOwes.length === 1
                      ? tr('home.contactOnWhoOwes', { name: firstName(newOnWhoOwes[0].contactName) })
                      : tr('home.contactsOnWhoOwes', { count: newOnWhoOwes.length })
                }
                subtitle={newOnWhoOwes.length === 0 ? tr('home.seeWhosHere') : tr('home.addThemAsFriends')}
                chevron
                onPress={() => navigation.navigate('FindFriends')}
              />
            ) : null}
          </ListCard>
        </>
      ) : null}

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
    </Screen>
  );
};

export default HomeScreen;
