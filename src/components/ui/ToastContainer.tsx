/**
 * Toast notification system.
 * Renders active toasts from UIStore at the top of the screen.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToasts, useUIStore } from '../../store/uiStore';
import { ToastMessage, ToastType } from '../../types';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';

const TOAST_CONFIG: Record<ToastType, { bg: string; icon: string; iconColor: string }> = {
  success: { bg: '#f0fdf4', icon: 'check-circle', iconColor: Colors.success },
  error:   { bg: '#fef2f2', icon: 'error',         iconColor: Colors.danger },
  warning: { bg: '#fffbeb', icon: 'warning',        iconColor: Colors.warning },
  info:    { bg: '#eff6ff', icon: 'info',           iconColor: Colors.primary },
};

const ToastItem: React.FC<{ toast: ToastMessage }> = ({ toast }) => {
  const dismiss = useUIStore((s) => s.dismissToast);
  const { bg, icon, iconColor } = TOAST_CONFIG[toast.type];

  return (
    <View style={[styles.toast, { backgroundColor: bg }, Shadows.md as ViewStyle]}>
      <MaterialIcons
        name={icon as keyof typeof MaterialIcons.glyphMap}
        size={20}
        color={iconColor}
        style={styles.icon}
      />
      <Text style={styles.message} numberOfLines={3}>
        {toast.message}
      </Text>
      <TouchableOpacity
        onPress={() => dismiss(toast.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <MaterialIcons name="close" size={18} color={Colors.gray400} />
      </TouchableOpacity>
    </View>
  );
};

const ToastContainer: React.FC = () => {
  const insets = useSafeAreaInsets();
  const toasts = useToasts();

  if (toasts.length === 0) return null;

  return (
    <View
      style={[
        styles.container,
        { top: insets.top + Spacing.sm },
      ]}
      pointerEvents="box-none"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.base,
    right: Spacing.base,
    zIndex: 9999,
    gap: Spacing.sm,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.base,
    gap: Spacing.sm,
  },
  icon: { flexShrink: 0 },
  message: {
    flex: 1,
    fontSize: Typography.sm,
    color: Colors.textPrimary,
    fontWeight: Typography.medium,
    lineHeight: 18,
  },
});

export default ToastContainer;
