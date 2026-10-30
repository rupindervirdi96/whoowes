/**
 * Month-level spending stats. Numbers are always computed here (deterministic);
 * the AI only writes the narrative on top of them.
 *
 * Stats cover one currency at a time; amounts in other currencies are never mixed in.
 */

import type { Expense, ExpenseCategory } from '../types';
import type { MonthStats } from '../services';
import { roundToCents } from './currency';
import { formatMonthYear } from './date';

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
  return formatMonthYear(new Date(y, m - 1, 1));
}

/** "My share" of an expense — what it actually cost me. */
function myShare(e: Expense, userId: string): number {
  return e.splits.find((s) => s.userId === userId)?.amount ?? 0;
}

/** Currencies I spent in during a month, most spent first (preferred currency wins ties). */
export function monthCurrencies(expenses: Expense[], userId: string, month: string, preferred?: string): string[] {
  const totals = new Map<string, number>();
  for (const e of expenses) {
    if (monthKey(e.date) !== month) continue;
    totals.set(e.currency, (totals.get(e.currency) ?? 0) + myShare(e, userId));
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] === preferred ? -1 : b[0] === preferred ? 1 : 0))
    .map(([c]) => c);
}

export function computeMonthStats(expenses: Expense[], userId: string, month: string, currency?: string, preferred?: string): MonthStats {
  const available = monthCurrencies(expenses, userId, month, preferred);
  const chosen = currency && available.includes(currency) ? currency : (available[0] ?? preferred ?? 'USD');
  const inCurrency = expenses.filter((e) => e.currency === chosen);
  const inMonth = inCurrency.filter((e) => monthKey(e.date) === month);
  const prev = inCurrency.filter((e) => monthKey(e.date) === shiftMonth(month, -1));

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
    currency: chosen,
    currencies: available,
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
