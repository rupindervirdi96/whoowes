/**
 * TextInput component.
 * Controlled input with label, error state, helper text, left/right icons.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput as RNTextInput,
  TextInputProps,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, Typography, Spacing } from '../../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  required?: boolean;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  required,
  secureTextEntry,
  style,
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isSecure, setIsSecure] = useState(secureTextEntry ?? false);

  const borderColor = error
    ? Colors.danger
    : isFocused
    ? Colors.primary
    : Colors.border;

  return (
    <View style={styles.container}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      <View style={[styles.inputRow, { borderColor }]}>
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <RNTextInput
          style={[styles.input, leftIcon ? styles.inputWithLeft : null, style]}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isSecure}
          placeholderTextColor={Colors.gray400}
          {...rest}
        />
        {/* Password toggle */}
        {secureTextEntry && (
          <TouchableOpacity
            style={styles.rightIcon}
            onPress={() => setIsSecure((prev) => !prev)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons
              name={isSecure ? 'visibility-off' : 'visibility'}
              size={20}
              color={Colors.gray400}
            />
          </TouchableOpacity>
        )}
        {/* Custom right icon (not shown when secureTextEntry is active) */}
        {!secureTextEntry && rightIcon && (
          <View style={styles.rightIcon}>{rightIcon}</View>
        )}
      </View>
      {(error || helperText) && (
        <Text style={error ? styles.errorText : styles.helperText}>
          {error ?? helperText}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.base },
  label: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  required: { color: Colors.danger },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: BorderRadius.base,
    backgroundColor: Colors.surface,
    minHeight: 48,
  },
  input: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.base,
    color: Colors.textPrimary,
  },
  inputWithLeft: { paddingLeft: 4 },
  leftIcon: {
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
  },
  rightIcon: {
    paddingRight: Spacing.md,
    paddingLeft: Spacing.xs,
  },
  errorText: {
    marginTop: 4,
    fontSize: Typography.xs,
    color: Colors.danger,
  },
  helperText: {
    marginTop: 4,
    fontSize: Typography.xs,
    color: Colors.textTertiary,
  },
});

export default Input;
