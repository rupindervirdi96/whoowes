import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme';
import { useT } from '../../i18n';
import type { ExpenseComment } from '../../types';
import { timeAgo } from '../../utils/date';
import Text from '../ui/Text';
import Avatar from '../ui/Avatar';
import Icon from '../ui/Icon';

interface CommentListProps {
  comments: ExpenseComment[];
  myId: string;
  /** Long-press on one of my comments. */
  onDelete: (comment: ExpenseComment) => void;
}

/** The conversation under an expense, oldest first. My own comments can be deleted with a long press. */
const CommentList: React.FC<CommentListProps> = ({ comments, myId, onDelete }) => {
  const t = useTheme();
  const c = t.colors;
  const { t: tr } = useT();

  if (comments.length === 0) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 }}>
        <Icon name="chat-bubble-outline" size={18} color={c.textTertiary} />
        <Text variant="caption" tone="tertiary" style={{ flex: 1 }}>
          {tr('comments.empty')}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ paddingVertical: 6 }}>
      {comments.map((cm) => {
        const mine = cm.userId === myId;
        return (
          <Pressable
            key={cm.id}
            disabled={!mine || cm.sending}
            onLongPress={() => onDelete(cm)}
            delayLongPress={350}
            accessibilityHint={mine ? tr('comments.deleteHint') : undefined}
            style={({ pressed }) => ({ flexDirection: 'row', gap: 10, paddingVertical: 8, opacity: cm.sending ? 0.55 : pressed ? 0.7 : 1 })}
          >
            <Avatar name={cm.user.name} uri={cm.user.avatarUrl} size="sm" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Text variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {mine ? tr('common.you') : cm.user.name}
                </Text>
                <Text variant="caption" tone="tertiary">
                  {cm.sending ? tr('comments.sending') : timeAgo(cm.createdAt)}
                </Text>
              </View>
              <View
                style={{
                  alignSelf: 'flex-start',
                  marginTop: 4,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 14,
                  borderTopLeftRadius: 4,
                  backgroundColor: mine ? c.primarySoft : c.surfaceAlt,
                  maxWidth: '100%',
                }}
              >
                <Text selectable>{cm.text}</Text>
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
};

export default CommentList;
