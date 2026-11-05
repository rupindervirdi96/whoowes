/**
 * Turning a Splitwise export back into expenses and payments.
 *
 * Splitwise's spreadsheet gives, for each row, what it did to each person's
 * balance: + for whoever paid more than their share, − for whoever owes. That's
 * enough to rebuild who paid and each share exactly. One payer: they paid the
 * cost, everyone with a − owes that much, and the payer's own share is the rest.
 * Several payers (rare): the debts are paired up, one expense per payer.
 */

import { createHash } from 'node:crypto';

export interface SplitwiseRow {
  /** YYYY-MM-DD */
  date: string;
  description: string;
  category: string;
  costCents: number;
  currency: string;
  /** Change to each person's balance, in cents, in the order of the file's columns. */
  nets: number[];
}

export type PlannedRow =
  | { kind: 'expense'; payer: number; amountCents: number; shares: Array<{ person: number; cents: number }>; severalPayers: boolean }
  | { kind: 'payment'; from: number; to: number; cents: number };

const CATEGORIES: Array<[RegExp, string]> = [
  [/heat|electric|water|tv|phone|internet|trash|cleaning|utilit/i, 'utilities'],
  [/dining|food|grocer|liquor|drink/i, 'food'],
  [/\bcar\b|fuel|parking|bus|train|plane|taxi|bicycle|transport/i, 'transport'],
  [/hotel|rent|mortgage/i, 'accommodation'],
  [/movie|music|game|sport|entertainment/i, 'entertainment'],
  [/cloth|gift|electronic|furniture|household|shopping/i, 'shopping'],
  [/medical|insurance|health/i, 'health'],
];

/** Splitwise's category names ("Dining out", "Gas/fuel") → ours. */
export function categoryFor(splitwise: string) {
  return CATEGORIES.find(([re]) => re.test(splitwise))?.[1] ?? 'other';
}

export const isPaymentRow = (r: SplitwiseRow) => /^payment$/i.test(r.category.trim());

/** The same row always gets the same key, whoever imports it and whatever they call the people. */
export function importKey(r: SplitwiseRow) {
  const nets = [...r.nets].sort((a, b) => a - b).join(',');
  return createHash('sha1').update(`splitwise|${r.date}|${r.description.trim()}|${r.costCents}|${r.currency}|${nets}`).digest('hex');
}

/**
 * What one row becomes. Empty when it changes nobody's balance (someone's own
 * expense) or doesn't add up (more than a cent per person out).
 */
export function planRow(row: SplitwiseRow): PlannedRow[] {
  const nets = row.nets.map((n) => Math.round(n));
  const sum = nets.reduce((a, b) => a + b, 0);
  if (Math.abs(sum) > nets.length) return [];
  if (sum !== 0) {
    // Splitwise rounds each person's cents; the biggest amount on the heavy side absorbs it.
    let at = -1;
    nets.forEach((n, i) => {
      if (Math.sign(n) === Math.sign(sum) && (at < 0 || Math.abs(n) > Math.abs(nets[at]))) at = i;
    });
    if (at < 0) return [];
    nets[at] -= sum;
  }

  const payers = nets.map((n, i) => ({ i, n })).filter((x) => x.n > 0);
  const owers = nets.map((n, i) => ({ i, n })).filter((x) => x.n < 0);
  if (payers.length === 0 || owers.length === 0) return [];

  if (isPaymentRow(row) && payers.length === 1 && owers.length === 1) {
    return [{ kind: 'payment', from: payers[0].i, to: owers[0].i, cents: payers[0].n }];
  }

  if (payers.length === 1) {
    const payer = payers[0];
    let amountCents = row.costCents;
    let own = amountCents - payer.n;
    if (own < 0) {
      // The cost doesn't match the balances; trust the balances.
      amountCents = payer.n;
      own = 0;
    }
    const shares = owers.map((o) => ({ person: o.i, cents: -o.n }));
    if (own > 0) shares.push({ person: payer.i, cents: own });
    return [{ kind: 'expense', payer: payer.i, amountCents, shares, severalPayers: false }];
  }

  // Several people paid: pair each debt with a payer, biggest first.
  const credit = payers.map((p) => ({ ...p })).sort((a, b) => b.n - a.n);
  const debt = owers.map((o) => ({ i: o.i, n: -o.n })).sort((a, b) => b.n - a.n);
  const byPayer = new Map<number, Map<number, number>>();
  let c = 0;
  let d = 0;
  while (c < credit.length && d < debt.length) {
    const take = Math.min(credit[c].n, debt[d].n);
    const shares = byPayer.get(credit[c].i) ?? new Map<number, number>();
    shares.set(debt[d].i, (shares.get(debt[d].i) ?? 0) + take);
    byPayer.set(credit[c].i, shares);
    credit[c].n -= take;
    debt[d].n -= take;
    if (credit[c].n === 0) c++;
    if (debt[d].n === 0) d++;
  }
  return [...byPayer].map(([payer, shares]) => {
    const list = [...shares].map(([person, cents]) => ({ person, cents }));
    return { kind: 'expense' as const, payer, amountCents: list.reduce((s, x) => s + x.cents, 0), shares: list, severalPayers: true };
  });
}
