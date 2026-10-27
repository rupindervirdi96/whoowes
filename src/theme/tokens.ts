/**
 * WhoOwes design tokens.
 *
 * Brand: electric violet + citrus, with mint for "you're owed" and coral for "you owe".
 * Every color a screen uses comes from a palette below, so light and dark mode stay in sync.
 */

export const Brand = {
  violet: '#5B4CF5',
  violetDeep: '#4129D6',
  violetSoft: '#7B6CFF',
  citrus: '#D4FF3A',
  ink: '#15112E',
  gold: '#FFB938',
} as const;

export interface Palette {
  // Surfaces
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceRaised: string;
  overlay: string;
  border: string;
  borderStrong: string;

  // Text
  text: string;
  textSecondary: string;
  textTertiary: string;
  textOnPrimary: string;
  textOnAccent: string;

  // Brand
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  accent: string;
  accentSoft: string;

  // Money semantics
  positive: string;
  positiveSoft: string;
  negative: string;
  negativeSoft: string;

  // Status
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
  pro: string;
  proSoft: string;

  // Hero card (balance) — always a dark violet surface in both modes
  heroFrom: string;
  heroTo: string;
  heroText: string;
  heroTextMuted: string;

  tabBar: string;
  shadow: string;
}

export const LightPalette: Palette = {
  background: '#F6F5FB',
  surface: '#FFFFFF',
  surfaceAlt: '#EFEDF8',
  surfaceRaised: '#FFFFFF',
  overlay: 'rgba(16, 12, 40, 0.45)',
  border: '#E6E3F2',
  borderStrong: '#D2CDE8',

  text: '#16132D',
  textSecondary: '#5E5A78',
  textTertiary: '#9894B2',
  textOnPrimary: '#FFFFFF',
  textOnAccent: '#15112E',

  primary: '#5B4CF5',
  primaryPressed: '#4A3BE3',
  primarySoft: '#ECE9FF',
  accent: '#D4FF3A',
  accentSoft: '#F4FFD0',

  positive: '#0E9F6E',
  positiveSoft: '#DDF7EC',
  negative: '#E5484D',
  negativeSoft: '#FDE7E8',

  warning: '#D9822B',
  warningSoft: '#FCEFDD',
  info: '#2B7FD9',
  infoSoft: '#E0EEFC',
  pro: '#B7791F',
  proSoft: '#FFF3D6',

  heroFrom: '#5B4CF5',
  heroTo: '#2A1D9E',
  heroText: '#FFFFFF',
  heroTextMuted: 'rgba(255,255,255,0.72)',

  tabBar: '#FFFFFF',
  shadow: '#2A1D9E',
};

export const DarkPalette: Palette = {
  background: '#0E0C1D',
  surface: '#17142B',
  surfaceAlt: '#211D3A',
  surfaceRaised: '#1E1A36',
  overlay: 'rgba(0, 0, 0, 0.6)',
  border: '#2A2647',
  borderStrong: '#3A3560',

  text: '#F4F2FF',
  textSecondary: '#B4AFD4',
  textTertiary: '#7D78A1',
  textOnPrimary: '#FFFFFF',
  textOnAccent: '#15112E',

  primary: '#7B6DFF',
  primaryPressed: '#6A5BF5',
  primarySoft: '#2A2456',
  accent: '#D4FF3A',
  accentSoft: '#2E3514',

  positive: '#34D399',
  positiveSoft: '#123328',
  negative: '#FF6B70',
  negativeSoft: '#3A1A22',

  warning: '#F2A45A',
  warningSoft: '#3A2A17',
  info: '#64A8F5',
  infoSoft: '#16263D',
  pro: '#FFC857',
  proSoft: '#3A2F14',

  heroFrom: '#3C2FC2',
  heroTo: '#1C1460',
  heroText: '#FFFFFF',
  heroTextMuted: 'rgba(255,255,255,0.68)',

  tabBar: '#141127',
  shadow: '#000000',
};

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 56,
  /** Horizontal page margin. */
  gutter: 20,
  /** Vertical gap between page sections. */
  section: 32,
} as const;

export const Radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  '2xl': 32,
  full: 999,
} as const;

/** Font family names registered in App.tsx via @expo-google-fonts/plus-jakarta-sans. */
export const Fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export type FontWeightName = keyof typeof Fonts;

/** Type scale. `display` is for hero amounts, `title` for screen titles. */
export const TypeScale = {
  display: { fontSize: 36, lineHeight: 42, letterSpacing: -1.1, font: 'extrabold' },
  h1: { fontSize: 28, lineHeight: 34, letterSpacing: -0.7, font: 'extrabold' },
  h2: { fontSize: 21, lineHeight: 27, letterSpacing: -0.4, font: 'bold' },
  h3: { fontSize: 17, lineHeight: 23, letterSpacing: -0.2, font: 'bold' },
  bodyLg: { fontSize: 17, lineHeight: 24, letterSpacing: 0, font: 'medium' },
  body: { fontSize: 15, lineHeight: 22, letterSpacing: 0, font: 'regular' },
  bodyStrong: { fontSize: 15, lineHeight: 22, letterSpacing: 0, font: 'semibold' },
  label: { fontSize: 13, lineHeight: 18, letterSpacing: 0.1, font: 'semibold' },
  caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0.1, font: 'medium' },
  overline: { fontSize: 11, lineHeight: 14, letterSpacing: 1.1, font: 'bold' },
} as const satisfies Record<string, { fontSize: number; lineHeight: number; letterSpacing: number; font: FontWeightName }>;

export type TypeVariant = keyof typeof TypeScale;

export function elevation(palette: Palette, level: 1 | 2 | 3, isDark: boolean) {
  if (isDark) {
    // Shadows barely read on dark surfaces; borders do the separating there.
    return { shadowOpacity: 0, elevation: 0 };
  }
  const map = {
    1: { shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
    2: { shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 3 },
    3: { shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.16, shadowRadius: 28, elevation: 8 },
  } as const;
  return { shadowColor: palette.shadow, ...map[level] };
}
