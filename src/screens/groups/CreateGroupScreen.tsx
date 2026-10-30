import React, { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { RootScreenProps } from '../../types/navigation';
import { useCreateGroup } from '../../hooks/useGroups';
import { useFriends } from '../../hooks/useFriends';
import { useCurrentUser } from '../../hooks/useAuth';
import { useMyCurrency } from '../../hooks/useCurrency';
import { useT, type TKey } from '../../i18n';
import { currencyName } from '../../utils/currency';
import Screen from '../../components/ui/Screen';
import Input from '../../components/ui/Input';
import Text from '../../components/ui/Text';
import Button from '../../components/ui/Button';
import Avatar from '../../components/ui/Avatar';
import Chip from '../../components/ui/Chip';
import Icon from '../../components/ui/Icon';
import { ListCard } from '../../components/ui/Card';
import ListRow from '../../components/ui/ListRow';
import EmptyState from '../../components/ui/EmptyState';
import GroupTile from '../../components/GroupTile';
import CurrencyPicker from '../../components/CurrencyPicker';

const IDEAS: Array<{ emoji: string; key: TKey }> = [
  { emoji: '🏠', key: 'createGroup.idea.home' },
  { emoji: '✈️', key: 'createGroup.idea.trip' },
  { emoji: '🍕', key: 'createGroup.idea.dinner' },
  { emoji: '💼', key: 'createGroup.idea.team' },
  { emoji: '💍', key: 'createGroup.idea.wedding' },
];

const CreateGroupScreen: React.FC<RootScreenProps<'CreateGroup'>> = ({ navigation }) => {
  const t = useTheme();
  const { t: tr } = useT();
  const me = useCurrentUser()!;
  const myCurrency = useMyCurrency();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState(myCurrency);
  const [pickerOpen, setPickerOpen] = useState(false);
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
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError(tr('createGroup.nameTooShort'));
      return;
    }
    if (trimmed.length > 50) {
      setError(tr('createGroup.nameTooLong'));
      return;
    }
    create.mutate(
      { name: trimmed, description: description.trim() || undefined, memberIds: [me.id, ...selected], currency },
      {
        onSuccess: (g) => {
          navigation.goBack();
          navigation.navigate('GroupDetail', { groupId: g.id });
        },
      },
    );
  };

  return (
    <Screen
      footer={
        <Button
          title={selected.size ? tr('createGroup.createWithCount', { count: selected.size + 1 }) : tr('groups.create')}
          size="lg"
          fullWidth
          loading={create.isPending}
          disabled={!name.trim()}
          onPress={submit}
        />
      }
    >
      <View style={{ alignItems: 'center', marginVertical: t.spacing.base }}>
        <GroupTile name={name || tr('createGroup.newGroup')} size={72} />
      </View>
      <Input
        label={tr('createGroup.name')}
        value={name}
        onChangeText={(v) => {
          setName(v);
          setError(undefined);
        }}
        placeholder={tr('createGroup.namePlaceholder')}
        error={error}
        autoFocus
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -6, marginBottom: t.spacing.base }}>
        {IDEAS.map((idea) => (
          <Chip key={idea.key} label={`${idea.emoji} ${tr(idea.key)}`} onPress={() => setName(tr(idea.key))} />
        ))}
      </View>
      <Input label={tr('createGroup.description')} value={description} onChangeText={setDescription} placeholder={tr('createGroup.descriptionPlaceholder')} />

      <ListCard style={{ marginBottom: t.spacing.base }}>
        <ListRow
          leading={<Icon name="payments" color={t.colors.textSecondary} />}
          title={tr('group.currency')}
          subtitle={currencyName(currency)}
          trailing={<Text tone="secondary">{currency}</Text>}
          chevron
          onPress={() => setPickerOpen(true)}
        />
      </ListCard>

      <Text variant="h3" style={{ marginTop: t.spacing.sm }}>
        {tr('createGroup.whosIn')}
      </Text>
      <Text variant="caption" tone="tertiary" style={{ marginBottom: 12 }}>
        {tr('createGroup.whosInHint')}
      </Text>
      {friends.length === 0 ? (
        <EmptyState emoji="👋" title={tr('createGroup.noFriends')} body={tr('createGroup.noFriendsBody')} />
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

      <CurrencyPicker visible={pickerOpen} onClose={() => setPickerOpen(false)} value={currency} onSelect={setCurrency} suggested={[myCurrency]} title={tr('group.currency')} />
    </Screen>
  );
};

export default CreateGroupScreen;
