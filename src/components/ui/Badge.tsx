/**
 * Badge component — status chips and count indicators.
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Typography, BorderRadius, Spacing } from '../../theme';

type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

const VARIANTS: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: Colors.successLight, text: Colors.success },
  danger: { bg: Colors.dangerLight, text: Colors.danger },
  warning: { bg: Colors.warningLight, text: Colors.warning },
  info: { bg: Colors.infoLight, text: Colors.info },
  neutral: { bg: Colors.gray100, text: Colors.gray600 },
};

const Badge: React.FC<BadgeProps> = ({ label, variant = 'neutral', style }) => {
  const { bg, text } = VARIANTS[variant];
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[styles.label, { color: text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    textTransform: 'capitalize',
  },
});

export default Badge;
