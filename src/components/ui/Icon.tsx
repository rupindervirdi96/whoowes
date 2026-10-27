import React from 'react';
import { StyleProp, TextStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../theme';

export type IconName = keyof typeof MaterialIcons.glyphMap;

interface IconProps {
  name: IconName | string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

/** MaterialIcons with a themed default color. Accepts plain strings for data-driven icons. */
const Icon: React.FC<IconProps> = ({ name, size = 22, color, style }) => {
  const t = useTheme();
  return <MaterialIcons name={name as IconName} size={size} color={color ?? t.colors.text} style={style} />;
};

export default Icon;
