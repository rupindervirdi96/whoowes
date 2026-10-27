import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme';
import Text from './ui/Text';

const TILE_COLORS = ['#5B4CF5', '#0E9F6E', '#F08A24', '#D9418C', '#2B7FD9', '#0F9AA8'];

/** Square tile for a group: first letter on a color picked from the name. */
const GroupTile: React.FC<{ name: string; size?: number }> = ({ name, size = 48 }) => {
  const t = useTheme();
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  const color = TILE_COLORS[Math.abs(h) % TILE_COLORS.length];
  const letter = name.replace(/[^\p{L}\p{N}]/gu, '').charAt(0).toUpperCase() || '#';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: color + (t.isDark ? '33' : '1F'),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text weight="extrabold" color={t.isDark ? '#FFFFFF' : color} style={{ fontSize: size * 0.42, lineHeight: size * 0.52 }}>
        {letter}
      </Text>
    </View>
  );
};

export default GroupTile;
