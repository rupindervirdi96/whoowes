/**
 * Friend insights — pure functions over expenses and payments, no side effects.
 *
 *   openSince   how long a balance with someone has been open
 *   whoseTurn   who usually picks up the bill between two people
 *   sharedStats what two people have split together
 */

import type { Expense, ExpenseCategory, Settlement } from '../types';
import { orderCurrencies } from './balanceEngine';
import { roundToCents } from './currency';
import { translate } from '../i18n';

const DAY = 24 * 60 * 60_000;

/** A balance this old gets an amber "getting old" look and a nudge to remind. */
export const STALE_AFTER_DAYS = 30;

/**
 * When the oldest unpaid part of a balance started. Payments are treated as
 * paying off the oldest debts first, so this is the date of the oldest expense
 * still (partly) unpaid. `net` is my balance with them in this currency:
 * positive when they owe me.
 */
export function openSince(
  expenses: Expense[],
  settlements: Settlement[],
  myId: string,
  friendId: string,
  currency: string,
  net: number,
): string | null {
  if (Math.abs(net) < 0.01) return null;
  const theyOwe = net > 0;
  const creditor = theyOwe ? myId : friendId;
  const debtor = theyOwe ? friendId : myId;

  // Everything that added to this balance, newest first.
  const items: { date: string; amount: number }[] = [];
  for (const e of expenses) {
    if (e.currency !== currency || e.paidBy !== creditor) continue;
    const split = e.splits.find((s) => s.userId === debtor && !s.paid);
    if (split && split.amount > 0) items.push({ date: e.date, amount: split.amount });
  }
  for (const s of settlements) {
    // Paying someone more than you owed them flips the balance the other way.
    if (s.status === 'confirmed' && s.currency === currency && s.fromUserId === creditor && s.toUserId === debtor) {
      items.push({ date: s.updatedAt, amount: s.amount });
    }
  }
  items.sort((a, b) => b.date.localeCompare(a.date));

  // Walk back from the newest until the open amount is covered.
  let covered = 0;
  for (const item of items) {
    covered = roundToCents(covered + item.amount);
    if (covered >= Math.abs(net) - 0.005) return item.date;
  }
  return items.at(-1)?.date ?? null;
}

/** Whole days since a date. */
export function daysSince(iso: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY));
}

/** "3 days", "6 weeks", "4 months"; null under a day (too fresh to mention). */
export function ageLabel(iso: string, now = Date.now()): string | null {
  const days = daysSince(iso, now);
  if (days < 1) return null;
  if (days < 14) return translate('age.days', { count: days });
  if (days < 60) return translate('age.weeks', { count: Math.floor(days / 7) });
  return translate('age.months', { count: Math.floor(days / 30) });
}

/** Expenses between exactly these two people's wallets: one of them paid, the other had a share. */
function betweenUs(expenses: Expense[], myId: string, friendId: string) {
  return expenses.filter(
    (e) =>
      (e.paidBy === myId && e.splits.some((s) => s.userId === friendId && s.amount > 0)) ||
      (e.paidBy === friendId && e.splits.some((s) => s.userId === myId && s.amount > 0)),
  );
}

export interface WhoseTurn {
  /** Of the last `total` bills between us, how many I paid and how many they did. */
  mine: number;
  theirs: number;
  total: number;
  /** Who should pay next: whoever has paid fewer. */
  next: 'me' | 'them' | 'even';
}

const TURN_WINDOW = 10;
const TURN_MIN = 3;

/** Who usually pays, over the last 10 bills between us. Null until there are at least 3. */
export function whoseTurn(expenses: Expense[], myId: string, friendId: string): WhoseTurn | null {
  const recent = betweenUs(expenses, myId, friendId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, TURN_WINDOW);
  if (recent.length < TURN_MIN) return null;
  const mine = recent.filter((e) => e.paidBy === myId).length;
  const theirs = recent.length - mine;
  return { mine, theirs, total: recent.length, next: mine === theirs ? 'even' : mine > theirs ? 'them' : 'me' };
}

export interface SharedStats {
  /** Expenses we're both part of (including group ones). */
  count: number;
  /** What those expenses added up to, in the currency we use most. */
  total: number;
  currency: string;
  /** Other currencies we've also used, not added in. */
  otherCurrencies: number;
  /** The category we split most often, if there's a clear one. */
  topCategory: ExpenseCategory | null;
}

/** What two people have split together. `shared` = expenses both of them are in. */
export function sharedStats(shared: Expense[], preferred?: string): SharedStats | null {
  if (!shared.length) return null;
  const byCurrency = new Map<string, number>();
  const byCategory = new Map<ExpenseCategory, number>();
  for (const e of shared) {
    byCurrency.set(e.currency, roundToCents((byCurrency.get(e.currency) ?? 0) + e.amount));
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + 1);
  }
  const currencies = orderCurrencies(byCurrency.keys(), preferred, (c) => byCurrency.get(c)!);
  // Most-used currency wins; the preferred one only breaks ties.
  const currency = [...currencies].sort((a, b) => shared.filter((e) => e.currency === b).length - shared.filter((e) => e.currency === a).length)[0];
  const [topCategory, topCount] = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    count: shared.length,
    total: byCurrency.get(currency)!,
    currency,
    otherCurrencies: currencies.length - 1,
    // "Other" isn't much of an insight, and one expense isn't a pattern.
    topCategory: topCategory !== 'other' && topCount >= 2 ? topCategory : null,
  };
}
