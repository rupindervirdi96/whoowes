import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Modal, Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import Text from './Text';
import { translate } from '../../i18n';

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
  const { height: windowHeight } = useWindowDimensions();
  const keyboard = useKeyboardHeight(visible);

  useEffect(() => {
    if (visible) {
      // Close the screen's keyboard first, or it covers the sheet.
      Keyboard.dismiss();
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
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel={translate('common.close')} />
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          // Sit on top of the keyboard, so a search field inside stays visible.
          bottom: keyboard,
          maxHeight: keyboard ? windowHeight - keyboard - insets.top - 12 : '88%',
          backgroundColor: t.colors.surface,
          borderTopLeftRadius: t.radius['2xl'],
          borderTopRightRadius: t.radius['2xl'],
          paddingHorizontal: t.spacing.lg,
          paddingBottom: (keyboard ? 0 : insets.bottom) + t.spacing.base,
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

/** Keyboard height while the sheet is open (0 when hidden). */
function useKeyboardHeight(active: boolean) {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (!active || Platform.OS === 'web') return;
    // iOS reports "will" events, so the sheet moves with the keyboard; Android only "did".
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvt, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
      setHeight(0);
    };
  }, [active]);
  return height;
}

export default BottomSheet;
