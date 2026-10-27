import React from 'react';
import { Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native';
import { useTheme, TypeVariant, FontWeightName, Palette } from '../../theme';

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
  const scale = t.type[variant];
  return (
    <RNText
      {...rest}
      style={[
        {
          fontFamily: t.fonts[weight ?? scale.font],
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
