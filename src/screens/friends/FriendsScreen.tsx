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
import FriendListRow from '../../components/friends/FriendListRow';
import FriendActionsSheet from '../../components/friends/FriendActionsSheet';
import NicknameSheet from '../../components/friends/NicknameSheet';
import { FriendFilters, FriendsTotals, filtersUseful } from '../../components/friends/FriendsSummary';

const SEARCH_FROM = 6; // show search once the list is long enough to need it
const CONTACTS_ON_TOP_UNDER = 3; // with only a few friends, finding more comes first

const FriendsScreen: React.FC = () => {
  const t = useTheme();
  const { t: tr } = useT();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { rows, summary, counts, friendsQ } = useFriendRows();
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

  const showFilters = filtersUseful(counts);
  const activeFilter = showFilters ? filter : 'all';
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => matchesFilter(r, activeFilter) && (!q || friendSearchText(r.friend).includes(q)));
  }, [rows, activeFilter, search]);

  const incoming = requests?.incoming ?? [];
  const outgoing = requests?.outgoing ?? [];
  const newContacts = contacts?.onWhoOwes.filter((m) => m.state === 'none').length ?? 0;
  const contactsOnTop = rows.length < CONTACTS_ON_TOP_UNDER;

  const contactsRow = (
    <ListCard style={contactsOnTop ? undefined : { marginTop: t.spacing.section }}>
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
  );

  const emptyText = {
    all: null,
    owesYou: tr('friends.filterEmpty.owesYou'),
    youOwe: tr('friends.filterEmpty.youOwe'),
    settled: tr('friends.filterEmpty.settled'),
  }[activeFilter];

  return (
    <Screen edges={['top']} refreshing={friendsQ.isRefetching} onRefresh={refreshAll}>
      <TabHeader
        title={tr('tab.friends')}
        right={<IconButton icon="person-add-alt" variant="soft" accessibilityLabel={tr('friends.addFriend')} onPress={() => navigation.navigate('AddFriend')} />}
      />

      {/* Requests to answer come first: they're the only thing here waiting on you. */}
      {incoming.length > 0 ? (
        <>
          <SectionHeader title={tr('friends.requests')} style={{ marginTop: t.spacing.base }} />
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
        </>
      ) : null}

      {summary ? <FriendsTotals summary={summary} /> : null}

      {contactsOnTop ? <View style={{ marginTop: t.spacing.base }}>{contactsRow}</View> : null}

      <SectionHeader title={rows.length ? `${tr('friends.yours')} · ${rows.length}` : tr('friends.yours')} />
      {rows.length >= SEARCH_FROM ? (
        <Input icon="search" value={search} onChangeText={setSearch} placeholder={tr('friends.search')} autoCorrect={false} />
      ) : null}
      {showFilters ? <FriendFilters value={filter} onChange={setFilter} counts={counts} /> : null}

      <View style={{ marginTop: showFilters || rows.length >= SEARCH_FROM ? t.spacing.md : 0 }}>
        {friendsQ.isLoading ? (
          <SkeletonList />
        ) : list.length === 0 ? (
          <EmptyState
            emoji={search ? '🔍' : emptyText ? '✨' : '👋'}
            title={search ? tr('common.noMatches') : (emptyText ?? tr('friends.empty.title'))}
            body={search ? tr('friends.tryAnotherName') : emptyText ? undefined : tr('friends.empty.body')}
            actionLabel={search || emptyText ? undefined : tr('friends.addFriend')}
            onAction={() => navigation.navigate('AddFriend')}
          />
        ) : (
          <ListCard style={{ overflow: 'hidden' }}>
            {list.map((row, i) => (
              <FriendListRow
                key={row.friend.id}
                row={row}
                divider={i < list.length - 1}
                open={openRow === row.friend.id}
                onOpenChange={(o) => setOpenRow((cur) => (o ? row.friend.id : cur === row.friend.id ? null : cur))}
                onSwiped={() => !tipSeen && markTipSeen()}
                onLongPress={() => {
                  setOpenRow(null);
                  setSheetRow(row);
                }}
              />
            ))}
          </ListCard>
        )}
      </View>

      {!tipSeen && list.length > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: t.spacing.md, paddingHorizontal: 4 }}>
          <Icon name="swipe" size={16} color={t.colors.textTertiary} />
          <Text variant="caption" tone="tertiary" style={{ flex: 1 }}>
            {tr('friends.swipeHint')}
          </Text>
          <Pressable onPress={markTipSeen} hitSlop={10} accessibilityRole="button" accessibilityLabel={tr('friends.dismissHint')}>
            <Icon name="close" size={16} color={t.colors.textTertiary} />
          </Pressable>
        </View>
      ) : null}

      {outgoing.length > 0 ? (
        <>
          <SectionHeader title={tr('friends.sentRequests')} />
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

      {contactsOnTop ? null : contactsRow}

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
