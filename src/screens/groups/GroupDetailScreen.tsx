/**
 * Group Detail Screen â€” expenses list, member list, totals
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
import { GroupsStackParamList, RootStackParamList } from '../../types/navigation';
import { useGroup } from '../../hooks/useGroups';
import { useExpenses } from '../../hooks/useExpenses';
import { useCurrentUser } from '../../hooks/useAuth';
import { useDeleteGroup } from '../../hooks/useGroups';
import { useShowModal, useHideModal } from '../../store/uiStore';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import { formatCurrency } from '../../utils/currency';
import { formatSmartDate } from '../../utils/date';
import { CATEGORY_ICONS, CATEGORY_COLORS } from '../../constants';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import Screen from '../../components/ui/Screen';

type Props = NativeStackScreenProps<GroupsStackParamList, 'GroupDetail'>;

const GroupDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { groupId, groupName } = route.params;
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useCurrentUser();
  const { data: group, isLoading: loadingGroup, refetch } = useGroup(groupId);
  const { data: expenses = [], isLoading: loadingExpenses } = useExpenses(groupId);
  const { mutate: deleteGroup, isPending: deleting } = useDeleteGroup();
  const showModal = useShowModal();
  const hideModal = useHideModal();

  const isLoading = loadingGroup || loadingExpenses;

  const handleDelete = () => {
    showModal({
      title: 'Delete Group',
      body: `Delete "${groupName}"? All expenses will remain but will no longer be linked to this group.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
      onConfirm: () => {
        hideModal();
        deleteGroup(groupId, { onSuccess: () => navigation.goBack() });
      },
      onCancel: hideModal,
    });
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

  return (
    <Screen scrollable refreshing={false} onRefresh={refetch}>
      {/* Header Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryIcon}>
          <MaterialIcons name="group" size={32} color={Colors.primary} />
        </View>
        <Text style={styles.summaryName}>{group?.name ?? groupName}</Text>
        {group?.description ? (
          <Text style={styles.summaryDesc}>{group.description}</Text>
        ) : null}
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatCurrency(group?.totalExpenses ?? 0)}</Text>
            <Text style={styles.statLabel}>Total expenses</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{group?.members.length ?? 0}</Text>
            <Text style={styles.statLabel}>Members</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{expenses.length}</Text>
            <Text style={styles.statLabel}>Expenses</Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Button
          title="Add Expense"
          variant="primary"
          size="sm"
          leftIcon={<MaterialIcons name="add" size={16} color={Colors.white} />}
          onPress={() => rootNav.navigate('ExpenseFlow', { screen: 'AddExpense' } as never)}
        />
        <Button
          title="View Balances"
          variant="outline"
          size="sm"
          leftIcon={<MaterialIcons name="account-balance" size={16} color={Colors.primary} />}
          onPress={() => navigation.navigate('GroupBalances', { groupId, groupName })}
        />
      </View>

      {/* Members */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Members</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.membersRow}>
          {group?.members.map((member) => (
            <View key={member.userId} style={styles.memberChip}>
              <Avatar name={member.user.name} size="sm" />
              <Text style={styles.memberName} numberOfLines={1}>
                {member.userId === user?.id ? 'You' : member.user.name.split(' ')[0]}
              </Text>
              {member.role === 'admin' && (
                <MaterialIcons name="star" size={10} color={Colors.warning} />
              )}
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Expenses */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Expenses ({expenses.length})</Text>
        {expenses.length === 0 ? (
          <EmptyState
            icon="receipt"
            title="No expenses yet"
            description="Add your first expense for this group"
            actionLabel="Add Expense"
            onAction={() => rootNav.navigate('ExpenseFlow', { screen: 'AddExpense' } as never)}
          />
        ) : (
          expenses.map((expense) => {
            const iconName = (CATEGORY_ICONS[expense.category] ?? 'receipt') as keyof typeof MaterialIcons.glyphMap;
            const iconColor = CATEGORY_COLORS[expense.category] ?? Colors.primary;
            const myShare = expense.splits.find((s) => s.userId === user?.id);
const paid = myShare?.paid;

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
                <View style={[styles.catIcon, { backgroundColor: iconColor + '20' }]}>
                  <MaterialIcons name={iconName} size={18} color={iconColor} />
                </View>
                <View style={styles.expenseInfo}>
                  <Text style={styles.expenseTitle} numberOfLines={1}>{expense.title}</Text>
                  <Text style={styles.expenseMeta}>
                    {formatSmartDate(expense.date)} Â· {expense.paidByUser.name}
                  </Text>
                </View>
                <View style={styles.expenseRight}>
                  <Text style={styles.expenseTotal}>{formatCurrency(expense.amount)}</Text>
                  {myShare && (
                    <Badge
                      label={paid ? 'Paid' : `my: ${formatCurrency(myShare.amount)}`}
                      variant={paid ? 'success' : 'warning'}
                    />
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* Danger Zone */}
      <View style={styles.dangerZone}>
        <Button
          title="Delete Group"
          variant="danger"
          size="sm"
          loading={deleting}
          onPress={handleDelete}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  summary: {
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  summaryIcon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  summaryName: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  summaryDesc: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'center' },
  statRow: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
    width: '100%',
    justifyContent: 'center',
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  statLabel: { fontSize: Typography.xs, color: Colors.textTertiary, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: Spacing.xs },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.base,
    paddingBottom: 0,
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
  membersRow: { flexDirection: 'row', gap: Spacing.sm, paddingBottom: Spacing.xs },
  memberChip: { alignItems: 'center', gap: Spacing.xs, width: 56 },
  memberName: { fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'center' },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  catIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseInfo: { flex: 1 },
  expenseTitle: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  expenseMeta: { fontSize: Typography.xs, color: Colors.textTertiary, marginTop: 2 },
  expenseRight: { alignItems: 'flex-end', gap: 2 },
  expenseTotal: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  dangerZone: { padding: Spacing.xl, alignItems: 'center' },
});

export default GroupDetailScreen;

