import React from 'react';
import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { useT } from '../../i18n';
import { EXPENSE_REACTIONS, type ExpenseReaction, type ExpenseReactionEmoji } from '../../types';
import { firstName } from '../../utils/money';
import Text from '../ui/Text';

interface ReactionBarProps {
  reactions: ExpenseReaction[];
  myId: string;
  onReact: (emoji: ExpenseReactionEmoji | null) => void;
}

/**
 * One reaction each: tap a face to react, tap yours again to take it back,
 * tap another to switch. Underneath: who reacted with what.
 */
const ReactionBar: React.FC<ReactionBarProps> = ({ reactions, myId, onReact }) => {
  const t = useTheme();
  const c = t.colors;
  const { t: tr } = useT();
  const mine = reactions.find((r) => r.userId === myId)?.emoji ?? null;
  const count = (emoji: ExpenseReactionEmoji) => reactions.filter((r) => r.emoji === emoji).length;

  // "You 👍 · Alex 😂 · Sam 😂": me first, then in the order they reacted.
  const who = [...reactions]
    .sort((a, b) => (a.userId === myId ? -1 : b.userId === myId ? 1 : 0))
    .map((r) => `${r.userId === myId ? tr('common.you') : firstName(r.user.name)} ${r.emoji}`)
    .join('  ·  ');

  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
        {EXPENSE_REACTIONS.map((emoji) => {
          const n = count(emoji);
          const selected = mine === emoji;
          return (
            <Pressable
              key={emoji}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={selected ? tr('reactions.remove', { emoji }) : tr('reactions.react', { emoji })}
              hitSlop={4}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onReact(selected ? null : emoji);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                height: 36,
                minWidth: 44,
                paddingHorizontal: n > 0 ? 10 : 8,
                justifyContent: 'center',
                borderRadius: 999,
                borderWidth: 1.5,
                borderColor: selected ? c.primary : n > 0 ? c.borderStrong : c.border,
                backgroundColor: selected ? c.primarySoft : c.surface,
                opacity: pressed ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.94 : 1 }],
              })}
            >
              <Text style={{ fontSize: 18, lineHeight: 22 }}>{emoji}</Text>
              {n > 0 ? (
                <Text variant="label" tabular color={selected ? c.primary : c.textSecondary}>
                  {n}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {who ? (
        <Text variant="caption" tone="tertiary" align="center" numberOfLines={2}>
          {who}
        </Text>
      ) : null}
    </View>
  );
};

export default ReactionBar;
