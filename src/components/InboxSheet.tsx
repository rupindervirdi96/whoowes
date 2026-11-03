import React from 'react';
import { ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useT } from '../i18n';
import { useInbox } from '../hooks/useInbox';
import { useAcceptFriendRequest, useDismissReminder } from '../hooks/useFriends';
import { useMyCurrency } from '../hooks/useCurrency';
import { formatCurrency } from '../utils/currency';
import { firstName } from '../utils/money';
import BottomSheet from './ui/BottomSheet';
import ListRow from './ui/ListRow';
import Avatar from './ui/Avatar';
import Button from './ui/Button';
import IconButton from './ui/IconButton';
import Icon from './ui/Icon';
import Text from './ui/Text';

interface InboxSheetProps {
  visible: boolean;
  onClose: () => void;
}

/** Opened from the bell on the home screen: everything waiting on me, in one place. */
const InboxSheet: React.FC<InboxSheetProps> = ({ visible, onClose }) => {
  const t = useTheme();
  const { t: tr } = useT();
  const navigation = useNavigation();
  const myCurrency = useMyCurrency();
  const { pending, reminders, incoming, newOnWhoOwes, contactsRow, rows } = useInbox();
  const accept = useAcceptFriendRequest();
  const dismissReminder = useDismissReminder();

  // Close first, then go, so the next screen doesn't open under the sheet.
  const go = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={tr('home.inbox.title')}>
      {rows === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: t.spacing.xl, gap: 6 }}>
          <Text style={{ fontSize: 36, lineHeight: 44 }}>✨</Text>
          <Text variant="bodyStrong">{tr('home.inbox.empty.title')}</Text>
          <Text variant="caption" tone="tertiary" align="center">
            {tr('home.inbox.empty.body')}
          </Text>
        </View>
      ) : (
        <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false}>
          {pending.map((s, i) => (
            <ListRow
              key={s.id}
              leading={<Avatar name={s.fromUser.name} />}
              title={tr('home.paidYouAmount', { name: firstName(s.fromUser.name), amount: formatCurrency(s.amount, s.currency) })}
              subtitle={tr('home.confirmYouGotIt')}
              chevron
              divider={i < rows - 1}
              onPress={go(() => navigation.navigate('SettlementDetail', { settlementId: s.id }))}
            />
          ))}
          {reminders.map((r, i) => (
            <ListRow
              key={r.id}
              leading={<Avatar name={r.fromUser.name} uri={r.fromUser.avatarUrl} />}
              title={tr('home.sentReminder', { name: firstName(r.fromUser.name) })}
              subtitle={r.amount ? tr('home.about', { amount: formatCurrency(r.amount, r.currency ?? myCurrency) }) : tr('home.settleWhenYouCan')}
              divider={pending.length + i < rows - 1}
              trailing={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <IconButton icon="close" variant="ghost" size={36} accessibilityLabel={tr('home.dismissReminder')} onPress={() => dismissReminder.mutate(r.id)} />
                  <Button title={tr('home.settle')} size="sm" onPress={go(() => navigation.navigate('SettleUp', { userId: r.fromUser.id, currency: r.currency }))} />
                </View>
              }
            />
          ))}
          {incoming.map((r, i) => (
            <ListRow
              key={r.id}
              leading={<Avatar name={r.friendUser.name} />}
              title={firstName(r.friendUser.name)}
              subtitle={tr('friends.wantsToBeFriends')}
              divider={pending.length + reminders.length + i < rows - 1}
              trailing={<Button title={tr('common.accept')} size="sm" onPress={() => accept.mutate(r.id)} loading={accept.isPending && accept.variables === r.id} />}
            />
          ))}
          {contactsRow ? (
            <ListRow
              leading={
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="contacts" size={20} color={t.colors.primary} />
                </View>
              }
              title={
                newOnWhoOwes.length === 0
                  ? tr('home.findFromContacts')
                  : newOnWhoOwes.length === 1
                    ? tr('home.contactOnWhoOwes', { name: firstName(newOnWhoOwes[0].contactName) })
                    : tr('home.contactsOnWhoOwes', { count: newOnWhoOwes.length })
              }
              subtitle={newOnWhoOwes.length === 0 ? tr('home.seeWhosHere') : tr('home.addThemAsFriends')}
              chevron
              onPress={go(() => navigation.navigate('FindFriends'))}
            />
          ) : null}
        </ScrollView>
      )}
    </BottomSheet>
  );
};

export default InboxSheet;
