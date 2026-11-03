import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useTheme } from '../../theme';
import { useT } from '../../i18n';
import IconButton from '../ui/IconButton';

const MAX = 500;

interface CommentComposerProps {
  /** Called with the trimmed text; the box clears straight away. Call `restore` if sending fails, to put the text back. */
  onSend: (text: string, restore: () => void) => void;
}

/** The "Add a comment" box pinned to the bottom of an expense. */
const CommentComposer: React.FC<CommentComposerProps> = ({ onSend }) => {
  const t = useTheme();
  const c = t.colors;
  const { t: tr } = useT();
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const trimmed = text.trim();

  const send = () => {
    if (!trimmed) return;
    const sent = text;
    setText('');
    onSend(trimmed, () => setText((now) => (now ? now : sent)));
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={tr('comments.placeholder')}
        placeholderTextColor={c.textTertiary}
        selectionColor={c.primary}
        multiline
        maxLength={MAX}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={tr('comments.placeholder')}
        style={{
          flex: 1,
          minHeight: 44,
          maxHeight: 112,
          paddingHorizontal: 16,
          paddingTop: 11,
          paddingBottom: 11,
          borderRadius: 22,
          borderWidth: 1.5,
          borderColor: focused ? c.primary : c.border,
          backgroundColor: c.surface,
          color: c.text,
          fontSize: 16,
          lineHeight: 20,
          textAlignVertical: 'center',
        }}
      />
      <IconButton
        icon="send"
        variant={trimmed ? 'primary' : 'soft'}
        size={44}
        accessibilityLabel={tr('comments.send')}
        onPress={trimmed ? send : undefined}
      />
    </View>
  );
};

export default CommentComposer;
