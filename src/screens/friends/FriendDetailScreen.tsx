import React, { useLayoutEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme';
import { RootScreenProps } from '../../types/navigation';
import { useCurrentUser } from '../../hooks/useAuth';
import { useExpenses } from '../../hooks/useExpenses';
import { useSettlements } from '../../hooks/useSettlements';
import { useBalancesWith } from '../../hooks/useBalances';
import { useAcceptFriendRequest, useAddFriend, useFriendRequests, useFriends, useRemoveFriend } from '../../hooks/useFriends';
import { useFriendTogether } from '../../hooks/useFriendInsights';
import { remindedRecently, useFriendActions } from '../../hooks/useFriendActions';
import { ageLabel, daysSince, openSince, STALE_AFTER_DAYS } from '../../utils/friendInsights';
import { formatSmartDate, timeAgo } from '../../utils/date';
import Icon from '../../components/ui/Icon';
import TogetherCard from '../../components/friends/TogetherCard';
import NicknameSheet from '../../components/friends/NicknameSheet';
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
  const actions = useFriendActions();
  const remove = useRemoveFriend();
  const showModal = useShowModal();
  const { shared, turn, stats } = useFriendTogether(friendId);
  const [editingNickname, setEditingNickname] = useState(false);

  const friend = friends?.find((f) => f.friendId === friendId);
  const friendUser =
    friend?.friendUser ??
    shared[0]?.splits.find((s) => s.userId === friendId)?.user ??
    settlements.find((s) => s.fromUserId === friendId)?.fromUser ??
    settlements.find((s) => s.toUserId === friendId)?.toUser;
  const name = friendUser?.name ?? tr('friend.fallbackName');
  const first = firstName(name);
  const payments = settlements.filter((s) => s.fromUserId === friendId || s.toUserId === friendId);
  const isFriend = !!friends?.some((f) => f.friendId === friendId);
  // Someone I only know through a group: offer to add them.
  const { data: requests } = useFriendRequests();
  const addFriend = useAddFriend();
  const acceptRequest = useAcceptFriendRequest();
  const theyAsked = requests?.incoming.find((r) => r.userId === friendId);
  const iAsked = requests?.outgoing.some((r) => r.friendId === friendId);

  const owedToMe = balances.filter((b) => b.netBalance > 0);
  const iOwe = balances.filter((b) => b.netBalance < 0);
  const settled = balances.length === 0;
  const amounts = balances.map((b) => ({ currency: b.currency, amount: b.netBalance }));
  const row = friend ? { user: friend.friendUser, friend, amounts, direction: 'settled' as const, since: null, stale: false } : null;

  // How long the main balance has been open.
  const main0 = balances[0];
  const since = main0 ? openSince(expensesQ.data ?? [], settlements, me.id, friendId, main0.currency, main0.netBalance) : null;
  const age = since ? ageLabel(since) : null;
  const stale = !!since && daysSince(since) >= STALE_AFTER_DAYS;
  const cooling = !!friend && remindedRecently(friend);

  const pinned = !!friend?.pinned;
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {friend ? (
            <IconButton
              icon="push-pin"
              variant={pinned ? 'soft' : 'ghost'}
              size={40}
              accessibilityLabel={pinned ? tr('friend.unpin', { name: first }) : tr('friend.pin', { name: first })}
              onPress={() => actions.togglePin(friend)}
            />
          ) : null}
          <IconButton
            icon="add"
            variant="ghost"
            size={40}
            accessibilityLabel={tr('friend.addExpenseWith', { name: first })}
            onPress={() => navigation.navigate('ManualExpense', { friendId })}
          />
        </View>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, first, friendId, tr, pinned, friend]);

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
          {friend ? (
            <Pressable
              onPress={() => setEditingNickname(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={friend.nickname ? tr('friends.action.editNickname') : tr('friends.action.addNickname')}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                alignSelf: 'flex-start',
                gap: 4,
                marginTop: 8,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: friend.nickname ? t.colors.surfaceAlt : 'transparent',
                borderWidth: friend.nickname ? 0 : 1,
                borderColor: t.colors.border,
                borderStyle: 'dashed',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Icon name={friend.nickname ? 'sell' : 'add'} size={13} color={t.colors.textSecondary} />
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                {friend.nickname ?? tr('friends.action.addNickname')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {!isFriend && friends && friendUser ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: t.spacing.lg }}>
          <Text variant="caption" tone="tertiary" style={{ flex: 1 }}>
            {tr('friend.notFriendHint')}
          </Text>
          {theyAsked ? (
            <Button title={tr('common.accept')} size="sm" loading={acceptRequest.isPending} onPress={() => acceptRequest.mutate(theyAsked.id)} />
          ) : (
            <Button
              title={iAsked ? tr('friend.requestSent') : tr('friend.addFriend')}
              icon={iAsked ? 'check' : 'person-add-alt'}
              size="sm"
              variant="secondary"
              disabled={iAsked}
              loading={addFriend.isPending}
              onPress={() => addFriend.mutate({ userId: friendId })}
            />
          )}
        </View>
      ) : null}

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
            {since && age ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="schedule" size={14} color={stale ? t.colors.warning : t.colors.textTertiary} />
                <Text variant="caption" tone={stale ? 'warning' : 'tertiary'}>
                  {tr('friend.openSince', { date: formatSmartDate(since), age })}
                </Text>
              </View>
            ) : null}
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: t.spacing.lg }}>
          {owedToMe.length ? (
            <Button
              title={cooling ? tr('friend.reminded') : tr('friend.remind')}
              icon={cooling ? 'check' : 'notifications-active'}
              variant="secondary"
              style={{ flex: 1 }}
              loading={actions.remindPending}
              disabled={cooling}
              onPress={() => (row ? actions.remind(row) : undefined)}
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
        {owedToMe.length && friend?.lastRemindedAt ? (
          <Text variant="caption" tone="tertiary" style={{ marginTop: 10, textAlign: 'center' }}>
            {tr('friend.lastReminded', { when: timeAgo(friend.lastRemindedAt) })}
          </Text>
        ) : null}
      </Card>

      {stats ? (
        <>
          <SectionHeader title={tr('friend.together', { name: first })} />
          <TogetherCard name={first} turn={turn} stats={stats} friendsSince={friend?.friendsSince} />
        </>
      ) : null}

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

      <NicknameSheet friend={editingNickname ? (friend ?? null) : null} onClose={() => setEditingNickname(false)} onSave={actions.setNickname} />
    </Screen>
  );
};

export default FriendDetailScreen;
