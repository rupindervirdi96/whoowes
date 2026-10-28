/**
 * Core domain types for WhoOwes expense splitting app.
 * These types are the single source of truth for the entire application.
 */

// ─── User & Auth ─────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  phone?: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

/** Step 1 of phone sign-in: a code was texted to the number. */
export interface PhoneCodeSent {
  phone: string; // E.164
  isNewUser: boolean;
  /** Only in demo mode / development servers: the code to type. */
  devCode?: string;
}

// ─── Contacts ────────────────────────────────────────────────────────────────

/** 'demo' = no address book on this platform (web), sample contacts shown instead. */
export type ContactsPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable' | 'demo';

/** How a contact who is on WhoOwes relates to me. */
export type ContactFriendState = 'friend' | 'requested' | 'incoming' | 'none';

export interface ContactMatch {
  /** Address-book id + number, unique per row. */
  key: string;
  contactName: string;
  phone: string; // E.164
  /** Set when this number belongs to a WhoOwes user. */
  user?: User;
  state: ContactFriendState;
  /** Incoming friend request id, when state === 'incoming'. */
  requestId?: string;
}

export interface ContactMatchResult {
  permission: ContactsPermission;
  /** False when the user said "don't ask again"; only Settings can grant it now. */
  canAskAgain: boolean;
  onWhoOwes: ContactMatch[];
  invite: ContactMatch[];
  /** Demo mode: some contacts were shown as members so the feature can be tried. */
  demoSeeded: boolean;
}

// ─── Friends ─────────────────────────────────────────────────────────────────

export type FriendStatus = 'pending' | 'accepted' | 'blocked';

export interface Friend {
  id: string;
  userId: string;         // the current user
  friendId: string;       // the other user
  friendUser: User;       // populated friend user object
  status: FriendStatus;
  createdAt: string;
}

export interface AddFriendPayload {
  /** Add a known WhoOwes user directly (e.g. from contact matching). */
  userId?: string;
  emailOrPhone?: string;
}

/** "Alex reminded you": shown in Needs your attention until dismissed. */
export interface Reminder {
  id: string;
  fromUser: User;
  amount?: number;
  createdAt: string;
}

// ─── Groups ──────────────────────────────────────────────────────────────────

export interface GroupMember {
  userId: string;
  user: User;
  role: 'admin' | 'member';
  joinedAt: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  members: GroupMember[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  totalExpenses: number;
}

export interface CreateGroupPayload {
  name: string;
  description?: string;
  memberIds: string[];
}

// ─── Expenses ────────────────────────────────────────────────────────────────

export type SplitType = 'equal' | 'custom' | 'percentage' | 'item_based';
export type ExpenseCategory =
  | 'food'
  | 'transport'
  | 'accommodation'
  | 'entertainment'
  | 'utilities'
  | 'shopping'
  | 'health'
  | 'other';

export interface ExpenseSplit {
  userId: string;
  user: User;
  amount: number;       // the amount this user owes
  percentage?: number;  // used for percentage type
  paid: boolean;
}

export interface ExpenseItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  assignedTo: string[]; // userIds
}

export interface Expense {
  id: string;
  groupId: string | null; // null for non-group expenses
  title: string;
  description?: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  paidBy: string;       // userId
  paidByUser: User;
  splitType: SplitType;
  splits: ExpenseSplit[];
  items?: ExpenseItem[]; // for item-based splits
  receiptId?: string;
  date: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpensePayload {
  groupId?: string;
  title: string;
  description?: string;
  amount: number;
  currency?: string;
  category: ExpenseCategory;
  paidBy: string;
  splitType: SplitType;
  splits: Omit<ExpenseSplit, 'user' | 'paid'>[];
  items?: Omit<ExpenseItem, 'id'>[];
  receiptId?: string;
  date?: string;
}

// ─── Receipts ─────────────────────────────────────────────────────────────────

export type ReceiptSourceType = 'camera' | 'gallery' | 'pdf';

export interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  assignedTo: string[]; // userIds
}

export interface ParsedReceipt {
  merchant: string;
  date?: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  tip?: number;
  total: number;
  currency: string;
  /** Anything the AI flagged as unclear while reading the receipt. */
  rawText?: string;
}

export interface Receipt {
  id: string;
  sourceType: ReceiptSourceType;
  fileUri: string;
  fileName?: string;
  mimeType?: string;
  parsedData?: ParsedReceipt;
  aiPrompt?: string;
  createdAt: string;
  expenseId?: string;
}

// ─── Balances ─────────────────────────────────────────────────────────────────

export interface UserBalance {
  userId: string;
  user: User;
  owes: number;    // total this user owes (positive = owes others)
  owed: number;    // total others owe this user
  netBalance: number; // owed - owes (positive = net creditor)
}

export interface GroupBalance {
  groupId: string;
  userBalances: UserBalance[];
  totalExpenses: number;
}

export interface DebtSimplification {
  from: string;   // userId who owes
  to: string;     // userId who is owed
  amount: number;
  fromUser: User;
  toUser: User;
}

// ─── Settlements ──────────────────────────────────────────────────────────────

export type SettlementStatus = 'pending' | 'confirmed' | 'rejected';

export interface Settlement {
  id: string;
  fromUserId: string;   // who pays
  toUserId: string;     // who receives
  fromUser: User;
  toUser: User;
  amount: number;
  currency: string;
  note?: string;
  status: SettlementStatus;
  groupId?: string;
  expenseIds?: string[];
  initiatedAt: string;
  confirmedAt?: string;
  rejectedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSettlementPayload {
  toUserId: string;
  amount: number;
  currency?: string;
  note?: string;
  groupId?: string;
  expenseIds?: string[];
}

export interface RespondSettlementPayload {
  settlementId: string;
  action: 'confirm' | 'reject';
}

// ─── Activity ────────────────────────────────────────────────────────────────

export type ActivityItem =
  | { kind: 'expense'; id: string; date: string; expense: Expense }
  | { kind: 'settlement'; id: string; date: string; settlement: Settlement };

// ─── Billing / Plans ─────────────────────────────────────────────────────────

export type PlanId = 'free' | 'plus' | 'pro';
export type BillingInterval = 'month' | 'year';

/** Features that can be gated behind a paid plan. */
export type Feature =
  | 'receipt_scan'
  | 'ai_quick_add'
  | 'ai_split_assistant'
  | 'ai_insights'
  | 'csv_export';

export type SubscriptionStatus =
  | 'none'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete';

export interface Subscription {
  plan: PlanId;
  status: SubscriptionStatus;
  interval?: BillingInterval;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  /** AI receipt scans used in the current calendar month. */
  scansUsed: number;
  /** null = unlimited */
  scansLimit: number | null;
  /** True when the app is running against the local mock (no real charges). */
  isDemo?: boolean;
  /** Who bills the subscription: Stripe (web) or an app store. */
  provider?: 'stripe' | 'play_store' | 'app_store' | 'other_store';
  /** App store product id of the current subscription (used to switch plans). */
  productId?: string;
}

// ─── AI ──────────────────────────────────────────────────────────────────────

export interface QuickAddDraft {
  title: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  paidBy: string;
  participantIds: string[];
  splitType: 'equal' | 'custom';
  customAmounts?: Record<string, number>;
  groupId?: string;
  date?: string;
  /** Short note from the AI about anything it was unsure of. */
  note?: string;
}

export interface SpendingInsights {
  month: string;
  total: number;
  previousTotal: number;
  byCategory: Array<{ category: ExpenseCategory; amount: number }>;
  headline: string;
  highlights: string[];
  tips: string[];
}

// ─── API ─────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}

export interface ApiError {
  message: string;
  statusCode: number;
  /** Machine-readable reason, e.g. 'upgrade_required' or 'quota_exceeded'. */
  code?: string;
  /** For gating errors: which feature the user tried to use. */
  feature?: Feature;
  errors?: Record<string, string[]>;
}

// ─── UI State ─────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

export type ModalState = {
  visible: boolean;
  title?: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  onConfirm?: () => void;
  onCancel?: () => void;
};
