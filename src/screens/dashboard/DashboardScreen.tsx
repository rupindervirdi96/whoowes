/**
 * Dashboard Screen â€” overview of balances, recent expenses, quick actions
 */

import React, { useState, useMemo } from 'react';
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
import { Image } from 'react-native';
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
import Skeleton, { SkeletonCard } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import Screen from '../../components/ui/Screen';
import NotificationPanel, { NotificationItem } from '../../components/ui/NotificationPanel';

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

  const [notifVisible, setNotifVisible] = useState(false);

  const notifications = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];
    if (pending && user) {
      for (const s of pending) {
        items.push({ kind: 'pending_settlement', settlement: s, currentUserId: user.id });
      }
    }
    return items;
  }, [pending, user]);

  const notifCount = notifications.length;

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
    <View style={styles.wrapper}>
      <Screen
        scrollable
        refreshing={isRefetching}
        onRefresh={refetch}
        contentStyle={styles.content}
      >
      {/* Header: Logo + Notifications Bell */}
      <View style={styles.headerRow}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../../assets/LogoWhoOwes.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>
            <Text style={styles.logoTextWho}>Who</Text>
            <Text style={styles.logoTextOwes}>Owes</Text>
          </Text>
        </View>
        <TouchableOpacity
          style={styles.bellButton}
          onPress={() => setNotifVisible(true)}
          activeOpacity={0.75}
        >
          <MaterialIcons
            name={notifCount > 0 ? 'notifications-active' : 'notifications-none'}
            size={28}
            color={notifCount > 0 ? Colors.primary : Colors.textSecondary}
          />
          {notifCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>
                {notifCount > 9 ? '9+' : notifCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Hero Balance Card */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Net balance</Text>
        <Text style={[styles.heroAmount, { color: netBalance >= 0 ? Colors.success : Colors.danger }]}>
          {netBalance >= 0 ? '+' : ''}{formatCurrency(netBalance)}
        </Text>
        <View style={styles.heroDivider} />
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <View style={styles.heroStatIcon}>
              <MaterialIcons name="arrow-downward" size={14} color={Colors.success} />
            </View>
            <Text style={styles.heroStatValue}>{formatCurrency(totalOwed)}</Text>
            <Text style={styles.heroStatLabel}>owed to you</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <View style={[styles.heroStatIcon, { backgroundColor: Colors.danger + '18' }]}>
              <MaterialIcons name="arrow-upward" size={14} color={Colors.danger} />
            </View>
            <Text style={styles.heroStatValue}>{formatCurrency(totalOwes)}</Text>
            <Text style={styles.heroStatLabel}>you owe</Text>
          </View>
        </View>
      </View>

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
      </Screen>

      {/* FAB — fixed to bottom-right corner */}
      <TouchableOpacity
        style={[styles.fab, { bottom: Spacing.xl }]}
        onPress={openAddExpense}
        activeOpacity={0.85}
      >
        <MaterialIcons name="add" size={28} color={Colors.white} />
      </TouchableOpacity>

      {/* Notification Panel */}
      <NotificationPanel
        visible={notifVisible}
        onClose={() => setNotifVisible(false)}
        notifications={notifications}
        onPressSettlement={(id) =>
          navigation.navigate('Main', {
            screen: 'Settlements',
            params: { screen: 'SettlementDetail', params: { settlementId: id } },
          } as any)
        }
      />
    </View>
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
  wrapper: {
    flex: 1,
  },
  content: { padding: Spacing.base },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.base,
    paddingVertical: Spacing.xs,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  logoImage: {
    width: 64,
    height: 64,
  },
  logoText: {
    fontSize: 28,
    fontWeight: Typography.extrabold,
    letterSpacing: -0.8,
    includeFontPadding: false,
  },
  logoTextWho: {
    color: Colors.primary,
  },
  logoTextOwes: {
    color: Colors.textPrimary,
  },
  heroCard: {
    backgroundColor: '#F4FEFC',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.base,
    alignItems: 'center',
    ...Shadows.base,
  },
  heroLabel: {
    fontSize: Typography.sm,
    color: Colors.textTertiary,
    fontWeight: Typography.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  heroAmount: {
    fontSize: Typography['4xl'],
    fontWeight: Typography.extrabold,
    letterSpacing: -1,
    marginBottom: Spacing.base,
  },
  heroDivider: {
    height: 1,
    width: '100%',
    backgroundColor: Colors.border,
    marginBottom: Spacing.base,
  },
  heroStats: {
    flexDirection: 'row',
    width: '100%',
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  heroStatIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.success + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  heroStatValue: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  heroStatLabel: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
  },
  heroStatDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.sm,
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: Colors.danger,
    borderRadius: 7,
    minWidth: 14,
    height: 14,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#F4FEFC',
  },
  bellBadgeText: {
    fontSize: 8,
    fontWeight: Typography.bold,
    color: Colors.white,
    lineHeight: 11,
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

