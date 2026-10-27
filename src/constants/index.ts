/**
 * App-wide constants.
 */

import type { ExpenseCategory } from '../types';

export const APP_NAME = 'WhoOwes';
export const APP_VERSION = '2.0.0';

export const DEFAULT_CURRENCY = 'USD';

export const CURRENCIES: Record<string, { symbol: string; name: string }> = {
  USD: { symbol: '$', name: 'US Dollar' },
  EUR: { symbol: '€', name: 'Euro' },
  GBP: { symbol: '£', name: 'British Pound' },
  INR: { symbol: '₹', name: 'Indian Rupee' },
  CAD: { symbol: 'CA$', name: 'Canadian Dollar' },
  AUD: { symbol: 'A$', name: 'Australian Dollar' },
  JPY: { symbol: '¥', name: 'Japanese Yen' },
};

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
  label: string;
  icon: string; // MaterialIcons glyph
  emoji: string;
  /** Light / dark tint pair for the category chip. */
  color: { light: string; dark: string };
}

export const EXPENSE_CATEGORIES: CategoryMeta[] = [
  { id: 'food', label: 'Food & drink', icon: 'restaurant', emoji: '🍜', color: { light: '#EB6834', dark: '#D95926' } },
  { id: 'transport', label: 'Transport', icon: 'directions-car', emoji: '🚕', color: { light: '#2A78D6', dark: '#3987E5' } },
  { id: 'accommodation', label: 'Stay & rent', icon: 'home', emoji: '🏠', color: { light: '#6250D6', dark: '#9085E9' } },
  { id: 'entertainment', label: 'Fun', icon: 'local-activity', emoji: '🎟️', color: { light: '#E87BA4', dark: '#D55181' } },
  { id: 'utilities', label: 'Bills & utilities', icon: 'bolt', emoji: '💡', color: { light: '#1BAF7A', dark: '#199E70' } },
  { id: 'shopping', label: 'Shopping', icon: 'shopping-bag', emoji: '🛍️', color: { light: '#EDA100', dark: '#C98500' } },
  { id: 'health', label: 'Health', icon: 'favorite', emoji: '💊', color: { light: '#008300', dark: '#008300' } },
  { id: 'other', label: 'Other', icon: 'receipt-long', emoji: '🧾', color: { light: '#E34948', dark: '#E66767' } },
];

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
  { id: 'equal', label: 'Equally', icon: 'drag-handle', description: 'Everyone pays the same' },
  { id: 'custom', label: 'Exact amounts', icon: 'tune', description: 'Type what each person owes' },
  { id: 'percentage', label: 'Percentages', icon: 'percent', description: 'Split by percent' },
] as const;

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const TOAST_DURATION = {
  SHORT: 2000,
  MEDIUM: 3500,
  LONG: 5000,
} as const;
