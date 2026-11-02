import { useMemo } from 'react';
import type { CurrencyAmount, Friend, User } from '../types';
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

/** Narrowing the Friends tab by tapping a side of the totals card. */
export type FriendFilter = 'all' | 'owesYou' | 'youOwe';

/** One person on the Friends tab and my money with them. */
export interface PersonRowData {
  user: User;
  /** My balance with them per currency (+ they owe me), main currency first. */
  amounts: CurrencyAmount[];
  direction: ReturnType<typeof balanceDirection>;
  /** When the main balance started, if one is open. */
  since: string | null;
  /** Open for a month or more. */
  stale: boolean;
}

export interface FriendRowData extends PersonRowData {
  friend: Friend;
}

export interface FriendsSummary {
  currency: string;
  owedToYou: number;
  youOwe: number;
  /** How many people are on each side (in any currency). */
  owedCount: number;
  oweCount: number;
  /** Other currencies with open balances, not added in. */
  otherCurrencies: number;
}

export function matchesFilter(row: PersonRowData, filter: FriendFilter) {
  if (filter === 'owesYou') return row.amounts.some((a) => a.amount > 0);
  if (filter === 'youOwe') return row.amounts.some((a) => a.amount < 0);
  return true;
}

/** Text a friend search matches: their name, my nickname for them, their email. */
export const friendSearchText = (f: Friend) => `${f.friendUser.name} ${f.nickname ?? ''} ${f.friendUser.email}`.toLowerCase();

/**
 * Everything the Friends tab shows:
 *   rows    my friends: pinned first, then biggest open balance, then by name
 *   others  people I have money open with through a group but aren't friends with
 *   summary totals across both, so they match Home
 */
export function useFriendRows() {
  const myId = useAuthStore((s) => s.user?.id ?? '');
  const preferred = useMyCurrency();
  const friendsQ = useFriends();
  const { data: balanceData } = useBalances();
  const { data: expenses } = useExpenses();
  const { data: settlements } = useSettlements();

  const { rows, others } = useMemo(() => {
    const byPerson = balancesByPerson(balanceData?.balances ?? [], preferred);
    const person = (user: User): PersonRowData => {
      const amounts = (byPerson.get(user.id) ?? []).map((b) => ({ currency: b.currency, amount: b.netBalance }));
      const main = amounts[0];
      const since = main ? openSince(expenses ?? [], settlements ?? [], myId, user.id, main.currency, main.amount) : null;
      return { user, amounts, direction: balanceDirection(amounts), since, stale: !!since && daysSince(since) >= STALE_AFTER_DAYS };
    };
    const biggest = (a: PersonRowData, b: PersonRowData) => Math.abs(b.amounts[0]?.amount ?? 0) - Math.abs(a.amounts[0]?.amount ?? 0);

    const friends = friendsQ.data ?? [];
    const friendIds = new Set(friends.map((f) => f.friendId));
    const rows: FriendRowData[] = friends
      .map((friend) => ({ ...person(friend.friendUser), friend }))
      .sort(
        (a, b) =>
          Number(!!b.friend.pinned) - Number(!!a.friend.pinned) || biggest(a, b) || a.user.name.localeCompare(b.user.name),
      );
    const others: PersonRowData[] = [...byPerson.entries()]
      .filter(([id]) => id !== myId && !friendIds.has(id))
      .map(([, list]) => person(list[0].user))
      .sort(biggest);
    return { rows, others };
  }, [friendsQ.data, balanceData, expenses, settlements, myId, preferred]);

  const summary = useMemo<FriendsSummary | null>(() => {
    const owed = new Map<string, number>();
    const owe = new Map<string, number>();
    const everyone = [...rows, ...others];
    for (const r of everyone) {
      for (const a of r.amounts) {
        const into = a.amount > 0 ? owed : owe;
        into.set(a.currency, roundToCents((into.get(a.currency) ?? 0) + Math.abs(a.amount)));
      }
    }
    const currencies = orderCurrencies([...owed.keys(), ...owe.keys()], preferred, (c) => (owed.get(c) ?? 0) + (owe.get(c) ?? 0));
    if (!currencies.length) return null;
    const currency = currencies[0];
    return {
      currency,
      owedToYou: owed.get(currency) ?? 0,
      youOwe: owe.get(currency) ?? 0,
      owedCount: everyone.filter((r) => matchesFilter(r, 'owesYou')).length,
      oweCount: everyone.filter((r) => matchesFilter(r, 'youOwe')).length,
      otherCurrencies: currencies.length - 1,
    };
  }, [rows, others, preferred]);

  return { rows, others, summary, friendsQ };
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
