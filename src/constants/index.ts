/**
 * App-wide constants.
 */

import type { ExpenseCategory } from '../types';
import { translate, type TKey } from '../i18n';

export const APP_NAME = 'WhoOwes';
export const APP_VERSION = '2.0.0';

export const STORAGE_KEYS = {
  AUTH_TOKEN: '@whoowes/auth_token',
  USER: '@whoowes/user',
  UI_PREFS: '@whoowes/ui',
  DEMO_SUBSCRIPTION: '@whoowes/demo_subscription',
} as const;

export const QUERY_KEYS = {
  FRIENDS: ['friends'] as const,
  FRIEND_REQUESTS: ['friends', 'pending'] as const,
  GROUPS: ['groups'] as const,
  GROUP: (id: string) => ['groups', id] as const,
  EXPENSES: ['expenses'] as const,
  GROUP_EXPENSES: (groupId: string) => ['expenses', 'group', groupId] as const,
  EXPENSE: (id: string) => ['expenses', 'detail', id] as const,
  RECEIPT: (id: string) => ['receipts', id] as const,
  SETTLEMENTS: ['settlements'] as const,
  PENDING_SETTLEMENTS: ['settlements', 'pending'] as const,
  SETTLEMENT: (id: string) => ['settlements', 'detail', id] as const,
  BALANCES: ['balances'] as const,
  SUBSCRIPTION: ['billing', 'subscription'] as const,
  INSIGHTS: (month: string) => ['insights', month] as const,
  CONTACT_MATCHES: ['contacts', 'matches'] as const,
  REMINDERS: ['reminders'] as const,
  GROUP_SETTLEMENTS: (groupId: string) => ['settlements', 'group', groupId] as const,
} as const;

/** Every query key that depends on expenses or settlements — invalidate together after a write. */
export const MONEY_QUERY_ROOTS = [['expenses'], ['settlements'], ['balances'], ['groups'], ['insights']] as const;

// ─── Categories ───────────────────────────────────────────────────────────────

export interface CategoryMeta {
  id: ExpenseCategory;
  labelKey: TKey;
  /** One-word label for small chips. */
  shortKey: TKey;
  icon: string; // MaterialIcons glyph
  emoji: string;
  /** Light / dark tint pair for the category chip. */
  color: { light: string; dark: string };
}

export const EXPENSE_CATEGORIES: CategoryMeta[] = [
  { id: 'food', labelKey: 'category.food', shortKey: 'category.food.short', icon: 'restaurant', emoji: '🍜', color: { light: '#EB6834', dark: '#D95926' } },
  { id: 'transport', labelKey: 'category.transport', shortKey: 'category.transport.short', icon: 'directions-car', emoji: '🚕', color: { light: '#2A78D6', dark: '#3987E5' } },
  { id: 'accommodation', labelKey: 'category.accommodation', shortKey: 'category.accommodation.short', icon: 'home', emoji: '🏠', color: { light: '#6250D6', dark: '#9085E9' } },
  { id: 'entertainment', labelKey: 'category.entertainment', shortKey: 'category.entertainment.short', icon: 'local-activity', emoji: '🎟️', color: { light: '#E87BA4', dark: '#D55181' } },
  { id: 'utilities', labelKey: 'category.utilities', shortKey: 'category.utilities.short', icon: 'bolt', emoji: '💡', color: { light: '#1BAF7A', dark: '#199E70' } },
  { id: 'shopping', labelKey: 'category.shopping', shortKey: 'category.shopping.short', icon: 'shopping-bag', emoji: '🛍️', color: { light: '#EDA100', dark: '#C98500' } },
  { id: 'health', labelKey: 'category.health', shortKey: 'category.health.short', icon: 'favorite', emoji: '💊', color: { light: '#008300', dark: '#008300' } },
  { id: 'other', labelKey: 'category.other', shortKey: 'category.other.short', icon: 'receipt-long', emoji: '🧾', color: { light: '#E34948', dark: '#E66767' } },
];

/** "Food & drink" in the app language. */
export const categoryLabel = (id: ExpenseCategory) => translate(CATEGORY_BY_ID[id].labelKey);

/**
 * Fixed order for stacked / category charts. These colors are the validated
 * categorical palette: neighbours in THIS order pass colorblind and
 * normal-vision separation checks in light and dark mode, so stacked segments
 * must always be drawn in this order (never re-sorted by amount).
 */
export const CATEGORY_CHART_ORDER: ExpenseCategory[] = [
  'transport',
  'food',
  'utilities',
  'shopping',
  'entertainment',
  'health',
  'accommodation',
  'other',
];

export const CATEGORY_BY_ID: Record<ExpenseCategory, CategoryMeta> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.id, c]),
) as Record<ExpenseCategory, CategoryMeta>;

export const SPLIT_TYPES = [
  { id: 'equal', labelKey: 'split.equal', icon: 'drag-handle' },
  { id: 'custom', labelKey: 'split.custom', icon: 'tune' },
  { id: 'percentage', labelKey: 'split.percentage', icon: 'percent' },
] as const satisfies ReadonlyArray<{ id: string; labelKey: TKey; icon: string }>;

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const TOAST_DURATION = {
  SHORT: 2000,
  MEDIUM: 3500,
  LONG: 5000,
} as const;
