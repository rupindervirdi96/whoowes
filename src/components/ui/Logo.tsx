/**
 * WhoOwes logo — the owl badge, drawn with SVG so it stays sharp at any size.
 * The brow is a "W"; the pupils are split coins. Source: assets/brand/owl-glyph.svg.
 */

import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Brand, useTheme } from '../../theme';
import Text from './Text';

export const LogoMark: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <Svg width={size} height={size} viewBox="0 0 1024 1024" accessibilityLabel="WhoOwes">
    <Defs>
      <LinearGradient id="wo-bg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#7B6CFF" />
        <Stop offset="1" stopColor="#4129D6" />
      </LinearGradient>
    </Defs>
    <Rect width="1024" height="1024" rx="230" fill="url(#wo-bg)" />
    <Path
      d="M196 300 L364 418 L512 340 L660 418 L828 300"
      fill="none"
      stroke={Brand.citrus}
      strokeWidth={78}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx="364" cy="576" r="158" fill="#FFFFFF" />
    <Circle cx="660" cy="576" r="158" fill="#FFFFFF" />
    <Circle cx="364" cy="576" r="76" fill="none" stroke={Brand.ink} strokeWidth={22} />
    <Path d="M364 500 A76 76 0 0 1 364 652 Z" fill={Brand.ink} />
    <Circle cx="660" cy="576" r="76" fill="none" stroke={Brand.ink} strokeWidth={22} />
    <Path d="M660 500 A76 76 0 0 0 660 652 Z" fill={Brand.ink} />
    <Path d="M474 748 L550 748 L512 812 Z" fill={Brand.citrus} stroke={Brand.citrus} strokeWidth={22} strokeLinejoin="round" />
  </Svg>
);

/** Mark + wordmark. `onDark` renders the wordmark white (e.g. on the hero). */
const Logo: React.FC<{ size?: number; onDark?: boolean }> = ({ size = 36, onDark }) => {
  const t = useTheme();
  const fontSize = Math.round(size * 0.66);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Math.round(size * 0.28) }}>
      <LogoMark size={size} />
      <Text
        weight="extrabold"
        style={{ fontSize, lineHeight: Math.round(fontSize * 1.2), letterSpacing: -0.6 }}
        color={onDark ? '#FFFFFF' : t.colors.text}
      >
        who
        <Text weight="extrabold" style={{ fontSize, letterSpacing: -0.6 }} color={onDark ? Brand.citrus : t.colors.primary}>
          owes
        </Text>
      </Text>
    </View>
  );
};

export default Logo;
