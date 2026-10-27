import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUIStore } from '../../store/uiStore';
import { ToastMessage } from '../../types';
import { useTheme } from '../../theme';
import Text from './Text';
import Icon from './Icon';

const ICONS = { success: 'check-circle', error: 'error', warning: 'warning', info: 'info' } as const;

const ToastItem: React.FC<{ toast: ToastMessage }> = ({ toast }) => {
  const t = useTheme();
  const dismiss = useUIStore((s) => s.dismissToast);
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, damping: 16, stiffness: 180 }).start();
  }, [anim]);

  const tint = {
    success: t.colors.positive,
    error: t.colors.negative,
    warning: t.colors.warning,
    info: t.colors.primary,
  }[toast.type];

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
      }}
    >
      <Pressable
        onPress={() => dismiss(toast.id)}
        accessibilityRole="alert"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: t.radius.md,
          backgroundColor: t.isDark ? t.colors.surfaceRaised : '#16132D',
          borderWidth: t.isDark ? 1 : 0,
          borderColor: t.colors.border,
          ...(t.elevation(3) as object),
        }}
      >
        <Icon name={ICONS[toast.type]} size={20} color={tint} />
        <Text variant="label" color="#FFFFFF" style={{ flex: 1 }} numberOfLines={3}>
          {toast.message}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

const ToastContainer: React.FC = () => {
  const insets = useSafeAreaInsets();
  const toasts = useUIStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, zIndex: 9999, gap: 8 }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </View>
  );
};

export default ToastContainer;
