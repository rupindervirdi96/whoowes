import React, { useState } from 'react';
import { Share, View } from 'react-native';
import { useTheme } from '../../theme';
import { RootScreenProps } from '../../types/navigation';
import { useAddFriend, useFriends, useSearchUsers } from '../../hooks/useFriends';
import { addFriendSchema } from '../../utils/validation';
import Screen from '../../components/ui/Screen';
import Input from '../../components/ui/Input';
import Text from '../../components/ui/Text';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ListRow from '../../components/ui/ListRow';
import Badge from '../../components/ui/Badge';
import { SkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';

const AddFriendScreen: React.FC<RootScreenProps<'AddFriend'>> = () => {
  const t = useTheme();
  const [query, setQuery] = useState('');
  const [sent, setSent] = useState<Set<string>>(new Set());
  const { data: results = [], isFetching } = useSearchUsers(query);
  const { data: friends = [] } = useFriends();
  const add = useAddFriend();

  const looksLikeContact = addFriendSchema.safeParse({ emailOrPhone: query.trim() }).success;
  const friendIds = new Set(friends.map((f) => f.friendId));

  const send = (payload: { userId?: string; emailOrPhone?: string }, key: string) =>
    add.mutate(payload, { onSuccess: () => setSent((s) => new Set(s).add(key)) });

  return (
    <Screen>
      <Input
        icon="search"
        value={query}
        onChangeText={setQuery}
        placeholder="Name, email or phone"
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
      />

      {query.trim().length < 2 ? (
        <>
          <EmptyState emoji="🤝" title="Find your people" body="Search by phone number or email. Names find people you already share a group with." />
          <Card variant="alt" style={{ marginTop: t.spacing.base }}>
            <Text variant="bodyStrong">Not on WhoOwes yet?</Text>
            <Text tone="secondary" style={{ marginTop: 4 }}>
              Send them an invite — you can start splitting as soon as they join.
            </Text>
            <Button
              title="Share invite link"
              icon="ios-share"
              variant="secondary"
              style={{ marginTop: 12 }}
              onPress={() =>
                Share.share({ message: 'Join me on WhoOwes so we can split bills without the awkward math 🦉 https://whoowes.app' })
              }
            />
          </Card>
        </>
      ) : isFetching && results.length === 0 ? (
        <SkeletonList rows={3} />
      ) : results.length === 0 ? (
        <View>
          <EmptyState emoji="🔍" title="No one found" body={`Nobody matches “${query}”.`} />
          {looksLikeContact ? (
            <Button title={`Send request to ${query.trim()}`} onPress={() => send({ emailOrPhone: query.trim() }, query.trim())} loading={add.isPending} fullWidth />
          ) : null}
        </View>
      ) : (
        <Card padding={4} style={{ paddingHorizontal: 12 }}>
          {results.map((u, i) => {
            const already = friendIds.has(u.id);
            const isSent = sent.has(u.id);
            return (
              <ListRow
                key={u.id}
                divider={i < results.length - 1}
                leading={<Avatar name={u.name} uri={u.avatarUrl} />}
                title={u.name}
                subtitle={u.email || undefined}
                trailing={
                  already ? (
                    <Badge label="Friends" tone="positive" icon="check" />
                  ) : (
                    <Button
                      title={isSent ? 'Sent' : 'Add'}
                      size="sm"
                      variant={isSent ? 'secondary' : 'primary'}
                      disabled={isSent}
                      loading={add.isPending && add.variables?.userId === u.id}
                      onPress={() => send({ userId: u.id }, u.id)}
                    />
                  )
                }
              />
            );
          })}
        </Card>
      )}
    </Screen>
  );
};

export default AddFriendScreen;
