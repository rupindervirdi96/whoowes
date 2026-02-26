/**
 * Design tokens / theme constants for the WhoOwes app.
 * Used as a complement to NativeWind for inline styles, shadows, etc.
 */

export const Colors = {
  // Brand — teal / emerald
  primary: '#2DA58E',          // emerald teal
  primaryLight: '#4BBFA8',     // lighter teal
  primaryDark: '#1F8A74',      // deeper teal

  // Semantic
  success: '#3DAA72',
  successLight: '#DFF5EB',
  danger: '#D46B6B',
  dangerLight: '#FAEAEA',
  warning: '#C9923A',
  warningLight: '#FCEEDD',
  info: '#3A9EBB',
  infoLight: '#DCF3F8',

  // Neutrals
  white: '#ffffff',
  black: '#000000',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',

  // Surfaces
  background: '#EAF7F3',
  surface: '#ffffff',
  surfaceSecondary: '#F0FAF7',
  border: '#BDE0D8',
  borderLight: '#DFF4EF',

  // Text
  textPrimary: '#0E2B25',
  textSecondary: '#2E5A52',
  textTertiary: '#7AADA4',
  textInverse: '#ffffff',
  textLink: '#2DA58E',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
} as const;

export const BorderRadius = {
  sm: 4,
  md: 8,
  base: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const Typography = {
  // Font sizes
  xs: 12,
  sm: 14,
  base: 16,
  md: 17,
  lg: 19,
  xl: 22,
  '2xl': 26,
  '3xl': 30,
  '4xl': 34,

  // Font weights (as string for React Native)
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,

  // Line heights
  tight: 1.2,
  normal_lh: 1.5,
  relaxed: 1.7,
} as const;

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  base: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

export const AnimationDuration = {
  fast: 150,
  base: 250,
  slow: 400,
} as const;
