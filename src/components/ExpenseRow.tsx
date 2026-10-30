import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { Expense } from '../types';
import { useTheme } from '../theme';
import { useT } from '../i18n';
import { formatCurrency } from '../utils/currency';
import { formatSmartDate } from '../utils/date';
import { expenseForMe, firstName } from '../utils/money';
import Text from './ui/Text';
import CategoryIcon from './ui/CategoryIcon';
import Icon from './ui/Icon';
import { RowAmount } from './ui/ListRow';

interface ExpenseRowProps {
  expense: Expense;
  myId: string;
  /** Hairline under the row (inside list cards). */
  divider?: boolean;
}

/** One expense: what it was, who paid, and what it means for me. */
const ExpenseRow: React.FC<ExpenseRowProps> = ({ expense, myId, divider }) => {
  const t = useTheme();
  const { t: tr } = useT();
  const navigation = useNavigation();
  const mine = expenseForMe(expense, myId);
  const total = formatCurrency(expense.amount, expense.currency);
  const share = formatCurrency(mine.amount, expense.currency);
  const paidLine =
    expense.paidBy === myId ? tr('expenseRow.youPaid', { amount: total }) : tr('expenseRow.theyPaid', { name: firstName(expense.paidByUser.name), amount: total });
  const tone = mine.tone === 'tertiary' ? 'tertiary' : mine.tone;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${expense.title}, ${total}, ${mine.label} ${share}`}
      onPress={() => navigation.navigate('ExpenseDetail', { expenseId: expense.id })}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, opacity: pressed ? 0.6 : 1 })}
    >
      <CategoryIcon category={expense.category} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
            {expense.title}
          </Text>
          {expense.receiptId ? <Icon name="receipt-long" size={14} color={t.colors.textTertiary} /> : null}
        </View>
        <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ marginTop: 3 }}>
          {paidLine} · {formatSmartDate(expense.date)}
        </Text>
      </View>
      {mine.amount > 0 ? (
        <RowAmount amount={share} caption={mine.label} tone={tone} />
      ) : (
        <Text variant="caption" tone="tertiary">
          {mine.label}
        </Text>
      )}
      {divider ? (
        <View
          style={{ position: 'absolute', left: 54, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: t.colors.border }}
        />
      ) : null}
    </Pressable>
  );
};

export default ExpenseRow;
