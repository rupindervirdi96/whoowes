import React, { useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useGroups } from '../../hooks/useGroups';
import { useExpenses } from '../../hooks/useExpenses';
import { useSettlements } from '../../hooks/useSettlements';
import { useCurrentUser } from '../../hooks/useAuth';
import { computeNetPositions } from '../../utils/balanceEngine';
import { formatCurrency } from '../../utils/currency';
import { formatSmartDate } from '../../utils/date';
import Screen from '../../components/ui/Screen';
import TabHeader from '../../components/ui/TabHeader';
import IconButton from '../../components/ui/IconButton';
import { ListCard } from '../../components/ui/Card';
import ListRow, { RowAmount } from '../../components/ui/ListRow';
import Text from '../../components/ui/Text';
import { SkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import GroupTile from '../../components/GroupTile';

const GroupsScreen: React.FC = () => {
  const navigation = useNavigation();
  const me = useCurrentUser()!;
  const groupsQ = useGroups();
  const { data: expenses = [] } = useExpenses();
  const { data: settlements = [] } = useSettlements();

  // My net position inside each group.
  const myNetByGroup = useMemo(() => {
    const map: Record<string, number> = {};
    for (const g of groupsQ.data ?? []) {
      const net = computeNetPositions(
        expenses.filter((e) => e.groupId === g.id),
        settlements.filter((s) => s.groupId === g.id),
      );
      map[g.id] = net[me.id] ?? 0;
    }
    return map;
  }, [groupsQ.data, expenses, settlements, me.id]);

  return (
    <Screen edges={['top']} refreshing={groupsQ.isRefetching} onRefresh={groupsQ.refetch}>
      <TabHeader
        title="Groups"
        right={<IconButton icon="group-add" variant="soft" accessibilityLabel="New group" onPress={() => navigation.navigate('CreateGroup')} />}
      />

      {groupsQ.isLoading ? (
        <SkeletonList />
      ) : (groupsQ.data ?? []).length === 0 ? (
        <EmptyState
          emoji="🏕️"
          title="No groups yet"
          body="Make one for your flat, your next trip or your Friday dinner crew."
          actionLabel="Create a group"
          onAction={() => navigation.navigate('CreateGroup')}
        />
      ) : (
        <ListCard>
          {groupsQ.data!.map((g, i, arr) => {
            const net = myNetByGroup[g.id] ?? 0;
            const settled = Math.abs(net) < 0.01;
            return (
              <ListRow
                key={g.id}
                leading={<GroupTile name={g.name} size={40} />}
                title={g.name}
                subtitle={`${g.members.length} people · ${formatSmartDate(g.updatedAt)}`}
                divider={i < arr.length - 1}
                accessibilityLabel={g.name}
                onPress={() => navigation.navigate('GroupDetail', { groupId: g.id })}
                trailing={
                  settled ? (
                    <Text variant="caption" tone="tertiary">
                      Settled up
                    </Text>
                  ) : (
                    <RowAmount
                      amount={formatCurrency(Math.abs(net))}
                      caption={net > 0 ? 'you’re owed' : 'you owe'}
                      tone={net > 0 ? 'positive' : 'negative'}
                    />
                  )
                }
              />
            );
          })}
        </ListCard>
      )}
    </Screen>
  );
};

export default GroupsScreen;
