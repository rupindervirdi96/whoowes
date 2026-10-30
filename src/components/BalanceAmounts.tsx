import React from 'react';
import { View } from 'react-native';
import type { CurrencyAmount } from '../types';
import { useT } from '../i18n';
import { formatCurrency } from '../utils/currency';
import Text from './ui/Text';

/**
 * Signed balances in one or more currencies, stacked on the right of a row:
 * green when they owe you, red when you owe. Currencies are never added together.
 */
const BalanceAmounts: React.FC<{ amounts: CurrencyAmount[]; caption?: string; max?: number }> = ({ amounts, caption, max = 2 }) => {
  const { t } = useT();
  const shown = amounts.slice(0, max);
  const hidden = amounts.length - shown.length;
  return (
    <View style={{ alignItems: 'flex-end' }}>
      {shown.map((a) => (
        <Text key={a.currency} variant="bodyStrong" tone={a.amount > 0 ? 'positive' : 'negative'} tabular>
          {formatCurrency(Math.abs(a.amount), a.currency)}
        </Text>
      ))}
      {hidden > 0 || caption ? (
        <Text variant="caption" tone="tertiary" style={{ marginTop: 3 }}>
          {hidden > 0 ? t('balances.moreCurrencies', { count: hidden }) : caption}
        </Text>
      ) : null}
    </View>
  );
};

/** "owes you" / "you owe" / "mixed" for a set of signed balances. */
export function balanceDirection(amounts: CurrencyAmount[]): 'owesYou' | 'youOwe' | 'mixed' | 'settled' {
  if (amounts.length === 0) return 'settled';
  if (amounts.every((a) => a.amount > 0)) return 'owesYou';
  if (amounts.every((a) => a.amount < 0)) return 'youOwe';
  return 'mixed';
}

export default BalanceAmounts;
