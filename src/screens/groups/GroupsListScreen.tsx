/**
 * Groups List Screen
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { GroupsStackParamList } from '../../types/navigation';
import { useGroups } from '../../hooks/useGroups';
import { Group } from '../../types';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';
import { formatCurrency } from '../../utils/currency';
import { formatSmartDate } from '../../utils/date';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import Screen from '../../components/ui/Screen';

type Props = NativeStackScreenProps<GroupsStackParamList, 'GroupsList'>;

const GroupsListScreen: React.FC<Props> = ({ navigation }) => {
  const [search, setSearch] = useState('');
  const { data: groups = [], isLoading, refetch, isRefetching } = useGroups();

  const filtered = groups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase()),
  );

  if (isLoading) {
    return (
      <Screen scrollable>
        <SkeletonCard />
        <SkeletonCard />
      </Screen>
    );
  }

  return (
    <Screen scrollable={false} refreshing={isRefetching} onRefresh={refetch}>
      {/* Search + New */}
      <View style={styles.topRow}>
        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={18} color={Colors.gray400} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search groups..."
            placeholderTextColor={Colors.gray400}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('CreateGroup')}
        >
          <MaterialIcons name="group-add" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {filtered.length === 0 ? (
        <EmptyState
          icon="group"
          title={search ? 'No results' : 'No groups yet'}
          description={search ? 'Try a different name' : 'Create a group to split expenses with multiple people'}
          actionLabel={search ? undefined : 'Create Group'}
          onAction={search ? undefined : () => navigation.navigate('CreateGroup')}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(g) => g.id}
          contentContainerStyle={styles.list}
          scrollEnabled={false}
          renderItem={({ item: group }) => <GroupCard group={group} onPress={() => navigation.navigate('GroupDetail', { groupId: group.id, groupName: group.name })} />}
        />
      )}
    </Screen>
  );
};

const GroupCard: React.FC<{ group: Group; onPress: () => void }> = ({ group, onPress }) => (
  <TouchableOpacity style={styles.card} onPress={onPress}>
    <View style={styles.cardIcon}>
      <MaterialIcons name="group" size={24} color={Colors.primary} />
    </View>
    <View style={styles.cardContent}>
      <Text style={styles.cardTitle}>{group.name}</Text>
      {group.description ? (
        <Text style={styles.cardDesc} numberOfLines={1}>{group.description}</Text>
      ) : null}
      <View style={styles.cardMeta}>
        <MaterialIcons name="people" size={12} color={Colors.textTertiary} />
        <Text style={styles.cardMetaText}>{group.members.length} members</Text>
        {group.updatedAt && (
          <>
            <Text style={styles.cardMetaDot}>·</Text>
            <Text style={styles.cardMetaText}>{formatSmartDate(group.updatedAt)}</Text>
          </>
        )}
      </View>
    </View>
    <View style={styles.cardRight}>
      <Text style={styles.total}>{formatCurrency(group.totalExpenses ?? 0)}</Text>
      <Text style={styles.totalLabel}>total</Text>
    </View>
    <MaterialIcons name="chevron-right" size={20} color={Colors.gray300} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.base,
    paddingBottom: 0,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: Typography.sm, color: Colors.textPrimary },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingTop: Spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
    gap: Spacing.sm,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  cardDesc: { fontSize: Typography.xs, color: Colors.textTertiary, marginTop: 2 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 2 },
  cardMetaText: { fontSize: Typography.xs, color: Colors.textTertiary },
  cardMetaDot: { fontSize: Typography.xs, color: Colors.textTertiary, marginHorizontal: 2 },
  cardRight: { alignItems: 'flex-end' },
  total: { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.textPrimary },
  totalLabel: { fontSize: Typography.xs, color: Colors.textTertiary },
});

export default GroupsListScreen;
