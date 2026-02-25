/**
 * Expense Detail Screen
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { ExpensesStackParamList, RootStackParamList } from '../../types/navigation';
import { useExpense, useDeleteExpense, useMarkSplitPaid } from '../../hooks/useExpenses';
import { useCurrentUser } from '../../hooks/useAuth';
import { useShowModal, useHideModal } from '../../store/uiStore';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import { formatCurrency } from '../../utils/currency';
import { formatFullDate } from '../../utils/date';
import { CATEGORY_ICONS, CATEGORY_COLORS } from '../../constants';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { SkeletonCard } from '../../components/ui/Skeleton';
import Screen from '../../components/ui/Screen';

type Props = NativeStackScreenProps<ExpensesStackParamList, 'ExpenseDetail'>;

const ExpenseDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { expenseId } = route.params;
  const user = useCurrentUser();
  const { data: expense, isLoading, refetch } = useExpense(expenseId);
  const { mutate: deleteExpense, isPending: deleting } = useDeleteExpense();
  const { mutate: markPaid, isPending: marking } = useMarkSplitPaid();
  const showModal = useShowModal();
  const hideModal = useHideModal();

  if (isLoading || !expense) {
    return (
      <Screen scrollable>
        <SkeletonCard />
        <SkeletonCard />
      </Screen>
    );
  }

  const iconName = (CATEGORY_ICONS[expense.category] ?? 'receipt') as keyof typeof MaterialIcons.glyphMap;
  const iconColor = CATEGORY_COLORS[expense.category] ?? Colors.primary;
  const myShare = expense.splits.find((s) => s.userId === user?.id);
  const isMyExpense = expense.paidBy === user?.id;

  const handleDelete = () => {
    showModal({
      title: 'Delete Expense',
      body: `Delete "${expense.title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
      onConfirm: () => {
        hideModal();
        deleteExpense(expenseId, { onSuccess: () => navigation.goBack() });
      },
      onCancel: hideModal,
    });
  };

  const handleMarkPaid = () => {
    if (!myShare) return;
    markPaid({ expenseId, userId: user!.id });
  };

  return (
    <Screen scrollable refreshing={false} onRefresh={refetch}>
      {/* Header Card */}
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: iconColor + '20' }]}>
          <MaterialIcons name={iconName} size={32} color={iconColor} />
        </View>
        <Text style={styles.title}>{expense.title}</Text>
        <Text style={styles.amount}>{formatCurrency(expense.amount)}</Text>
        {expense.description ? (
          <Text style={styles.description}>{expense.description}</Text>
        ) : null}
        <Text style={styles.date}>{formatFullDate(expense.date)}</Text>
      </View>

      {/* Status */}
      <View style={styles.statusRow}>
        {myShare && !isMyExpense && (
          <>
            <Badge
              label={myShare.paid ? 'Your share paid' : `You owe ${formatCurrency(myShare.amount)}`}
              variant={myShare.paid ? 'success' : 'danger'}
            />
            {!myShare.paid && (
              <Button
                title="Mark as Paid"
                size="sm"
                variant="primary"
                loading={marking}
                onPress={handleMarkPaid}
              />
            )}
          </>
        )}
        {isMyExpense && (
          <Badge label="You paid for this" variant="info" />
        )}
      </View>

      {/* Paid By */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Paid By</Text>
        <View style={styles.paidByRow}>
          <Avatar name={expense.paidByUser.name} size="md" />
          <View>
            <Text style={styles.paidByName}>
              {expense.paidBy === user?.id ? 'You' : expense.paidByUser.name}
            </Text>
            <Text style={styles.paidByAmount}>{formatCurrency(expense.amount)}</Text>
          </View>
        </View>
      </View>

      {/* Splits */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Split ({expense.splits.length} people)</Text>
        {expense.splits.map((split) => (
          <View key={split.userId} style={styles.splitRow}>
            <Avatar name={split.user.name} size="sm" />
            <Text style={styles.splitName}>
              {split.userId === user?.id ? 'You' : split.user.name}
            </Text>
            {split.percentage != null && (
              <Text style={styles.splitPct}>{split.percentage}%</Text>
            )}
            <Text
              style={[
                styles.splitAmount,
                { color: split.paid ? Colors.success : Colors.textPrimary },
              ]}
            >
              {formatCurrency(split.amount)}
            </Text>
            {split.paid ? (
              <MaterialIcons name="check-circle" size={18} color={Colors.success} />
            ) : (
              <MaterialIcons name="radio-button-unchecked" size={18} color={Colors.gray300} />
            )}
          </View>
        ))}
      </View>

      {/* Items (if item-based) */}
      {expense.items && expense.items.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Receipt Items</Text>
          {expense.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemQty}>Ã—{item.quantity}</Text>
              <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Metadata */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        <DetailRow label="Category" value={expense.category.charAt(0).toUpperCase() + expense.category.slice(1)} />
        <DetailRow label="Split Type" value={expense.splitType.replace('_', ' ')} />
        <DetailRow label="Currency" value={expense.currency} />
        {expense.groupId && <DetailRow label="Group" value={`Group #${expense.groupId}`} />}
      </View>

      {/* Delete */}
      {(isMyExpense || expense.createdBy === user?.id) && (
        <View style={styles.dangerZone}>
          <Button
            title="Delete Expense"
            variant="danger"
            size="sm"
            loading={deleting}
            onPress={handleDelete}
          />
        </View>
      )}
    </Screen>
  );
};

const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    padding: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.xs,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  title: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary, textAlign: 'center' },
  amount: { fontSize: Typography['3xl'], fontWeight: Typography.bold, color: Colors.primary },
  description: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'center' },
  date: { fontSize: Typography.xs, color: Colors.textTertiary },
  statusRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
    padding: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    justifyContent: 'center',
  },
  section: { padding: Spacing.base },
  sectionTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  paidByRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  paidByName: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  paidByAmount: { fontSize: Typography.sm, color: Colors.textTertiary },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  splitName: { flex: 1, fontSize: Typography.sm, color: Colors.textPrimary },
  splitPct: { fontSize: Typography.xs, color: Colors.textTertiary, width: 36 },
  splitAmount: { fontSize: Typography.sm, fontWeight: Typography.semibold, width: 70, textAlign: 'right' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemName: { flex: 1, fontSize: Typography.sm, color: Colors.textPrimary },
  itemQty: { fontSize: Typography.xs, color: Colors.textTertiary, marginRight: Spacing.sm },
  itemPrice: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailLabel: { fontSize: Typography.sm, color: Colors.textSecondary },
  detailValue: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  dangerZone: { padding: Spacing.xl, alignItems: 'center' },
});

export default ExpenseDetailScreen;

