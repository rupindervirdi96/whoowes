/**
 * Theme provider + hooks.
 *
 * - `useTheme()` returns the active palette and helpers.
 * - `makeStyles(fn)` builds a hook that memoizes a StyleSheet per theme.
 * The user's choices (system / light / dark, and a colour theme) live in the UI store and are persisted.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { StyleSheet, useColorScheme, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import { useUIStore } from '../store/uiStore';
import {
  Brand,
  Fonts,
  Palette,
  Radius,
  Spacing,
  TypeScale,
  elevation,
} from './tokens';
import { COLOR_SCHEMES, DEFAULT_COLOR_THEME, schemeById, type ColorThemeId } from './schemes';

export * from './tokens';
export { COLOR_SCHEMES, type ColorThemeId } from './schemes';

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

function buildTheme(colors: Palette, isDark: boolean): Theme {
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

/** Every theme, built once: `${colourTheme}:light` / `${colourTheme}:dark`. */
const THEMES = new Map<string, Theme>();
for (const s of COLOR_SCHEMES) {
  THEMES.set(`${s.id}:light`, buildTheme(s.light, false));
  THEMES.set(`${s.id}:dark`, buildTheme(s.dark, true));
}
const themeFor = (id: ColorThemeId, isDark: boolean) => THEMES.get(`${schemeById(id).id}:${isDark ? 'dark' : 'light'}`)!;

const ThemeContext = createContext<Theme>(themeFor(DEFAULT_COLOR_THEME, false));

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const system = useColorScheme();
  const preference = useUIStore((s) => s.themePreference);
  const colorTheme = useUIStore((s) => s.colorTheme);
  const isDark = preference === 'system' ? system === 'dark' : preference === 'dark';
  return <ThemeContext.Provider value={themeFor(colorTheme, isDark)}>{children}</ThemeContext.Provider>;
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
