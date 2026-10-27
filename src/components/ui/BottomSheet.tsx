import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import Text from './Text';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}

/** Simple modal bottom sheet with a slide-up animation and a grab handle. */
const BottomSheet: React.FC<BottomSheetProps> = ({ visible, onClose, title, subtitle, children }) => {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [visible, anim]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={{ flex: 1, backgroundColor: t.colors.overlay, opacity: anim }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: '88%',
          backgroundColor: t.colors.surface,
          borderTopLeftRadius: t.radius['2xl'],
          borderTopRightRadius: t.radius['2xl'],
          paddingHorizontal: t.spacing.lg,
          paddingBottom: insets.bottom + t.spacing.base,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] }) }],
        }}
      >
        <View
          style={{
            alignSelf: 'center',
            width: 40,
            height: 5,
            borderRadius: 3,
            backgroundColor: t.colors.borderStrong,
            marginTop: 10,
            marginBottom: 14,
          }}
        />
        {title ? (
          <View style={{ marginBottom: t.spacing.base }}>
            <Text variant="h2">{title}</Text>
            {subtitle ? (
              <Text tone="secondary" style={{ marginTop: 4 }}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        ) : null}
        {children}
      </Animated.View>
    </Modal>
  );
};

export default BottomSheet;
