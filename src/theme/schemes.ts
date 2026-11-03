/**
 * Colour themes the user can pick in Account → Appearance.
 *
 * Each theme recolours the brand parts of the palette (buttons, links, the
 * balance card, tints of the background and borders) in both light and dark
 * mode. Money colours stay the same in every theme: green is always
 * "you're owed" and red is always "you owe".
 */

import { DarkPalette, LightPalette, type Palette } from './tokens';

export type ColorThemeId = 'violet' | 'ocean' | 'berry' | 'lagoon' | 'graphite';

export interface ColorScheme {
  id: ColorThemeId;
  /** Shown on the picker: the main colour and the accent. */
  swatch: { primary: string; accent: string; hero: string };
  light: Palette;
  dark: Palette;
}

const scheme = (id: ColorThemeId, light: Partial<Palette>, dark: Partial<Palette>): ColorScheme => {
  const l = { ...LightPalette, ...light };
  return {
    id,
    swatch: { primary: l.primary, accent: l.accent, hero: l.heroTo },
    light: l,
    dark: { ...DarkPalette, ...dark },
  };
};

export const COLOR_SCHEMES: ColorScheme[] = [
  // Graphite (the default): calm monochrome with a lime accent.
  scheme(
    'graphite',
    {
      background: '#F5F5F4',
      surfaceAlt: '#ECECEA',
      overlay: 'rgba(10, 10, 10, 0.45)',
      border: '#E4E4E1',
      borderStrong: '#CFCFCB',
      text: '#141414',
      textSecondary: '#5C5C58',
      textTertiary: '#9A9A95',
      primary: '#1C1C1E',
      primaryPressed: '#000000',
      primarySoft: '#EAEAE8',
      accent: '#C6F432',
      accentSoft: '#F1FCD2',
      textOnAccent: '#141414',
      heroFrom: '#2A2A2D',
      heroTo: '#0B0B0C',
      shadow: '#000000',
    },
    {
      background: '#0B0B0C',
      surface: '#161617',
      surfaceAlt: '#202022',
      surfaceRaised: '#1B1B1D',
      border: '#29292C',
      borderStrong: '#3A3A3E',
      text: '#F5F5F4',
      textSecondary: '#B3B3AE',
      textTertiary: '#7A7A76',
      primary: '#F2F2F0',
      primaryPressed: '#DADAD6',
      primarySoft: '#2A2A2D',
      textOnPrimary: '#141414',
      accent: '#C6F432',
      accentSoft: '#2D3512',
      textOnAccent: '#141414',
      heroFrom: '#2E2E33',
      heroTo: '#121214',
      tabBar: '#121213',
    },
  ),

  // Violet: the original electric violet with citrus.
  scheme('violet', {}, {}),

  // Ocean: clear blue with aqua.
  scheme(
    'ocean',
    {
      background: '#F4F7FC',
      surfaceAlt: '#E9F0FA',
      overlay: 'rgba(8, 18, 40, 0.45)',
      border: '#DFE7F3',
      borderStrong: '#C7D5EA',
      text: '#0F1B2D',
      textSecondary: '#526178',
      textTertiary: '#8C9AB0',
      primary: '#1F6FEB',
      primaryPressed: '#1A5FD0',
      primarySoft: '#E3EEFF',
      accent: '#7CF0E0',
      accentSoft: '#DDFBF6',
      textOnAccent: '#062B33',
      heroFrom: '#1F6FEB',
      heroTo: '#0A2E6E',
      shadow: '#0A2E6E',
    },
    {
      background: '#0A111D',
      surface: '#111A2B',
      surfaceAlt: '#1A2639',
      surfaceRaised: '#162135',
      border: '#22304A',
      borderStrong: '#31446A',
      text: '#EEF4FF',
      textSecondary: '#A9B8D3',
      textTertiary: '#6F7F9C',
      primary: '#3F7FF2',
      primaryPressed: '#336FE0',
      primarySoft: '#16294D',
      accent: '#7CF0E0',
      accentSoft: '#123534',
      textOnAccent: '#062B33',
      heroFrom: '#1D4FB8',
      heroTo: '#0A1B44',
      tabBar: '#0E1625',
    },
  ),

  // Berry: raspberry with sunshine yellow.
  scheme(
    'berry',
    {
      background: '#FBF5F8',
      surfaceAlt: '#F8EAF0',
      overlay: 'rgba(40, 10, 26, 0.45)',
      border: '#F0E0E8',
      borderStrong: '#E3C8D6',
      text: '#2A1020',
      textSecondary: '#6E5263',
      textTertiary: '#A890A0',
      primary: '#C2185B',
      primaryPressed: '#A8144F',
      primarySoft: '#FCE4EE',
      accent: '#FFD54A',
      accentSoft: '#FFF6D6',
      textOnAccent: '#3A2400',
      heroFrom: '#D81B60',
      heroTo: '#5E0B33',
      shadow: '#5E0B33',
    },
    {
      background: '#150B11',
      surface: '#20121A',
      surfaceAlt: '#2C1924',
      surfaceRaised: '#26151F',
      border: '#3A2230',
      borderStrong: '#523045',
      text: '#FFF0F6',
      textSecondary: '#D3B3C3',
      textTertiary: '#977686',
      primary: '#E0457F',
      primaryPressed: '#CC386F',
      primarySoft: '#45182E',
      accent: '#FFD54A',
      accentSoft: '#3A3012',
      textOnAccent: '#3A2400',
      heroFrom: '#A3174E',
      heroTo: '#3D0822',
      tabBar: '#1B0F16',
    },
  ),

  // Lagoon: deep teal with peach.
  scheme(
    'lagoon',
    {
      background: '#F3F8F8',
      surfaceAlt: '#E5F1F1',
      overlay: 'rgba(6, 30, 32, 0.45)',
      border: '#DCEAEA',
      borderStrong: '#BFD8D8',
      text: '#0D2224',
      textSecondary: '#4E6668',
      textTertiary: '#8AA2A3',
      primary: '#0D8A8A',
      primaryPressed: '#0B7676',
      primarySoft: '#DDF3F2',
      accent: '#FFB38A',
      accentSoft: '#FFEDE3',
      textOnAccent: '#3A1704',
      heroFrom: '#0F9A96',
      heroTo: '#063F45',
      shadow: '#063F45',
    },
    {
      background: '#081415',
      surface: '#0F1F21',
      surfaceAlt: '#172B2D',
      surfaceRaised: '#132628',
      border: '#1F3739',
      borderStrong: '#2C4C4F',
      text: '#ECFAF9',
      textSecondary: '#A3C4C3',
      textTertiary: '#6A8B8B',
      primary: '#2EC4BE',
      primaryPressed: '#22AFA9',
      primarySoft: '#123A3A',
      // Light teal needs dark text on buttons to stay readable.
      textOnPrimary: '#03201E',
      accent: '#FFB38A',
      accentSoft: '#3A2518',
      textOnAccent: '#3A1704',
      heroFrom: '#0C7472',
      heroTo: '#04292D',
      tabBar: '#0C1A1B',
    },
  ),

];

/** What new installs start with. */
export const DEFAULT_COLOR_THEME: ColorThemeId = 'graphite';

export const schemeById = (id: ColorThemeId | undefined) =>
  COLOR_SCHEMES.find((s) => s.id === id) ?? COLOR_SCHEMES.find((s) => s.id === DEFAULT_COLOR_THEME)!;
