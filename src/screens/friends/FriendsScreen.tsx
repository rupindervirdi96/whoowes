import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '../../constants';
import { useRefreshOnFocus } from '../../hooks/queryUtils';
import { useTheme } from '../../theme';
import { useFriendRequests, useAcceptFriendRequest, useDeclineFriendRequest } from '../../hooks/useFriends';
import { friendSearchText, matchesFilter, useFriendRows, type FriendFilter, type FriendRowData } from '../../hooks/useFriendInsights';
import { useFriendActions } from '../../hooks/useFriendActions';
import { useContactMatches } from '../../hooks/useContacts';
import { useUIStore } from '../../store/uiStore';
import { useT } from '../../i18n';
import type { Friend } from '../../types';
import Screen from '../../components/ui/Screen';
import TabHeader from '../../components/ui/TabHeader';
import IconButton from '../../components/ui/IconButton';
import Input from '../../components/ui/Input';
import { ListCard } from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';
import Text from '../../components/ui/Text';
import ListRow, { SectionHeader } from '../../components/ui/ListRow';
import { SkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import FriendListRow, { OtherPersonRow } from '../../components/friends/FriendListRow';
import FriendActionsSheet from '../../components/friends/FriendActionsSheet';
import NicknameSheet from '../../components/friends/NicknameSheet';
import FriendsTotals from '../../components/friends/FriendsSummary';

const SEARCH_FROM = 8; // show search once the list is long enough to need it

/**
 * Friends tab, most important first: requests waiting on you, who owes whom
 * (tap a side to filter), then the people. Finding contacts lives in the header.
 */
const FriendsScreen: React.FC = () => {
  const t = useTheme();
  const { t: tr } = useT();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { rows, others, summary, friendsQ } = useFriendRows();
  const { data: requests } = useFriendRequests();
  const { data: contacts } = useContactMatches();
  const accept = useAcceptFriendRequest();
  const decline = useDeclineFriendRequest();
  const actions = useFriendActions();
  const tipSeen = useUIStore((s) => s.friendSwipeTipSeen);
  const markTipSeen = useUIStore((s) => s.markFriendSwipeTipSeen);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FriendFilter>('all');
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [sheetRow, setSheetRow] = useState<FriendRowData | null>(null);
  const [nicknameFor, setNicknameFor] = useState<Friend | null>(null);

  // Everything on this screen: friends, requests, balances (and what they're built from), contact matches.
  const screenKeys = [QUERY_KEYS.FRIENDS, QUERY_KEYS.BALANCES, QUERY_KEYS.EXPENSES, QUERY_KEYS.SETTLEMENTS, QUERY_KEYS.CONTACT_MATCHES];
  useRefreshOnFocus(screenKeys);
  const refreshAll = () => {
    for (const queryKey of screenKeys) queryClient.refetchQueries({ queryKey: [...queryKey], type: 'active' });
  };

  const activeFilter = summary ? filter : 'all';
  const q = search.trim().toLowerCase();
  const list = useMemo(
    () => rows.filter((r) => matchesFilter(r, activeFilter) && (!q || friendSearchText(r.friend).includes(q))),
    [rows, activeFilter, q],
  );
  const otherList = useMemo(
    () => others.filter((r) => matchesFilter(r, activeFilter) && (!q || r.user.name.toLowerCase().includes(q))),
    [others, activeFilter, q],
  );

  const incoming = requests?.incoming ?? [];
  const outgoing = requests?.outgoing ?? [];
  const requestedIds = new Set(outgoing.map((r) => r.friendId));
  const newContacts = contacts?.onWhoOwes.filter((m) => m.state === 'none').length ?? 0;

  const filterTitle = { all: null, owesYou: tr('friends.owedToYou'), youOwe: tr('friends.youOwe') }[activeFilter];
  const emptyText = { all: null, owesYou: tr('friends.filterEmpty.owesYou'), youOwe: tr('friends.filterEmpty.youOwe') }[activeFilter];

  return (
    <Screen edges={['top']} refreshing={friendsQ.isRefetching} onRefresh={refreshAll}>
      <TabHeader
        title={tr('tab.friends')}
        right={
          <>
            {/* The badge says how many of my contacts are on WhoOwes and not yet friends. */}
            <IconButton
              icon="contacts"
              variant="surface"
              shape="square"
              badge={newContacts}
              accessibilityLabel={newContacts > 0 ? `${tr('friends.findFromContacts')}. ${tr('home.contactsOnWhoOwes', { count: newContacts })}` : tr('friends.findFromContacts')}
              onPress={() => navigation.navigate('FindFriends')}
            />
            <IconButton icon="person-add-alt" variant="soft" shape="square" accessibilityLabel={tr('friends.addFriend')} onPress={() => navigation.navigate('AddFriend')} />
          </>
        }
      />

      {/* Requests to answer come first: they're the only thing here waiting on you. */}
      {incoming.length > 0 ? (
        <ListCard style={{ marginBottom: t.spacing.md }}>
          {incoming.map((r, i) => (
            <ListRow
              key={r.id}
              leading={<Avatar name={r.friendUser.name} uri={r.friendUser.avatarUrl} />}
              title={r.friendUser.name}
              subtitle={tr('friends.wantsToBeFriends')}
              divider={i < incoming.length - 1}
              trailing={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <IconButton
                    icon="close"
                    variant="ghost"
                    size={36}
                    accessibilityLabel={tr('friends.decline', { name: r.friendUser.name })}
                    onPress={() => !(decline.isPending && decline.variables === r.id) && decline.mutate(r.id)}
                  />
                  <Button title={tr('common.accept')} size="sm" onPress={() => accept.mutate(r.id)} loading={accept.isPending && accept.variables === r.id} />
                </View>
              }
            />
          ))}
        </ListCard>
      ) : null}

      {summary ? <FriendsTotals summary={summary} filter={activeFilter} onFilter={setFilter} /> : null}

      <SectionHeader
        title={filterTitle ? `${filterTitle} · ${list.length + otherList.length}` : rows.length ? `${tr('friends.yours')} · ${rows.length}` : tr('friends.yours')}
        action={filterTitle ? tr('friends.showAll') : undefined}
        onAction={() => setFilter('all')}
        style={{ marginTop: t.spacing.lg, marginBottom: t.spacing.sm }}
      />
      {rows.length >= SEARCH_FROM ? (
        <Input icon="search" value={search} onChangeText={setSearch} placeholder={tr('friends.search')} autoCorrect={false} containerStyle={{ marginBottom: t.spacing.sm }} />
      ) : null}

      {friendsQ.isLoading ? (
        <SkeletonList />
      ) : list.length === 0 && otherList.length === 0 ? (
        <EmptyState
          emoji={search ? '🔍' : emptyText ? '✨' : '👋'}
          title={search ? tr('common.noMatches') : (emptyText ?? tr('friends.empty.title'))}
          body={search ? tr('friends.tryAnotherName') : emptyText ? undefined : tr('friends.empty.body')}
          actionLabel={search || emptyText ? undefined : tr('friends.addFriend')}
          onAction={() => navigation.navigate('AddFriend')}
        />
      ) : list.length > 0 ? (
        // No vertical padding: a swiped row's colour must reach the card's top and bottom edge.
        <ListCard style={{ overflow: 'hidden', paddingVertical: 0 }}>
          {list.map((row, i) => (
            <FriendListRow
              key={row.friend.id}
              row={row}
              divider={i < list.length - 1}
              open={openRow === row.friend.id}
              onOpenChange={(o) => setOpenRow((cur) => (o ? row.friend.id : cur === row.friend.id ? null : cur))}
              onSwiped={() => !tipSeen && markTipSeen()}
              peek={!tipSeen && i === 0}
              onLongPress={() => {
                setOpenRow(null);
                setSheetRow(row);
              }}
            />
          ))}
        </ListCard>
      ) : null}

      {!tipSeen && list.length > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: t.spacing.sm, paddingHorizontal: 4 }}>
          <Icon name="swipe" size={16} color={t.colors.textTertiary} />
          <Text variant="caption" tone="tertiary" style={{ flex: 1 }}>
            {tr('friends.swipeHint')}
          </Text>
          <Pressable onPress={markTipSeen} hitSlop={10} accessibilityRole="button" accessibilityLabel={tr('friends.dismissHint')}>
            <Icon name="close" size={16} color={t.colors.textTertiary} />
          </Pressable>
        </View>
      ) : null}

      {otherList.length > 0 ? (
        <>
          <SectionHeader title={tr('friends.others')} style={{ marginTop: t.spacing.xl, marginBottom: 4 }} />
          <Text variant="caption" tone="tertiary" style={{ marginBottom: t.spacing.sm }}>
            {tr('friends.othersHint')}
          </Text>
          <ListCard>
            {otherList.map((row, i) => (
              <OtherPersonRow key={row.user.id} row={row} divider={i < otherList.length - 1} requested={requestedIds.has(row.user.id)} />
            ))}
          </ListCard>
        </>
      ) : null}

      {outgoing.length > 0 && activeFilter === 'all' ? (
        <>
          <SectionHeader title={tr('friends.sentRequests')} style={{ marginTop: t.spacing.xl, marginBottom: t.spacing.sm }} />
          <ListCard>
            {outgoing.map((r, i) => (
              <ListRow
                key={r.id}
                leading={<Avatar name={r.friendUser.name} uri={r.friendUser.avatarUrl} />}
                title={r.friendUser.name}
                subtitle={tr('friends.waitingToAccept')}
                divider={i < outgoing.length - 1}
                trailing={
                  <Button
                    title={tr('common.cancel')}
                    size="sm"
                    variant="ghost"
                    accessibilityLabel={tr('friends.cancelRequest', { name: r.friendUser.name })}
                    loading={decline.isPending && decline.variables === r.id}
                    onPress={() => decline.mutate(r.id)}
                  />
                }
              />
            ))}
          </ListCard>
        </>
      ) : null}

      <FriendActionsSheet
        row={sheetRow}
        onClose={() => setSheetRow(null)}
        onEditNickname={(row) => {
          // Let the first sheet finish closing; iOS can't show two at once.
          setTimeout(() => setNicknameFor(row.friend), 350);
        }}
      />
      <NicknameSheet friend={nicknameFor} onClose={() => setNicknameFor(null)} onSave={actions.setNickname} />
    </Screen>
  );
};

export default FriendsScreen;
