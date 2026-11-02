/**
 * AI features: receipt reading, Quick Add, Split Assistant and spending insights.
 *
 * Live mode calls the WhoOwes server, which runs Claude and counts each use
 * against the user's monthly AI pass (free uses, then one per watched ad).
 * Demo mode uses small local heuristics and the same pass rules, offline.
 */

import { USE_MOCK_API, AI_TIMEOUT_MS } from '../config';
import { categoryLabel } from '../constants';
import { MOCK_PARSED_RECEIPT } from '../constants/sampleData';
import type {
  ExpenseCategory,
  Group,
  ParsedReceipt,
  QuickAddDraft,
  ReceiptItem,
  SpendingInsights,
  User,
} from '../types';
import apiClient from './api/apiClient';
import { takeDemoPass } from './aiPass';
import { mockDelay } from './mock/mockHelpers';
import { generateId } from '../utils/idGenerator';
import { formatCurrency, roundToCents } from '../utils/currency';
import { translate } from '../i18n';

export interface ReceiptFile {
  base64: string;
  mimeType: string; // image/jpeg, image/png, image/webp, application/pdf
}

export interface QuickAddContext {
  me: User;
  people: User[];
  groups: Group[];
  currency: string;
  today: string; // YYYY-MM-DD
}

export interface MonthStats {
  month: string; // YYYY-MM
  /** Every amount below is in this currency. */
  currency: string;
  /** All currencies with spending this month, most first. */
  currencies: string[];
  total: number;
  previousTotal: number;
  byCategory: Array<{ category: ExpenseCategory; amount: number }>;
  topPeople: Array<{ name: string; amount: number }>;
  biggest: Array<{ title: string; amount: number; category: ExpenseCategory }>;
  count: number;
}

// ─── Demo heuristics ──────────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Array<[ExpenseCategory, RegExp]> = [
  ['food', /(dinner|lunch|breakfast|brunch|food|pizza|taco|sushi|ramen|coffee|groceries|grocery|bar|drinks|beer|restaurant|cafe)/i],
  ['transport', /(uber|lyft|taxi|cab|gas|fuel|train|bus|flight|parking|tram|metro)/i],
  ['accommodation', /(rent|hotel|airbnb|hostel|stay|lodging)/i],
  ['entertainment', /(movie|concert|tickets?|show|game|museum|bowling|karaoke)/i],
  ['utilities', /(electric|power|water|internet|wifi|phone|utility|bill)/i],
  ['shopping', /(shop|store|amazon|clothes|ikea|costco|target)/i],
  ['health', /(pharmacy|doctor|gym|medicine|dentist)/i],
];

function guessCategory(text: string): ExpenseCategory {
  return CATEGORY_KEYWORDS.find(([, re]) => re.test(text))?.[0] ?? 'other';
}

function firstName(u: User) {
  return u.name.split(' ')[0].toLowerCase();
}

function demoQuickAdd(text: string, ctx: QuickAddContext): QuickAddDraft {
  const amountMatch = text.match(/(?:\$|usd\s*)?(\d+(?:[.,]\d{1,2})?)/i);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : 0;
  const lower = text.toLowerCase();

  const group = ctx.groups.find((g) => lower.includes(g.name.toLowerCase().replace(/[^\w\s]/g, '').trim()));
  const mentioned = ctx.people.filter((p) => p.id !== ctx.me.id && new RegExp(`\\b${firstName(p)}\\b`).test(lower));
  const everyone = group ? group.members.map((m) => m.user) : [ctx.me, ...mentioned];

  const payerMatch = ctx.people.find((p) => new RegExp(`\\b${firstName(p)}\\s+(paid|covered|got it)`).test(lower));
  const title =
    text
      .replace(amountMatch?.[0] ?? '', '')
      .replace(/\b(with|for|and|i paid|paid by|split|equally|evenly)\b.*$/i, '')
      .replace(/\s+/g, ' ')
      .trim() || 'Expense';

  return {
    title: title.charAt(0).toUpperCase() + title.slice(1),
    amount,
    currency: ctx.currency,
    category: guessCategory(text),
    paidBy: payerMatch?.id ?? ctx.me.id,
    participantIds: Array.from(new Set(everyone.map((p) => p.id))),
    splitType: 'equal',
    groupId: group?.id,
    date: ctx.today,
    note: amount === 0 ? translate('demo.noAmount') : undefined,
  };
}

function demoAssign(items: ReceiptItem[], people: User[], instruction: string): ReceiptItem[] {
  const clauses = instruction.toLowerCase().split(/[.;\n]|,(?![^(]*\))/);
  const result = items.map((i) => ({ ...i, assignedTo: [...i.assignedTo] }));
  let splitRest = false;

  for (const clause of clauses) {
    if (/\b(rest|everything else|remaining)\b/.test(clause)) splitRest = true;
    const who = people.filter((p) => clause.includes(firstName(p)) || (/\b(i|me|my)\b/.test(clause) && p.id === people[0]?.id));
    if (who.length === 0) continue;
    for (const item of result) {
      const words = item.name.toLowerCase().split(/[^a-zà-ÿ]+/).filter((w) => w.length > 3);
      if (words.some((w) => clause.includes(w))) item.assignedTo = who.map((p) => p.id);
    }
  }
  if (splitRest) {
    for (const item of result) if (item.assignedTo.length === 0) item.assignedTo = people.map((p) => p.id);
  }
  return result;
}

function demoInsights(stats: MonthStats): Omit<SpendingInsights, 'month' | 'currency' | 'total' | 'previousTotal' | 'byCategory'> {
  const top = stats.byCategory[0];
  const topLabel = categoryLabel(top?.category ?? 'other');
  const delta = stats.previousTotal ? Math.round(((stats.total - stats.previousTotal) / stats.previousTotal) * 100) : 0;
  const share = top && stats.total ? Math.round((top.amount / stats.total) * 100) : 0;
  const money = (n: number) => formatCurrency(n, stats.currency, { maximumFractionDigits: 0, minimumFractionDigits: 0 });
  return {
    headline:
      delta === 0
        ? translate('demo.insights.headlineFlat', { amount: money(stats.total) })
        : translate(delta > 0 ? 'demo.insights.headlineUp' : 'demo.insights.headlineDown', { percent: Math.abs(delta) }),
    highlights: [
      top ? translate('demo.insights.topCategory', { category: topLabel, percent: share }) : translate('demo.insights.nothingYet'),
      stats.topPeople[0] ? translate('demo.insights.topPerson', { name: stats.topPeople[0].name }) : translate('demo.insights.addFriends'),
      stats.biggest[0] ? translate('demo.insights.biggest', { title: stats.biggest[0].title, amount: money(stats.biggest[0].amount) }) : '',
    ].filter(Boolean),
    tips: [translate('demo.insights.tip1'), translate('demo.insights.tip2')],
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const AIService = {
  async extractReceipt(
    file: ReceiptFile,
    instructions?: string,
    meta?: { sourceType?: string; fileName?: string },
  ): Promise<ParsedReceipt & { receiptId?: string }> {
    if (USE_MOCK_API) {
      takeDemoPass('receipt_scan');
      await mockDelay(1800);
      return {
        ...MOCK_PARSED_RECEIPT,
        items: MOCK_PARSED_RECEIPT.items.map((i) => ({ ...i, id: generateId() })),
        rawText: translate('demo.sampleReceipt'),
      };
    }
    const res = await apiClient.post<ParsedReceipt & { receiptId: string }>(
      '/ai/receipts/parse',
      { file: { data: file.base64, mediaType: file.mimeType }, instructions, sourceType: meta?.sourceType, fileName: meta?.fileName },
      { timeout: AI_TIMEOUT_MS },
    );
    return { ...res.data, items: res.data.items.map((i) => ({ ...i, id: generateId(), assignedTo: [] })) };
  },

  async quickAdd(text: string, ctx: QuickAddContext): Promise<QuickAddDraft> {
    if (USE_MOCK_API) {
      takeDemoPass('quick_add');
      await mockDelay(900);
      return demoQuickAdd(text, ctx);
    }
    const res = await apiClient.post<QuickAddDraft>(
      '/ai/expenses/quick-add',
      {
        text,
        me: { id: ctx.me.id, name: ctx.me.name },
        people: ctx.people.map((p) => ({ id: p.id, name: p.name })),
        groups: ctx.groups.map((g) => ({ id: g.id, name: g.name, memberIds: g.members.map((m) => m.userId) })),
        currency: ctx.currency,
        today: ctx.today,
      },
      { timeout: AI_TIMEOUT_MS },
    );
    return res.data;
  },

  async assignItems(items: ReceiptItem[], people: User[], instruction: string): Promise<ReceiptItem[]> {
    if (USE_MOCK_API) {
      takeDemoPass('split_assistant');
      await mockDelay(1100);
      return demoAssign(items, people, instruction);
    }
    const res = await apiClient.post<{ assignments: Array<{ itemId: string; userIds: string[] }> }>(
      '/ai/receipts/assign',
      {
        instruction,
        items: items.map((i) => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
        people: people.map((p, idx) => ({ id: p.id, name: p.name, isMe: idx === 0 })),
      },
      { timeout: AI_TIMEOUT_MS },
    );
    const byId = new Map(res.data.assignments.map((a) => [a.itemId, a.userIds]));
    return items.map((i) => ({ ...i, assignedTo: byId.get(i.id) ?? i.assignedTo }));
  },

  /**
   * The AI write-up for a month. `cachedOnly` asks for one written earlier
   * (free, null if there isn't one); otherwise a new one uses an insights pass.
   */
  async insights(stats: MonthStats, opts: { cachedOnly?: boolean } = {}): Promise<SpendingInsights | null> {
    const base = {
      month: stats.month,
      currency: stats.currency,
      total: stats.total,
      previousTotal: stats.previousTotal,
      byCategory: stats.byCategory,
    };
    if (USE_MOCK_API) {
      if (opts.cachedOnly) return null;
      takeDemoPass('insights');
      await mockDelay(1200);
      return { ...base, ...demoInsights(stats) };
    }
    const res = await apiClient.post<Pick<SpendingInsights, 'headline' | 'highlights' | 'tips'> | null>(
      '/ai/insights',
      { stats: { ...stats, currencies: undefined, total: roundToCents(stats.total) }, cachedOnly: opts.cachedOnly },
      { timeout: AI_TIMEOUT_MS },
    );
    return res.data ? { ...base, ...res.data } : null;
  },
};

