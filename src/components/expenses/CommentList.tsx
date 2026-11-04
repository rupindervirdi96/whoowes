import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme';
import { useT } from '../../i18n';
import type { ExpenseChange, ExpenseComment } from '../../types';
import { formatShortDate, timeAgo } from '../../utils/date';
import { formatCurrency } from '../../utils/currency';
import { categoryLabel } from '../../constants';
import Text from '../ui/Text';
import Avatar from '../ui/Avatar';
import Icon from '../ui/Icon';

interface CommentListProps {
  comments: ExpenseComment[];
  myId: string;
  /** Long-press on one of my comments. */
  onDelete: (comment: ExpenseComment) => void;
}

/** One line per change: "Amount: $60.00 → $72.00". */
function changeLine(c: ExpenseChange, myId: string, tr: ReturnType<typeof useT>['t']): string {
  const arrow = (label: string, from: string, to: string) => `${label}: ${from} → ${to}`;
  switch (c.field) {
    case 'title':
      return arrow(tr('history.title'), `“${c.from}”`, `“${c.to}”`);
    case 'amount':
      return arrow(tr('history.amount'), formatCurrency(c.from, c.currency), formatCurrency(c.to, c.currency));
    case 'currency':
      return arrow(tr('history.currency'), c.from, c.to);
    case 'category':
      return arrow(tr('history.category'), categoryLabel(c.from), categoryLabel(c.to));
    case 'date':
      return arrow(tr('history.date'), formatShortDate(c.from), formatShortDate(c.to));
    case 'paidBy': {
      const who = (u: { id: string; name: string }) => (u.id === myId ? tr('common.you') : u.name);
      return arrow(tr('history.paidBy'), who(c.from), who(c.to));
    }
    case 'group':
      return arrow(tr('history.group'), c.from ?? tr('history.noGroup'), c.to ?? tr('history.noGroup'));
    case 'split':
      return tr('history.split');
    case 'note':
      return tr('history.note');
  }
}

/** "Alex edited this expense", with what changed, between the comments. */
const EditNote: React.FC<{ note: ExpenseComment; myId: string }> = ({ note, myId }) => {
  const t = useTheme();
  const { t: tr } = useT();
  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 8 }}>
      <View style={{ width: 32, alignItems: 'center', paddingTop: 2 }}>
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: t.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="edit" size={14} color={t.colors.textSecondary} />
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="caption" tone="secondary">
          {note.userId === myId ? tr('history.youEdited') : tr('history.edited', { name: note.user.name })}
          <Text variant="caption" tone="tertiary">{`  ${timeAgo(note.createdAt)}`}</Text>
        </Text>
        {note.edit!.map((c, i) => (
          <Text key={i} variant="caption" tone="tertiary" style={{ marginTop: 2 }}>
            {changeLine(c, myId, tr)}
          </Text>
        ))}
      </View>
    </View>
  );
};

/** The conversation under an expense, oldest first, with edit notes in between. My own comments can be deleted with a long press. */
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
        if (cm.edit) return <EditNote key={cm.id} note={cm} myId={myId} />;
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
