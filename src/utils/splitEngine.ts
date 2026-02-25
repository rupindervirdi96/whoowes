/**
 * Expense Splitting Engine
 *
 * Handles all split calculation logic:
 * - Equal split (with cent remainder distribution)
 * - Custom amount split (validates total equals expense amount)
 * - Percentage split (validates percentages sum to 100)
 * - Item-based split (assigns items to participants)
 *
 * All functions are pure and testable.
 */

import { ExpenseItem, ExpenseSplit, SplitType, User } from '../types';
import { roundToCents, distributeEvenly } from './currency';

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface SplitParticipant {
  userId: string;
  user: User;
}

export interface EqualSplitInput {
  type: 'equal';
  total: number;
  participants: SplitParticipant[];
  paidBy: string;
}

export interface CustomSplitInput {
  type: 'custom';
  total: number;
  assignments: Array<{ userId: string; user: User; amount: number }>;
  paidBy: string;
}

export interface PercentageSplitInput {
  type: 'percentage';
  total: number;
  assignments: Array<{ userId: string; user: User; percentage: number }>;
  paidBy: string;
}

export interface ItemBasedSplitInput {
  type: 'item_based';
  total: number;
  items: ExpenseItem[];
  participants: SplitParticipant[];
  paidBy: string;
}

export type SplitInput =
  | EqualSplitInput
  | CustomSplitInput
  | PercentageSplitInput
  | ItemBasedSplitInput;

// ─── Output Type ──────────────────────────────────────────────────────────────

export interface SplitResult {
  splits: ExpenseSplit[];
  isValid: boolean;
  error?: string;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

/**
 * Main split calculation entry point.
 * Dispatches to the appropriate algorithm based on split type.
 */
export function calculateSplit(input: SplitInput): SplitResult {
  switch (input.type) {
    case 'equal':
      return calculateEqualSplit(input);
    case 'custom':
      return calculateCustomSplit(input);
    case 'percentage':
      return calculatePercentageSplit(input);
    case 'item_based':
      return calculateItemBasedSplit(input);
  }
}

// ─── Equal Split ──────────────────────────────────────────────────────────────

function calculateEqualSplit(input: EqualSplitInput): SplitResult {
  const { total, participants, paidBy } = input;

  if (participants.length === 0) {
    return { splits: [], isValid: false, error: 'No participants selected' };
  }

  // Distribute evenly and give any cent remainder to the last person
  const amounts = distributeEvenly(total, participants.length);

  const splits: ExpenseSplit[] = participants.map((p, index) => ({
    userId: p.userId,
    user: p.user,
    amount: amounts[index],
    paid: p.userId === paidBy,
  }));

  return { splits, isValid: true };
}

// ─── Custom Split ─────────────────────────────────────────────────────────────

function calculateCustomSplit(input: CustomSplitInput): SplitResult {
  const { total, assignments, paidBy } = input;

  if (assignments.length === 0) {
    return { splits: [], isValid: false, error: 'No participants selected' };
  }

  // Validate that custom amounts sum to total (within 1 cent tolerance)
  const sum = assignments.reduce((acc, a) => acc + a.amount, 0);
  const diff = Math.abs(roundToCents(sum) - roundToCents(total));
  if (diff > 0.01) {
    return {
      splits: [],
      isValid: false,
      error: `Custom amounts (${sum.toFixed(2)}) must equal total (${total.toFixed(2)})`,
    };
  }

  const splits: ExpenseSplit[] = assignments.map((a) => ({
    userId: a.userId,
    user: a.user,
    amount: roundToCents(a.amount),
    paid: a.userId === paidBy,
  }));

  return { splits, isValid: true };
}

// ─── Percentage Split ─────────────────────────────────────────────────────────

function calculatePercentageSplit(input: PercentageSplitInput): SplitResult {
  const { total, assignments, paidBy } = input;

  if (assignments.length === 0) {
    return { splits: [], isValid: false, error: 'No participants selected' };
  }

  // Validate percentages sum to ~100%
  const totalPct = assignments.reduce((acc, a) => acc + a.percentage, 0);
  if (Math.abs(totalPct - 100) > 0.01) {
    return {
      splits: [],
      isValid: false,
      error: `Percentages must sum to 100% (currently ${totalPct.toFixed(1)}%)`,
    };
  }

  // Calculate amounts; give rounding remainder to the last person
  const rawAmounts = assignments.map((a) =>
    Math.floor((a.percentage / 100) * total * 100),
  );
  const roundedTotal = rawAmounts.reduce((sum, a) => sum + a, 0);
  const remainder = Math.round(total * 100) - roundedTotal;

  const splits: ExpenseSplit[] = assignments.map((a, i) => ({
    userId: a.userId,
    user: a.user,
    percentage: a.percentage,
    amount: roundToCents(
      (rawAmounts[i] + (i === assignments.length - 1 ? remainder : 0)) / 100,
    ),
    paid: a.userId === paidBy,
  }));

  return { splits, isValid: true };
}

// ─── Item-Based Split ─────────────────────────────────────────────────────────

function calculateItemBasedSplit(input: ItemBasedSplitInput): SplitResult {
  const { total, items, participants, paidBy } = input;

  if (participants.length === 0) {
    return { splits: [], isValid: false, error: 'No participants selected' };
  }

  // Calculate how much each user owes based on items assigned to them
  const userAmounts: Record<string, number> = {};
  participants.forEach((p) => {
    userAmounts[p.userId] = 0;
  });

  let assignedTotal = 0;
  for (const item of items) {
    const itemTotal = item.price * item.quantity;
    if (item.assignedTo.length === 0) {
      // Unassigned items → split equally among all participants
      const perPerson = itemTotal / participants.length;
      participants.forEach((p) => {
        userAmounts[p.userId] = roundToCents(userAmounts[p.userId] + perPerson);
      });
    } else {
      const perPerson = itemTotal / item.assignedTo.length;
      item.assignedTo.forEach((uid) => {
        if (userAmounts[uid] !== undefined) {
          userAmounts[uid] = roundToCents(userAmounts[uid] + perPerson);
        }
      });
    }
    assignedTotal += itemTotal;
  }

  // Distribute any remaining amount (tax/fees gap) equally
  const gap = roundToCents(total - assignedTotal);
  if (Math.abs(gap) > 0.01) {
    const gapPerPerson = gap / participants.length;
    participants.forEach((p) => {
      userAmounts[p.userId] = roundToCents(userAmounts[p.userId] + gapPerPerson);
    });
  }

  const splits: ExpenseSplit[] = participants.map((p) => ({
    userId: p.userId,
    user: p.user,
    amount: roundToCents(userAmounts[p.userId] ?? 0),
    paid: p.userId === paidBy,
  }));

  return { splits, isValid: true };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns display-friendly label for a split type.
 */
export function getSplitTypeLabel(type: SplitType): string {
  const labels: Record<SplitType, string> = {
    equal: 'Split Equally',
    custom: 'Custom Amounts',
    percentage: 'By Percentage',
    item_based: 'By Item',
  };
  return labels[type];
}

/**
 * Returns the current user's share from a list of splits.
 */
export function getMyShare(splits: ExpenseSplit[], userId: string): number {
  return splits.find((s) => s.userId === userId)?.amount ?? 0;
}
