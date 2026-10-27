import React from 'react';
import { View } from 'react-native';
import { CATEGORY_BY_ID } from '../../constants';
import type { ExpenseCategory } from '../../types';
import { useTheme } from '../../theme';
import Icon from './Icon';

/** Rounded tile tinted with the category's color. */
const CategoryIcon: React.FC<{ category: ExpenseCategory; size?: number }> = ({ category, size = 40 }) => {
  const t = useTheme();
  const meta = CATEGORY_BY_ID[category] ?? CATEGORY_BY_ID.other;
  const color = t.isDark ? meta.color.dark : meta.color.light;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: color + (t.isDark ? '26' : '1A'),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={meta.icon} size={Math.round(size * 0.48)} color={color} />
    </View>
  );
};

export function categoryColor(category: ExpenseCategory, isDark: boolean) {
  const meta = CATEGORY_BY_ID[category] ?? CATEGORY_BY_ID.other;
  return isDark ? meta.color.dark : meta.color.light;
}

export default CategoryIcon;
