/**
 * Reading a Splitwise export ("Export as spreadsheet" on a group or friend).
 *
 * The file looks like:
 *
 *   Date,Description,Category,Cost,Currency,Alex Smith,Bea Jones
 *   2024-01-05,Dinner,Dining out,60.00,USD,30.00,-30.00
 *   2024-01-07,Bea J. paid Alex S.,Payment,30.00,USD,-30.00,30.00
 *   2024-01-08,Total balance, , ,USD,0.00,0.00
 *
 * One column per person, holding what each row did to their balance
 * (+ paid more than their share, − owes). The server turns that back into
 * who paid and each share; here we only read it and match up the names.
 */

import type { SplitwiseImportPayload, SplitwiseMatch, User } from '../types';

export const SPLITWISE_MAX_ROWS = 5000;

export interface SplitwiseFile {
  /** The people columns, in order. */
  people: string[];
  rows: SplitwiseImportPayload['rows'];
  expenseCount: number;
  paymentCount: number;
  /** First and last date (YYYY-MM-DD). */
  from: string;
  to: string;
  /** Each person's bottom line per currency, as Splitwise has it. */
  totals: Array<Record<string, number>>;
}

export type SplitwiseFileProblem = 'empty' | 'notSplitwise' | 'tooMany';
export class SplitwiseFileError extends Error {
  constructor(public problem: SplitwiseFileProblem) {
    super(problem);
  }
}

/** RFC 4180-style: quoted cells may hold the delimiter, quotes ("") and line breaks. */
function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** "1,234.50", "-12,5", " 30.00 " → number; blank → 0; anything else → NaN. */
function num(raw: string | undefined, decimalComma: boolean): number {
  let s = (raw ?? '').trim().replace(/\s/g, '');
  if (!s) return 0;
  if (decimalComma) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

/** YYYY-MM-DD from Splitwise's date (normally already that). */
function day(raw: string): string | null {
  const s = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseSplitwiseCsv(input: string): SplitwiseFile {
  const text = input.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) ?? '';
  if (!firstLine) throw new SplitwiseFileError('empty');
  // Opened and saved again in a spreadsheet app, the commas can become semicolons or tabs.
  const delimiter = [',', ';', '\t'].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const decimalComma = delimiter === ';';
  const table = parseCsv(text, delimiter).filter((r) => r.some((c) => c.trim()));
  const [header, ...body] = table;
  if (!header || header.length < 7) throw new SplitwiseFileError('notSplitwise');

  let width = header.length;
  while (width > 5 && !header[width - 1].trim()) width--;
  const people = header.slice(5, width).map((h) => h.trim());
  if (people.length < 2 || people.some((p) => !p)) throw new SplitwiseFileError('notSplitwise');

  const rows: SplitwiseFile['rows'] = [];
  let paymentCount = 0;
  for (const r of body) {
    const description = (r[1] ?? '').trim();
    const cost = num(r[3], decimalComma);
    const date = day(r[0] ?? '');
    const currency = (r[4] ?? '').trim().toUpperCase();
    // The "Total balance" line, and anything else that isn't an expense or payment.
    if (/^total balance$/i.test(description) || !(r[3] ?? '').trim() || Number.isNaN(cost) || !date || !/^[A-Z]{3}$/.test(currency)) continue;
    const nets = people.map((_, i) => num(r[5 + i], decimalComma));
    if (nets.some(Number.isNaN)) continue;
    const category = (r[2] ?? '').trim();
    if (/^payment$/i.test(category)) paymentCount++;
    rows.push({ date, description, category, cost, currency, nets });
  }
  if (rows.length === 0) throw new SplitwiseFileError(table.length > 1 ? 'notSplitwise' : 'empty');
  if (rows.length > SPLITWISE_MAX_ROWS) throw new SplitwiseFileError('tooMany');

  const totals = people.map((_, i) => {
    const t: Record<string, number> = {};
    for (const r of rows) t[r.currency] = Math.round(((t[r.currency] ?? 0) + r.nets[i]) * 100) / 100;
    return t;
  });
  const dates = rows.map((r) => r.date).sort();
  return { people, rows, expenseCount: rows.length - paymentCount, paymentCount, from: dates[0], to: dates[dates.length - 1], totals };
}

/** "goa-trip_2024-03-01_export.csv" → "Goa trip". */
export function nameFromFile(fileName?: string | null): string {
  const base = (fileName ?? '')
    .replace(/\.[a-z]+$/i, '')
    .replace(/_?export$/i, '')
    .replace(/_?\d{4}-\d{2}-\d{2}$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  return base ? base[0].toUpperCase() + base.slice(1) : '';
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

/** How alike two names are: 3 same name, 2 same first name and last initial, 1 same first name. */
function likeness(a: string, b: string): number {
  const x = norm(a);
  const y = norm(b);
  if (!x.length || !y.length) return 0;
  if (x.join(' ') === y.join(' ')) return 3;
  if (x[0] !== y[0]) return 0;
  if (x.length > 1 && y.length > 1 && x[x.length - 1][0] === y[y.length - 1][0]) return 2;
  return 1;
}

/**
 * A first guess at who each Splitwise name is: me (the closest to my name), a
 * WhoOwes person with a matching name, or someone new.
 */
export function guessMatches(names: string[], me: User, candidates: User[]): SplitwiseMatch[] {
  const out: SplitwiseMatch[] = names.map(() => 'new');
  const mine = names.map((n) => likeness(n, me.name));
  const best = Math.max(...mine);
  if (best > 0 && mine.filter((s) => s === best).length === 1) out[mine.indexOf(best)] = 'me';
  const taken = new Set<string>();
  names.forEach((n, i) => {
    if (out[i] === 'me') return;
    const scored = candidates.filter((c) => c.id !== me.id && !taken.has(c.id)).map((c) => ({ c, s: likeness(n, c.name) }));
    const top = Math.max(0, ...scored.map((x) => x.s));
    const tops = scored.filter((x) => x.s === top);
    if (top >= 2 || (top === 1 && tops.length === 1)) {
      out[i] = { userId: tops[0].c.id };
      taken.add(tops[0].c.id);
    }
  });
  return out;
}
