/**
 * App-wide constants.
 */

export const APP_NAME = 'WhoOwes';
export const APP_VERSION = '1.0.0';

// Default currency
export const DEFAULT_CURRENCY = 'USD';

// Supported currencies with symbols
export const CURRENCIES: Record<string, { symbol: string; name: string }> = {
  USD: { symbol: '$', name: 'US Dollar' },
  EUR: { symbol: '€', name: 'Euro' },
  GBP: { symbol: '£', name: 'British Pound' },
  INR: { symbol: '₹', name: 'Indian Rupee' },
  CAD: { symbol: 'CA$', name: 'Canadian Dollar' },
  AUD: { symbol: 'A$', name: 'Australian Dollar' },
  JPY: { symbol: '¥', name: 'Japanese Yen' },
};

// AsyncStorage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: '@whoowes/auth_token',
  USER: '@whoowes/user',
  THEME: '@whoowes/theme',
  ONBOARDING_DONE: '@whoowes/onboarding_done',
} as const;

// Query keys for React Query
export const QUERY_KEYS = {
  // Auth
  CURRENT_USER: ['currentUser'] as const,
  // Friends
  FRIENDS: ['friends'] as const,
  FRIEND: (id: string) => ['friends', id] as const,
  // Groups
  GROUPS: ['groups'] as const,
  GROUP: (id: string) => ['groups', id] as const,
  GROUP_BALANCES: (id: string) => ['groups', id, 'balances'] as const,
  // Expenses
  EXPENSES: ['expenses'] as const,
  GROUP_EXPENSES: (groupId: string) => ['expenses', 'group', groupId] as const,
  EXPENSE: (id: string) => ['expenses', id] as const,
  // Receipts
  RECEIPT: (id: string) => ['receipts', id] as const,
  // Settlements
  SETTLEMENTS: ['settlements'] as const,
  PENDING_SETTLEMENTS: ['settlements', 'pending'] as const,
  SETTLEMENT: (id: string) => ['settlements', id] as const,
  // Balances
  USER_BALANCES: ['balances', 'user'] as const,
  DASHBOARD_SUMMARY: ['dashboard', 'summary'] as const,
} as const;

// Expense category icon mapping (@expo/vector-icons MaterialIcons names)
export const CATEGORY_ICONS: Record<string, string> = {
  food: 'restaurant',
  transport: 'directions-car',
  accommodation: 'hotel',
  entertainment: 'movie',
  utilities: 'electrical-services',
  shopping: 'shopping-bag',
  health: 'local-hospital',
  other: 'receipt-long',
};

// Expense category colors
export const CATEGORY_COLORS: Record<string, string> = {
  food: '#f59e0b',
  transport: '#3b82f6',
  accommodation: '#8b5cf6',
  entertainment: '#ec4899',
  utilities: '#06b6d4',
  shopping: '#f97316',
  health: '#22c55e',
  other: '#6b7280',
};

// Settlement status colors
export const SETTLEMENT_STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  confirmed: '#22c55e',
  rejected: '#ef4444',
};

// Pagination
export const DEFAULT_PAGE_SIZE = 20;

// Split types
export const SPLIT_TYPES = [
  { id: 'equal',      label: 'Split Equally',  icon: 'call-split', description: 'Divide equally among all'  },
  { id: 'custom',     label: 'Custom Amounts', icon: 'tune',       description: 'Set individual amounts'    },
  { id: 'percentage', label: 'By Percentage',  icon: 'percent',    description: 'Set percentage per person' },
  { id: 'item_based', label: 'By Item',        icon: 'list-alt',   description: 'Assign items to people'    },
] as const;

// Expense categories
export const EXPENSE_CATEGORIES = [
  { id: 'food',          label: 'Food & Drinks',  icon: 'restaurant'    },
  { id: 'transport',     label: 'Transport',       icon: 'directions-car'},
  { id: 'accommodation', label: 'Accommodation',   icon: 'hotel'         },
  { id: 'entertainment', label: 'Entertainment',   icon: 'movie'         },
  { id: 'utilities',     label: 'Utilities',       icon: 'bolt'          },
  { id: 'shopping',      label: 'Shopping',        icon: 'shopping-bag'  },
  { id: 'health',        label: 'Health',          icon: 'favorite'      },
  { id: 'other',         label: 'Other',           icon: 'more-horiz'    },
] as const;

// Receipt upload constraints
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// Toast durations (ms)
export const TOAST_DURATION = {
  SHORT: 2000,
  MEDIUM: 3500,
  LONG: 5000,
} as const;

// API base URL - switch to real backend URL here
export const API_BASE_URL = 'https://api.whoowes.app/v1'; // replace with real URL
export const API_TIMEOUT_MS = 15000;
