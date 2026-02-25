/**
 * Balance Engine
 *
 * Computes:
 * 1. Per-user net balances from a list of expenses and settlements.
 * 2. Group-level balances.
 * 3. Simplified debt (minimizes number of transactions needed).
 *
 * All functions are pure and side-effect free.
 */

import { Expense, Settlement, User, UserBalance, DebtSimplification } from '../types';
import { roundToCents } from './currency';

// ─── Internal Types ───────────────────────────────────────────────────────────

interface BalanceMap {
  [userId: string]: {
    user: User;
    owes: number;   // how much this user owes others in total
    owed: number;   // how much others owe this user in total
  };
}

// ─── Per-Pair Balance Engine ──────────────────────────────────────────────────

/**
 * Builds a map of { userId → { net balance relative to all other users } }
 * from a list of expenses.
 *
 * A positive netBalance means others owe you money.
 * A negative netBalance means you owe others money.
 */
export function computeUserBalances(
  expenses: Expense[],
  settlements: Settlement[],
  currentUserId: string,
  allUsers: User[],
): UserBalance[] {
  const userMap: Record<string, User> = {};
  allUsers.forEach((u) => (userMap[u.id] = u));

  // Track net balance per user relative to currentUser
  const netMap: Record<string, number> = {};

  // Process expenses
  for (const expense of expenses) {
    for (const split of expense.splits) {
      if (split.paid) continue; // settled split

      const paidBy = expense.paidBy;
      const owedBy = split.userId;
      const amount = split.amount;

      if (paidBy === currentUserId && owedBy !== currentUserId) {
        // Others owe me
        netMap[owedBy] = roundToCents((netMap[owedBy] ?? 0) + amount);
      } else if (owedBy === currentUserId && paidBy !== currentUserId) {
        // I owe others
        netMap[paidBy] = roundToCents((netMap[paidBy] ?? 0) - amount);
      }
    }
  }

  // Process confirmed settlements (reduce outstanding balances)
  for (const settlement of settlements) {
    if (settlement.status === 'confirmed') {
      if (settlement.fromUserId === currentUserId) {
        // I paid someone
        netMap[settlement.toUserId] = roundToCents(
          (netMap[settlement.toUserId] ?? 0) + settlement.amount,
        );
      } else if (settlement.toUserId === currentUserId) {
        // Someone paid me
        netMap[settlement.fromUserId] = roundToCents(
          (netMap[settlement.fromUserId] ?? 0) - settlement.amount,
        );
      }
    }
  }

  // Convert map to UserBalance array
  return Object.entries(netMap)
    .filter(([, net]) => Math.abs(net) >= 0.01)
    .map(([userId, net]) => {
      const user = userMap[userId] ?? { id: userId, name: 'Unknown', email: '', createdAt: '', updatedAt: '' };
      return {
        userId,
        user,
        owes: net < 0 ? roundToCents(Math.abs(net)) : 0,
        owed: net > 0 ? roundToCents(net) : 0,
        netBalance: roundToCents(net),
      };
    });
}

/**
 * Computes how much the current user owes in total, and how much they are owed.
 */
export function computeTotals(balances: UserBalance[]): {
  totalOwed: number;
  totalOwes: number;
  netBalance: number;
} {
  const totalOwed = roundToCents(
    balances.reduce((sum, b) => sum + b.owed, 0),
  );
  const totalOwes = roundToCents(
    balances.reduce((sum, b) => sum + b.owes, 0),
  );
  return {
    totalOwed,
    totalOwes,
    netBalance: roundToCents(totalOwed - totalOwes),
  };
}

// ─── Simplified Debt ──────────────────────────────────────────────────────────

/**
 * Implements the "greedy" debt simplification algorithm.
 * Minimizes the number of payments needed to settle all debts in a group.
 *
 * Approach:
 * 1. Compute net balance for each person.
 * 2. Greedily pair largest creditor with largest debtor.
 * 3. Repeat until all balances are zero.
 */
export function simplifyDebts(
  expenses: Expense[],
  userMap: Record<string, User>,
): DebtSimplification[] {
  // Step 1: Compute net balance per user across all expenses
  const net: Record<string, number> = {};

  for (const expense of expenses) {
    // Payer gets credited
    net[expense.paidBy] = roundToCents((net[expense.paidBy] ?? 0) + expense.amount);

    // Each participant is debited their share
    for (const split of expense.splits) {
      net[split.userId] = roundToCents((net[split.userId] ?? 0) - split.amount);
    }
  }

  // Step 2: Separate into creditors and debtors
  type NetEntry = { userId: string; amount: number };
  const creditors: NetEntry[] = [];
  const debtors: NetEntry[] = [];

  Object.entries(net).forEach(([userId, amount]) => {
    if (amount > 0.01) creditors.push({ userId, amount });
    else if (amount < -0.01) debtors.push({ userId, amount: Math.abs(amount) });
  });

  // Sort descending by amount for greedy matching
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  // Step 3: Greedy matching
  const result: DebtSimplification[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const amount = roundToCents(Math.min(creditor.amount, debtor.amount));

    if (amount >= 0.01) {
      const fromUser = userMap[debtor.userId] ?? {
        id: debtor.userId, name: 'Unknown', email: '', createdAt: '', updatedAt: '',
      };
      const toUser = userMap[creditor.userId] ?? {
        id: creditor.userId, name: 'Unknown', email: '', createdAt: '', updatedAt: '',
      };
      result.push({
        from: debtor.userId,
        to: creditor.userId,
        amount,
        fromUser,
        toUser,
      });
    }

    creditors[ci].amount = roundToCents(creditor.amount - amount);
    debtors[di].amount = roundToCents(debtor.amount - amount);

    if (creditors[ci].amount < 0.01) ci++;
    if (debtors[di].amount < 0.01) di++;
  }

  return result;
}

/**
 * Filters simplified debts to only show transactions involving a specific user.
 */
export function getDebtsForUser(
  debts: DebtSimplification[],
  userId: string,
): DebtSimplification[] {
  return debts.filter((d) => d.from === userId || d.to === userId);
}
