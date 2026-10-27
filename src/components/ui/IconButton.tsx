import React from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import Icon from './Icon';
import Text from './Text';

interface IconButtonProps {
  icon: string;
  onPress?: () => void;
  variant?: 'surface' | 'soft' | 'primary' | 'ghost' | 'hero';
  size?: number;
  badge?: number;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  variant = 'surface',
  size = 44,
  badge,
  accessibilityLabel,
  style,
}) => {
  const t = useTheme();
  const c = t.colors;
  const map = {
    surface: { bg: c.surface, fg: c.text, border: c.border },
    soft: { bg: c.primarySoft, fg: c.primary, border: 'transparent' },
    primary: { bg: c.primary, fg: c.textOnPrimary, border: 'transparent' },
    ghost: { bg: 'transparent', fg: c.text, border: 'transparent' },
    hero: { bg: 'rgba(255,255,255,0.16)', fg: '#FFFFFF', border: 'transparent' },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: map.bg,
          borderWidth: variant === 'surface' ? 1 : 0,
          borderColor: map.border,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} color={map.fg} />
      {badge ? (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: 9,
            backgroundColor: c.negative,
            borderWidth: 2,
            borderColor: c.background,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="caption" weight="bold" color="#FFFFFF" style={{ fontSize: 10, lineHeight: 12 }}>
            {badge > 9 ? '9+' : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
};

export default IconButton;
