import type { Expense } from '../types';
import { expenseForMe } from './money';

const esc = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One row per expense, from the current user's point of view. */
export function expensesToCsv(expenses: Expense[], myId: string): string {
  const header = ['Date', 'Title', 'Category', 'Paid by', 'Total', 'Currency', 'Your share', 'Your position', 'Group'];
  const rows = expenses.map((e) => {
    const mine = e.splits.find((s) => s.userId === myId)?.amount ?? 0;
    const pos = expenseForMe(e, myId);
    return [
      e.date.slice(0, 10),
      e.title,
      e.category,
      e.paidByUser.name,
      e.amount.toFixed(2),
      e.currency,
      mine.toFixed(2),
      `${pos.label} ${pos.amount.toFixed(2)}`,
      e.groupId ?? '',
    ];
  });
  return [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
}
