/**
 * Card component.
 * Consistent card surface with optional header, padding control, and press state.
 */

import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TouchableOpacityProps,
} from 'react-native';
import { Colors, BorderRadius, Spacing, Shadows } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: keyof typeof Spacing | number;
  shadow?: keyof typeof Shadows;
  onPress?: TouchableOpacityProps['onPress'];
}

const Card: React.FC<CardProps> = ({
  children,
  style,
  padding = 'base',
  shadow = 'base',
  onPress,
}) => {
  const paddingValue = typeof padding === 'number' ? padding : Spacing[padding];
  const shadowStyle = Shadows[shadow];

  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.card, shadowStyle, { padding: paddingValue }, style]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.card, shadowStyle, { padding: paddingValue }, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
});

export default Card;
