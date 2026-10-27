import React from 'react';
import { TextInput, View } from 'react-native';
import { useTheme } from '../../theme';
import { getCurrencySymbol } from '../../utils/currency';
import Text from './Text';

interface AmountInputProps {
  value: string;
  onChangeText: (v: string) => void;
  currency?: string;
  autoFocus?: boolean;
  label?: string;
}

/** Big, centered money input used at the top of money-entry screens. */
const AmountInput: React.FC<AmountInputProps> = ({ value, onChangeText, currency = 'USD', autoFocus, label }) => {
  const t = useTheme();
  const clean = (v: string) => {
    const normalized = v.replace(',', '.').replace(/[^0-9.]/g, '');
    const [whole, ...rest] = normalized.split('.');
    return rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
  };
  return (
    <View style={{ alignItems: 'center', paddingVertical: t.spacing.base }}>
      {label ? (
        <Text variant="overline" tone="tertiary" style={{ marginBottom: 6 }}>
          {label}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text variant="h1" tone={value ? 'default' : 'tertiary'} style={{ marginRight: 2 }}>
          {getCurrencySymbol(currency)}
        </Text>
        <TextInput
          value={value}
          onChangeText={(v) => onChangeText(clean(v))}
          placeholder="0.00"
          placeholderTextColor={t.colors.textTertiary}
          keyboardType="decimal-pad"
          autoFocus={autoFocus}
          selectionColor={t.colors.primary}
          accessibilityLabel="Amount"
          style={{
            fontFamily: t.fonts.extrabold,
            fontSize: 48,
            letterSpacing: -1.5,
            color: t.colors.text,
            // Size to the digits so the currency symbol stays next to them
            // (web would otherwise stretch the input to full width).
            width: Math.max(90, (value || '0.00').length * 30 + 16),
            paddingVertical: 0,
            textAlign: 'center',
          }}
        />
      </View>
    </View>
  );
};

export default AmountInput;
