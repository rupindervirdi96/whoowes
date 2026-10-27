/**
 * Theme provider + hooks.
 *
 * - `useTheme()` returns the active palette and helpers.
 * - `makeStyles(fn)` builds a hook that memoizes a StyleSheet per theme.
 * The user's choice (system / light / dark) lives in the UI store and is persisted.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { StyleSheet, useColorScheme, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import { useUIStore } from '../store/uiStore';
import {
  Brand,
  DarkPalette,
  Fonts,
  LightPalette,
  Palette,
  Radius,
  Spacing,
  TypeScale,
  elevation,
} from './tokens';

export * from './tokens';

export interface Theme {
  colors: Palette;
  isDark: boolean;
  spacing: typeof Spacing;
  radius: typeof Radius;
  fonts: typeof Fonts;
  type: typeof TypeScale;
  brand: typeof Brand;
  elevation: (level: 1 | 2 | 3) => object;
}

function buildTheme(isDark: boolean): Theme {
  const colors = isDark ? DarkPalette : LightPalette;
  return {
    colors,
    isDark,
    spacing: Spacing,
    radius: Radius,
    fonts: Fonts,
    type: TypeScale,
    brand: Brand,
    elevation: (level) => elevation(colors, level, isDark),
  };
}

const LIGHT = buildTheme(false);
const DARK = buildTheme(true);

const ThemeContext = createContext<Theme>(LIGHT);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const system = useColorScheme();
  const preference = useUIStore((s) => s.themePreference);
  const isDark = preference === 'system' ? system === 'dark' : preference === 'dark';
  return <ThemeContext.Provider value={isDark ? DARK : LIGHT}>{children}</ThemeContext.Provider>;
};

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/**
 * Usage:
 *   const useStyles = makeStyles((t) => ({ card: { backgroundColor: t.colors.surface } }));
 *   const styles = useStyles();
 */
type NamedStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;

export function makeStyles<T extends NamedStyles>(factory: (theme: Theme) => T) {
  const cache = new WeakMap<Theme, T>();
  return function useStyles(): T {
    const theme = useTheme();
    return useMemo(() => {
      const cached = cache.get(theme);
      if (cached) return cached;
      const styles = StyleSheet.create(factory(theme)) as T;
      cache.set(theme, styles);
      return styles;
    }, [theme]);
  };
}
