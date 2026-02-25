/**
 * Create Group Screen
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { GroupsStackParamList } from '../../types/navigation';
import { useCreateGroup } from '../../hooks/useGroups';
import { useFriends } from '../../hooks/useFriends';
import { useCurrentUser } from '../../hooks/useAuth';
import { createGroupSchema } from '../../utils/validation';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Avatar from '../../components/ui/Avatar';
import Screen from '../../components/ui/Screen';

type Props = NativeStackScreenProps<GroupsStackParamList, 'CreateGroup'>;

const CreateGroupScreen: React.FC<Props> = ({ navigation }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({});

  const { data: friends = [] } = useFriends();
  const user = useCurrentUser();
  const { mutate: createGroup, isPending } = useCreateGroup();

  const toggleFriend = (friendId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(friendId) ? next.delete(friendId) : next.add(friendId);
      return next;
    });
  };

  const handleSubmit = () => {
    const result = createGroupSchema.safeParse({ name, description: description || undefined });
    if (!result.success) {
      const errs: typeof errors = {};
      result.error.issues.forEach((i) => {
        const f = i.path[0] as keyof typeof errors;
        if (!errs[f]) errs[f] = i.message;
      });
      setErrors(errs);
      return;
    }

    // build member list: current user + selected friends
    const memberIds = [user!.id, ...Array.from(selectedIds)];

    createGroup(
      { name: result.data.name, description: result.data.description, memberIds },
      { onSuccess: () => navigation.goBack() },
    );
  };

  return (
    <Screen scrollable>
      <View style={styles.container}>
        <Input
          label="Group Name"
          value={name}
          onChangeText={(v) => { setName(v); if (errors.name) setErrors((p) => ({ ...p, name: undefined })); }}
          placeholder="e.g. Apartment 4B, Road Trip"
          error={errors.name}
          required
          leftIcon={<MaterialIcons name="group" size={18} color={Colors.gray400} />}
        />

        <Input
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="What's this group for?"
          multiline
          numberOfLines={3}
        />

        {/* Member Selector */}
        <Text style={styles.memberLabel}>Add Friends</Text>
        <Text style={styles.memberHint}>
          You'll be added automatically. Select friends to include.
        </Text>

        {/* Current user chip */}
        <View style={styles.memberRow}>
          <Avatar name={user?.name ?? 'Me'} size="sm" />
          <Text style={styles.memberName}>{user?.name ?? 'Me'} (you)</Text>
          <MaterialIcons name="check-circle" size={20} color={Colors.success} />
        </View>

        {friends.map((f) => (
          <TouchableOpacity
            key={f.id}
            style={styles.memberRow}
            onPress={() => toggleFriend(f.friendId)}
          >
            <Avatar name={f.friendUser.name} uri={f.friendUser?.avatarUrl} size="sm" />
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{f.friendUser.name}</Text>
              <Text style={styles.memberEmail}>{f.friendUser.email}</Text>
            </View>
            <MaterialIcons
              name={selectedIds.has(f.friendId) ? 'check-circle' : 'radio-button-unchecked'}
              size={22}
              color={selectedIds.has(f.friendId) ? Colors.primary : Colors.gray300}
            />
          </TouchableOpacity>
        ))}

        <Button
          title={`Create Group${selectedIds.size > 0 ? ` (${selectedIds.size + 1} members)` : ''}`}
          onPress={handleSubmit}
          loading={isPending}
          fullWidth
          size="lg"
          style={styles.createBtn}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: { padding: Spacing.base, gap: Spacing.sm },
  memberLabel: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
  },
  memberHint: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    marginBottom: Spacing.xs,
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
  memberName: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary, flex: 1 },
  memberEmail: { fontSize: Typography.xs, color: Colors.textTertiary },
  createBtn: { marginTop: Spacing.xl },
});

export default CreateGroupScreen;

