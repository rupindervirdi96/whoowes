import React, { useRef } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { useT } from '../../i18n';
import type { FriendRowData } from '../../hooks/useFriendInsights';
import { remindedRecently, useFriendActions } from '../../hooks/useFriendActions';
import { timeAgo } from '../../utils/date';
import BottomSheet from '../ui/BottomSheet';
import Icon from '../ui/Icon';
import ListRow from '../ui/ListRow';

interface Props {
  row: FriendRowData | null;
  onClose: () => void;
  onEditNickname: (row: FriendRowData) => void;
}

/** Everything you can do with a friend, from press-and-hold on their row. */
const FriendActionsSheet: React.FC<Props> = ({ row: current, onClose, onEditNickname }) => {
  const t = useTheme();
  const { t: tr } = useT();
  const actions = useFriendActions();
  // Keep showing the last friend while the sheet slides away.
  const last = useRef(current);
  if (current) last.current = current;
  const row = last.current;
  const f = row?.friend;

  const icon = (name: string, color = t.colors.primary) => (
    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={18} color={color} />
    </View>
  );

  // Close first, then act, so a new screen doesn't open under the sheet.
  const then = (fn: () => void) => () => {
    onClose();
    fn();
  };

  const items =
    row && f
      ? [
          { key: 'add', title: tr('friends.action.addExpense'), leading: icon('add'), onPress: then(() => actions.addExpense(f.friendId)) },
          ...(actions.canRemind(row)
            ? [
                {
                  key: 'remind',
                  title: tr('friends.action.remind'),
                  subtitle: f.lastRemindedAt ? tr('friend.lastReminded', { when: timeAgo(f.lastRemindedAt) }) : undefined,
                  leading: icon('notifications-active', remindedRecently(f) ? t.colors.textTertiary : t.colors.warning),
                  onPress: then(() => actions.remind(row)),
                },
              ]
            : []),
          ...(actions.canSettle(row)
            ? [{ key: 'settle', title: tr('friends.action.settle'), leading: icon('swap-horiz', t.colors.positive), onPress: then(() => actions.settle(row)) }]
            : []),
          {
            key: 'pin',
            title: f.pinned ? tr('friends.action.unpin') : tr('friends.action.pin'),
            leading: icon('push-pin', t.colors.textSecondary),
            onPress: then(() => actions.togglePin(f)),
          },
          {
            key: 'nickname',
            title: f.nickname ? tr('friends.action.editNickname') : tr('friends.action.addNickname'),
            subtitle: f.nickname,
            leading: icon('sell', t.colors.textSecondary),
            onPress: then(() => onEditNickname(row)),
          },
        ]
      : [];

  return (
    <BottomSheet visible={!!current} onClose={onClose} title={f?.friendUser.name} subtitle={f?.nickname}>
      <View>
        {items.map(({ key, ...it }, i) => (
          <ListRow key={key} {...it} divider={i < items.length - 1} chevron />
        ))}
      </View>
    </BottomSheet>
  );
};

export default FriendActionsSheet;
