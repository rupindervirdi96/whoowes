import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { useFriends, useFriendRequests, useAcceptFriendRequest, useDeclineFriendRequest } from '../../hooks/useFriends';
import { useBalances } from '../../hooks/useBalances';
import { useContactMatches } from '../../hooks/useContacts';
import { formatCurrency } from '../../utils/currency';
import Screen from '../../components/ui/Screen';
import TabHeader from '../../components/ui/TabHeader';
import IconButton from '../../components/ui/IconButton';
import Input from '../../components/ui/Input';
import { ListCard } from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';
import ListRow, { RowAmount, SectionHeader } from '../../components/ui/ListRow';
import { SkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';

const SEARCH_FROM = 6; // show search once the list is long enough to need it

const FriendsScreen: React.FC = () => {
  const t = useTheme();
  const navigation = useNavigation();
  const [search, setSearch] = useState('');
  const friendsQ = useFriends();
  const { data: requests } = useFriendRequests();
  const { data: balanceData } = useBalances();
  const { data: contacts } = useContactMatches();
  const accept = useAcceptFriendRequest();
  const decline = useDeclineFriendRequest();

  const netFor = (id: string) => balanceData?.balances.find((b) => b.userId === id)?.netBalance ?? 0;
  const friends = friendsQ.data ?? [];

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return friends
      .filter((f) => !q || f.friendUser.name.toLowerCase().includes(q) || f.friendUser.email.toLowerCase().includes(q))
      .sort((a, b) => Math.abs(netFor(b.friendId)) - Math.abs(netFor(a.friendId)) || a.friendUser.name.localeCompare(b.friendUser.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friends, balanceData, search]);

  const incoming = requests?.incoming ?? [];
  const outgoing = requests?.outgoing ?? [];
  const newContacts = contacts?.onWhoOwes.filter((m) => m.state === 'none').length ?? 0;

  return (
    <Screen edges={['top']} refreshing={friendsQ.isRefetching} onRefresh={friendsQ.refetch}>
      <TabHeader
        title="Friends"
        right={<IconButton icon="person-add-alt" variant="soft" accessibilityLabel="Add a friend" onPress={() => navigation.navigate('AddFriend')} />}
      />

      {friends.length >= SEARCH_FROM ? (
        <Input icon="search" value={search} onChangeText={setSearch} placeholder="Search friends" autoCorrect={false} />
      ) : null}

      {/* Contacts discovery */}
      <ListCard>
        <ListRow
          leading={
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="contacts" size={20} color={t.colors.primary} />
            </View>
          }
          title="Find friends from contacts"
          subtitle={
            newContacts > 0
              ? `${newContacts} ${newContacts === 1 ? 'contact is' : 'contacts are'} on WhoOwes`
              : 'See who’s already on WhoOwes'
          }
          chevron
          onPress={() => navigation.navigate('FindFriends')}
        />
      </ListCard>

      {incoming.length > 0 ? (
        <>
          <SectionHeader title="Friend requests" />
          <ListCard>
            {incoming.map((r, i) => (
              <ListRow
                key={r.id}
                leading={<Avatar name={r.friendUser.name} uri={r.friendUser.avatarUrl} />}
                title={r.friendUser.name}
                subtitle="Wants to be friends"
                divider={i < incoming.length - 1}
                trailing={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <IconButton icon="close" variant="ghost" size={36} accessibilityLabel={`Decline ${r.friendUser.name}`} onPress={() => decline.mutate(r.id)} />
                    <Button title="Accept" size="sm" onPress={() => accept.mutate(r.id)} loading={accept.isPending && accept.variables === r.id} />
                  </View>
                }
              />
            ))}
          </ListCard>
        </>
      ) : null}

      <SectionHeader title={friends.length ? `Your friends · ${friends.length}` : 'Your friends'} />
      {friendsQ.isLoading ? (
        <SkeletonList />
      ) : list.length === 0 ? (
        <EmptyState
          emoji={search ? '🔍' : '👋'}
          title={search ? 'No matches' : 'No friends yet'}
          body={search ? 'Try another name.' : 'Find friends from your contacts, or add someone by phone or email.'}
          actionLabel={search ? undefined : 'Add a friend'}
          onAction={() => navigation.navigate('AddFriend')}
        />
      ) : (
        <ListCard>
          {list.map((f, i) => {
            const net = netFor(f.friendId);
            const settled = Math.abs(net) < 0.005;
            return (
              <ListRow
                key={f.id}
                divider={i < list.length - 1}
                leading={<Avatar name={f.friendUser.name} uri={f.friendUser.avatarUrl} />}
                title={f.friendUser.name}
                subtitle={settled ? 'Settled up' : net > 0 ? 'owes you' : 'you owe'}
                onPress={() => navigation.navigate('FriendDetail', { friendId: f.friendId })}
                trailing={settled ? undefined : <RowAmount amount={formatCurrency(Math.abs(net))} tone={net > 0 ? 'positive' : 'negative'} />}
              />
            );
          })}
        </ListCard>
      )}

      {outgoing.length > 0 ? (
        <>
          <SectionHeader title="Sent requests" />
          <ListCard>
            {outgoing.map((r, i) => (
              <ListRow
                key={r.id}
                leading={<Avatar name={r.friendUser.name} />}
                title={r.friendUser.name}
                subtitle="Waiting for them to accept"
                divider={i < outgoing.length - 1}
              />
            ))}
          </ListCard>
        </>
      ) : null}
    </Screen>
  );
};

export default FriendsScreen;
