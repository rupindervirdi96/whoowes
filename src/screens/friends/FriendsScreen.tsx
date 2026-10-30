import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme';
import { useFriends, useFriendRequests, useAcceptFriendRequest, useDeclineFriendRequest } from '../../hooks/useFriends';
import { useBalances } from '../../hooks/useBalances';
import { useContactMatches } from '../../hooks/useContacts';
import { balancesByPerson } from '../../utils/balanceEngine';
import { useMyCurrency } from '../../hooks/useCurrency';
import { useT } from '../../i18n';
import BalanceAmounts, { balanceDirection } from '../../components/BalanceAmounts';
import Screen from '../../components/ui/Screen';
import TabHeader from '../../components/ui/TabHeader';
import IconButton from '../../components/ui/IconButton';
import Input from '../../components/ui/Input';
import { ListCard } from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';
import ListRow, { SectionHeader } from '../../components/ui/ListRow';
import { SkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';

const SEARCH_FROM = 6; // show search once the list is long enough to need it

const FriendsScreen: React.FC = () => {
  const t = useTheme();
  const { t: tr } = useT();
  const navigation = useNavigation();
  const myCurrency = useMyCurrency();
  const [search, setSearch] = useState('');
  const friendsQ = useFriends();
  const { data: requests } = useFriendRequests();
  const { data: balanceData } = useBalances();
  const { data: contacts } = useContactMatches();
  const accept = useAcceptFriendRequest();
  const decline = useDeclineFriendRequest();

  // Each friend's open balances, one per currency.
  const byPerson = useMemo(() => balancesByPerson(balanceData?.balances ?? [], myCurrency), [balanceData, myCurrency]);
  const amountsFor = (id: string) => (byPerson.get(id) ?? []).map((b) => ({ currency: b.currency, amount: b.netBalance }));
  // For sorting only: people with open balances first, biggest first in their main currency.
  const weight = (id: string) => Math.abs(byPerson.get(id)?.[0]?.netBalance ?? 0);
  const friends = friendsQ.data ?? [];

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return friends
      .filter((f) => !q || f.friendUser.name.toLowerCase().includes(q) || f.friendUser.email.toLowerCase().includes(q))
      .sort((a, b) => weight(b.friendId) - weight(a.friendId) || a.friendUser.name.localeCompare(b.friendUser.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friends, balanceData, search]);

  const incoming = requests?.incoming ?? [];
  const outgoing = requests?.outgoing ?? [];
  const newContacts = contacts?.onWhoOwes.filter((m) => m.state === 'none').length ?? 0;

  return (
    <Screen edges={['top']} refreshing={friendsQ.isRefetching} onRefresh={friendsQ.refetch}>
      <TabHeader
        title={tr('tab.friends')}
        right={<IconButton icon="person-add-alt" variant="soft" accessibilityLabel={tr('friends.addFriend')} onPress={() => navigation.navigate('AddFriend')} />}
      />

      {friends.length >= SEARCH_FROM ? (
        <Input icon="search" value={search} onChangeText={setSearch} placeholder={tr('friends.search')} autoCorrect={false} />
      ) : null}

      {/* Contacts discovery */}
      <ListCard>
        <ListRow
          leading={
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="contacts" size={20} color={t.colors.primary} />
            </View>
          }
          title={tr('friends.findFromContacts')}
          subtitle={newContacts > 0 ? tr('home.contactsOnWhoOwes', { count: newContacts }) : tr('friends.seeWhosOn')}
          chevron
          onPress={() => navigation.navigate('FindFriends')}
        />
      </ListCard>

      {incoming.length > 0 ? (
        <>
          <SectionHeader title={tr('friends.requests')} />
          <ListCard>
            {incoming.map((r, i) => (
              <ListRow
                key={r.id}
                leading={<Avatar name={r.friendUser.name} uri={r.friendUser.avatarUrl} />}
                title={r.friendUser.name}
                subtitle={tr('friends.wantsToBeFriends')}
                divider={i < incoming.length - 1}
                trailing={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <IconButton icon="close" variant="ghost" size={36} accessibilityLabel={tr('friends.decline', { name: r.friendUser.name })} onPress={() => decline.mutate(r.id)} />
                    <Button title={tr('common.accept')} size="sm" onPress={() => accept.mutate(r.id)} loading={accept.isPending && accept.variables === r.id} />
                  </View>
                }
              />
            ))}
          </ListCard>
        </>
      ) : null}

      <SectionHeader title={friends.length ? `${tr('friends.yours')} · ${friends.length}` : tr('friends.yours')} />
      {friendsQ.isLoading ? (
        <SkeletonList />
      ) : list.length === 0 ? (
        <EmptyState
          emoji={search ? '🔍' : '👋'}
          title={search ? tr('common.noMatches') : tr('friends.empty.title')}
          body={search ? tr('friends.tryAnotherName') : tr('friends.empty.body')}
          actionLabel={search ? undefined : tr('friends.addFriend')}
          onAction={() => navigation.navigate('AddFriend')}
        />
      ) : (
        <ListCard>
          {list.map((f, i) => {
            const amounts = amountsFor(f.friendId);
            const direction = balanceDirection(amounts);
            const subtitle = {
              settled: tr('common.settledUp'),
              owesYou: tr('balance.owesYou'),
              youOwe: tr('balance.youOwe'),
              mixed: tr('balance.mixed'),
            }[direction];
            return (
              <ListRow
                key={f.id}
                divider={i < list.length - 1}
                leading={<Avatar name={f.friendUser.name} uri={f.friendUser.avatarUrl} />}
                title={f.friendUser.name}
                subtitle={subtitle}
                onPress={() => navigation.navigate('FriendDetail', { friendId: f.friendId })}
                trailing={direction === 'settled' ? undefined : <BalanceAmounts amounts={amounts} />}
              />
            );
          })}
        </ListCard>
      )}

      {outgoing.length > 0 ? (
        <>
          <SectionHeader title={tr('friends.sentRequests')} />
          <ListCard>
            {outgoing.map((r, i) => (
              <ListRow
                key={r.id}
                leading={<Avatar name={r.friendUser.name} />}
                title={r.friendUser.name}
                subtitle={tr('friends.waitingToAccept')}
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
