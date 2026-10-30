/**
 * How an expense or payment looks from the current user's point of view.
 */

import type { Expense, Settlement } from '../types';
import { translate, type TKey } from '../i18n';
import { roundToCents } from './currency';

export type MoneyTone = 'positive' | 'negative' | 'tertiary';

const LABELS = {
  settled: 'position.settled',
  lent: 'position.lent',
  notInvolved: 'position.notInvolved',
  paidBack: 'position.paidBack',
  borrowed: 'position.borrowed',
} as const satisfies Record<string, TKey>;

/** My position on an expense. `label` is translated; amounts are in expense.currency. */
export function expenseForMe(e: Expense, myId: string): { kind: keyof typeof LABELS; label: string; amount: number; tone: MoneyTone } {
  const mine = e.splits.find((s) => s.userId === myId);
  const make = (kind: keyof typeof LABELS, amount: number, tone: MoneyTone) => ({ kind, label: translate(LABELS[kind]), amount, tone });
  if (e.paidBy === myId) {
    const owedToMe = roundToCents(
      e.splits.filter((s) => s.userId !== myId && !s.paid).reduce((sum, s) => sum + s.amount, 0),
    );
    if (owedToMe === 0) return make('settled', 0, 'tertiary');
    return make('lent', owedToMe, 'positive');
  }
  if (!mine) return make('notInvolved', 0, 'tertiary');
  if (mine.paid) return make('paidBack', mine.amount, 'tertiary');
  return make('borrowed', mine.amount, 'negative');
}

export function settlementForMe(s: Settlement, myId: string) {
  const outgoing = s.fromUserId === myId;
  const other = outgoing ? s.toUser : s.fromUser;
  return { outgoing, other };
}

export function firstName(name: string) {
  return name.split(' ')[0];
}
