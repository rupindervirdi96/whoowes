import { useNavigation } from '@react-navigation/native';
import type { Friend } from '../types';
import { REMIND_COOLDOWN_MS } from '../constants';
import { translate } from '../i18n';
import { useShowToast } from '../store/uiStore';
import { timeAgo } from '../utils/date';
import { firstName } from '../utils/money';
import type { FriendRowData } from './useFriendInsights';
import { useRemind, useUpdateFriend } from './useFriends';

/** Reminded within the last 12 hours, so another one would be refused. */
export function remindedRecently(f: Pick<Friend, 'lastRemindedAt'>, now = Date.now()) {
  return !!f.lastRemindedAt && now - new Date(f.lastRemindedAt).getTime() < REMIND_COOLDOWN_MS;
}

/**
 * The quick actions on a friend, shared by swipe, press-and-hold and the friend page,
 * so each one behaves the same everywhere.
 */
export function useFriendActions() {
  const navigation = useNavigation();
  const showToast = useShowToast();
  const remind = useRemind();
  const update = useUpdateFriend();

  return {
    remindPending: remind.isPending,

    open: (friendId: string) => navigation.navigate('FriendDetail', { friendId }),

    addExpense: (friendId: string) => navigation.navigate('ManualExpense', { friendId }),

    /** They owe me something (in any currency). */
    canRemind: (row: FriendRowData) => row.amounts.some((a) => a.amount > 0),
    /** I owe them something (in any currency). */
    canSettle: (row: FriendRowData) => row.amounts.some((a) => a.amount < 0),

    remind: (row: FriendRowData) => {
      const f = row.friend;
      const name = firstName(f.friendUser.name);
      if (remindedRecently(f)) {
        showToast(translate('friends.remindedRecently', { name, when: timeAgo(f.lastRemindedAt!) }), 'info');
        return;
      }
      const owed = row.amounts.find((a) => a.amount > 0);
      remind.mutate({ userId: f.friendId, name: f.friendUser.name, amount: owed?.amount, currency: owed?.currency });
    },

    settle: (row: FriendRowData) => {
      const owe = row.amounts.find((a) => a.amount < 0);
      if (!owe) return;
      navigation.navigate('SettleUp', { userId: row.friend.friendId, amount: -owe.amount, currency: owe.currency });
    },

    togglePin: (f: Friend) => update.mutate({ friendId: f.friendId, prefs: { pinned: !f.pinned } }),

    setNickname: (f: Friend, nickname: string | null) => update.mutate({ friendId: f.friendId, prefs: { nickname } }),
  };
}
