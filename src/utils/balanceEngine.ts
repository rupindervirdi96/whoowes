/**
 * Balance Engine — pure functions, no side effects.
 *
 * Conventions: a positive balance means "is owed money", negative means "owes money".
 * Only unpaid splits and *confirmed* settlements move balances; pending payments don't.
 */

import { Expense, Settlement, User, UserBalance, DebtSimplification } from '../types';
import { roundToCents } from './currency';

const unknownUser = (id: string): User => ({ id, name: 'Unknown', email: '', createdAt: '', updatedAt: '' });

/**
 * Net position of every person across the given expenses and settlements.
 */
export function computeNetPositions(
  expenses: Expense[],
  settlements: Settlement[],
): Record<string, number> {
  const net: Record<string, number> = {};
  const add = (id: string, delta: number) => {
    net[id] = roundToCents((net[id] ?? 0) + delta);
  };

  for (const e of expenses) {
    for (const s of e.splits) {
      if (s.userId === e.paidBy || s.paid) continue;
      add(e.paidBy, s.amount);
      add(s.userId, -s.amount);
    }
  }
  for (const s of settlements) {
    if (s.status !== 'confirmed') continue;
    add(s.fromUserId, s.amount);
    add(s.toUserId, -s.amount);
  }
  return net;
}

/**
 * Per-person balance relative to `currentUserId` (who owes me / whom I owe).
 */
export function computeUserBalances(
  expenses: Expense[],
  settlements: Settlement[],
  currentUserId: string,
  allUsers: User[],
): UserBalance[] {
  const userMap: Record<string, User> = {};
  allUsers.forEach((u) => (userMap[u.id] = u));

  const netMap: Record<string, number> = {};
  const add = (id: string, delta: number) => {
    netMap[id] = roundToCents((netMap[id] ?? 0) + delta);
  };

  for (const expense of expenses) {
    for (const split of expense.splits) {
      if (split.paid) continue;
      if (expense.paidBy === currentUserId && split.userId !== currentUserId) {
        add(split.userId, split.amount); // they owe me
      } else if (split.userId === currentUserId && expense.paidBy !== currentUserId) {
        add(expense.paidBy, -split.amount); // I owe them
      }
    }
  }

  for (const s of settlements) {
    if (s.status !== 'confirmed') continue;
    if (s.fromUserId === currentUserId) add(s.toUserId, s.amount);
    else if (s.toUserId === currentUserId) add(s.fromUserId, -s.amount);
  }

  return Object.entries(netMap)
    .filter(([, net]) => Math.abs(net) >= 0.01)
    .map(([userId, net]) => ({
      userId,
      user: userMap[userId] ?? unknownUser(userId),
      owes: net < 0 ? roundToCents(-net) : 0,
      owed: net > 0 ? roundToCents(net) : 0,
      netBalance: roundToCents(net),
    }))
    .sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance));
}

export function computeTotals(balances: UserBalance[]) {
  const totalOwed = roundToCents(balances.reduce((sum, b) => sum + b.owed, 0));
  const totalOwes = roundToCents(balances.reduce((sum, b) => sum + b.owes, 0));
  return { totalOwed, totalOwes, netBalance: roundToCents(totalOwed - totalOwes) };
}

/**
 * Greedy debt simplification: pair the biggest creditor with the biggest debtor
 * until everyone is square. Produces at most n-1 payments.
 */
export function simplifyDebts(
  net: Record<string, number>,
  userMap: Record<string, User>,
): DebtSimplification[] {
  type Entry = { userId: string; amount: number };
  const creditors: Entry[] = [];
  const debtors: Entry[] = [];
  for (const [userId, amount] of Object.entries(net)) {
    if (amount > 0.01) creditors.push({ userId, amount });
    else if (amount < -0.01) debtors.push({ userId, amount: -amount });
  }
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const result: DebtSimplification[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const amount = roundToCents(Math.min(creditors[ci].amount, debtors[di].amount));
    if (amount >= 0.01) {
      result.push({
        from: debtors[di].userId,
        to: creditors[ci].userId,
        amount,
        fromUser: userMap[debtors[di].userId] ?? unknownUser(debtors[di].userId),
        toUser: userMap[creditors[ci].userId] ?? unknownUser(creditors[ci].userId),
      });
    }
    creditors[ci].amount = roundToCents(creditors[ci].amount - amount);
    debtors[di].amount = roundToCents(debtors[di].amount - amount);
    if (creditors[ci].amount < 0.01) ci++;
    if (debtors[di].amount < 0.01) di++;
  }
  return result;
}

/**
 * Everything a group screen needs: each member's net position and the
 * minimum set of payments that squares the group.
 */
export function computeGroupBalances(
  expenses: Expense[],
  settlements: Settlement[],
  members: User[],
) {
  const net = computeNetPositions(expenses, settlements);
  const userMap: Record<string, User> = {};
  members.forEach((m) => (userMap[m.id] = m));
  const memberNets = members.map((m) => ({ user: m, net: net[m.id] ?? 0 }));
  memberNets.sort((a, b) => b.net - a.net);
  return { memberNets, debts: simplifyDebts(net, userMap) };
}
