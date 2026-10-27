import React from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  onPress?: () => void;
  variant?: 'surface' | 'alt' | 'outline';
  accessibilityLabel?: string;
}

/**
 * Rounded surface. Flat by design: white on the tinted page in light mode,
 * a hairline border in dark mode. No shadows, so lists read as calm blocks.
 */
const Card: React.FC<CardProps> = ({ children, style, padding = 18, onPress, variant = 'surface', accessibilityLabel }) => {
  const t = useTheme();
  const base: ViewStyle = {
    backgroundColor: variant === 'alt' ? t.colors.surfaceAlt : variant === 'outline' ? 'transparent' : t.colors.surface,
    borderRadius: 20,
    padding,
    borderWidth: variant === 'outline' || (t.isDark && variant === 'surface') ? 1 : 0,
    borderColor: t.colors.border,
  };
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [base, { opacity: pressed ? 0.85 : 1 }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
};

/** A card holding a list of rows: tighter vertical padding, rows supply their own. */
export const ListCard: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({ children, style }) => (
  <Card padding={0} style={[{ paddingHorizontal: 16, paddingVertical: 4 }, style]}>
    {children}
  </Card>
);

export default Card;
