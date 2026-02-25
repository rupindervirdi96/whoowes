/**
 * Loading skeleton component.
 * Animated placeholder for content that is being loaded.
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { Colors, BorderRadius } from '../../theme';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius = BorderRadius.md,
  style,
}) => {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius, opacity },
        style,
      ]}
    />
  );
};

// Preset skeleton layouts for common UI patterns
export const SkeletonCard: React.FC = () => (
  <View style={skStyles.card}>
    <View style={skStyles.header}>
      <Skeleton width={40} height={40} borderRadius={20} />
      <View style={skStyles.headerText}>
        <Skeleton width="60%" height={14} style={{ marginBottom: 8 }} />
        <Skeleton width="40%" height={12} />
      </View>
    </View>
    <Skeleton width="100%" height={12} style={{ marginTop: 12, marginBottom: 6 }} />
    <Skeleton width="80%" height={12} />
  </View>
);

const styles = StyleSheet.create({
  skeleton: { backgroundColor: Colors.gray200 },
});

const skStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: 16,
    marginBottom: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  headerText: { flex: 1, marginLeft: 12 },
});

export default Skeleton;
