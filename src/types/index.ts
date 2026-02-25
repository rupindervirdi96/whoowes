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
  emailOrPhone: string;
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
  total: number;
  currency: string;
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
