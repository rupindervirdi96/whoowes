/**
 * How an expense or payment looks from the current user's point of view.
 */

import type { Expense, Settlement } from '../types';
import { roundToCents } from './currency';

export type MoneyTone = 'positive' | 'negative' | 'tertiary';

export function expenseForMe(e: Expense, myId: string): { label: string; amount: number; tone: MoneyTone } {
  const mine = e.splits.find((s) => s.userId === myId);
  if (e.paidBy === myId) {
    const owedToMe = roundToCents(
      e.splits.filter((s) => s.userId !== myId && !s.paid).reduce((sum, s) => sum + s.amount, 0),
    );
    if (owedToMe === 0) return { label: 'settled', amount: 0, tone: 'tertiary' };
    return { label: 'you lent', amount: owedToMe, tone: 'positive' };
  }
  if (!mine) return { label: 'not involved', amount: 0, tone: 'tertiary' };
  if (mine.paid) return { label: 'you paid back', amount: mine.amount, tone: 'tertiary' };
  return { label: 'you borrowed', amount: mine.amount, tone: 'negative' };
}

export function settlementForMe(s: Settlement, myId: string) {
  const outgoing = s.fromUserId === myId;
  const other = outgoing ? s.toUser : s.fromUser;
  return { outgoing, other };
}

export function firstName(name: string) {
  return name.split(' ')[0];
}
