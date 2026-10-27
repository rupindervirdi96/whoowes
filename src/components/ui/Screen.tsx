import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
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
}) => {
  const t = useTheme();
  const padding = padded ? { paddingHorizontal: t.spacing.gutter } : null;

  const body = scroll ? (
    <ScrollView
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
      {keyboard ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        >
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
};

export default Screen;
