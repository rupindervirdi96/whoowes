/**
 * Avatar component.
 * Displays a user avatar with initials fallback.
 */

import React from 'react';
import { View, Text, StyleSheet, Image, ViewStyle, StyleProp } from 'react-native';
import { Colors, Typography, BorderRadius } from '../../theme';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  name: string;
  uri?: string;
  size?: AvatarSize;
  style?: StyleProp<ViewStyle>;
}

const SIZES: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 72,
};

const FONT_SIZES: Record<AvatarSize, number> = {
  xs: 9,
  sm: 12,
  md: 15,
  lg: 22,
  xl: 28,
};

// Generate a consistent color from the user's name
function getAvatarColor(name: string): string {
  const palette = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
    '#f59e0b', '#22c55e', '#ef4444', '#f97316',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

const Avatar: React.FC<AvatarProps> = ({ name, uri, size = 'md', style }) => {
  const sizePx = SIZES[size];
  const fontSize = FONT_SIZES[size];
  const bgColor = getAvatarColor(name);

  if (uri) {
    return (
      <View
        style={[
          styles.avatar,
          {
            width: sizePx,
            height: sizePx,
            borderRadius: sizePx / 2,
          },
          style,
        ]}
      >
        <Image
          source={{ uri }}
          style={{ width: sizePx, height: sizePx }}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.avatar,
        styles.initials,
        {
          width: sizePx,
          height: sizePx,
          borderRadius: sizePx / 2,
          backgroundColor: bgColor,
        },
        style,
      ]}
    >
      <Text style={[styles.initialsText, { fontSize }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: {
    overflow: 'hidden',
  },
  initials: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: Colors.white,
    fontWeight: Typography.bold,
    letterSpacing: 0.5,
  },
});

export default Avatar;
