import React, { forwardRef, useState } from 'react';
import { Pressable, TextInput, TextInputProps, View, StyleProp, ViewStyle, type TextInputInstance } from 'react-native';
import { useTheme } from '../../theme';
import Text from './Text';
import Icon from './Icon';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  icon?: string;
  right?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

const Input = forwardRef<TextInputInstance, InputProps>(
  ({ label, error, hint, icon, right, secureTextEntry, containerStyle, style, multiline, ...rest }, ref) => {
    const t = useTheme();
    const [focused, setFocused] = useState(false);
    const [hidden, setHidden] = useState(!!secureTextEntry);
    const borderColor = error ? t.colors.negative : focused ? t.colors.primary : t.colors.border;

    return (
      <View style={[{ marginBottom: t.spacing.base }, containerStyle]}>
        {label ? (
          <Text variant="label" tone="secondary" style={{ marginBottom: 6 }}>
            {label}
          </Text>
        ) : null}
        <View
          style={{
            flexDirection: 'row',
            alignItems: multiline ? 'flex-start' : 'center',
            minHeight: multiline ? 96 : 52,
            borderRadius: t.radius.md,
            borderWidth: 1.5,
            borderColor,
            backgroundColor: t.colors.surface,
            paddingHorizontal: 14,
            gap: 10,
          }}
        >
          {icon ? (
            <Icon name={icon} size={20} color={focused ? t.colors.primary : t.colors.textTertiary} style={multiline ? { marginTop: 14 } : undefined} />
          ) : null}
          <TextInput
            ref={ref}
            placeholderTextColor={t.colors.textTertiary}
            selectionColor={t.colors.primary}
            secureTextEntry={hidden}
            multiline={multiline}
            onFocus={(e) => {
              setFocused(true);
              rest.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              rest.onBlur?.(e);
            }}
            style={[
              {
                flex: 1,
                fontFamily: t.fonts.medium,
                fontSize: 16,
                color: t.colors.text,
                paddingVertical: multiline ? 14 : 10,
                textAlignVertical: multiline ? 'top' : 'center',
              },
              style,
            ]}
            {...rest}
          />
          {secureTextEntry ? (
            <Pressable
              onPress={() => setHidden((h) => !h)}
              hitSlop={10}
              accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            >
              <Icon name={hidden ? 'visibility-off' : 'visibility'} size={20} color={t.colors.textTertiary} />
            </Pressable>
          ) : (
            right
          )}
        </View>
        {error || hint ? (
          <Text variant="caption" tone={error ? 'negative' : 'tertiary'} style={{ marginTop: 6 }}>
            {error ?? hint}
          </Text>
        ) : null}
      </View>
    );
  },
);

Input.displayName = 'Input';

export default Input;
