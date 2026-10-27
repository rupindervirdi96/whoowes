import React from 'react';
import { ActivityIndicator, Pressable, PressableProps, StyleProp, View, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import Text from './Text';
import Icon from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent' | 'pro';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: string;
  iconRight?: string;
  fullWidth?: boolean;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SIZES: Record<ButtonSize, { height: number; px: number; icon: number; variant: 'label' | 'bodyStrong' | 'bodyLg' }> = {
  sm: { height: 36, px: 14, icon: 16, variant: 'label' },
  md: { height: 48, px: 18, icon: 18, variant: 'bodyStrong' },
  lg: { height: 56, px: 22, icon: 20, variant: 'bodyLg' },
};

const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  fullWidth,
  haptic,
  disabled,
  style,
  onPress,
  ...rest
}) => {
  const t = useTheme();
  const c = t.colors;
  const s = SIZES[size];
  const isDisabled = disabled || loading;

  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string; pressed: string }> = {
    primary: { bg: c.primary, fg: c.textOnPrimary, pressed: c.primaryPressed },
    secondary: { bg: c.surfaceAlt, fg: c.text, pressed: c.border },
    outline: { bg: 'transparent', fg: c.text, border: c.borderStrong, pressed: c.surfaceAlt },
    ghost: { bg: 'transparent', fg: c.primary, pressed: c.primarySoft },
    danger: { bg: c.negativeSoft, fg: c.negative, pressed: c.negativeSoft },
    accent: { bg: c.accent, fg: c.textOnAccent, pressed: c.accent },
    pro: { bg: c.pro, fg: t.isDark ? '#1A1405' : '#FFFFFF', pressed: c.pro },
  };
  const v = palette[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={(e) => {
        if (haptic || variant === 'primary' || variant === 'pro') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        onPress?.(e);
      }}
      style={({ pressed }) => [
        {
          height: s.height,
          paddingHorizontal: s.px,
          borderRadius: size === 'sm' ? t.radius.sm : t.radius.md,
          backgroundColor: pressed ? v.pressed : v.bg,
          borderWidth: v.border ? 1.5 : 0,
          borderColor: v.border,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          alignSelf: fullWidth ? 'stretch' : 'auto',
          opacity: isDisabled && !loading ? 0.45 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon ? <Icon name={icon} size={s.icon} color={v.fg} /> : null}
          <Text variant={s.variant} weight="bold" color={v.fg} numberOfLines={1}>
            {title}
          </Text>
          {iconRight ? <Icon name={iconRight} size={s.icon} color={v.fg} /> : null}
        </View>
      )}
    </Pressable>
  );
};

export default Button;
