/**
 * Application constants.
 * All static values used across the app.
 */

// ─── API ─────────────────────────────────────────────────────────────────────
export const API_BASE_URL = 'https://api.whoowes.app/v1';
export const API_TIMEOUT_MS = 15_000;

// ─── AsyncStorage Keys ────────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  AUTH_TOKEN: '@whoowes/auth_token',
  USER: '@whoowes/user',
  THEME: '@whoowes/theme',
} as const;

// ─── Query Keys ───────────────────────────────────────────────────────────────
export const QUERY_KEYS = {
  FRIENDS:             ['friends'] as const,
  GROUPS:              ['groups'] as const,
  GROUP:               (id: string) => ['groups', id] as const,
  GROUP_EXPENSES:      (id: string) => ['groups', id, 'expenses'] as const,
  GROUP_BALANCES:      (id: string) => ['groups', id, 'balances'] as const,
  EXPENSES:            ['expenses'] as const,
  EXPENSE:             (id: string) => ['expenses', id] as const,
  SETTLEMENTS:         ['settlements'] as const,
  PENDING_SETTLEMENTS: ['settlements', 'pending'] as const,
  SETTLEMENT:          (id: string) => ['settlements', id] as const,
  RECEIPT:             (id: string) => ['receipts', id] as const,
  USER_BALANCES:       ['balances', 'user'] as const,
  DASHBOARD_SUMMARY:   ['dashboard', 'summary'] as const,
} as const;

// ─── Toast Durations ─────────────────────────────────────────────────────────
export const TOAST_DURATION = {
  SHORT:  2000,
  MEDIUM: 3500,
  LONG:   5000,
} as const;

// ─── Currencies ──────────────────────────────────────────────────────────────
export const DEFAULT_CURRENCY = 'USD';

export const CURRENCIES: Record<string, { symbol: string; name: string }> = {
  USD: { symbol: '$',   name: 'US Dollar' },
  EUR: { symbol: '€',   name: 'Euro' },
  GBP: { symbol: '£',   name: 'British Pound' },
  CAD: { symbol: 'CA$', name: 'Canadian Dollar' },
  AUD: { symbol: 'A$',  name: 'Australian Dollar' },
  INR: { symbol: '₹',   name: 'Indian Rupee' },
  JPY: { symbol: '¥',   name: 'Japanese Yen' },
  CHF: { symbol: 'Fr',  name: 'Swiss Franc' },
  SGD: { symbol: 'S$',  name: 'Singapore Dollar' },
};

// ─── Expense Categories ────────────────────────────────────────────────────────
export const EXPENSE_CATEGORIES = [
  { id: 'food',          label: 'Food & Drinks',  icon: 'restaurant'  },
  { id: 'transport',     label: 'Transport',       icon: 'directions-car' },
  { id: 'accommodation', label: 'Accommodation',   icon: 'hotel'       },
  { id: 'entertainment', label: 'Entertainment',   icon: 'movie'       },
  { id: 'utilities',     label: 'Utilities',       icon: 'bolt'        },
  { id: 'shopping',      label: 'Shopping',        icon: 'shopping-bag'},
  { id: 'health',        label: 'Health',          icon: 'favorite'    },
  { id: 'other',         label: 'Other',           icon: 'more-horiz'  },
] as const;

// ─── Split Types ─────────────────────────────────────────────────────────────
export const SPLIT_TYPES = [
  { id: 'equal',      label: 'Split Equally',  icon: 'call-split', description: 'Divide equally among all'  },
  { id: 'custom',     label: 'Custom Amounts', icon: 'tune',       description: 'Set individual amounts'    },
  { id: 'percentage', label: 'By Percentage',  icon: 'percent',    description: 'Set percentage per person' },
  { id: 'item_based', label: 'By Item',        icon: 'list-alt',   description: 'Assign items to people'    },
] as const;

// ─── Pagination ───────────────────────────────────────────────────────────────
export const DEFAULT_PAGE_SIZE = 20;
