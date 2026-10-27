/**
 * AI features: receipt reading, Quick Add, Split Assistant and spending insights.
 *
 * Live mode calls the WhoOwes server, which runs Claude and enforces plans and
 * quotas. Demo mode uses small local heuristics so every flow is clickable
 * offline — and applies the same plan gates, so the paywall behaves the same.
 */

import { USE_MOCK_API, AI_TIMEOUT_MS } from '../config';
import { CATEGORY_BY_ID } from '../constants';
import { MOCK_PARSED_RECEIPT } from '../constants/sampleData';
import { PLANS, planIncludes } from '../billing/plans';
import type {
  ApiError,
  ExpenseCategory,
  Feature,
  Group,
  ParsedReceipt,
  QuickAddDraft,
  ReceiptItem,
  SpendingInsights,
  User,
} from '../types';
import apiClient from './api/apiClient';
import { BillingService } from './billing';
import { mockDelay } from './mock/mockHelpers';
import { generateId } from '../utils/idGenerator';
import { roundToCents } from '../utils/currency';

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
  total: number;
  previousTotal: number;
  byCategory: Array<{ category: ExpenseCategory; amount: number }>;
  topPeople: Array<{ name: string; amount: number }>;
  biggest: Array<{ title: string; amount: number; category: ExpenseCategory }>;
  count: number;
}

// ─── Demo-mode gating (the server does this in live mode) ─────────────────────

async function assertFeature(feature: Feature) {
  const sub = await BillingService.getSubscription();
  if (!planIncludes(sub.plan, feature)) {
    const err: ApiError = {
      statusCode: 402,
      code: 'upgrade_required',
      feature,
      message: 'This feature needs an upgrade.',
    };
    throw err;
  }
  if (feature === 'receipt_scan' && sub.scansLimit !== null && sub.scansUsed >= sub.scansLimit) {
    const err: ApiError = {
      statusCode: 402,
      code: 'quota_exceeded',
      feature,
      message: `You've used all ${sub.scansLimit} AI scans on ${PLANS[sub.plan].name} this month.`,
    };
    throw err;
  }
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
    note: amount === 0 ? "I couldn't find an amount — please add it." : undefined,
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

function demoInsights(stats: MonthStats): Omit<SpendingInsights, 'month' | 'total' | 'previousTotal' | 'byCategory'> {
  const top = stats.byCategory[0];
  const topLabel = CATEGORY_BY_ID[top?.category ?? 'other'].label;
  const delta = stats.previousTotal ? Math.round(((stats.total - stats.previousTotal) / stats.previousTotal) * 100) : 0;
  const share = top && stats.total ? Math.round((top.amount / stats.total) * 100) : 0;
  return {
    headline:
      delta === 0
        ? `You shared $${stats.total.toFixed(0)} in expenses this month.`
        : `Shared spending is ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)}% vs last month.`,
    highlights: [
      top ? `${topLabel} was your biggest category — ${share}% of the month.` : 'No shared spending yet this month.',
      stats.topPeople[0] ? `You split the most with ${stats.topPeople[0].name}.` : 'Add friends to start splitting.',
      stats.biggest[0] ? `Largest bill: ${stats.biggest[0].title} ($${stats.biggest[0].amount.toFixed(0)}).` : '',
    ].filter(Boolean),
    tips: [
      'Settle small balances weekly so they never pile up.',
      'Scan receipts at the table — item-level splits end the "who had what" debate.',
    ],
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
      await assertFeature('receipt_scan');
      await mockDelay(1800);
      await BillingService.recordDemoScan();
      return {
        ...MOCK_PARSED_RECEIPT,
        items: MOCK_PARSED_RECEIPT.items.map((i) => ({ ...i, id: generateId() })),
        rawText: 'Demo mode: this is a sample receipt, not the one you scanned. Connect the WhoOwes server to read real receipts.',
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
      await assertFeature('ai_quick_add');
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
      await assertFeature('ai_split_assistant');
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

  async insights(stats: MonthStats): Promise<SpendingInsights> {
    const base = {
      month: stats.month,
      total: stats.total,
      previousTotal: stats.previousTotal,
      byCategory: stats.byCategory,
    };
    if (USE_MOCK_API) {
      await assertFeature('ai_insights');
      await mockDelay(1200);
      return { ...base, ...demoInsights(stats) };
    }
    const res = await apiClient.post<Pick<SpendingInsights, 'headline' | 'highlights' | 'tips'>>(
      '/ai/insights',
      { stats: { ...stats, total: roundToCents(stats.total) } },
      { timeout: AI_TIMEOUT_MS },
    );
    return { ...base, ...res.data };
  },
};

