import React, { useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useGroups } from '../../hooks/useGroups';
import { useExpenses } from '../../hooks/useExpenses';
import { useSettlements } from '../../hooks/useSettlements';
import { useCurrentUser } from '../../hooks/useAuth';
import { useMyCurrency } from '../../hooks/useCurrency';
import { useT } from '../../i18n';
import { computeNetPositions, netsFor, orderCurrencies } from '../../utils/balanceEngine';
import { formatSmartDate } from '../../utils/date';
import type { CurrencyAmount } from '../../types';
import Screen from '../../components/ui/Screen';
import TabHeader from '../../components/ui/TabHeader';
import IconButton from '../../components/ui/IconButton';
import { ListCard } from '../../components/ui/Card';
import ListRow from '../../components/ui/ListRow';
import Text from '../../components/ui/Text';
import { SkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import GroupTile from '../../components/GroupTile';
import BalanceAmounts, { balanceDirection } from '../../components/BalanceAmounts';

const GroupsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { t: tr } = useT();
  const me = useCurrentUser()!;
  const myCurrency = useMyCurrency();
  const groupsQ = useGroups();
  const { data: expenses = [] } = useExpenses();
  const { data: settlements = [] } = useSettlements();

  // My net position inside each group, per currency (group's currency first).
  const myNetsByGroup = useMemo(() => {
    const map: Record<string, CurrencyAmount[]> = {};
    for (const g of groupsQ.data ?? []) {
      const nets = netsFor(
        computeNetPositions(
          expenses.filter((e) => e.groupId === g.id),
          settlements.filter((s) => s.groupId === g.id),
        ),
        me.id,
      );
      const order = orderCurrencies(nets.map((n) => n.currency), g.currency ?? myCurrency);
      map[g.id] = order.map((c) => nets.find((n) => n.currency === c)!);
    }
    return map;
  }, [groupsQ.data, expenses, settlements, me.id, myCurrency]);

  return (
    <Screen edges={['top']} refreshing={groupsQ.isRefetching} onRefresh={groupsQ.refetch}>
      <TabHeader
        title={tr('tab.groups')}
        right={<IconButton icon="group-add" variant="soft" accessibilityLabel={tr('groups.new')} onPress={() => navigation.navigate('CreateGroup')} />}
      />

      {groupsQ.isLoading ? (
        <SkeletonList />
      ) : (groupsQ.data ?? []).length === 0 ? (
        <EmptyState
          emoji="🏕️"
          title={tr('groups.empty.title')}
          body={tr('groups.empty.body')}
          actionLabel={tr('groups.create')}
          onAction={() => navigation.navigate('CreateGroup')}
        />
      ) : (
        <ListCard>
          {groupsQ.data!.map((g, i, arr) => {
            const nets = myNetsByGroup[g.id] ?? [];
            const direction = balanceDirection(nets);
            return (
              <ListRow
                key={g.id}
                leading={<GroupTile name={g.name} size={40} />}
                title={g.name}
                subtitle={`${tr('common.people', { count: g.members.length })} · ${formatSmartDate(g.updatedAt)}`}
                divider={i < arr.length - 1}
                accessibilityLabel={g.name}
                onPress={() => navigation.navigate('GroupDetail', { groupId: g.id })}
                trailing={
                  direction === 'settled' ? (
                    <Text variant="caption" tone="tertiary">
                      {tr('common.settledUp')}
                    </Text>
                  ) : (
                    <BalanceAmounts
                      amounts={nets}
                      caption={direction === 'owesYou' ? tr('balance.youreOwed') : direction === 'youOwe' ? tr('balance.youOwe') : undefined}
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
