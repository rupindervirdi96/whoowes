import React, { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  type ScrollViewInstance,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';

interface ScreenProps {
  children: React.ReactNode;
  /** Scrollable content (default true). */
  scroll?: boolean;
  padded?: boolean;
  /** Safe-area edges. Screens under a native header only need bottom. */
  edges?: Edge[];
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Sticky footer (e.g. the primary action), kept above the keyboard. */
  footer?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  keyboard?: boolean;
  /** For screens that scroll themselves (e.g. down to new comments). */
  scrollRef?: React.Ref<ScrollViewInstance>;
}

/**
 * Android draws apps edge to edge, so the window no longer shrinks for the
 * keyboard. Screens that reach the bottom of the display get the keyboard's
 * height as bottom padding instead, so footers (and the comment box) stay above it.
 * React Native reports that height without the navigation bar, which the safe
 * area already pads for. Tab screens end at the tab bar and are left alone.
 */
function useAndroidKeyboardInset(enabled: boolean) {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android' || !enabled) return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setInset(Math.max(0, Math.round(e.endCoordinates.height))));
    const hide = Keyboard.addListener('keyboardDidHide', () => setInset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [enabled]);
  return inset;
}

const Screen: React.FC<ScreenProps> = ({
  children,
  scroll = true,
  padded = true,
  edges = ['bottom'],
  refreshing,
  onRefresh,
  footer,
  contentStyle,
  keyboard = true,
  scrollRef,
}) => {
  const t = useTheme();
  const keyboardInset = useAndroidKeyboardInset(keyboard && edges.includes('bottom'));
  const padding = padded ? { paddingHorizontal: t.spacing.gutter } : null;

  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={[{ flexGrow: 1, paddingTop: t.spacing.md, paddingBottom: t.spacing['4xl'] }, padding, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.colors.primary} colors={[t.colors.primary]} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, paddingTop: t.spacing.sm }, padding, contentStyle]}>{children}</View>
  );

  const inner = (
    <>
      {body}
      {footer ? (
        <View
          style={{
            paddingHorizontal: t.spacing.gutter,
            paddingTop: t.spacing.md,
            paddingBottom: t.spacing.sm,
            borderTopWidth: 1,
            borderTopColor: t.colors.border,
            backgroundColor: t.colors.background,
          }}
        >
          {footer}
        </View>
      ) : null}
    </>
  );

  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: t.colors.background }}>
      {keyboard && Platform.OS === 'android' ? (
        <View style={{ flex: 1, paddingBottom: keyboardInset }}>
          {inner}
        </View>
      ) : keyboard ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={64}>
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
};

export default Screen;
