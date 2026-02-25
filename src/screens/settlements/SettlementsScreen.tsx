/**
 * Settlements List Screen â€” all settlements with filter tabs
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { SettlementsStackParamList } from '../../types/navigation';
import { Settlement, SettlementStatus } from '../../types';
import { useSettlements } from '../../hooks/useSettlements';
import { useCurrentUser } from '../../hooks/useAuth';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import Screen from '../../components/ui/Screen';

type Props = NativeStackScreenProps<SettlementsStackParamList, 'SettlementsList'>;

type FilterTab = 'all' | 'pending' | 'confirmed' | 'rejected';

const TABS: Array<{ key: FilterTab; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'rejected', label: 'Rejected' },
];

const SettlementsScreen: React.FC<Props> = ({ navigation }) => {
  const currentUser = useCurrentUser();
  const { data: settlements, isLoading, refetch, isRefetching } = useSettlements();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const filtered = useMemo(() => {
    if (!settlements) return [];
    if (activeTab === 'all') return settlements;
    return settlements.filter((s) => s.status === activeTab);
  }, [settlements, activeTab]);

  const renderItem = ({ item }: { item: Settlement }) => {
    const isInitiator = item.fromUserId === currentUser?.id;
    const other = isInitiator ? item.toUser : item.fromUser;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('SettlementDetail', { settlementId: item.id })}
        activeOpacity={0.7}
      >
        {/* Avatar */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{other.name.charAt(0).toUpperCase()}</Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.row}>
            <Text style={styles.name} numberOfLines={1}>{other.name}</Text>
            <Text style={[styles.amount, isInitiator ? styles.amountOut : styles.amountIn]}>
              {isInitiator ? '-' : '+'}{item.currency} {item.amount.toFixed(2)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.meta}>
              {isInitiator ? 'You sent' : 'You received'} Â· {formatDate(item.initiatedAt)}
            </Text>
            <StatusBadge status={item.status} />
          </View>
          {item.note ? (
            <Text style={styles.note} numberOfLines={1}>{item.note}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Screen scrollable={false}>
      {/* Filter Tabs */}
      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          onRefresh={refetch}
          refreshing={isRefetching}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="compare-arrows" size={48} color={Colors.gray200} />
              <Text style={styles.emptyTitle}>No settlements</Text>
              <Text style={styles.emptyMeta}>
                {activeTab === 'all'
                  ? 'Your settlements will appear here'
                  : `No ${activeTab} settlements`}
              </Text>
            </View>
          }
        />
      )}

      {/* FAB â€” Pending */}
      <TouchableOpacity
        style={styles.pendingFab}
        onPress={() => navigation.navigate('PendingSettlements')}
      >
        <MaterialIcons name="hourglass-empty" size={20} color={Colors.white} />
        <Text style={styles.pendingFabText}>Pending</Text>
      </TouchableOpacity>
    </Screen>
  );
};

const StatusBadge: React.FC<{ status: SettlementStatus }> = ({ status }) => {
  const config: Record<SettlementStatus, { color: string; bg: string; label: string }> = {
    pending: { color: Colors.warning, bg: Colors.warning + '20', label: 'Pending' },
    confirmed: { color: Colors.success, bg: Colors.success + '20', label: 'Confirmed' },
    rejected: { color: Colors.danger, bg: Colors.danger + '20', label: 'Rejected' },
  };
  const c = config[status];
  return (
    <View style={[badgeStyles.badge, { backgroundColor: c.bg }]}>
      <Text style={[badgeStyles.label, { color: c.color }]}>{c.label}</Text>
    </View>
  );
};

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  tab: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
  },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium },
  tabTextActive: { color: Colors.white },
  list: { padding: Spacing.base, paddingBottom: Spacing.xl * 3 },
  separator: { height: Spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.primary,
  },
  content: { flex: 1, gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary, flex: 1 },
  amount: { fontSize: Typography.base, fontWeight: Typography.bold },
  amountOut: { color: Colors.danger },
  amountIn: { color: Colors.success },
  meta: { fontSize: Typography.xs, color: Colors.textTertiary },
  note: { fontSize: Typography.xs, color: Colors.textSecondary, fontStyle: 'italic' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl * 2 },
  emptyTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  emptyMeta: { fontSize: Typography.sm, color: Colors.textSecondary },
  pendingFab: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.base,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    gap: 6,
    ...Shadows.lg,
  },
  pendingFabText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.white },
});

const badgeStyles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  label: { fontSize: 10, fontWeight: Typography.semibold },
});

export default SettlementsScreen;


