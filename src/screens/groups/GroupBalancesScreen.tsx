/**
 * Group Balances Screen â€” simplified debts within a group
 */

import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { GroupsStackParamList } from '../../types/navigation';
import { useBalances } from '../../hooks/useBalances';
import { useGroup } from '../../hooks/useGroups';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';
import { formatCurrency } from '../../utils/currency';
import { DebtSimplification } from '../../types';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import Screen from '../../components/ui/Screen';

type Props = NativeStackScreenProps<GroupsStackParamList, 'GroupBalances'>;

const GroupBalancesScreen: React.FC<Props> = ({ route }) => {
  const { groupId, groupName } = route.params;
  const { data: group } = useGroup(groupId);
  const { data: balanceSummary, isLoading, refetch, isRefetching } = useBalances();

  if (isLoading) {
    return (
      <Screen scrollable>
        <SkeletonCard />
        <SkeletonCard />
      </Screen>
    );
  }

  const debts = balanceSummary?.simplifiedDebts ?? [];
  const userBalances = balanceSummary?.balances ?? [];

  // filter to group members only
  const memberIds = new Set(group?.members.map((m) => m.userId) ?? []);
  const groupDebts = debts.filter(
    (d) => memberIds.has(d.from) && memberIds.has(d.to),
  );
  const groupBalances = userBalances.filter((b) => memberIds.has(b.userId));

  return (
    <Screen scrollable refreshing={isRefetching} onRefresh={refetch} contentStyle={styles.container}>
      {/* Net per member */}
      <Text style={styles.sectionTitle}>Per-Member Balance</Text>
      {groupBalances.length === 0 ? (
        <EmptyState icon="account-balance" title="No balances" description="Add expenses to see balances" />
      ) : (
        groupBalances.map((b) => (
          <View key={b.userId} style={styles.memberRow}>
            <Avatar name={b.user.name} size="md" />
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{b.user.name}</Text>
              <Text style={styles.memberSub}>
                Paid: {formatCurrency(b.owed)} Â· Owed: {formatCurrency(b.owes)}
              </Text>
            </View>
            <Text
              style={[
                styles.net,
                { color: b.netBalance >= 0 ? Colors.success : Colors.danger },
              ]}
            >
              {b.netBalance >= 0 ? '+' : ''}{formatCurrency(b.netBalance)}
            </Text>
          </View>
        ))
      )}

      {/* Simplified Debts */}
      <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>
        Suggested Settlements
      </Text>
      <Text style={styles.hint}>
        Minimum number of payments to settle all debts in this group.
      </Text>
      {groupDebts.length === 0 ? (
        <EmptyState
          icon="check-circle"
          title="All settled!"
          description="No outstanding debts in this group"
        />
      ) : (
        groupDebts.map((debt, i) => (
          <View key={i} style={styles.debtCard}>
            <Avatar name={debt.fromUser.name} size="sm" />
            <View style={styles.debtArrow}>
              <Text style={styles.debtFrom}>{debt.fromUser.name}</Text>
              <View style={styles.arrowRow}>
                <View style={styles.arrowLine} />
                <MaterialIcons name="arrow-forward" size={16} color={Colors.danger} />
                <Text style={styles.debtAmount}>{formatCurrency(debt.amount)}</Text>
              </View>
              <Text style={styles.debtTo}>â†’ {debt.toUser.name}</Text>
            </View>
            <Avatar name={debt.toUser.name} size="sm" />
          </View>
        ))
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: { padding: Spacing.base },
  sectionTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  hint: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    marginBottom: Spacing.sm,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  memberInfo: { flex: 1 },
  memberName: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  memberSub: { fontSize: Typography.xs, color: Colors.textTertiary, marginTop: 2 },
  net: { fontSize: Typography.base, fontWeight: Typography.bold },
  debtCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  debtArrow: { flex: 1, alignItems: 'center' },
  debtFrom: { fontSize: Typography.xs, color: Colors.textSecondary },
  arrowRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  arrowLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  debtAmount: { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.danger },
  debtTo: { fontSize: Typography.xs, color: Colors.textSecondary },
});

export default GroupBalancesScreen;

