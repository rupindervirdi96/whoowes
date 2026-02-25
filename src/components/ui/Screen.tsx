/**
 * Screen wrapper component.
 * Provides safe area, standard background, scroll support, and consistent padding.
 */

import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ViewStyle,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing } from '../../theme';

interface ScreenProps {
  children: React.ReactNode;
  scrollable?: boolean;
  padded?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  keyboardAvoid?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}

const Screen: React.FC<ScreenProps> = ({
  children,
  scrollable = false,
  padded = true,
  style,
  contentStyle,
  keyboardAvoid = false,
  refreshing,
  onRefresh,
}) => {
  const paddingStyle = padded ? { paddingHorizontal: Spacing.base } : {};

  const inner = scrollable ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, paddingStyle, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing ?? false}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, paddingStyle, contentStyle]}>{children}</View>
  );

  const wrapped = keyboardAvoid ? (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
    >
      {inner}
    </KeyboardAvoidingView>
  ) : (
    inner
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, style]}
      edges={['bottom']}
    >
      {wrapped}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: { flex: 1 },
  content: {
    flex: 1,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.base,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: Spacing.base,
    paddingBottom: Spacing['3xl'],
  },
});

export default Screen;
