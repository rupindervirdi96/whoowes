/**
 * Friends List Screen
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
import { FriendsStackParamList } from '../../types/navigation';
import { useFriends, usePendingFriendRequests, useAcceptFriendRequest } from '../../hooks/useFriends';
import { useBalances } from '../../hooks/useBalances';
import { useCurrentUser } from '../../hooks/useAuth';
import { Friend } from '../../types';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';
import { formatCurrency } from '../../utils/currency';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import Screen from '../../components/ui/Screen';

type Props = NativeStackScreenProps<FriendsStackParamList, 'FriendsList'>;

const FriendsListScreen: React.FC<Props> = ({ navigation }) => {
  const [search, setSearch] = useState('');
  const { data: friends = [], isLoading, refetch, isRefetching } = useFriends();
  const { data: pending = [] } = usePendingFriendRequests();
  const { mutate: accept, isPending: accepting } = useAcceptFriendRequest();
  const user = useCurrentUser();
  const { data: balanceSummary } = useBalances();

  const filtered = friends.filter(
    (f) =>
      f.friendUser.name.toLowerCase().includes(search.toLowerCase()) ||
      f.friendUser.email.toLowerCase().includes(search.toLowerCase()),
  );

  const getBalance = (friendId: string): number => {
    if (!balanceSummary) return 0;
    const b = balanceSummary.balances.find((b) => b.userId === friendId);
    return b?.netBalance ?? 0;
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
    <Screen
      scrollable={false}
      refreshing={isRefetching}
      onRefresh={refetch}
    >
      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={18} color={Colors.gray400} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search friends..."
            placeholderTextColor={Colors.gray400}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <MaterialIcons name="close" size={16} color={Colors.gray400} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddFriend')}
        >
          <MaterialIcons name="person-add" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Pending Requests */}
      {pending.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Pending Requests ({pending.length})
          </Text>
          {pending.map((req) => (
            <View key={req.id} style={styles.pendingItem}>
              <Avatar name={req.friendUser.name} size="sm" />
              <View style={styles.pendingInfo}>
                <Text style={styles.pendingName}>{req.friendUser.name}</Text>
                <Text style={styles.pendingEmail}>{req.friendUser.email}</Text>
              </View>
              <Button
                title="Accept"
                size="sm"
                variant="primary"
                loading={accepting}
                onPress={() => accept(req.id)}
              />
            </View>
          ))}
        </View>
      )}

      {/* Friends List */}
      <View style={styles.section}>
        {friends.length > 0 && (
          <Text style={styles.sectionTitle}>Friends ({filtered.length})</Text>
        )}
        {filtered.length === 0 && !isLoading ? (
          <EmptyState
            icon="people"
            title={search ? 'No results' : 'No friends yet'}
            description={search ? 'Try a different search term' : 'Add friends to start splitting expenses'}
            actionLabel={search ? undefined : 'Add Friend'}
            onAction={search ? undefined : () => navigation.navigate('AddFriend')}
          />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => {
              const balance = getBalance(item.friendId);
              return (
                <TouchableOpacity
                  style={styles.friendRow}
                  onPress={() =>
                    navigation.navigate('FriendDetail', {
                      friendId: item.friendId,
                      friendName: item.friendUser.name,
                    })
                  }
                >
                  <Avatar name={item.friendUser.name} uri={item.friendUser.avatarUrl} size="md" />
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{item.friendUser.name}</Text>
                    <Text style={styles.friendEmail}>{item.friendUser.email}</Text>
                  </View>
                  <View style={styles.balanceCol}>
                    {balance !== 0 ? (
                      <>
                        <Text
                          style={[
                            styles.balanceText,
                            { color: balance > 0 ? Colors.success : Colors.danger },
                          ]}
                        >
                          {balance > 0
                            ? `+${formatCurrency(balance)}`
                            : `-${formatCurrency(Math.abs(balance))}`}
                        </Text>
                        <Text style={styles.balanceLabel}>
                          {balance > 0 ? 'owes you' : 'you owe'}
                        </Text>
                      </>
                    ) : (
                      <Badge variant="success" label="Settled" />
                    )}
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={Colors.gray300} />
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  searchRow: {
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
  searchInput: {
    flex: 1,
    fontSize: Typography.sm,
    color: Colors.textPrimary,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { marginTop: Spacing.base },
  sectionTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pendingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.warning + '0D',
  },
  pendingInfo: { flex: 1 },
  pendingName: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  pendingEmail: { fontSize: Typography.xs, color: Colors.textTertiary },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
    backgroundColor: Colors.background,
  },
  friendInfo: { flex: 1 },
  friendName: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  friendEmail: { fontSize: Typography.xs, color: Colors.textTertiary, marginTop: 1 },
  balanceCol: { alignItems: 'flex-end', minWidth: 70 },
  balanceText: { fontSize: Typography.sm, fontWeight: Typography.semibold },
  balanceLabel: { fontSize: Typography.xs, color: Colors.textTertiary },
});

export default FriendsListScreen;

