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

/** Group totals are derived, never stored, so they can't drift. */
export function withTotals(group: Group): Group {
  const totalExpenses = db.expenses
    .filter((e) => e.groupId === group.id)
    .reduce((sum, e) => sum + e.amount, 0);
  const last = db.expenses
    .filter((e) => e.groupId === group.id)
    .reduce((max, e) => (e.date > max ? e.date : max), group.updatedAt);
  return { ...group, totalExpenses: Math.round(totalExpenses * 100) / 100, updatedAt: last };
}
