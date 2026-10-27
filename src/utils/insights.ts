/**
 * Month-level spending stats. Numbers are always computed here (deterministic);
 * the AI only writes the narrative on top of them.
 */

import type { Expense, ExpenseCategory } from '../types';
import type { MonthStats } from '../services';
import { roundToCents } from './currency';

export function monthKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** "My share" of an expense — what it actually cost me. */
function myShare(e: Expense, userId: string): number {
  return e.splits.find((s) => s.userId === userId)?.amount ?? 0;
}

export function computeMonthStats(expenses: Expense[], userId: string, month: string): MonthStats {
  const inMonth = expenses.filter((e) => monthKey(e.date) === month);
  const prev = expenses.filter((e) => monthKey(e.date) === shiftMonth(month, -1));

  const byCat = new Map<ExpenseCategory, number>();
  const byPerson = new Map<string, { name: string; amount: number }>();
  for (const e of inMonth) {
    const share = myShare(e, userId);
    byCat.set(e.category, (byCat.get(e.category) ?? 0) + share);
    for (const s of e.splits) {
      if (s.userId === userId) continue;
      const cur = byPerson.get(s.userId) ?? { name: s.user.name, amount: 0 };
      cur.amount += s.amount;
      byPerson.set(s.userId, cur);
    }
  }

  return {
    month,
    total: roundToCents(inMonth.reduce((sum, e) => sum + myShare(e, userId), 0)),
    previousTotal: roundToCents(prev.reduce((sum, e) => sum + myShare(e, userId), 0)),
    byCategory: Array.from(byCat.entries())
      .map(([category, amount]) => ({ category, amount: roundToCents(amount) }))
      .sort((a, b) => b.amount - a.amount),
    topPeople: Array.from(byPerson.values())
      .map((p) => ({ name: p.name, amount: roundToCents(p.amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3),
    biggest: [...inMonth]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((e) => ({ title: e.title, amount: e.amount, category: e.category })),
    count: inMonth.length,
  };
}
