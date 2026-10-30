import React, { useLayoutEffect, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { RootScreenProps } from '../../types/navigation';
import { useGroup, useDeleteGroup, useAddGroupMember, useUpdateGroup } from '../../hooks/useGroups';
import { useExpenses } from '../../hooks/useExpenses';
import { useFriends, useRemind } from '../../hooks/useFriends';
import { useGroupBalances } from '../../hooks/useBalances';
import { useCurrentUser } from '../../hooks/useAuth';
import { useMyCurrency } from '../../hooks/useCurrency';
import { useShowModal, useUIStore } from '../../store/uiStore';
import { useT } from '../../i18n';
import { currencyName, formatCurrency } from '../../utils/currency';
import { firstName } from '../../utils/money';
import Screen from '../../components/ui/Screen';
import Text from '../../components/ui/Text';
import Card, { ListCard } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import IconButton from '../../components/ui/IconButton';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Icon from '../../components/ui/Icon';
import { SegmentedControl } from '../../components/ui/Chip';
import ListRow, { SectionHeader } from '../../components/ui/ListRow';
import { SkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import BottomSheet from '../../components/ui/BottomSheet';
import ExpenseRow from '../../components/ExpenseRow';
import GroupTile from '../../components/GroupTile';
import BalanceAmounts from '../../components/BalanceAmounts';
import CurrencyPicker from '../../components/CurrencyPicker';
import { formatPhone } from '../../utils/phone';

type Tab = 'expenses' | 'balances' | 'members';

const GroupDetailScreen: React.FC<RootScreenProps<'GroupDetail'>> = ({ route, navigation }) => {
  const { groupId } = route.params;
  const t = useTheme();
  const { t: tr } = useT();
  const me = useCurrentUser()!;
  const myCurrency = useMyCurrency();
  const [tab, setTab] = useState<Tab>('expenses');
  const [addOpen, setAddOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const groupQ = useGroup(groupId);
  const expensesQ = useExpenses(groupId);
  const balances = useGroupBalances(groupId);
  const { data: friends = [] } = useFriends();
  const deleteGroup = useDeleteGroup();
  const addMember = useAddGroupMember();
  const updateGroup = useUpdateGroup();
  const remind = useRemind();
  const showModal = useShowModal();
  const openAddSheet = useUIStore((s) => s.openAddSheet);
  const group = groupQ.data;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerRight: () => (
        <IconButton
          icon="delete-outline"
          variant="ghost"
          size={40}
          accessibilityLabel={tr('group.delete')}
          onPress={() =>
            showModal({
              title: tr('group.deleteTitle'),
              body: tr('group.deleteBody'),
              confirmLabel: tr('common.delete'),
              variant: 'danger',
              onConfirm: () => deleteGroup.mutate(groupId, { onSuccess: () => navigation.goBack() }),
            })
          }
        />
      ),
    });
  }, [navigation, group?.name, groupId, deleteGroup, showModal, tr]);

  if (groupQ.isLoading || !group) {
    return (
      <Screen>
        <SkeletonList rows={5} />
      </Screen>
    );
  }

  const groupCurrency = group.currency ?? myCurrency;
  const myNets = balances?.memberNets.find((m) => m.user.id === me.id)?.nets ?? [];
  const spend = group.totals?.length ? group.totals : [{ currency: groupCurrency, amount: group.totalExpenses }];
  const memberIds = new Set(group.members.map((m) => m.userId));
  const addable = friends.filter((f) => !memberIds.has(f.friendId));

  return (
    <Screen refreshing={expensesQ.isRefetching} onRefresh={() => { groupQ.refetch(); expensesQ.refetch(); }}>
      {/* Summary */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <GroupTile name={group.name} size={44} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="h3" numberOfLines={1}>
              {group.name}
            </Text>
            <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ marginTop: 2 }}>
              {group.description || tr('common.people', { count: group.members.length })}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', marginTop: t.spacing.lg }}>
          <View style={{ flex: 1 }}>
            <Text variant="caption" tone="tertiary">
              {tr('group.spend')}
            </Text>
            {spend.slice(0, 2).map((s) => (
              <Text key={s.currency} variant="h3" tabular style={{ marginTop: 2 }}>
                {formatCurrency(s.amount, s.currency)}
              </Text>
            ))}
          </View>
          <View style={{ width: 1, backgroundColor: t.colors.border, marginHorizontal: t.spacing.base }} />
          <View style={{ flex: 1 }}>
            <Text variant="caption" tone="tertiary">
              {myNets.length === 0 ? tr('common.you') : myNets.every((n) => n.amount > 0) ? tr('balance.youreOwedTitle') : myNets.every((n) => n.amount < 0) ? tr('balance.youOweTitle') : tr('group.yourBalance')}
            </Text>
            {myNets.length === 0 ? (
              <Text variant="h3" style={{ marginTop: 2 }}>
                {tr('common.settledUp')}
              </Text>
            ) : (
              myNets.slice(0, 2).map((n) => (
                <Text key={n.currency} variant="h3" tone={n.amount > 0 ? 'positive' : 'negative'} tabular style={{ marginTop: 2 }}>
                  {formatCurrency(Math.abs(n.amount), n.currency)}
                </Text>
              ))
            )}
          </View>
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: t.spacing.base }}>
        <Button title={tr('common.addExpense')} icon="add" style={{ flex: 1 }} onPress={() => openAddSheet(groupId)} />
        <Button title={tr('hero.settleUp')} icon="swap-horiz" variant="secondary" style={{ flex: 1 }} onPress={() => setTab('balances')} />
      </View>

      <SegmentedControl
        style={{ marginTop: t.spacing.xl }}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'expenses', label: tr('group.tab.expenses') },
          { value: 'balances', label: tr('group.tab.balances') },
          { value: 'members', label: `${tr('group.tab.members')} · ${group.members.length}` },
        ]}
      />

      {tab === 'expenses' ? (
        expensesQ.isLoading ? (
          <SkeletonList />
        ) : (expensesQ.data ?? []).length === 0 ? (
          <EmptyState emoji="🧾" title={tr('group.noExpenses')} body={tr('group.noExpensesBody')} />
        ) : (
          <ListCard style={{ marginTop: t.spacing.base }}>
            {expensesQ.data!.map((e, i, arr) => (
              <ExpenseRow key={e.id} expense={e} myId={me.id} divider={i < arr.length - 1} />
            ))}
          </ListCard>
        )
      ) : null}

      {tab === 'balances' && balances ? (
        <>
          <SectionHeader title={tr('group.suggested')} />
          <Text variant="caption" tone="tertiary" style={{ marginTop: -6, marginBottom: t.spacing.md }}>
            {balances.currencies.length > 1 ? tr('group.suggestedBodyMulti') : tr('group.suggestedBody')}
          </Text>
          {balances.debts.length === 0 ? (
            <Card variant="alt">
              <Text tone="positive" weight="bold">
                🎉 {tr('group.allSettled', { name: group.name })}
              </Text>
            </Card>
          ) : (
            <ListCard>
              {balances.debts.map((d, i) => {
                const fromName = d.from === me.id ? tr('common.you') : firstName(d.fromUser.name);
                const toName = d.to === me.id ? tr('common.youLower') : firstName(d.toUser.name);
                return (
                  <ListRow
                    key={`${d.from}-${d.to}-${d.currency}-${i}`}
                    leading={<Avatar name={d.fromUser.name} />}
                    title={`${fromName} → ${toName}`}
                    subtitle={formatCurrency(d.amount, d.currency)}
                    divider={i < balances.debts.length - 1}
                    trailing={
                      d.from === me.id ? (
                        <Button
                          title={tr('group.pay')}
                          size="sm"
                          onPress={() => navigation.navigate('SettleUp', { userId: d.to, amount: d.amount, currency: d.currency, groupId })}
                        />
                      ) : d.to === me.id ? (
                        <Button
                          title={tr('friend.remind')}
                          size="sm"
                          variant="secondary"
                          loading={remind.isPending && remind.variables?.userId === d.from}
                          onPress={() => remind.mutate({ userId: d.from, name: d.fromUser.name, amount: d.amount, currency: d.currency })}
                        />
                      ) : undefined
                    }
                  />
                );
              })}
            </ListCard>
          )}

          <SectionHeader title={tr('group.positions')} />
          <ListCard>
            {balances.memberNets.map((m, i) => {
              const isMe = m.user.id === me.id;
              const settled = m.nets.length === 0;
              const allOwed = m.nets.every((n) => n.amount > 0);
              const allOwe = m.nets.every((n) => n.amount < 0);
              const subtitle = settled
                ? tr('common.settledUp')
                : allOwed
                  ? tr(isMe ? 'balance.youreOwed' : 'balance.isOwed')
                  : allOwe
                    ? tr(isMe ? 'balance.youOwe' : 'balance.owes')
                    : tr('balance.mixed');
              return (
                <ListRow
                  key={m.user.id}
                  divider={i < balances.memberNets.length - 1}
                  leading={<Avatar name={m.user.name} />}
                  title={isMe ? tr('common.you') : m.user.name}
                  subtitle={subtitle}
                  trailing={settled ? undefined : <BalanceAmounts amounts={m.nets} />}
                />
              );
            })}
          </ListCard>
        </>
      ) : null}

      {tab === 'members' ? (
        <>
          <ListCard style={{ marginTop: t.spacing.base }}>
            {group.members.map((m, i) => (
              <ListRow
                key={m.userId}
                divider={i < group.members.length - 1}
                leading={<Avatar name={m.user.name} />}
                title={m.userId === me.id ? tr('group.memberYou', { name: m.user.name }) : m.user.name}
                subtitle={m.user.email || (m.user.phone ? formatPhone(m.user.phone) : undefined)}
                trailing={m.role === 'admin' ? <Badge label={tr('group.admin')} tone="primary" /> : null}
              />
            ))}
          </ListCard>
          <Button title={tr('group.addPeople')} icon="person-add-alt" variant="secondary" fullWidth style={{ marginTop: 12 }} onPress={() => setAddOpen(true)} />

          <SectionHeader title={tr('group.settings')} />
          <ListCard>
            <ListRow
              leading={<Icon name="payments" color={t.colors.textSecondary} />}
              title={tr('group.currency')}
              subtitle={tr('group.currencyHint')}
              trailing={
                <Text tone="secondary" numberOfLines={1}>
                  {groupCurrency}
                </Text>
              }
              accessibilityLabel={`${tr('group.currency')}: ${currencyName(groupCurrency)}`}
              chevron
              onPress={() => setCurrencyOpen(true)}
            />
          </ListCard>
        </>
      ) : null}

      <BottomSheet visible={addOpen} onClose={() => setAddOpen(false)} title={tr('group.addToGroup')} subtitle={tr('group.pickFriends')}>
        {addable.length === 0 ? (
          <Text tone="secondary" style={{ paddingVertical: 16 }}>
            {tr('group.allFriendsIn')}
          </Text>
        ) : (
          addable.map((f) => (
            <ListRow
              key={f.id}
              leading={<Avatar name={f.friendUser.name} size="sm" />}
              title={f.friendUser.name}
              onPress={() => addMember.mutate({ groupId, userId: f.friendId }, { onSuccess: () => setAddOpen(false) })}
              trailing={<Icon name="add-circle-outline" color={t.colors.primary} />}
            />
          ))
        )}
      </BottomSheet>

      <CurrencyPicker
        visible={currencyOpen}
        onClose={() => setCurrencyOpen(false)}
        value={groupCurrency}
        suggested={[myCurrency, ...(group.totals ?? []).map((x) => x.currency)]}
        title={tr('group.currency')}
        onSelect={(currency) => updateGroup.mutate({ groupId, currency })}
      />
    </Screen>
  );
};

export default GroupDetailScreen;
