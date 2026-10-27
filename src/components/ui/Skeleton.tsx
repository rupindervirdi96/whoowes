import React, { useEffect, useRef } from 'react';
import { Animated, DimensionValue, StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

const Skeleton: React.FC<SkeletonProps> = ({ width = '100%', height = 14, radius = 8, style }) => {
  const t = useTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: t.colors.surfaceAlt, opacity }, style]}
    />
  );
};

/** Placeholder for a list of rows while data loads. */
export const SkeletonList: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <View style={{ gap: 18, paddingVertical: 12 }}>
    {Array.from({ length: rows }).map((_, i) => (
      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Skeleton width={44} height={44} radius={14} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="60%" />
          <Skeleton width="35%" height={10} />
        </View>
        <Skeleton width={56} height={14} />
      </View>
    ))}
  </View>
);

export default Skeleton;
