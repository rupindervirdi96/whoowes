import React from 'react';
import { Image, StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import Text from './Text';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
const PX: Record<AvatarSize, number> = { xs: 24, sm: 32, md: 40, lg: 56, xl: 80 };

// Soft background + strong foreground pairs, picked deterministically per name.
const LIGHT_PAIRS = [
  ['#ECE9FF', '#4A3BE3'],
  ['#DDF7EC', '#0B7A55'],
  ['#FFE8D6', '#B4530F'],
  ['#FDE2EF', '#B02868'],
  ['#E0EEFC', '#1F64B3'],
  ['#F4FFD0', '#4D6300'],
  ['#E8E6F2', '#4A4766'],
];
const DARK_PAIRS = [
  ['#2A2456', '#B9B0FF'],
  ['#123328', '#6EE7B7'],
  ['#3A2716', '#FDBA74'],
  ['#3A1730', '#F9A8D4'],
  ['#16263D', '#93C5FD'],
  ['#2E3514', '#D4FF3A'],
  ['#25223A', '#C9C5E4'],
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (s.charCodeAt(i) + ((h << 5) - h)) | 0;
  return Math.abs(h);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface AvatarProps {
  name: string;
  uri?: string;
  size?: AvatarSize;
  ring?: boolean;
  style?: StyleProp<ViewStyle>;
}

const Avatar: React.FC<AvatarProps> = ({ name, uri, size = 'md', ring, style }) => {
  const t = useTheme();
  const px = PX[size];
  const [bg, fg] = (t.isDark ? DARK_PAIRS : LIGHT_PAIRS)[hash(name) % LIGHT_PAIRS.length];
  const box: ViewStyle = {
    width: px,
    height: px,
    borderRadius: px / 2,
    backgroundColor: bg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: ring ? 2 : 0,
    borderColor: t.colors.surface,
  };
  return (
    <View style={[box, style]} accessibilityLabel={name}>
      {uri ? (
        <Image source={{ uri }} style={{ width: px, height: px }} />
      ) : (
        <Text
          weight="bold"
          color={fg}
          style={{ fontSize: Math.round(px * 0.38), lineHeight: Math.round(px * 0.5), letterSpacing: 0.2 }}
        >
          {initials(name)}
        </Text>
      )}
    </View>
  );
};

/** Overlapping avatars, e.g. group members. */
export const AvatarStack: React.FC<{ names: string[]; size?: AvatarSize; max?: number }> = ({
  names,
  size = 'sm',
  max = 4,
}) => {
  const t = useTheme();
  const px = PX[size];
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <View style={{ flexDirection: 'row' }}>
      {shown.map((n, i) => (
        <Avatar key={`${n}-${i}`} name={n} size={size} ring style={{ marginLeft: i === 0 ? 0 : -px * 0.32 }} />
      ))}
      {extra > 0 ? (
        <View
          style={{
            width: px,
            height: px,
            borderRadius: px / 2,
            marginLeft: -px * 0.32,
            backgroundColor: t.colors.surfaceAlt,
            borderWidth: 2,
            borderColor: t.colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="caption" weight="bold" tone="secondary">
            +{extra}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

export default Avatar;
