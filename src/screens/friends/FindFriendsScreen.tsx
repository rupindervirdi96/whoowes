import React, { useMemo, useState } from 'react';
import { Linking, Platform, Share, View } from 'react-native';
import { useTheme } from '../../theme';
import { RootScreenProps } from '../../types/navigation';
import type { ContactMatch } from '../../types';
import { useContactMatches, useRequestContactsAccess } from '../../hooks/useContacts';
import { useAcceptFriendRequest, useAddFriend } from '../../hooks/useFriends';
import { formatPhone } from '../../utils/phone';
import Screen from '../../components/ui/Screen';
import Text from '../../components/ui/Text';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Icon from '../../components/ui/Icon';
import Avatar from '../../components/ui/Avatar';
import Card, { ListCard } from '../../components/ui/Card';
import ListRow, { SectionHeader } from '../../components/ui/ListRow';
import { SkeletonList } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';

const INVITE_MESSAGE = 'I’m using WhoOwes to split bills — join me so we can settle up without the awkward math 🦉 https://whoowes.app';
const INVITE_PAGE = 25;

function invite(phone: string) {
  if (Platform.OS === 'web') return Share.share({ message: INVITE_MESSAGE });
  // iOS uses "&" before body, Android "?".
  const url = `sms:${phone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(INVITE_MESSAGE)}`;
  return Linking.openURL(url).catch(() => Share.share({ message: INVITE_MESSAGE }));
}

const FindFriendsScreen: React.FC<RootScreenProps<'FindFriends'>> = () => {
  const t = useTheme();
  const matches = useContactMatches();
  const requestAccess = useRequestContactsAccess();
  const add = useAddFriend();
  const accept = useAcceptFriendRequest();
  const [search, setSearch] = useState('');
  const [showAllInvites, setShowAllInvites] = useState(false);

  const data = matches.data;
  const q = search.trim().toLowerCase();
  const filter = (list: ContactMatch[]) => (q ? list.filter((c) => c.contactName.toLowerCase().includes(q)) : list);
  const members = useMemo(() => filter(data?.onWhoOwes ?? []), [data, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const invites = useMemo(() => filter(data?.invite ?? []), [data, q]); // eslint-disable-line react-hooks/exhaustive-deps

  if (matches.isLoading || !data) {
    return (
      <Screen>
        <SkeletonList rows={6} />
      </Screen>
    );
  }

  // ── No access yet ──
  if (data.permission === 'undetermined' || data.permission === 'denied') {
    const blocked = data.permission === 'denied' && !data.canAskAgain;
    return (
      <Screen
        footer={
          <Button
            title={blocked ? 'Open Settings' : 'Allow access to contacts'}
            size="lg"
            fullWidth
            loading={requestAccess.isPending}
            onPress={() => (blocked ? Linking.openSettings() : requestAccess.mutate())}
          />
        }
      >
        <View style={{ alignItems: 'center', paddingTop: t.spacing['3xl'], paddingHorizontal: t.spacing.base }}>
          <View
            style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: t.colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="contacts" size={40} color={t.colors.primary} />
          </View>
          <Text variant="h2" align="center" style={{ marginTop: t.spacing.xl }}>
            See who’s already on WhoOwes
          </Text>
          <Text tone="secondary" align="center" style={{ marginTop: t.spacing.sm, maxWidth: 320 }}>
            We’ll check your contacts and show you who you can add, so you don’t have to search one by one.
          </Text>
        </View>
        <View style={{ gap: t.spacing.base, marginTop: t.spacing['3xl'] }}>
          <PrivacyPoint icon="lock-outline" text="Numbers are scrambled (hashed) on your phone before they’re checked." />
          <PrivacyPoint icon="cloud-off" text="Your address book is never uploaded or stored." />
          <PrivacyPoint icon="notifications-off" text="We never message your contacts. Invites only go out if you send them." />
        </View>
        {blocked ? (
          <Text variant="caption" tone="tertiary" align="center" style={{ marginTop: t.spacing.xl }}>
            Contacts access is turned off for WhoOwes. You can turn it on in Settings.
          </Text>
        ) : null}
      </Screen>
    );
  }

  if (data.permission === 'unavailable') {
    return (
      <Screen>
        <EmptyState emoji="📱" title="Use the mobile app for this" body="Finding friends from your contacts works in the WhoOwes app on your phone." />
      </Screen>
    );
  }

  const total = data.onWhoOwes.length + data.invite.length;
  const shownInvites = showAllInvites || q ? invites : invites.slice(0, INVITE_PAGE);

  return (
    <Screen refreshing={matches.isRefetching} onRefresh={matches.refetch}>
      {total > 8 ? (
        <Input icon="search" value={search} onChangeText={setSearch} placeholder="Search contacts" autoCorrect={false} />
      ) : null}

      <SectionHeader title={`On WhoOwes${members.length ? ` · ${members.length}` : ''}`} style={{ marginTop: total > 8 ? t.spacing.xl : 0 }} />
      {members.length === 0 ? (
        <Card variant="alt">
          <Text tone="secondary">{q ? 'No matches.' : 'None of your contacts are on WhoOwes yet. Invite a few below.'}</Text>
        </Card>
      ) : (
        <ListCard>
          {members.map((m, i) => {
            const subtitle =
              m.state === 'friend'
                ? 'Already friends'
                : m.state === 'requested'
                  ? 'Request sent'
                  : m.state === 'incoming'
                    ? 'Wants to be friends'
                    : formatPhone(m.phone);
            return (
              <ListRow
                key={m.key}
                leading={<Avatar name={m.contactName} />}
                title={m.contactName}
                subtitle={subtitle}
                divider={i < members.length - 1}
                trailing={
                  m.state === 'none' ? (
                    <Button
                      title="Add"
                      size="sm"
                      icon="person-add-alt"
                      loading={add.isPending && (add.variables?.userId === m.user?.id || add.variables?.emailOrPhone === m.phone)}
                      onPress={() => add.mutate(m.user ? { userId: m.user.id } : { emailOrPhone: m.phone })}
                    />
                  ) : m.state === 'incoming' && m.requestId ? (
                    <Button
                      title="Accept"
                      size="sm"
                      loading={accept.isPending && accept.variables === m.requestId}
                      onPress={() => accept.mutate(m.requestId!)}
                    />
                  ) : m.state === 'friend' ? (
                    <Icon name="check-circle" size={22} color={t.colors.positive} />
                  ) : (
                    <Icon name="schedule" size={20} color={t.colors.textTertiary} />
                  )
                }
              />
            );
          })}
        </ListCard>
      )}

      {invites.length > 0 ? (
        <>
          <SectionHeader title={`Invite to WhoOwes · ${invites.length}`} />
          <ListCard>
            {shownInvites.map((c, i) => (
              <ListRow
                key={c.key}
                leading={<Avatar name={c.contactName} />}
                title={c.contactName}
                subtitle={formatPhone(c.phone)}
                divider={i < shownInvites.length - 1}
                trailing={<Button title="Invite" size="sm" variant="secondary" onPress={() => invite(c.phone)} />}
              />
            ))}
          </ListCard>
          {shownInvites.length < invites.length ? (
            <Button
              title={`Show all ${invites.length}`}
              variant="ghost"
              onPress={() => setShowAllInvites(true)}
              style={{ marginTop: t.spacing.sm }}
            />
          ) : null}
        </>
      ) : null}

      {data.permission === 'demo' || data.demoSeeded ? (
        <Text variant="caption" tone="tertiary" align="center" style={{ marginTop: t.spacing.xl }}>
          {data.permission === 'demo'
            ? 'Demo: these are sample contacts.'
            : 'Demo mode: a few of your contacts are shown as members so you can try this.'}
        </Text>
      ) : null}
    </Screen>
  );
};

const PrivacyPoint: React.FC<{ icon: string; text: string }> = ({ icon, text }) => {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
      <Icon name={icon} size={20} color={t.colors.textSecondary} style={{ marginTop: 1 }} />
      <Text tone="secondary" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
};

export default FindFriendsScreen;
