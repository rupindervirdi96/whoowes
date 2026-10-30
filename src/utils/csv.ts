import type { Expense } from '../types';
import { translate } from '../i18n';
import { categoryLabel } from '../constants';
import { expenseForMe } from './money';
import { currencyDecimals } from './currency';

const esc = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One row per expense, from the current user's point of view. Headers in the app language. */
export function expensesToCsv(expenses: Expense[], myId: string): string {
  const header = [
    translate('csv.date'),
    translate('csv.title'),
    translate('csv.category'),
    translate('csv.paidBy'),
    translate('csv.total'),
    translate('csv.currency'),
    translate('csv.yourShare'),
    translate('csv.yourPosition'),
    translate('csv.group'),
  ];
  const rows = expenses.map((e) => {
    const digits = currencyDecimals(e.currency);
    const mine = e.splits.find((s) => s.userId === myId)?.amount ?? 0;
    const pos = expenseForMe(e, myId);
    return [
      e.date.slice(0, 10),
      e.title,
      categoryLabel(e.category),
      e.paidByUser.name,
      e.amount.toFixed(digits),
      e.currency,
      mine.toFixed(digits),
      `${pos.label} ${pos.amount.toFixed(digits)}`,
      e.groupId ?? '',
    ];
  });
  return [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
}
