import React, { useLayoutEffect, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { RootScreenProps } from '../../types/navigation';
import { useGroup, useDeleteGroup, useAddGroupMember } from '../../hooks/useGroups';
import { useExpenses } from '../../hooks/useExpenses';
import { useFriends, useRemind } from '../../hooks/useFriends';
import { useGroupBalances } from '../../hooks/useBalances';
import { useCurrentUser } from '../../hooks/useAuth';
import { useShowModal, useUIStore } from '../../store/uiStore';
import { formatCurrency } from '../../utils/currency';
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
import ListRow, { RowAmount, SectionHeader } from '../../components/ui/ListRow';
import { SkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import BottomSheet from '../../components/ui/BottomSheet';
import ExpenseRow from '../../components/ExpenseRow';
import GroupTile from '../../components/GroupTile';
import { formatPhone } from '../../utils/phone';

type Tab = 'expenses' | 'balances' | 'members';

const GroupDetailScreen: React.FC<RootScreenProps<'GroupDetail'>> = ({ route, navigation }) => {
  const { groupId } = route.params;
  const t = useTheme();
  const me = useCurrentUser()!;
  const [tab, setTab] = useState<Tab>('expenses');
  const [addOpen, setAddOpen] = useState(false);
  const groupQ = useGroup(groupId);
  const expensesQ = useExpenses(groupId);
  const balances = useGroupBalances(groupId);
  const { data: friends = [] } = useFriends();
  const deleteGroup = useDeleteGroup();
  const addMember = useAddGroupMember();
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
          accessibilityLabel="Delete group"
          onPress={() =>
            showModal({
              title: 'Delete this group?',
              body: 'Expenses stay in everyone’s history but won’t be grouped anymore.',
              confirmLabel: 'Delete',
              variant: 'danger',
              onConfirm: () => deleteGroup.mutate(groupId, { onSuccess: () => navigation.goBack() }),
            })
          }
        />
      ),
    });
  }, [navigation, group?.name, groupId, deleteGroup, showModal]);

  if (groupQ.isLoading || !group) {
    return (
      <Screen>
        <SkeletonList rows={5} />
      </Screen>
    );
  }

  const myNet = balances?.memberNets.find((m) => m.user.id === me.id)?.net ?? 0;
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
              {group.description || `${group.members.length} people`}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', marginTop: t.spacing.lg }}>
          <View style={{ flex: 1 }}>
            <Text variant="caption" tone="tertiary">
              Group spend
            </Text>
            <Text variant="h3" tabular style={{ marginTop: 2 }}>
              {formatCurrency(group.totalExpenses)}
            </Text>
          </View>
          <View style={{ width: 1, backgroundColor: t.colors.border, marginHorizontal: t.spacing.base }} />
          <View style={{ flex: 1 }}>
            <Text variant="caption" tone="tertiary">
              {Math.abs(myNet) < 0.01 ? 'You' : myNet > 0 ? 'You’re owed' : 'You owe'}
            </Text>
            <Text variant="h3" tone={Math.abs(myNet) < 0.01 ? 'default' : myNet > 0 ? 'positive' : 'negative'} tabular style={{ marginTop: 2 }}>
              {Math.abs(myNet) < 0.01 ? 'Settled up' : formatCurrency(Math.abs(myNet))}
            </Text>
          </View>
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: t.spacing.base }}>
        <Button title="Add expense" icon="add" style={{ flex: 1 }} onPress={() => openAddSheet(groupId)} />
        <Button title="Settle up" icon="swap-horiz" variant="secondary" style={{ flex: 1 }} onPress={() => setTab('balances')} />
      </View>

      <SegmentedControl
        style={{ marginTop: t.spacing.xl }}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'expenses', label: 'Expenses' },
          { value: 'balances', label: 'Balances' },
          { value: 'members', label: `Members · ${group.members.length}` },
        ]}
      />

      {tab === 'expenses' ? (
        expensesQ.isLoading ? (
          <SkeletonList />
        ) : (expensesQ.data ?? []).length === 0 ? (
          <EmptyState emoji="🧾" title="No expenses yet" body="Add the first one — everyone in the group will see it." />
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
          <SectionHeader title="Suggested payments" />
          <Text variant="caption" tone="tertiary" style={{ marginTop: -6, marginBottom: t.spacing.md }}>
            The fewest payments that get everyone back to zero.
          </Text>
          {balances.debts.length === 0 ? (
            <Card variant="alt">
              <Text tone="positive" weight="bold">
                🎉 Everyone in {group.name} is settled up.
              </Text>
            </Card>
          ) : (
            <ListCard>
              {balances.debts.map((d, i) => {
                const fromName = d.from === me.id ? 'You' : firstName(d.fromUser.name);
                const toName = d.to === me.id ? 'you' : firstName(d.toUser.name);
                return (
                  <ListRow
                    key={`${d.from}-${d.to}-${i}`}
                    leading={<Avatar name={d.fromUser.name} />}
                    title={`${fromName} → ${toName}`}
                    subtitle={formatCurrency(d.amount)}
                    divider={i < balances.debts.length - 1}
                    trailing={
                      d.from === me.id ? (
                        <Button title="Pay" size="sm" onPress={() => navigation.navigate('SettleUp', { userId: d.to, amount: d.amount, groupId })} />
                      ) : d.to === me.id ? (
                        <Button
                          title="Remind"
                          size="sm"
                          variant="secondary"
                          loading={remind.isPending && remind.variables?.userId === d.from}
                          onPress={() => remind.mutate({ userId: d.from, name: d.fromUser.name, amount: d.amount })}
                        />
                      ) : undefined
                    }
                  />
                );
              })}
            </ListCard>
          )}

          <SectionHeader title="Everyone’s position" />
          <ListCard>
            {balances.memberNets.map((m, i) => (
              <ListRow
                key={m.user.id}
                divider={i < balances.memberNets.length - 1}
                leading={<Avatar name={m.user.name} />}
                title={m.user.id === me.id ? 'You' : m.user.name}
                subtitle={Math.abs(m.net) < 0.01 ? 'Settled up' : m.user.id === me.id ? (m.net > 0 ? 'you’re owed' : 'you owe') : m.net > 0 ? 'is owed' : 'owes'}
                trailing={
                  Math.abs(m.net) < 0.01 ? undefined : (
                    <RowAmount amount={formatCurrency(Math.abs(m.net))} tone={m.net > 0 ? 'positive' : 'negative'} />
                  )
                }
              />
            ))}
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
                title={m.userId === me.id ? `${m.user.name} (you)` : m.user.name}
                subtitle={m.user.email || (m.user.phone ? formatPhone(m.user.phone) : undefined)}
                trailing={m.role === 'admin' ? <Badge label="Admin" tone="primary" /> : null}
              />
            ))}
          </ListCard>
          <Button title="Add people" icon="person-add-alt" variant="secondary" fullWidth style={{ marginTop: 12 }} onPress={() => setAddOpen(true)} />
        </>
      ) : null}

      <BottomSheet visible={addOpen} onClose={() => setAddOpen(false)} title="Add to group" subtitle="Pick from your friends">
        {addable.length === 0 ? (
          <Text tone="secondary" style={{ paddingVertical: 16 }}>
            All your friends are already in this group.
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
    </Screen>
  );
};

export default GroupDetailScreen;
