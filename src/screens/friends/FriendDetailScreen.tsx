import React, { useLayoutEffect } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { RootScreenProps } from '../../types/navigation';
import { useCurrentUser } from '../../hooks/useAuth';
import { useExpenses } from '../../hooks/useExpenses';
import { useSettlements } from '../../hooks/useSettlements';
import { useBalanceWith } from '../../hooks/useBalances';
import { useFriends, useRemind, useRemoveFriend } from '../../hooks/useFriends';
import { useShowModal } from '../../store/uiStore';
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
  const me = useCurrentUser()!;
  const { data: friends } = useFriends();
  const expensesQ = useExpenses();
  const { data: settlements = [] } = useSettlements();
  const net = useBalanceWith(friendId);
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
  const name = friendUser?.name ?? 'Friend';
  const payments = settlements.filter((s) => s.fromUserId === friendId || s.toUserId === friendId);
  const isFriend = !!friends?.some((f) => f.friendId === friendId);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <IconButton
          icon="add"
          variant="ghost"
          size={40}
          accessibilityLabel={`Add an expense with ${firstName(name)}`}
          onPress={() => navigation.navigate('ManualExpense', { friendId })}
        />
      ),
    });
  }, [navigation, name, friendId]);

  const confirmRemove = () =>
    showModal({
      title: `Remove ${firstName(name)}?`,
      body: net !== 0 ? 'You still have an open balance. Shared expenses stay in your history.' : 'Shared expenses stay in your history.',
      confirmLabel: 'Remove',
      variant: 'danger',
      onConfirm: () => remove.mutate(friendId, { onSuccess: () => navigation.goBack() }),
    });

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
        {net === 0 ? (
          <Text variant="bodyStrong" tone="positive">
            You and {firstName(name)} are settled up
          </Text>
        ) : (
          <>
            <Text variant="label" tone="tertiary">
              {net > 0 ? `${firstName(name)} owes you` : `You owe ${firstName(name)}`}
            </Text>
            <Text variant="h1" tone={net > 0 ? 'positive' : 'negative'} tabular style={{ marginTop: 4 }}>
              {formatCurrency(Math.abs(net))}
            </Text>
          </>
        )}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: t.spacing.lg }}>
          {net > 0 ? (
            <Button
              title="Remind"
              icon="notifications-active"
              variant="secondary"
              style={{ flex: 1 }}
              loading={remind.isPending}
              onPress={() => remind.mutate({ userId: friendId, name, amount: Math.abs(net) || undefined })}
            />
          ) : null}
          <Button
            title={net > 0 ? 'Record payment' : net < 0 ? 'Settle up' : 'Add expense'}
            icon={net === 0 ? 'add' : net < 0 ? 'swap-horiz' : undefined}
            style={{ flex: 1 }}
            onPress={() =>
              net === 0
                ? navigation.navigate('ManualExpense', { friendId })
                : navigation.navigate('SettleUp', { userId: friendId, amount: Math.abs(net) || undefined })
            }
          />
        </View>
      </Card>

      <SectionHeader title="Shared expenses" />
      {expensesQ.isLoading ? (
        <SkeletonList rows={3} />
      ) : shared.length === 0 ? (
        <EmptyState emoji="🧾" title="Nothing shared yet" body={`Expenses you split with ${firstName(name)} show up here.`} />
      ) : (
        <ListCard>
          {shared.map((e, i) => (
            <ExpenseRow key={e.id} expense={e} myId={me.id} divider={i < shared.length - 1} />
          ))}
        </ListCard>
      )}

      {payments.length > 0 ? (
        <>
          <SectionHeader title="Payments" />
          <ListCard>
            {payments.map((s, i) => (
              <SettlementRow key={s.id} settlement={s} myId={me.id} divider={i < payments.length - 1} />
            ))}
          </ListCard>
        </>
      ) : null}

      {isFriend ? (
        <Button title="Remove friend" variant="ghost" icon="person-remove" onPress={confirmRemove} style={{ marginTop: t.spacing.xl }} />
      ) : null}
    </Screen>
  );
};

export default FriendDetailScreen;
