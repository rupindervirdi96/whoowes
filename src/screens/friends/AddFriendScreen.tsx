import React, { useEffect, useState } from 'react';
import { Share, View } from 'react-native';
import { useTheme } from '../../theme';
import { RootScreenProps } from '../../types/navigation';
import {
  useAcceptFriendRequest,
  useAddFriend,
  useDeclineFriendRequest,
  useFriendRequests,
  useFriends,
  useSearchUsers,
} from '../../hooks/useFriends';
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
  // Wait for a short pause in typing before searching, so results don't flicker on every key.
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const { data: results = [], isFetching } = useSearchUsers(debounced);
  const { data: friends = [] } = useFriends();
  const { data: requests } = useFriendRequests();
  const add = useAddFriend();
  const accept = useAcceptFriendRequest();
  const cancel = useDeclineFriendRequest();

  const looksLikeContact = addFriendSchema.safeParse({ emailOrPhone: query.trim() }).success;
  const friendIds = new Set(friends.map((f) => f.friendId));
  // Pending requests by the other person's id, in both directions.
  const outgoing = new Map((requests?.outgoing ?? []).map((r) => [r.friendId, r.id]));
  const incoming = new Map((requests?.incoming ?? []).map((r) => [r.userId, r.id]));
  const searching = query.trim() !== debounced || (isFetching && results.length === 0);

  const send = (payload: { userId?: string; emailOrPhone?: string }) =>
    add.mutate(payload, {
      onSuccess: () => payload.emailOrPhone && setSentTo((s) => new Set(s).add(payload.emailOrPhone!)),
    });

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
      ) : searching ? (
        <SkeletonList rows={3} />
      ) : results.length === 0 ? (
        <View>
          <EmptyState emoji="🔍" title={tr('addFriend.noneFound')} body={tr('addFriend.nobodyMatches', { query })} />
          {looksLikeContact ? (
            <Button
              title={sentTo.has(query.trim()) ? tr('addFriend.sent') : tr('addFriend.sendTo', { who: query.trim() })}
              variant={sentTo.has(query.trim()) ? 'secondary' : 'primary'}
              disabled={sentTo.has(query.trim())}
              onPress={() => send({ emailOrPhone: query.trim() })}
              loading={add.isPending}
              fullWidth
            />
          ) : null}
        </View>
      ) : (
        <Card padding={4} style={{ paddingHorizontal: 12 }}>
          {results.map((u, i) => {
            const outgoingId = outgoing.get(u.id);
            const incomingId = incoming.get(u.id);
            const subtitle = friendIds.has(u.id)
              ? tr('contacts.alreadyFriends')
              : incomingId
                ? tr('friends.wantsToBeFriends')
                : outgoingId
                  ? tr('friends.waitingToAccept')
                  : u.email || undefined;
            let trailing: React.ReactNode;
            if (friendIds.has(u.id)) {
              trailing = <Badge label={tr('addFriend.friends')} tone="positive" icon="check" />;
            } else if (incomingId) {
              // They already asked me: accept right here instead of sending a duplicate request.
              trailing = (
                <Button
                  title={tr('common.accept')}
                  size="sm"
                  loading={accept.isPending && accept.variables === incomingId}
                  onPress={() => accept.mutate(incomingId)}
                />
              );
            } else if (outgoingId) {
              // Already sent: tapping again cancels it.
              trailing = (
                <Button
                  title={tr('addFriend.sent')}
                  icon="check"
                  size="sm"
                  variant="secondary"
                  accessibilityLabel={tr('friends.cancelRequest', { name: u.name })}
                  loading={cancel.isPending && cancel.variables === outgoingId}
                  onPress={() => cancel.mutate(outgoingId)}
                />
              );
            } else {
              trailing = (
                <Button
                  title={tr('common.add')}
                  size="sm"
                  icon="person-add-alt"
                  loading={add.isPending && add.variables?.userId === u.id}
                  onPress={() => send({ userId: u.id })}
                />
              );
            }
            return (
              <ListRow
                key={u.id}
                divider={i < results.length - 1}
                leading={<Avatar name={u.name} uri={u.avatarUrl} />}
                title={u.name}
                subtitle={subtitle}
                trailing={trailing}
              />
            );
          })}
        </Card>
      )}
      {outgoing.size > 0 && query.trim().length >= 2 && results.some((u) => outgoing.has(u.id)) ? (
        <Text variant="caption" tone="tertiary" align="center" style={{ marginTop: t.spacing.md }}>
          {tr('addFriend.tapToCancel')}
        </Text>
      ) : null}
    </Screen>
  );
};

export default AddFriendScreen;
