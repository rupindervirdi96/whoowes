import React from 'react';
import { Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native';
import { useTheme, TypeVariant, FontWeightName, Palette } from '../../theme';
import { useLanguage } from '../../i18n';

export type TextTone =
  | 'default'
  | 'secondary'
  | 'tertiary'
  | 'primary'
  | 'positive'
  | 'negative'
  | 'warning'
  | 'pro'
  | 'onPrimary'
  | 'hero'
  | 'heroMuted';

/**
 * Plus Jakarta Sans has no Devanagari letters. For Hindi the phone's own font is
 * used (it covers both scripts), with the weight set directly instead.
 */
const SYSTEM_WEIGHT: Record<FontWeightName, TextStyle['fontWeight']> = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
};

const TONE_TO_COLOR: Record<TextTone, keyof Palette> = {
  default: 'text',
  secondary: 'textSecondary',
  tertiary: 'textTertiary',
  primary: 'primary',
  positive: 'positive',
  negative: 'negative',
  warning: 'warning',
  pro: 'pro',
  onPrimary: 'textOnPrimary',
  hero: 'heroText',
  heroMuted: 'heroTextMuted',
};

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  tone?: TextTone;
  /** Raw color override (wins over tone). */
  color?: string;
  weight?: FontWeightName;
  align?: TextStyle['textAlign'];
  uppercase?: boolean;
  tabular?: boolean;
}

/** Themed text. Always use this instead of RN's Text so fonts and colors stay consistent. */
const Text: React.FC<TextProps> = ({
  variant = 'body',
  tone = 'default',
  color,
  weight,
  align,
  uppercase,
  tabular,
  style,
  ...rest
}) => {
  const t = useTheme();
  const systemFont = useLanguage() === 'hi';
  const scale = t.type[variant];
  const fontName = weight ?? scale.font;
  return (
    <RNText
      {...rest}
      style={[
        {
          fontFamily: systemFont ? undefined : t.fonts[fontName],
          fontWeight: systemFont ? SYSTEM_WEIGHT[fontName] : undefined,
          fontSize: scale.fontSize,
          lineHeight: scale.lineHeight,
          letterSpacing: scale.letterSpacing,
          color: color ?? t.colors[TONE_TO_COLOR[tone]],
          textAlign: align,
          textTransform: uppercase || variant === 'overline' ? 'uppercase' : undefined,
          fontVariant: tabular ? ['tabular-nums'] : undefined,
        },
        style,
      ]}
    />
  );
};

export default Text;
