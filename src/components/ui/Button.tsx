/**
 * Button component.
 * Supports primary, secondary, outline, ghost, danger variants.
 * Handles loading state, disabled state, icon support.
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
  TouchableOpacityProps,
} from 'react-native';
import { Colors, BorderRadius, Typography, Spacing } from '../../theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  style,
  ...rest
}) => {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[`size_${size}`],
        styles[`variant_${variant}`],
        isDisabled && styles.disabled,
        fullWidth && styles.fullWidth,
        style,
      ]}
      disabled={isDisabled}
      activeOpacity={0.75}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? Colors.primary : Colors.white}
        />
      ) : (
        <View style={styles.content}>
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
          <Text style={[styles.label, styles[`label_${variant}`], styles[`labelSize_${size}`]]}>
            {title}
          </Text>
          {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.base,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: { marginRight: Spacing.sm },
  iconRight: { marginLeft: Spacing.sm },

  // Sizes
  size_sm: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  size_md: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  size_lg: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.base + 2 },

  // Variants
  variant_primary: { backgroundColor: Colors.primary },
  variant_secondary: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  variant_outline: { backgroundColor: 'transparent', borderWidth: 2, borderColor: Colors.primary },
  variant_ghost: { backgroundColor: 'transparent' },
  variant_danger: { backgroundColor: Colors.danger },

  // Disabled
  disabled: { opacity: 0.5 },

  // Labels
  label: { fontWeight: Typography.semibold },
  label_primary: { color: Colors.white },
  label_secondary: { color: Colors.textPrimary },
  label_outline: { color: Colors.primary },
  label_ghost: { color: Colors.primary },
  label_danger: { color: Colors.white },
  labelSize_sm: { fontSize: Typography.sm },
  labelSize_md: { fontSize: Typography.base },
  labelSize_lg: { fontSize: Typography.md },
});

export default Button;
