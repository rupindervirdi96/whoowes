import React, { useLayoutEffect } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { RootScreenProps } from '../../types/navigation';
import { useCurrentUser } from '../../hooks/useAuth';
import { useExpenses } from '../../hooks/useExpenses';
import { useSettlements } from '../../hooks/useSettlements';
import { useBalancesWith } from '../../hooks/useBalances';
import { useFriends, useRemind, useRemoveFriend } from '../../hooks/useFriends';
import { useShowModal } from '../../store/uiStore';
import { useT } from '../../i18n';
import { formatCurrency } from '../../utils/currency';
import { firstName } from '../../utils/money';
import Screen from '../../components/ui/Screen';
import Text from '../../components/ui/Text';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import Card, { ListCard } from '../../components/ui/Card';
import { formatPhone } from '../../utils/phone';
import IconButton from '../../components/ui/IconButton';
import { SectionHeader } from '../../components/ui/ListRow';
import { SkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import ExpenseRow from '../../components/ExpenseRow';
import SettlementRow from '../../components/SettlementRow';

const FriendDetailScreen: React.FC<RootScreenProps<'FriendDetail'>> = ({ route, navigation }) => {
  const { friendId } = route.params;
  const t = useTheme();
  const { t: tr } = useT();
  const me = useCurrentUser()!;
  const { data: friends } = useFriends();
  const expensesQ = useExpenses();
  const { data: settlements = [] } = useSettlements();
  const balances = useBalancesWith(friendId); // one per currency, main first
  const remind = useRemind();
  const remove = useRemoveFriend();
  const showModal = useShowModal();

  const shared = (expensesQ.data ?? []).filter(
    (e) => e.paidBy === friendId || e.splits.some((s) => s.userId === friendId),
  );
  const friendUser =
    friends?.find((f) => f.friendId === friendId)?.friendUser ??
    shared[0]?.splits.find((s) => s.userId === friendId)?.user ??
    settlements.find((s) => s.fromUserId === friendId)?.fromUser ??
    settlements.find((s) => s.toUserId === friendId)?.toUser;
  const name = friendUser?.name ?? tr('friend.fallbackName');
  const first = firstName(name);
  const payments = settlements.filter((s) => s.fromUserId === friendId || s.toUserId === friendId);
  const isFriend = !!friends?.some((f) => f.friendId === friendId);

  const owedToMe = balances.filter((b) => b.netBalance > 0);
  const iOwe = balances.filter((b) => b.netBalance < 0);
  const settled = balances.length === 0;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <IconButton
          icon="add"
          variant="ghost"
          size={40}
          accessibilityLabel={tr('friend.addExpenseWith', { name: first })}
          onPress={() => navigation.navigate('ManualExpense', { friendId })}
        />
      ),
    });
  }, [navigation, first, friendId, tr]);

  const confirmRemove = () =>
    showModal({
      title: tr('friend.removeTitle', { name: first }),
      body: settled ? tr('friend.removeBody') : tr('friend.removeBodyOpen'),
      confirmLabel: tr('common.remove'),
      variant: 'danger',
      onConfirm: () => remove.mutate(friendId, { onSuccess: () => navigation.goBack() }),
    });

  // The first balance (main currency) drives the buttons; each other one is still listed.
  const main = balances[0];

  return (
    <Screen refreshing={expensesQ.isRefetching} onRefresh={expensesQ.refetch}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar name={name} uri={friendUser?.avatarUrl} size="lg" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="h2" numberOfLines={1}>
            {name}
          </Text>
          {friendUser?.email || friendUser?.phone ? (
            <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ marginTop: 2 }}>
              {friendUser.email || formatPhone(friendUser.phone!)}
            </Text>
          ) : null}
        </View>
      </View>

      <Card style={{ marginTop: t.spacing.xl }}>
        {settled ? (
          <Text variant="bodyStrong" tone="positive">
            {tr('friend.settledWith', { name: first })}
          </Text>
        ) : (
          <View style={{ gap: 12 }}>
            {owedToMe.length ? (
              <View>
                <Text variant="label" tone="tertiary">
                  {tr('friend.owesYou', { name: first })}
                </Text>
                {owedToMe.map((b) => (
                  <Text key={b.currency} variant="h1" tone="positive" tabular style={{ marginTop: 4 }}>
                    {formatCurrency(b.netBalance, b.currency)}
                  </Text>
                ))}
              </View>
            ) : null}
            {iOwe.length ? (
              <View>
                <Text variant="label" tone="tertiary">
                  {tr('friend.youOwe', { name: first })}
                </Text>
                {iOwe.map((b) => (
                  <Text key={b.currency} variant="h1" tone="negative" tabular style={{ marginTop: 4 }}>
                    {formatCurrency(-b.netBalance, b.currency)}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: t.spacing.lg }}>
          {owedToMe.length ? (
            <Button
              title={tr('friend.remind')}
              icon="notifications-active"
              variant="secondary"
              style={{ flex: 1 }}
              loading={remind.isPending}
              onPress={() => remind.mutate({ userId: friendId, name, amount: owedToMe[0].netBalance, currency: owedToMe[0].currency })}
            />
          ) : null}
          <Button
            title={settled ? tr('common.addExpense') : iOwe.length ? tr('hero.settleUp') : tr('friend.recordPayment')}
            icon={settled ? 'add' : iOwe.length ? 'swap-horiz' : undefined}
            style={{ flex: 1 }}
            onPress={() =>
              settled || !main
                ? navigation.navigate('ManualExpense', { friendId })
                : navigation.navigate('SettleUp', {
                    userId: friendId,
                    amount: Math.abs((iOwe[0] ?? main).netBalance),
                    currency: (iOwe[0] ?? main).currency,
                  })
            }
          />
        </View>
      </Card>

      <SectionHeader title={tr('friend.sharedExpenses')} />
      {expensesQ.isLoading ? (
        <SkeletonList rows={3} />
      ) : shared.length === 0 ? (
        <EmptyState emoji="🧾" title={tr('friend.nothingShared')} body={tr('friend.nothingSharedBody', { name: first })} />
      ) : (
        <ListCard>
          {shared.map((e, i) => (
            <ExpenseRow key={e.id} expense={e} myId={me.id} divider={i < shared.length - 1} />
          ))}
        </ListCard>
      )}

      {payments.length > 0 ? (
        <>
          <SectionHeader title={tr('friend.payments')} />
          <ListCard>
            {payments.map((s, i) => (
              <SettlementRow key={s.id} settlement={s} myId={me.id} divider={i < payments.length - 1} />
            ))}
          </ListCard>
        </>
      ) : null}

      {isFriend ? (
        <Button title={tr('friend.remove')} variant="ghost" icon="person-remove" onPress={confirmRemove} style={{ marginTop: t.spacing.xl }} />
      ) : null}
    </Screen>
  );
};

export default FriendDetailScreen;
