import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, StyleSheet, View } from 'react-native';
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

/** Swiping the row right past a point runs this straight away; no button to tap. */
export interface SwipeTrigger {
  icon: string;
  color: string;
  /** Shown while dragging: "Add expense with Alex". */
  label: string;
  /** Shown once letting go would run it: "Let go to start". */
  armedLabel: string;
  onTrigger: () => void;
}

interface SwipeRowProps {
  children: React.ReactNode;
  /** Swipe right far enough and this runs. */
  trigger?: SwipeTrigger;
  /** Revealed by swiping left, as buttons. */
  right?: SwipeAction[];
  /** Controlled, so only one row in a list is open at a time. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called the first time the row is dragged either way. */
  onSwipe?: () => void;
  /** Nudge the row once to show what a swipe right does (first-time tip). */
  peek?: boolean;
  /** Horizontal padding of the card the row sits in: the row stretches across it so actions reach the edge. */
  bleed?: number;
}

const ACTION_WIDTH = 78;
/** How far right (share of the row) a swipe must go to run the trigger. */
const TRIGGER_AT = 0.35;
const SPRING = { useNativeDriver: true, speed: 22, bounciness: 0 } as const;

/**
 * A row that slides sideways. Right: a full-width action that runs when you let go
 * past the line (like archiving in Mail). Left: buttons. Plain React Native
 * (PanResponder + Animated), so it runs in Expo Go too. Tapping an open row closes it.
 */
const SwipeRow: React.FC<SwipeRowProps> = ({ children, trigger, right = [], open, onOpenChange, onSwipe, peek, bleed = 16 }) => {
  const t = useTheme();
  const x = useRef(new Animated.Value(0)).current;
  const resting = useRef(0);
  const width = useRef(0);
  const armedRef = useRef(false);
  const [armed, setArmed] = useState(false);
  const rightWidth = right.length * ACTION_WIDTH;

  // Latest props for the responder, which is created once per layout.
  const latest = useRef({ onOpenChange, onSwipe, trigger });
  latest.current = { onOpenChange, onSwipe, trigger };

  const setArmedOnce = (v: boolean) => {
    if (armedRef.current === v) return;
    armedRef.current = v;
    setArmed(v);
    if (v) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const snap = (to: number) => {
    const opening = to !== 0 && resting.current === 0;
    resting.current = to;
    Animated.spring(x, { toValue: to, ...SPRING }).start();
    if (opening) Haptics.selectionAsync().catch(() => {});
    latest.current.onOpenChange(to !== 0);
  };

  /** Slide the row off to the right, run the trigger, then quietly put the row back. */
  const fire = () => {
    const tr = latest.current.trigger;
    resting.current = 0;
    Animated.timing(x, { toValue: width.current || 400, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => {
      tr?.onTrigger();
      setTimeout(() => {
        x.setValue(0);
        setArmedOnce(false);
      }, 450);
    });
    latest.current.onOpenChange(false);
  };

  // Closed from outside (another row opened, or an action ran).
  useEffect(() => {
    if (!open && resting.current !== 0) {
      resting.current = 0;
      Animated.spring(x, { toValue: 0, ...SPRING }).start();
    }
  }, [open, x]);

  // First-time tip: nudge right a little, once, so people see what's underneath.
  const peeked = useRef(false);
  const hasTrigger = !!trigger;
  useEffect(() => {
    if (!peek || !hasTrigger || peeked.current) return;
    const id = setTimeout(() => {
      peeked.current = true;
      Animated.sequence([
        Animated.timing(x, { toValue: 64, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.delay(450),
        Animated.spring(x, { toValue: 0, ...SPRING }),
      ]).start();
    }, 700);
    return () => clearTimeout(id);
  }, [peek, hasTrigger, x]);

  const pan = useMemo(() => {
    const horizontal = (dx: number, dy: number) => Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5;
    const canRight = !!latest.current.trigger;
    // Past the buttons on the left side, the row keeps following the finger, but slower.
    const clamp = (v: number) => {
      if (v > 0 && !canRight) return v * 0.15;
      if (v < -rightWidth) return -rightWidth + (v + rightWidth) * 0.25;
      return v;
    };
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => horizontal(g.dx, g.dy),
      onMoveShouldSetPanResponderCapture: (_, g) => horizontal(g.dx, g.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => latest.current.onSwipe?.(),
      onPanResponderMove: (_, g) => {
        const v = clamp(resting.current + g.dx);
        x.setValue(v);
        if (canRight) setArmedOnce(v > width.current * TRIGGER_AT);
      },
      onPanResponderRelease: (_, g) => {
        const v = resting.current + g.dx;
        if (canRight && v > width.current * TRIGGER_AT) return fire();
        setArmedOnce(false);
        if (rightWidth && (v < -rightWidth / 2 || (g.vx < -0.6 && v < 0))) snap(-rightWidth);
        else snap(0);
      },
      onPanResponderTerminate: () => {
        setArmedOnce(false);
        snap(resting.current);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rightWidth, hasTrigger, x]);

  const run = (a: SwipeAction) => {
    snap(0);
    a.onPress();
  };

  // Only the side being revealed is visible, so the other can't flash through.
  const leftOpacity = x.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const rightOpacity = x.interpolate({ inputRange: [-1, 0], outputRange: [1, 0], extrapolate: 'clamp' });
  // The trigger's icon grows a little as you near the line.
  const iconScale = x.interpolate({ inputRange: [0, 120], outputRange: [0.8, 1.1], extrapolate: 'clamp' });

  const accessibilityActions = [
    ...(trigger ? [{ name: 'trigger', label: trigger.label }] : []),
    ...right.map((a) => ({ name: a.key, label: a.label })),
  ];

  return (
    <View
      style={{ marginHorizontal: -bleed }}
      onLayout={(e) => (width.current = e.nativeEvent.layout.width)}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'trigger') trigger?.onTrigger();
        else right.find((a) => a.key === e.nativeEvent.actionName)?.onPress();
      }}
    >
      {trigger ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: leftOpacity,
              backgroundColor: trigger.color,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingHorizontal: bleed + 4,
            },
          ]}
        >
          <Animated.View style={{ transform: [{ scale: iconScale }] }}>
            <Icon name={armed ? 'check-circle' : trigger.icon} size={22} color="#FFFFFF" />
          </Animated.View>
          <Text variant="label" color="#FFFFFF" numberOfLines={1} style={{ flexShrink: 1 }}>
            {armed ? trigger.armedLabel : trigger.label}
          </Text>
        </Animated.View>
      ) : null}

      {right.length ? (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: rightOpacity, flexDirection: 'row', justifyContent: 'flex-end' }]}>
          {right.map((a) => (
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
        </Animated.View>
      ) : null}

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
