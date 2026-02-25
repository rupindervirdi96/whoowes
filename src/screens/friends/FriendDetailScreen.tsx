/**
 * Friend Detail Screen â€” shared expenses, balance summary, settle up
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { FriendsStackParamList, RootStackParamList } from '../../types/navigation';
import { useExpenses } from '../../hooks/useExpenses';
import { useBalances } from '../../hooks/useBalances';
import { useCurrentUser } from '../../hooks/useAuth';
import { useRemoveFriend } from '../../hooks/useFriends';
import { useShowModal, useHideModal } from '../../store/uiStore';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';
import { formatCurrency } from '../../utils/currency';
import { formatSmartDate } from '../../utils/date';
import { CATEGORY_ICONS, CATEGORY_COLORS } from '../../constants';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import Screen from '../../components/ui/Screen';

type Props = NativeStackScreenProps<FriendsStackParamList, 'FriendDetail'>;

const FriendDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { friendId, friendName } = route.params;
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const user = useCurrentUser();
  const { data: expenses = [], isLoading } = useExpenses();
  const { data: balanceSummary } = useBalances();
  const { mutate: removeFriend, isPending: removing } = useRemoveFriend();
  const showModal = useShowModal();
  const hideModal = useHideModal();

  // filter shared expenses
  const shared = expenses.filter((e) =>
    e.splits.some((s) => s.userId === friendId) &&
    e.splits.some((s) => s.userId === user?.id),
  );

  const balance = balanceSummary?.balances.find((b) => b.userId === friendId);
  const net = balance?.netBalance ?? 0;

  const handleRemove = () => {
    showModal({
      title: 'Remove Friend',
      body: `Remove ${friendName} from your friends list?`,
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      variant: 'danger',
      onConfirm: () => {
        hideModal();
        removeFriend(friendId, { onSuccess: () => navigation.goBack() });
      },
      onCancel: hideModal,
    });
  };

  if (isLoading) {
    return (
      <Screen scrollable>
        <SkeletonCard />
        <SkeletonCard />
      </Screen>
    );
  }

  return (
    <Screen scrollable refreshing={false} onRefresh={() => {}}>
      {/* Profile Header */}
      <View style={styles.header}>
        <Avatar name={friendName} size="xl" />
        <Text style={styles.name}>{friendName}</Text>

        {/* Balance summary */}
        {net !== 0 ? (
          <View style={[styles.balancePill, { backgroundColor: net > 0 ? Colors.success + '20' : Colors.danger + '20' }]}>
            <Text style={[styles.balancePillText, { color: net > 0 ? Colors.success : Colors.danger }]}>
              {net > 0
                ? `${friendName} owes you ${formatCurrency(net)}`
                : `You owe ${friendName} ${formatCurrency(Math.abs(net))}`}
            </Text>
          </View>
        ) : (
          <View style={[styles.balancePill, { backgroundColor: Colors.success + '20' }]}>
            <Text style={[styles.balancePillText, { color: Colors.success }]}>All settled up!</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionRow}>
          <Button
            title="Settle Up"
            variant="primary"
            size="md"
            leftIcon={<MaterialIcons name="swap-horiz" size={16} color={Colors.white} />}
            onPress={() =>
              rootNav.navigate('ExpenseFlow', {
                screen: 'ManualExpense',
              } as never)
            }
          />
          <Button
            title="Add Expense"
            variant="outline"
            size="md"
            leftIcon={<MaterialIcons name="add" size={16} color={Colors.primary} />}
            onPress={() =>
              rootNav.navigate('ExpenseFlow', { screen: 'AddExpense' } as never)
            }
          />
        </View>
      </View>

      {/* Shared Expenses */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Shared Expenses ({shared.length})</Text>
        {shared.length === 0 ? (
          <EmptyState
            icon="receipt"
            title="No shared expenses"
            description="Add an expense including this friend"
          />
        ) : (
          shared.map((expense) => {
            const iconName = (CATEGORY_ICONS[expense.category] ?? 'receipt') as keyof typeof MaterialIcons.glyphMap;
            const iconColor = CATEGORY_COLORS[expense.category] ?? Colors.primary;
            const myShare = expense.splits.find((s) => s.userId === user?.id);
            const theirShare = expense.splits.find((s) => s.userId === friendId);

            return (
              <TouchableOpacity
                key={expense.id}
                style={styles.expenseRow}
                onPress={() =>
                  rootNav.navigate('ExpenseFlow', {
                    screen: 'ExpenseDetail',
                    params: { expenseId: expense.id },
                  } as never)
                }
              >
                <View style={[styles.expenseIcon, { backgroundColor: iconColor + '20' }]}>
                  <MaterialIcons name={iconName} size={18} color={iconColor} />
                </View>
                <View style={styles.expenseInfo}>
                  <Text style={styles.expenseTitle}>{expense.title}</Text>
                  <Text style={styles.expenseMeta}>{formatSmartDate(expense.date)}</Text>
                </View>
                <View style={styles.expenseAmounts}>
                  <Text style={styles.expenseTotal}>{formatCurrency(expense.amount)}</Text>
                  <Text style={styles.expenseShare}>
                    {theirShare ? `their: ${formatCurrency(theirShare.amount)}` : ''}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={18} color={Colors.gray300} />
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* Danger Zone */}
      <View style={styles.dangerZone}>
        <Button
          title="Remove Friend"
          variant="danger"
          size="sm"
          loading={removing}
          onPress={handleRemove}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    padding: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  name: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  balancePill: {
    borderRadius: 24,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
  },
  balancePillText: { fontSize: Typography.sm, fontWeight: Typography.medium },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  section: { padding: Spacing.base },
  sectionTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  expenseIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseInfo: { flex: 1 },
  expenseTitle: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  expenseMeta: { fontSize: Typography.xs, color: Colors.textTertiary },
  expenseAmounts: { alignItems: 'flex-end' },
  expenseTotal: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  expenseShare: { fontSize: Typography.xs, color: Colors.textTertiary },
  dangerZone: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
});

export default FriendDetailScreen;

