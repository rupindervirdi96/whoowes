import React, { memo, startTransition, useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, TextInput, View, type TextInputInstance } from 'react-native';
import { useTheme } from '../../theme';
import { useT } from '../../i18n';
import { cleanAmountInput, currencyDecimals, currencyName, getCurrencySymbol } from '../../utils/currency';
import Text from './Text';
import Icon from './Icon';

interface AmountInputProps {
  value: string;
  onChangeText: (v: string) => void;
  currency: string;
  /** Makes the currency tappable (opens a currency picker). */
  onCurrencyPress?: () => void;
  autoFocus?: boolean;
  /** Small caption above the digits (default "Amount"). */
  label?: string;
}

const DIGIT_HEIGHT = 58;

/**
 * Money-entry card used at the top of the expense and payment screens:
 *
 *   AMOUNT
 *   $ 1,250.00                  [ USD ⌄ ]
 *   US Dollar
 *
 * Digits go into a real, left-aligned TextInput, so they appear the moment a key
 * is pressed and the cursor sits before the "0.00" hint, never on top of it.
 * The parent hears about each change in a low-priority update, so a busy screen
 * redraws without holding up the next key press.
 */
const AmountInput: React.FC<AmountInputProps> = ({ value: external, onChangeText, currency, onCurrencyPress, autoFocus, label }) => {
  const t = useTheme();
  const { t: tr, lang } = useT();
  const inputRef = useRef<TextInputInstance>(null);
  const [value, setValue] = useState(external);
  const [focused, setFocused] = useState(false);
  // Values typed here that the parent may still echo back, oldest first. Background
  // updates can arrive late (an older "1" after "12" was typed), so an echo is any
  // value in this list, not just the latest one.
  const pending = useRef<string[]>([]);

  // Follow changes the parent makes itself (a "full amount" chip, a draft).
  useEffect(() => {
    const echo = pending.current.lastIndexOf(external);
    if (echo !== -1) {
      // Our own typing coming back: drop it and anything older, keep what's on screen.
      pending.current.splice(0, echo + 1);
      return;
    }
    pending.current = [];
    setValue(external);
  }, [external]);

  // A currency with fewer decimals (e.g. yen) trims what's shown here too.
  useEffect(() => {
    setValue((v) => cleanAmountInput(v, currency));
  }, [currency]);

  const change = (raw: string) => {
    const next = cleanAmountInput(raw, currency);
    setValue(next);
    pending.current.push(next);
    startTransition(() => onChangeText(next));
  };

  const decimals = currencyDecimals(currency);
  const hint = decimals ? `0.${'0'.repeat(decimals)}` : '0';
  const symbol = getCurrencySymbol(currency);
  const empty = !value;
  // Long amounts step down a size so they never run into the currency pill.
  const fontSize = value.length <= 8 ? 44 : value.length <= 11 ? 36 : 30;
  const c = t.colors;

  const pill = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        height: 38,
        paddingLeft: 14,
        paddingRight: onCurrencyPress ? 8 : 14,
        borderRadius: t.radius.full,
        backgroundColor: c.surfaceAlt,
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      <Text variant="label" weight="bold">
        {currency}
      </Text>
      {onCurrencyPress ? <Icon name="expand-more" size={20} color={c.textSecondary} /> : null}
    </View>
  );

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      accessible={false}
      style={[
        {
          marginTop: t.spacing.sm,
          marginBottom: t.spacing.base,
          paddingHorizontal: 18,
          paddingTop: 14,
          paddingBottom: 12,
          borderRadius: t.radius.xl,
          backgroundColor: c.surface,
          borderWidth: 1.5,
          borderColor: focused ? c.primary : c.border,
        },
        t.elevation(focused ? 2 : 1) as object,
      ]}
    >
      <Text variant="overline" color={focused ? c.primary : c.textTertiary}>
        {label ?? tr('amount.label')}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}>
          {/* Symbol in a quieter weight, so the digits carry the row. */}
          <Text
            weight="semibold"
            color={empty ? c.textTertiary : c.textSecondary}
            style={{ fontSize: Math.round(fontSize * 0.62), lineHeight: DIGIT_HEIGHT, marginRight: 6 }}
          >
            {symbol}
          </Text>
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={change}
            placeholder={hint}
            placeholderTextColor={c.textTertiary}
            keyboardType={decimals ? 'decimal-pad' : 'number-pad'}
            autoFocus={autoFocus}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            selectionColor={c.primary}
            cursorColor={c.primary}
            accessibilityLabel={tr('amount.label')}
            style={{
              flex: 1,
              minWidth: 0,
              height: DIGIT_HEIGHT,
              paddingVertical: 0,
              paddingHorizontal: 0,
              fontFamily: t.fonts.extrabold,
              fontSize,
              letterSpacing: -1,
              color: c.text,
              includeFontPadding: false,
              textAlignVertical: 'center',
            }}
          />
        </View>

        {onCurrencyPress ? (
          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              onCurrencyPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={tr('amount.changeCurrency', { currency })}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            {pill}
          </Pressable>
        ) : (
          pill
        )}
      </View>

      <Text variant="caption" tone="tertiary" numberOfLines={1}>
        {currencyName(currency, lang)}
      </Text>
    </Pressable>
  );
};

export default memo(AmountInput);
