import React from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useTheme } from '../../theme';
import { useT } from '../../i18n';
import { cleanAmountInput, currencyDecimals, getCurrencySymbol } from '../../utils/currency';
import Text from './Text';
import Icon from './Icon';

interface AmountInputProps {
  value: string;
  onChangeText: (v: string) => void;
  currency: string;
  /** Makes the currency tappable (opens a currency picker). */
  onCurrencyPress?: () => void;
  autoFocus?: boolean;
  label?: string;
}

/** Big, centered money input used at the top of money-entry screens. */
const AmountInput: React.FC<AmountInputProps> = ({ value, onChangeText, currency, onCurrencyPress, autoFocus, label }) => {
  const t = useTheme();
  const { t: tr } = useT();
  const decimals = currencyDecimals(currency);
  const placeholder = decimals ? `0.${'0'.repeat(decimals)}` : '0';
  const symbol = getCurrencySymbol(currency);

  const symbolText = (
    <Text variant="h1" tone={value ? 'default' : 'tertiary'} style={{ marginRight: 2 }}>
      {symbol}
    </Text>
  );

  return (
    <View style={{ alignItems: 'center', paddingVertical: t.spacing.base }}>
      {label ? (
        <Text variant="overline" tone="tertiary" style={{ marginBottom: 6 }}>
          {label}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {onCurrencyPress ? null : symbolText}
        <TextInput
          value={value}
          onChangeText={(v) => onChangeText(cleanAmountInput(v, currency))}
          placeholder={placeholder}
          placeholderTextColor={t.colors.textTertiary}
          keyboardType={decimals ? 'decimal-pad' : 'number-pad'}
          autoFocus={autoFocus}
          selectionColor={t.colors.primary}
          accessibilityLabel={tr('amount.label')}
          style={{
            fontFamily: t.fonts.extrabold,
            fontSize: 48,
            letterSpacing: -1.5,
            color: t.colors.text,
            // Size to the digits so the currency stays next to them
            // (web would otherwise stretch the input to full width).
            width: Math.max(90, (value || placeholder).length * 30 + 16),
            paddingVertical: 0,
            textAlign: 'center',
          }}
        />
      </View>
      {onCurrencyPress ? (
        <Pressable
          onPress={onCurrencyPress}
          accessibilityRole="button"
          accessibilityLabel={tr('amount.changeCurrency', { currency })}
          hitSlop={8}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginTop: 6,
            paddingHorizontal: 12,
            height: 32,
            borderRadius: 16,
            backgroundColor: t.colors.surfaceAlt,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text variant="label">
            {currency}
            {symbol !== currency ? ` · ${symbol}` : ''}
          </Text>
          <Icon name="expand-more" size={18} color={t.colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
};

export default AmountInput;
