/**
 * Add Friend Screen â€” search users and send friend requests
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { FriendsStackParamList } from '../../types/navigation';
import { useAddFriend, useSearchUsers } from '../../hooks/useFriends';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import EmptyState from '../../components/ui/EmptyState';
import Screen from '../../components/ui/Screen';

type Props = NativeStackScreenProps<FriendsStackParamList, 'AddFriend'>;

const AddFriendScreen: React.FC<Props> = ({ navigation }) => {
  const [query, setQuery] = useState('');
  const [sentEmails, setSentIds] = useState<Set<string>>(new Set());

  const { data: results = [], isLoading: searching } = useSearchUsers(query);
  const { mutate: addFriend, isPending: adding } = useAddFriend();

  const handleAdd = (userEmail: string) => {
    addFriend({ emailOrPhone: userEmail }, {
      onSuccess: () => setSentIds((prev) => new Set(prev).add(userEmail)),
    });
  };

  return (
    <Screen scrollable={false}>
      <View style={styles.container}>
        <Text style={styles.hint}>
          Search by name, email, or phone number to find friends.
        </Text>

        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search users..."
          autoFocus
          leftIcon={<MaterialIcons name="search" size={18} color={Colors.gray400} />}
          rightIcon={
            query.length > 0 ? (
              <TouchableOpacity onPress={() => setQuery('')}>
                <MaterialIcons name="close" size={16} color={Colors.gray400} />
              </TouchableOpacity>
            ) : undefined
          }
        />

        {query.length < 2 ? (
          <EmptyState
            icon="person-search"
            title="Find friends"
            description="Enter at least 2 characters to search"
          />
        ) : results.length === 0 && !searching ? (
          <EmptyState
            icon="search-off"
            title="No users found"
            description={`No one matches "${query}"`}
          />
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            style={styles.list}
            renderItem={({ item }) => {
              const sent = sentEmails.has(item.email);
              return (
                <View style={styles.resultRow}>
                  <Avatar name={item.name} uri={item.avatarUrl} size="md" />
                  <View style={styles.info}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.email}>{item.email}</Text>
                  </View>
                  <Button
                    title={sent ? 'Sent' : 'Add'}
                    size="sm"
                    variant={sent ? 'secondary' : 'primary'}
                    disabled={sent}
                    loading={adding}
                    onPress={() => handleAdd(item.email)}
                  />
                </View>
              );
            }}
          />
        )}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: { padding: Spacing.base, flex: 1 },
  hint: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.base,
    lineHeight: 20,
  },
  list: { marginTop: Spacing.sm },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  info: { flex: 1 },
  name: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  email: { fontSize: Typography.xs, color: Colors.textTertiary, marginTop: 1 },
});

export default AddFriendScreen;

