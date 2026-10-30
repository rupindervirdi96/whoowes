/**
 * Balance Engine — pure functions, no side effects.
 *
 * Conventions: a positive balance means "is owed money", negative means "owes money".
 * Only unpaid splits and *confirmed* settlements move balances; pending payments don't.
 *
 * Every balance is per currency. Amounts in different currencies are never added
 * together or converted: owing someone €10 and being owed $10 are two balances.
 */

import { CurrencyAmount, CurrencyTotals, Expense, Settlement, User, UserBalance, DebtSimplification } from '../types';
import { roundToCents } from './currency';

const unknownUser = (id: string): User => ({ id, name: 'Unknown', email: '', createdAt: '', updatedAt: '' });
const settled = (n: number) => Math.abs(n) < 0.005;

/** Currencies in display order: the preferred one first, then by how much is at stake. */
export function orderCurrencies(currencies: Iterable<string>, preferred?: string, weight?: (c: string) => number): string[] {
  return [...new Set(currencies)].sort((a, b) => {
    if (a === preferred) return -1;
    if (b === preferred) return 1;
    return (weight ? weight(b) - weight(a) : 0) || a.localeCompare(b);
  });
}

/**
 * Net position of every person, per currency: { CAD: { alex: 12.5, sam: -12.5 } }.
 */
export function computeNetPositions(
  expenses: Expense[],
  settlements: Settlement[],
): Record<string, Record<string, number>> {
  const net: Record<string, Record<string, number>> = {};
  const add = (currency: string, id: string, delta: number) => {
    const bucket = (net[currency] ??= {});
    bucket[id] = roundToCents((bucket[id] ?? 0) + delta);
  };

  for (const e of expenses) {
    for (const s of e.splits) {
      if (s.userId === e.paidBy || s.paid) continue;
      add(e.currency, e.paidBy, s.amount);
      add(e.currency, s.userId, -s.amount);
    }
  }
  for (const s of settlements) {
    if (s.status !== 'confirmed') continue;
    add(s.currency, s.fromUserId, s.amount);
    add(s.currency, s.toUserId, -s.amount);
  }
  return net;
}

/** One person's net position in each currency, non-zero only. */
export function netsFor(net: Record<string, Record<string, number>>, userId: string): CurrencyAmount[] {
  return Object.entries(net)
    .map(([currency, people]) => ({ currency, amount: people[userId] ?? 0 }))
    .filter((x) => !settled(x.amount));
}

/**
 * My balance with every person, one entry per (person, currency).
 */
export function computeUserBalances(
  expenses: Expense[],
  settlements: Settlement[],
  currentUserId: string,
  allUsers: User[],
): UserBalance[] {
  const userMap: Record<string, User> = {};
  allUsers.forEach((u) => (userMap[u.id] = u));

  const netMap: Record<string, number> = {}; // key: `${userId}|${currency}`
  const add = (userId: string, currency: string, delta: number) => {
    const key = `${userId}|${currency}`;
    netMap[key] = roundToCents((netMap[key] ?? 0) + delta);
  };

  for (const expense of expenses) {
    for (const split of expense.splits) {
      if (split.paid) continue;
      if (expense.paidBy === currentUserId && split.userId !== currentUserId) {
        add(split.userId, expense.currency, split.amount); // they owe me
      } else if (split.userId === currentUserId && expense.paidBy !== currentUserId) {
        add(expense.paidBy, expense.currency, -split.amount); // I owe them
      }
    }
  }

  for (const s of settlements) {
    if (s.status !== 'confirmed') continue;
    if (s.fromUserId === currentUserId) add(s.toUserId, s.currency, s.amount);
    else if (s.toUserId === currentUserId) add(s.fromUserId, s.currency, -s.amount);
  }

  return Object.entries(netMap)
    .filter(([, net]) => Math.abs(net) >= 0.01)
    .map(([key, net]) => {
      const [userId, currency] = key.split('|');
      return {
        userId,
        user: userMap[userId] ?? unknownUser(userId),
        currency,
        owes: net < 0 ? roundToCents(-net) : 0,
        owed: net > 0 ? roundToCents(net) : 0,
        netBalance: roundToCents(net),
      };
    })
    .sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance));
}

/** My totals in each currency, preferred currency first. */
export function computeTotals(balances: UserBalance[], preferred?: string): CurrencyTotals[] {
  const byCurrency = new Map<string, CurrencyTotals>();
  for (const b of balances) {
    const row = byCurrency.get(b.currency) ?? { currency: b.currency, totalOwed: 0, totalOwes: 0, netBalance: 0 };
    row.totalOwed = roundToCents(row.totalOwed + b.owed);
    row.totalOwes = roundToCents(row.totalOwes + b.owes);
    row.netBalance = roundToCents(row.totalOwed - row.totalOwes);
    byCurrency.set(b.currency, row);
  }
  return orderCurrencies(byCurrency.keys(), preferred, (c) => {
    const r = byCurrency.get(c)!;
    return r.totalOwed + r.totalOwes;
  }).map((c) => byCurrency.get(c)!);
}

/** My balances grouped by person: Map<userId, entries in display order>. */
export function balancesByPerson(balances: UserBalance[], preferred?: string): Map<string, UserBalance[]> {
  const map = new Map<string, UserBalance[]>();
  for (const b of balances) map.set(b.userId, [...(map.get(b.userId) ?? []), b]);
  for (const [id, list] of map) {
    const order = orderCurrencies(list.map((b) => b.currency), preferred, (c) => Math.abs(list.find((b) => b.currency === c)!.netBalance));
    map.set(id, order.map((c) => list.find((b) => b.currency === c)!));
  }
  return map;
}

/**
 * Greedy debt simplification within one currency: pair the biggest creditor with
 * the biggest debtor until everyone is square. Produces at most n-1 payments.
 */
export function simplifyDebts(
  net: Record<string, number>,
  userMap: Record<string, User>,
  currency: string,
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
        currency,
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
 * Everything a group screen needs: each member's position per currency and the
 * fewest payments (per currency) that square the group.
 */
export function computeGroupBalances(
  expenses: Expense[],
  settlements: Settlement[],
  members: User[],
  preferred?: string,
) {
  const net = computeNetPositions(expenses, settlements);
  const userMap: Record<string, User> = {};
  members.forEach((m) => (userMap[m.id] = m));
  const weight = (c: string) => Object.values(net[c] ?? {}).reduce((s, v) => s + Math.abs(v), 0);
  const currencies = orderCurrencies(Object.keys(net), preferred, weight).filter((c) => weight(c) >= 0.01);

  const memberNets = members.map((m) => ({
    user: m,
    nets: currencies.map((c) => ({ currency: c, amount: net[c]?.[m.id] ?? 0 })).filter((x) => !settled(x.amount)),
  }));
  // Owed most first (in the first currency they have), settled people last.
  memberNets.sort((a, b) => (b.nets[0]?.amount ?? 0) - (a.nets[0]?.amount ?? 0));

  return {
    currencies,
    memberNets,
    debts: currencies.flatMap((c) => simplifyDebts(net[c] ?? {}, userMap, c)),
  };
}
