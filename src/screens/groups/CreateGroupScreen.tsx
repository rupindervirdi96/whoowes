import React, { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { RootScreenProps } from '../../types/navigation';
import { useCreateGroup } from '../../hooks/useGroups';
import { useFriends } from '../../hooks/useFriends';
import { useCurrentUser } from '../../hooks/useAuth';
import { createGroupSchema } from '../../utils/validation';
import Screen from '../../components/ui/Screen';
import Input from '../../components/ui/Input';
import Text from '../../components/ui/Text';
import Button from '../../components/ui/Button';
import Avatar from '../../components/ui/Avatar';
import Chip from '../../components/ui/Chip';
import EmptyState from '../../components/ui/EmptyState';
import GroupTile from '../../components/GroupTile';

const IDEAS = ['🏠 Home', '✈️ Trip', '🍕 Dinner club', '💼 Team lunch', '💍 Wedding'];

const CreateGroupScreen: React.FC<RootScreenProps<'CreateGroup'>> = ({ navigation }) => {
  const t = useTheme();
  const me = useCurrentUser()!;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>();
  const { data: friends = [] } = useFriends();
  const create = useCreateGroup();

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = () => {
    const memberIds = [me.id, ...selected];
    const result = createGroupSchema.safeParse({ name: name.trim(), description: description.trim() || undefined, memberIds });
    if (!result.success) {
      setError(result.error.issues[0]?.message);
      return;
    }
    create.mutate(result.data, {
      onSuccess: (g) => {
        navigation.goBack();
        navigation.navigate('GroupDetail', { groupId: g.id });
      },
    });
  };

  return (
    <Screen
      footer={
        <Button
          title={selected.size ? `Create group · ${selected.size + 1} people` : 'Create group'}
          size="lg"
          fullWidth
          loading={create.isPending}
          disabled={!name.trim()}
          onPress={submit}
        />
      }
    >
      <View style={{ alignItems: 'center', marginVertical: t.spacing.base }}>
        <GroupTile name={name || 'New group'} size={72} />
      </View>
      <Input
        label="Group name"
        value={name}
        onChangeText={(v) => {
          setName(v);
          setError(undefined);
        }}
        placeholder="e.g. Lisbon trip"
        error={error}
        autoFocus
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -6, marginBottom: t.spacing.base }}>
        {IDEAS.map((idea) => (
          <Chip key={idea} label={idea} onPress={() => setName(idea.replace(/^\S+\s/, ''))} />
        ))}
      </View>
      <Input label="Description (optional)" value={description} onChangeText={setDescription} placeholder="What’s it for?" />

      <Text variant="h3" style={{ marginTop: t.spacing.sm }}>
        Who’s in?
      </Text>
      <Text variant="caption" tone="tertiary" style={{ marginBottom: 12 }}>
        You’re added automatically. You can add more people later.
      </Text>
      {friends.length === 0 ? (
        <EmptyState emoji="👋" title="No friends to add yet" body="Create the group now and invite people later." />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {friends.map((f) => (
            <Chip
              key={f.id}
              label={f.friendUser.name.split(' ')[0]}
              selected={selected.has(f.friendId)}
              onPress={() => toggle(f.friendId)}
              leading={<Avatar name={f.friendUser.name} size="xs" />}
            />
          ))}
        </View>
      )}
    </Screen>
  );
};

export default CreateGroupScreen;
