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
import { useT } from '../../i18n';
import { INVITE_URL } from '../../config';

const AddFriendScreen: React.FC<RootScreenProps<'AddFriend'>> = () => {
  const t = useTheme();
  const { t: tr } = useT();
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
        placeholder={tr('addFriend.placeholder')}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
      />

      {query.trim().length < 2 ? (
        <>
          <EmptyState emoji="🤝" title={tr('addFriend.empty.title')} body={tr('addFriend.empty.body')} />
          <Card variant="alt" style={{ marginTop: t.spacing.base }}>
            <Text variant="bodyStrong">{tr('addFriend.notOn')}</Text>
            <Text tone="secondary" style={{ marginTop: 4 }}>
              {tr('addFriend.notOnBody')}
            </Text>
            <Button
              title={tr('addFriend.share')}
              icon="ios-share"
              variant="secondary"
              style={{ marginTop: 12 }}
              onPress={() => Share.share({ message: tr('invite.message', { url: INVITE_URL }) })}
            />
          </Card>
        </>
      ) : isFetching && results.length === 0 ? (
        <SkeletonList rows={3} />
      ) : results.length === 0 ? (
        <View>
          <EmptyState emoji="🔍" title={tr('addFriend.noneFound')} body={tr('addFriend.nobodyMatches', { query })} />
          {looksLikeContact ? (
            <Button title={tr('addFriend.sendTo', { who: query.trim() })} onPress={() => send({ emailOrPhone: query.trim() }, query.trim())} loading={add.isPending} fullWidth />
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
                    <Badge label={tr('addFriend.friends')} tone="positive" icon="check" />
                  ) : (
                    <Button
                      title={isSent ? tr('addFriend.sent') : tr('common.add')}
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
