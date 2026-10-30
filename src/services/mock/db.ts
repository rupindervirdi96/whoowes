/**
 * Shared in-memory "database" for the mock services, so a write in one service
 * (e.g. a new expense) is visible to the others (e.g. group totals, balances).
 */

import {
  MOCK_EXPENSES,
  MOCK_FRIENDS,
  MOCK_GROUPS,
  MOCK_SETTLEMENTS,
  MOCK_USERS,
} from '../../constants/sampleData';
import type { Expense, Friend, Group, Receipt, Settlement, User } from '../../types';

export const db = {
  users: [...MOCK_USERS] as User[],
  friends: [...MOCK_FRIENDS] as Friend[],
  groups: [...MOCK_GROUPS] as Group[],
  expenses: [...MOCK_EXPENSES] as Expense[],
  settlements: [...MOCK_SETTLEMENTS] as Settlement[],
  receipts: new Map<string, Receipt>(),
};

export function findUser(id: string): User {
  return (
    db.users.find((u) => u.id === id) ?? {
      id,
      name: 'Unknown',
      email: '',
      createdAt: '',
      updatedAt: '',
    }
  );
}

/** Group totals are derived, never stored, so they can't drift. Kept per currency. */
export function withTotals(group: Group): Group {
  const inGroup = db.expenses.filter((e) => e.groupId === group.id);
  const sums = new Map<string, number>();
  for (const e of inGroup) sums.set(e.currency, (sums.get(e.currency) ?? 0) + e.amount);
  const totals = [...sums.entries()]
    .map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);
  const currency = group.currency ?? totals[0]?.currency;
  const last = inGroup.reduce((max, e) => (e.date > max ? e.date : max), group.updatedAt);
  return {
    ...group,
    currency,
    totals,
    totalExpenses: totals.find((t) => t.currency === currency)?.amount ?? 0,
    updatedAt: last,
  };
}
