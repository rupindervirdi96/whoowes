/**
 * Dashboard Screen â€” overview of balances, recent expenses, quick actions
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { useDashboardSummary, useBalances } from '../../hooks/useBalances';
import { useCurrentUser } from '../../hooks/useAuth';
import { usePendingSettlements } from '../../hooks/useSettlements';
import { MainTabParamList, RootStackParamList } from '../../types/navigation';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import { formatCurrency } from '../../utils/currency';
import { formatSmartDate } from '../../utils/date';
import { CATEGORY_ICONS, CATEGORY_COLORS } from '../../constants';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import Skeleton, { SkeletonCard } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import Screen from '../../components/ui/Screen';

type DashboardNav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Dashboard'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<DashboardNav>();
  const user = useCurrentUser();
  const {
    data: summary,
    isLoading,
    refetch,
    isRefetching,
  } = useDashboardSummary();
  const { data: balanceSummary } = useBalances();
  const { data: pending } = usePendingSettlements();

  const pendingCount = pending?.length ?? 0;

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const openAddExpense = () => {
    navigation.navigate('ExpenseFlow', { screen: 'AddExpense', params: {} });
  };

  if (isLoading) {
    return (
      <Screen scrollable>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </Screen>
    );
  }

  const { totalOwed, totalOwes, netBalance, recentExpenses } =
    summary ?? {
      totalOwed: 0,
      totalOwes: 0,
      netBalance: 0,
      recentExpenses: [],
    };
  const balances = balanceSummary?.balances ?? [];

  return (
    <Screen
      scrollable
      refreshing={isRefetching}
      onRefresh={refetch}
      contentStyle={styles.content}
    >
      {/* Greeting */}
      <View style={styles.greetingRow}>
        <View style={styles.flex}>
          <Text style={styles.greeting}>{greeting()},</Text>
          <Text style={styles.userName}>{user?.name?.split(' ')[0] ?? 'there'} ðŸ‘‹</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Main', { screen: 'Profile' } as any)}>
          <Avatar
            name={user?.name ?? 'Me'}
            uri={user?.avatarUrl}
            size="md"
          />
        </TouchableOpacity>
      </View>

      {/* Balance Cards */}
      <View style={styles.balanceRow}>
        <View style={[styles.balanceCard, { backgroundColor: Colors.success }]}>
          <MaterialIcons name="arrow-downward" size={20} color={Colors.white} />
          <Text style={styles.balanceLabel}>You are owed</Text>
          <Text style={styles.balanceAmount}>{formatCurrency(totalOwed)}</Text>
        </View>
        <View style={[styles.balanceCard, { backgroundColor: Colors.danger }]}>
          <MaterialIcons name="arrow-upward" size={20} color={Colors.white} />
          <Text style={styles.balanceLabel}>You owe</Text>
          <Text style={styles.balanceAmount}>{formatCurrency(totalOwes)}</Text>
        </View>
      </View>

      {/* Net Balance Banner */}
      <Card style={[styles.netCard, { borderLeftColor: netBalance >= 0 ? Colors.success : Colors.danger }]}>
        <Text style={styles.netLabel}>Net balance</Text>
        <Text
          style={[
            styles.netAmount,
            { color: netBalance >= 0 ? Colors.success : Colors.danger },
          ]}
        >
          {netBalance >= 0 ? '+' : ''}{formatCurrency(netBalance)}
        </Text>
      </Card>

      {/* Pending Settlements Alert */}
      {pendingCount > 0 && (
        <TouchableOpacity
          style={styles.pendingBanner}
          onPress={() =>
            navigation.navigate('Main', { screen: 'Settlements' } as any)
          }
        >
          <MaterialIcons name="hourglass-empty" size={20} color={Colors.warning} />
          <Text style={styles.pendingText}>
            {pendingCount} pending settlement{pendingCount > 1 ? 's' : ''} need your attention
          </Text>
          <MaterialIcons name="chevron-right" size={18} color={Colors.warning} />
        </TouchableOpacity>
      )}

      {/* Quick Actions */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
      </View>
      <View style={styles.quickActions}>
        <QuickAction icon="add-circle" label="Add Expense" onPress={openAddExpense} />
        <QuickAction
          icon="people"
          label="Friends"
          onPress={() => navigation.navigate('Main', { screen: 'Friends' } as any)}
        />
        <QuickAction
          icon="group"
          label="Groups"
          onPress={() => navigation.navigate('Main', { screen: 'Groups' } as any)}
        />
        <QuickAction
          icon="swap-horiz"
          label="Settle Up"
          onPress={() => navigation.navigate('Main', { screen: 'Settlements' } as any)}
        />
      </View>

      {/* Recent Expenses */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Expenses</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Main', { screen: 'Groups' } as any)}
        >
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>

      {recentExpenses.length === 0 ? (
        <EmptyState
          icon="receipt"
          title="No expenses yet"
          description="Add your first shared expense to get started"
          actionLabel="Add Expense"
          onAction={openAddExpense}
        />
      ) : (
        recentExpenses.map((expense) => {
          const iconName = (CATEGORY_ICONS[expense.category] ?? 'receipt') as keyof typeof MaterialIcons.glyphMap;
          const iconColor = CATEGORY_COLORS[expense.category] ?? Colors.primary;
          const myShare = expense.splits.find((s) => s.userId === user?.id);

          return (
            <TouchableOpacity
              key={expense.id}
              style={styles.expenseRow}
              onPress={() =>
                navigation.navigate('ExpenseFlow', {
                  screen: 'ExpenseDetail',
                  params: { expenseId: expense.id },
                })
              }
            >
              <View style={[styles.expenseIcon, { backgroundColor: iconColor + '20' }]}>
                <MaterialIcons name={iconName} size={20} color={iconColor} />
              </View>
              <View style={styles.expenseInfo}>
                <Text style={styles.expenseTitle} numberOfLines={1}>
                  {expense.title}
                </Text>
                <Text style={styles.expenseMeta}>
                  {formatSmartDate(expense.date)} Â· {expense.paidByUser.name}
                </Text>
              </View>
              <View style={styles.expenseAmounts}>
                <Text style={styles.expenseTotal}>{formatCurrency(expense.amount)}</Text>
                {myShare && (
                  <Text
                    style={[
                      styles.myShare,
                      { color: expense.paidBy === user?.id ? Colors.success : Colors.danger },
                    ]}
                  >
                    {expense.paidBy === user?.id ? 'you paid' : `you owe ${formatCurrency(myShare.amount)}`}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })
      )}

      {/* Top Balances */}
      {balances.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Balances Overview</Text>
          </View>
          {balances.slice(0, 5).map((b) => (
            <View key={b.userId} style={styles.balanceLine}>
              <Avatar name={b.user.name} size="sm" />
              <Text style={styles.balancePerson} numberOfLines={1}>
                {b.user.name}
              </Text>
              <Text
                style={[
                  styles.balanceLineAmount,
                  { color: b.netBalance >= 0 ? Colors.success : Colors.danger },
                ]}
              >
                {b.netBalance >= 0
                  ? `owes you ${formatCurrency(b.netBalance)}`
                  : `you owe ${formatCurrency(Math.abs(b.netBalance))}`}
              </Text>
            </View>
          ))}
        </>
      )}

      {/* FAB spacer */}
      <View style={{ height: 80 }} />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openAddExpense}>
        <MaterialIcons name="add" size={28} color={Colors.white} />
      </TouchableOpacity>
    </Screen>
  );
};

interface QuickActionProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
}

const QuickAction: React.FC<QuickActionProps> = ({ icon, label, onPress }) => (
  <TouchableOpacity style={styles.qaButton} onPress={onPress}>
    <View style={styles.qaIcon}>
      <MaterialIcons name={icon} size={22} color={Colors.primary} />
    </View>
    <Text style={styles.qaLabel}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  content: { padding: Spacing.base },
  flex: { flex: 1 },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  greeting: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
  },
  userName: {
    fontSize: Typography['2xl'],
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  balanceRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  balanceCard: {
    flex: 1,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  balanceLabel: {
    fontSize: Typography.xs,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: Typography.medium,
  },
  balanceAmount: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.white,
  },
  netCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    borderLeftWidth: 4,
    paddingLeft: Spacing.md,
  },
  netLabel: { fontSize: Typography.sm, color: Colors.textSecondary },
  netAmount: { fontSize: Typography.lg, fontWeight: Typography.bold },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning + '15',
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.base,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.warning + '40',
  },
  pendingText: {
    flex: 1,
    fontSize: Typography.sm,
    color: Colors.warning,
    fontWeight: Typography.medium,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  seeAll: { fontSize: Typography.sm, color: Colors.primary, fontWeight: Typography.medium },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  qaButton: { flex: 1, alignItems: 'center', gap: Spacing.xs },
  qaIcon: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qaLabel: { fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'center' },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  expenseIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseInfo: { flex: 1 },
  expenseTitle: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  expenseMeta: { fontSize: Typography.xs, color: Colors.textTertiary, marginTop: 2 },
  expenseAmounts: { alignItems: 'flex-end' },
  expenseTotal: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  myShare: { fontSize: Typography.xs, marginTop: 2 },
  balanceLine: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  balancePerson: { flex: 1, fontSize: Typography.sm, color: Colors.textPrimary },
  balanceLineAmount: { fontSize: Typography.sm, fontWeight: Typography.medium },
  fab: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.base,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.lg,
  },
});

export default DashboardScreen;

