import { useMemo } from 'react';
import type { CurrencyAmount, Friend } from '../types';
import { balanceDirection } from '../components/BalanceAmounts';
import { balancesByPerson, orderCurrencies } from '../utils/balanceEngine';
import { roundToCents } from '../utils/currency';
import { daysSince, openSince, sharedStats, STALE_AFTER_DAYS, whoseTurn } from '../utils/friendInsights';
import { useAuthStore } from '../store/authStore';
import { useBalances } from './useBalances';
import { useExpenses } from './useExpenses';
import { useFriends } from './useFriends';
import { useSettlements } from './useSettlements';
import { useMyCurrency } from './useCurrency';

export type FriendFilter = 'all' | 'owesYou' | 'youOwe' | 'settled';

export interface FriendRowData {
  friend: Friend;
  /** My balance with them per currency (+ they owe me), main currency first. */
  amounts: CurrencyAmount[];
  direction: ReturnType<typeof balanceDirection>;
  /** When the main balance started, if one is open. */
  since: string | null;
  /** Open for a month or more. */
  stale: boolean;
}

export interface FriendsSummary {
  currency: string;
  owedToYou: number;
  youOwe: number;
  /** Other currencies with open balances, not added in. */
  otherCurrencies: number;
}

export function matchesFilter(row: FriendRowData, filter: FriendFilter) {
  switch (filter) {
    case 'owesYou':
      return row.amounts.some((a) => a.amount > 0);
    case 'youOwe':
      return row.amounts.some((a) => a.amount < 0);
    case 'settled':
      return row.amounts.length === 0;
    default:
      return true;
  }
}

/** The name I see for a friend: my nickname for them comes second, never instead. */
export const friendSearchText = (f: Friend) => `${f.friendUser.name} ${f.nickname ?? ''} ${f.friendUser.email}`.toLowerCase();

/**
 * Everything the Friends tab shows per friend, plus the totals strip.
 * Order: pinned first, then biggest open balance, then by name.
 */
export function useFriendRows() {
  const myId = useAuthStore((s) => s.user?.id ?? '');
  const preferred = useMyCurrency();
  const friendsQ = useFriends();
  const { data: balanceData } = useBalances();
  const { data: expenses } = useExpenses();
  const { data: settlements } = useSettlements();

  const rows = useMemo<FriendRowData[]>(() => {
    const byPerson = balancesByPerson(balanceData?.balances ?? [], preferred);
    return (friendsQ.data ?? [])
      .map((friend) => {
        const amounts = (byPerson.get(friend.friendId) ?? []).map((b) => ({ currency: b.currency, amount: b.netBalance }));
        const main = amounts[0];
        const since = main ? openSince(expenses ?? [], settlements ?? [], myId, friend.friendId, main.currency, main.amount) : null;
        return {
          friend,
          amounts,
          direction: balanceDirection(amounts),
          since,
          stale: !!since && daysSince(since) >= STALE_AFTER_DAYS,
        };
      })
      .sort(
        (a, b) =>
          Number(!!b.friend.pinned) - Number(!!a.friend.pinned) ||
          Math.abs(b.amounts[0]?.amount ?? 0) - Math.abs(a.amounts[0]?.amount ?? 0) ||
          a.friend.friendUser.name.localeCompare(b.friend.friendUser.name),
      );
  }, [friendsQ.data, balanceData, expenses, settlements, myId, preferred]);

  const summary = useMemo<FriendsSummary | null>(() => {
    const owed = new Map<string, number>();
    const owe = new Map<string, number>();
    for (const r of rows) {
      for (const a of r.amounts) {
        const into = a.amount > 0 ? owed : owe;
        into.set(a.currency, roundToCents((into.get(a.currency) ?? 0) + Math.abs(a.amount)));
      }
    }
    const currencies = orderCurrencies([...owed.keys(), ...owe.keys()], preferred, (c) => (owed.get(c) ?? 0) + (owe.get(c) ?? 0));
    if (!currencies.length) return null;
    const currency = currencies[0];
    return { currency, owedToYou: owed.get(currency) ?? 0, youOwe: owe.get(currency) ?? 0, otherCurrencies: currencies.length - 1 };
  }, [rows, preferred]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      owesYou: rows.filter((r) => matchesFilter(r, 'owesYou')).length,
      youOwe: rows.filter((r) => matchesFilter(r, 'youOwe')).length,
      settled: rows.filter((r) => matchesFilter(r, 'settled')).length,
    }),
    [rows],
  );

  return { rows, summary, counts, friendsQ };
}

/** Who usually pays and what we've split, for one friend's page. */
export function useFriendTogether(friendId: string) {
  const myId = useAuthStore((s) => s.user?.id ?? '');
  const preferred = useMyCurrency();
  const { data: expenses } = useExpenses();
  return useMemo(() => {
    const shared = (expenses ?? []).filter((e) => e.paidBy === friendId || e.splits.some((s) => s.userId === friendId));
    return {
      shared,
      turn: whoseTurn(shared, myId, friendId),
      stats: sharedStats(shared, preferred),
    };
  }, [expenses, friendId, myId, preferred]);
}
