import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { useT } from '../../i18n';
import type { Friend } from '../../types';
import type { FriendRowData, PersonRowData } from '../../hooks/useFriendInsights';
import { useAddFriend } from '../../hooks/useFriends';
import { useFriendActions } from '../../hooks/useFriendActions';
import { ageLabel } from '../../utils/friendInsights';
import { firstName } from '../../utils/money';
import BalanceAmounts from '../BalanceAmounts';
import Avatar from '../ui/Avatar';
import IconButton from '../ui/IconButton';
import Icon from '../ui/Icon';
import ListRow from '../ui/ListRow';
import SwipeRow, { type SwipeAction, type SwipeTrigger } from '../ui/SwipeRow';
import Text from '../ui/Text';

/** Pin and private nickname, after a friend's name. */
export const FriendNameTags: React.FC<{ friend: Friend }> = ({ friend }) => {
  const t = useTheme();
  // Brought over from Splitwise, not on WhoOwes yet.
  const placeholder = !!friend.friendUser.placeholder;
  if (!friend.pinned && !friend.nickname && !placeholder) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0, maxWidth: '55%' }}>
      {placeholder ? <Icon name="person-outline" size={14} color={t.colors.textTertiary} /> : null}
      {friend.nickname ? (
        <View style={{ backgroundColor: t.colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, flexShrink: 1 }}>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {friend.nickname}
          </Text>
        </View>
      ) : null}
      {friend.pinned ? <Icon name="push-pin" size={14} color={t.colors.textTertiary} /> : null}
    </View>
  );
};

/** "Owes you · 6 weeks", "You owe", "Settled up". */
function useStatusLine(row: PersonRowData) {
  const { t: tr } = useT();
  const status = {
    settled: tr('common.settledUp'),
    owesYou: tr('friends.row.owesYou'),
    youOwe: tr('friends.row.youOwe'),
    mixed: tr('friends.row.bothWays'),
  }[row.direction];
  const age = row.since && row.direction !== 'mixed' ? ageLabel(row.since) : null;
  return age ? tr('friends.row.age', { status, age }) : status;
}

interface Props {
  row: FriendRowData;
  divider: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLongPress: () => void;
  onSwiped: () => void;
  /** Nudge this row once to show the swipe (first-time tip). */
  peek?: boolean;
}

/** One friend: swipe right to start an expense with them, left to remind / settle up / pin. */
const FriendListRow: React.FC<Props> = ({ row, divider, open, onOpenChange, onLongPress, onSwiped, peek }) => {
  const t = useTheme();
  const { t: tr } = useT();
  const actions = useFriendActions();
  const f = row.friend;
  const subtitle = useStatusLine(row);

  const name = firstName(f.friendUser.name);
  const trigger: SwipeTrigger = {
    icon: 'add-circle',
    color: t.colors.primary,
    textColor: t.colors.textOnPrimary,
    label: tr('friends.swipe.addWith', { name }),
    armedLabel: tr('friends.swipe.release', { name }),
    onTrigger: () => actions.addExpense(f.friendId),
  };
  const right: SwipeAction[] = [
    ...(actions.canRemind(row)
      ? [{ key: 'remind', label: tr('friends.action.remind'), icon: 'notifications-active', color: t.colors.warning, onPress: () => actions.remind(row) }]
      : []),
    ...(actions.canSettle(row)
      ? [{ key: 'settle', label: tr('friends.action.settle'), icon: 'swap-horiz', color: t.colors.positive, onPress: () => actions.settle(row) }]
      : []),
    {
      key: 'pin',
      label: f.pinned ? tr('friends.action.unpin') : tr('friends.action.pin'),
      icon: 'push-pin',
      color: t.colors.textSecondary,
      // Light grey in dark mode, so dark text reads better on it.
      textColor: t.isDark ? t.colors.background : '#FFFFFF',
      onPress: () => actions.togglePin(f),
    },
  ];

  return (
    <SwipeRow trigger={trigger} right={right} open={open} onOpenChange={onOpenChange} onSwipe={onSwiped} peek={peek}>
      <ListRow
        divider={divider}
        leading={<Avatar name={f.friendUser.name} uri={f.friendUser.avatarUrl} />}
        title={f.friendUser.name}
        titleAccessory={<FriendNameTags friend={f} />}
        subtitle={subtitle}
        subtitleTone={row.stale ? 'warning' : 'tertiary'}
        onPress={() => actions.open(f.friendId)}
        onLongPress={onLongPress}
        trailing={row.direction === 'settled' ? undefined : <BalanceAmounts amounts={row.amounts} />}
      />
    </SwipeRow>
  );
};

export default FriendListRow;

/**
 * Someone I have money open with through a group, who isn't my friend:
 * tap for their page, or add them as a friend right here.
 */
export const OtherPersonRow: React.FC<{ row: PersonRowData; divider: boolean; requested: boolean }> = ({ row, divider, requested }) => {
  const t = useTheme();
  const { t: tr } = useT();
  const actions = useFriendActions();
  const add = useAddFriend();
  const subtitle = useStatusLine(row);
  const sent = requested || add.isSuccess;
  return (
    <ListRow
      divider={divider}
      leading={<Avatar name={row.user.name} uri={row.user.avatarUrl} />}
      title={row.user.name}
      subtitle={subtitle}
      subtitleTone={row.stale ? 'warning' : 'tertiary'}
      onPress={() => actions.open(row.user.id)}
      trailing={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <BalanceAmounts amounts={row.amounts} />
          {row.user.placeholder ? null : (
            <IconButton
            icon={sent ? 'check' : 'person-add-alt'}
            variant="soft"
            shape="square"
            size={34}
            accessibilityLabel={sent ? tr('friend.requestSent') : tr('friends.addOther', { name: row.user.name })}
            onPress={sent || add.isPending ? undefined : () => add.mutate({ userId: row.user.id })}
            style={sent ? { backgroundColor: t.colors.surfaceAlt } : undefined}
            />
          )}
        </View>
      }
    />
  );
};
