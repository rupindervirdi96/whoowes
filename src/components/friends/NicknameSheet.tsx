import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { useT, type TKey } from '../../i18n';
import type { Friend } from '../../types';
import { firstName } from '../../utils/money';
import BottomSheet from '../ui/BottomSheet';
import Button from '../ui/Button';
import Chip from '../ui/Chip';
import Input from '../ui/Input';

const SUGGESTIONS: TKey[] = ['nickname.suggest.roommate', 'nickname.suggest.partner', 'nickname.suggest.family', 'nickname.suggest.work'];
const MAX = 30;

interface Props {
  friend: Friend | null;
  onClose: () => void;
  onSave: (friend: Friend, nickname: string | null) => void;
}

/** A private label for a friend ("Roommate"). Only the person who sets it sees it. */
const NicknameSheet: React.FC<Props> = ({ friend: current, onClose, onSave }) => {
  const t = useTheme();
  const { t: tr } = useT();
  const [value, setValue] = useState('');
  // Keep showing the last friend while the sheet slides away.
  const last = useRef(current);
  if (current) last.current = current;
  const friend = last.current;

  useEffect(() => {
    if (current) setValue(current.nickname ?? '');
  }, [current]);

  const save = (next: string | null) => {
    if (!friend) return;
    const clean = next?.trim() || null;
    if (clean !== (friend.nickname ?? null)) onSave(friend, clean);
    onClose();
  };

  return (
    <BottomSheet
      visible={!!current}
      onClose={onClose}
      title={friend ? tr('nickname.title', { name: firstName(friend.friendUser.name) }) : undefined}
      subtitle={tr('nickname.hint')}
    >
      <Input
        value={value}
        onChangeText={(v) => setValue(v.slice(0, MAX))}
        placeholder={tr('nickname.placeholder')}
        icon="sell"
        maxLength={MAX}
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={() => save(value)}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: t.spacing.md }}>
        {SUGGESTIONS.map((key) => {
          const label = tr(key);
          return <Chip key={key} label={label} selected={value.trim() === label} onPress={() => setValue(label)} />;
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: t.spacing.xl }}>
        {friend?.nickname ? (
          <Button title={tr('nickname.remove')} variant="ghost" style={{ flex: 1 }} onPress={() => save(null)} />
        ) : null}
        <Button title={tr('common.save')} style={{ flex: 1 }} onPress={() => save(value)} />
      </View>
    </BottomSheet>
  );
};

export default NicknameSheet;
