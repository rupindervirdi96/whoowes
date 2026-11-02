import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { useT } from '../../i18n';
import type { Friend } from '../../types';
import type { FriendRowData } from '../../hooks/useFriendInsights';
import { useFriendActions } from '../../hooks/useFriendActions';
import { ageLabel } from '../../utils/friendInsights';
import BalanceAmounts from '../BalanceAmounts';
import Avatar from '../ui/Avatar';
import Icon from '../ui/Icon';
import ListRow from '../ui/ListRow';
import SwipeRow, { type SwipeAction } from '../ui/SwipeRow';
import Text from '../ui/Text';

/** Pin and private nickname, after a friend's name. */
export const FriendNameTags: React.FC<{ friend: Friend }> = ({ friend }) => {
  const t = useTheme();
  if (!friend.pinned && !friend.nickname) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0, maxWidth: '55%' }}>
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
function useStatusLine(row: FriendRowData) {
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
}

/** One friend: swipe right to add an expense, left to remind / settle up / pin. */
const FriendListRow: React.FC<Props> = ({ row, divider, open, onOpenChange, onLongPress, onSwiped }) => {
  const t = useTheme();
  const { t: tr } = useT();
  const actions = useFriendActions();
  const f = row.friend;
  const subtitle = useStatusLine(row);

  const left: SwipeAction[] = [
    { key: 'add', label: tr('friends.action.addExpense'), icon: 'add', color: t.colors.primary, onPress: () => actions.addExpense(f.friendId) },
  ];
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
      onPress: () => actions.togglePin(f),
    },
  ];

  return (
    <SwipeRow
      left={left}
      right={right}
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) onSwiped();
      }}
    >
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
