/**
 * Claude-powered features. Every call uses structured outputs (a Zod schema),
 * so responses are guaranteed to parse — no regex-scraping of model text.
 *
 * Model: Claude Opus 5.5 with the server-side refusal fallback enabled, so a
 * rare false-positive safety decline is retried on Anthropic's recommended
 * fallback model instead of failing the user's request.
 */

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { LANGUAGE_NAMES, type Lang } from '../i18n.js';

const MODEL = 'claude-opus-5-5';
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

let client: Anthropic | null = null;
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw Object.assign(new Error('AI features are not set up on this server yet.'), { status: 503, code: 'ai_unavailable' });
  }
  client ??= new Anthropic();
  return client;
}

export class AIRefusalError extends Error {
  status = 422;
  code = 'ai_declined';
}

type Effort = 'low' | 'medium' | 'high';

async function structured<S extends z.ZodType>(opts: {
  schema: S;
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  effort: Effort;
}): Promise<z.infer<S>> {
  const response = await anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    system: opts.system,
    messages: [{ role: 'user', content: opts.content }],
    output_config: { format: betaZodOutputFormat(opts.schema), effort: opts.effort },
  });

  if (response.stop_reason === 'refusal') {
    throw new AIRefusalError("The AI couldn't process this request. Try again or enter it manually.");
  }
  if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
    throw Object.assign(new Error('The AI response was incomplete. Please try again.'), { status: 502, code: 'ai_incomplete' });
  }
  return response.parsed_output as z.infer<S>;
}

// ─── Receipts ────────────────────────────────────────────────────────────────

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;

const ReceiptSchema = z.object({
  merchant: z.string().describe('Business name as printed, title case'),
  date: z.string().nullable().describe('Purchase date as YYYY-MM-DD, or null if not printed'),
  currency: z.string().describe('ISO 4217 code, e.g. USD, EUR'),
  items: z
    .array(
      z.object({
        name: z.string().describe('Short, human-readable item name (expand cryptic POS abbreviations)'),
        unitPrice: z.number().describe('Price for ONE unit. Negative for discounts/coupons.'),
        quantity: z.number().int(),
      }),
    )
    .describe('Every purchased line item. Exclude subtotal, tax, tip and total lines.'),
  subtotal: z.number(),
  tax: z.number().describe('All taxes plus non-tip fees and service charges'),
  tip: z.number().nullable().describe('Tip/gratuity if printed, else null'),
  total: z.number(),
  notes: z.string().nullable().describe('One short sentence about anything unclear (e.g. smudged price), else null'),
});

export async function parseReceipt(file: { data: string; mediaType: string }, instructions?: string, language: Lang = 'en') {
  const source =
    file.mediaType === 'application/pdf'
      ? ({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file.data } } as const)
      : ({
          type: 'image',
          source: { type: 'base64', media_type: file.mediaType as (typeof IMAGE_TYPES)[number], data: file.data },
        } as const);

  const result = await structured({
    schema: ReceiptSchema,
    effort: 'medium',
    system: [
      'You read receipts for WhoOwes, a bill-splitting app. Extract exactly what is printed.',
      'Rules:',
      '- One entry per purchased line. If a line shows a quantity (e.g. "2 @ 4.50" or "2x Latte 9.00"), set quantity and the UNIT price.',
      '- Discounts and comps are negative items. Do not include subtotal/tax/tip/total as items.',
      '- If the document is not a receipt or invoice, return merchant "Unknown", no items, all amounts 0, and explain in notes.',
      '- Never invent items or prices you cannot read; mention uncertainty in notes.',
      '- Keep item names in the language printed on the receipt.',
      `- Write notes in ${LANGUAGE_NAMES[language]}.`,
    ].join('\n'),
    content: [
      source,
      {
        type: 'text',
        text: instructions
          ? `Extract this receipt. The user added this note — follow it where it applies to extraction:\n<user_note>${instructions}</user_note>`
          : 'Extract this receipt.',
      },
    ],
  });

  return {
    merchant: result.merchant,
    date: result.date ?? undefined,
    currency: result.currency.toUpperCase(),
    items: result.items.map((i) => ({ name: i.name, price: i.unitPrice, quantity: Math.max(1, i.quantity), assignedTo: [] })),
    subtotal: result.subtotal,
    tax: result.tax,
    tip: result.tip ?? undefined,
    total: result.total,
    rawText: result.notes ?? undefined,
  };
}

// ─── Quick Add ───────────────────────────────────────────────────────────────

const CATEGORIES = ['food', 'transport', 'accommodation', 'entertainment', 'utilities', 'shopping', 'health', 'other'] as const;

const QuickAddSchema = z.object({
  title: z.string().describe('Short expense title, 2-5 words, no amount'),
  amount: z.number().describe('Total amount, 0 if none was given'),
  currency: z.string(),
  category: z.enum(CATEGORIES),
  paidById: z.string().describe('id of the person who paid'),
  participantIds: z.array(z.string()).describe('ids of everyone sharing the cost (include the payer if they share it)'),
  splitType: z.enum(['equal', 'custom']),
  customAmounts: z.array(z.object({ userId: z.string(), amount: z.number() })).nullable(),
  groupId: z.string().nullable(),
  date: z.string().nullable().describe('YYYY-MM-DD if a date or relative day was mentioned, else null'),
  note: z.string().nullable().describe('Short question/warning for the user if anything was ambiguous, else null'),
});

export interface QuickAddInput {
  text: string;
  me: { id: string; name: string };
  people: Array<{ id: string; name: string }>;
  groups: Array<{ id: string; name: string; memberIds: string[] }>;
  currency: string;
  today: string;
  language?: Lang;
}

export async function quickAdd(input: QuickAddInput) {
  const directory = {
    me: input.me,
    people: input.people,
    groups: input.groups,
    defaultCurrency: input.currency,
    today: input.today,
  };
  const draft = await structured({
    schema: QuickAddSchema,
    effort: 'low',
    system: [
      'You turn a one-line description of a shared expense into structured data for WhoOwes.',
      '- Use ONLY ids from the provided directory. "I", "me", "my" mean `me`.',
      '- Match people by first name or nickname; if a name is not in the directory, leave them out and say so in note.',
      '- If no payer is named, the payer is me. Default split is equal among everyone mentioned plus me.',
      '- If a group is named, use its id and, unless people are listed, all its members.',
      '- Use splitType "custom" only when individual amounts are stated; then customAmounts must sum to amount.',
      '- Resolve relative dates ("yesterday", "last Friday") against `today`.',
      '- If no currency is named or shown by a symbol, use defaultCurrency.',
      `- The text may be in any language. Write the title in the user's own words and the note in ${LANGUAGE_NAMES[input.language ?? 'en']}.`,
    ].join('\n'),
    content: [
      { type: 'text', text: `<directory>${JSON.stringify(directory)}</directory>` },
      { type: 'text', text: `<expense>${input.text}</expense>` },
    ],
  });

  // Defensive: keep only ids we actually know about.
  const known = new Set([input.me.id, ...input.people.map((p) => p.id)]);
  const participantIds = Array.from(new Set(draft.participantIds.filter((id) => known.has(id))));
  const paidBy = known.has(draft.paidById) ? draft.paidById : input.me.id;
  const customAmounts =
    draft.splitType === 'custom' && draft.customAmounts
      ? Object.fromEntries(draft.customAmounts.filter((c) => known.has(c.userId)).map((c) => [c.userId, c.amount]))
      : undefined;

  return {
    title: draft.title,
    amount: draft.amount,
    currency: draft.currency.toUpperCase(),
    category: draft.category,
    paidBy,
    participantIds: participantIds.length ? participantIds : [input.me.id],
    splitType: customAmounts ? 'custom' : 'equal',
    customAmounts,
    groupId: draft.groupId && input.groups.some((g) => g.id === draft.groupId) ? draft.groupId : undefined,
    date: draft.date ?? input.today,
    note: draft.note ?? undefined,
  };
}

// ─── Split Assistant ─────────────────────────────────────────────────────────

const AssignSchema = z.object({
  assignments: z.array(
    z.object({
      itemId: z.string(),
      userIds: z.array(z.string()).describe('Who shares this item. Empty array = shared by everyone on the bill.'),
    }),
  ),
});

export async function assignItems(input: {
  instruction: string;
  items: Array<{ id: string; name: string; price: number; quantity: number }>;
  people: Array<{ id: string; name: string; isMe?: boolean }>;
}) {
  const result = await structured({
    schema: AssignSchema,
    effort: 'medium',
    system: [
      'You assign receipt items to people for WhoOwes. Return one assignment per item id.',
      '- "I/me/my" refers to the person with isMe=true.',
      '- An item several people shared lists all of them. Items nobody claimed get an empty array (shared by everyone).',
      '- "split the rest" or "everything else shared" means remaining items get an empty array.',
      '- Only use ids from the lists provided.',
    ].join('\n'),
    content: [
      { type: 'text', text: `<people>${JSON.stringify(input.people)}</people>\n<items>${JSON.stringify(input.items)}</items>` },
      { type: 'text', text: `<instruction>${input.instruction}</instruction>` },
    ],
  });

  const itemIds = new Set(input.items.map((i) => i.id));
  const personIds = new Set(input.people.map((p) => p.id));
  return {
    assignments: result.assignments
      .filter((a) => itemIds.has(a.itemId))
      .map((a) => ({ itemId: a.itemId, userIds: a.userIds.filter((id) => personIds.has(id)) })),
  };
}

// ─── Insights ────────────────────────────────────────────────────────────────

const InsightsSchema = z.object({
  headline: z.string().describe('One upbeat sentence, max 14 words'),
  highlights: z.array(z.string()).describe('2-4 specific observations grounded in the numbers'),
  tips: z.array(z.string()).describe('1-2 practical, friendly tips about splitting or settling up'),
});

export async function monthlyInsights(stats: { currency: string }, language: Lang = 'en') {
  return structured({
    schema: InsightsSchema,
    effort: 'low',
    system: [
      'You write a short monthly spending read-out for a WhoOwes user (a bill-splitting app).',
      'Amounts are the USER\'S SHARE of shared expenses. Be specific, warm and concise; no judgement about spending.',
      `Only state facts present in the data. Amounts are in ${stats.currency}; write them with that currency's symbol or code, rounded to whole units.`,
      `Write everything in ${LANGUAGE_NAMES[language]}.`,
    ].join('\n'),
    content: [{ type: 'text', text: `<month_stats>${JSON.stringify(stats)}</month_stats>` }],
  });
}
