import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import Icon from './Icon';
import Text from './Text';

export interface SwipeAction {
  key: string;
  label: string;
  icon: string;
  /** Background of the action; its text is white. */
  color: string;
  onPress: () => void;
}

interface SwipeRowProps {
  children: React.ReactNode;
  /** Revealed by swiping right. */
  left?: SwipeAction[];
  /** Revealed by swiping left. */
  right?: SwipeAction[];
  /** Controlled, so only one row in a list is open at a time. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Horizontal padding of the card the row sits in: the row stretches across it so actions reach the edge. */
  bleed?: number;
}

const ACTION_WIDTH = 78;

/**
 * A row that slides sideways to show quick actions, like Mail on iPhone.
 * Plain React Native (PanResponder + Animated), so it runs in Expo Go too.
 * Tapping an open row closes it instead of opening it.
 */
const SwipeRow: React.FC<SwipeRowProps> = ({ children, left = [], right = [], open, onOpenChange, bleed = 16 }) => {
  const t = useTheme();
  const x = useRef(new Animated.Value(0)).current;
  const resting = useRef(0);
  const leftWidth = left.length * ACTION_WIDTH;
  const rightWidth = right.length * ACTION_WIDTH;

  // Latest callbacks for the responder, which is created once per layout.
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const snap = (to: number) => {
    const opening = to !== 0 && resting.current === 0;
    resting.current = to;
    Animated.spring(x, { toValue: to, useNativeDriver: true, speed: 22, bounciness: 0 }).start();
    if (opening) Haptics.selectionAsync().catch(() => {});
    onOpenChangeRef.current(to !== 0);
  };

  // Closed from outside (another row opened, or an action ran).
  useEffect(() => {
    if (!open && resting.current !== 0) {
      resting.current = 0;
      Animated.spring(x, { toValue: 0, useNativeDriver: true, speed: 22, bounciness: 0 }).start();
    }
  }, [open, x]);

  const pan = useMemo(() => {
    const horizontal = (dx: number, dy: number) => Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5;
    // Past the actions, the row keeps following the finger, but slower.
    const clamp = (v: number) => {
      if (v > leftWidth) return leftWidth + (v - leftWidth) * 0.25;
      if (v < -rightWidth) return -rightWidth + (v + rightWidth) * 0.25;
      return v;
    };
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => horizontal(g.dx, g.dy),
      onMoveShouldSetPanResponderCapture: (_, g) => horizontal(g.dx, g.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => x.setValue(clamp(resting.current + g.dx)),
      onPanResponderRelease: (_, g) => {
        const v = resting.current + g.dx;
        if (leftWidth && (v > leftWidth / 2 || (g.vx > 0.6 && v > 0))) snap(leftWidth);
        else if (rightWidth && (v < -rightWidth / 2 || (g.vx < -0.6 && v < 0))) snap(-rightWidth);
        else snap(0);
      },
      onPanResponderTerminate: () => snap(resting.current),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftWidth, rightWidth, x]);

  const run = (a: SwipeAction) => {
    snap(0);
    a.onPress();
  };

  const renderActions = (actions: SwipeAction[], side: 'left' | 'right') => (
    <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', justifyContent: side === 'left' ? 'flex-start' : 'flex-end' }]}>
      {actions.map((a) => (
        <Pressable
          key={a.key}
          onPress={() => run(a)}
          accessibilityRole="button"
          accessibilityLabel={a.label}
          style={({ pressed }) => ({
            width: ACTION_WIDTH,
            backgroundColor: a.color,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Icon name={a.icon} size={20} color="#FFFFFF" />
          <Text variant="caption" color="#FFFFFF" numberOfLines={1} style={{ paddingHorizontal: 4 }}>
            {a.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  // Only the side being revealed is visible, so the other can't flash through.
  const leftOpacity = x.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const rightOpacity = x.interpolate({ inputRange: [-1, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  const all = [...left, ...right];
  return (
    <View
      style={{ marginHorizontal: -bleed }}
      accessible={false}
      accessibilityActions={all.map((a) => ({ name: a.key, label: a.label }))}
      onAccessibilityAction={(e) => all.find((a) => a.key === e.nativeEvent.actionName)?.onPress()}
    >
      {left.length ? <Animated.View style={[StyleSheet.absoluteFill, { opacity: leftOpacity }]}>{renderActions(left, 'left')}</Animated.View> : null}
      {right.length ? <Animated.View style={[StyleSheet.absoluteFill, { opacity: rightOpacity }]}>{renderActions(right, 'right')}</Animated.View> : null}
      <Animated.View
        {...pan.panHandlers}
        style={{ transform: [{ translateX: x }], backgroundColor: t.colors.surface, paddingHorizontal: bleed }}
      >
        {children}
        {open ? <Pressable style={StyleSheet.absoluteFill} onPress={() => snap(0)} accessibilityElementsHidden /> : null}
      </Animated.View>
    </View>
  );
};

export default SwipeRow;
