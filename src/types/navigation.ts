/**
 * React Navigation typed param lists.
 * Every navigator and screen is typed here for full type safety.
 */

import { NavigatorScreenParams } from '@react-navigation/native';

// ─── Auth Stack ───────────────────────────────────────────────────────────────

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

// ─── Friends Stack ────────────────────────────────────────────────────────────

export type FriendsStackParamList = {
  FriendsList: undefined;
  AddFriend: undefined;
  FriendDetail: { friendId: string; friendName: string };
};

// ─── Groups Stack ─────────────────────────────────────────────────────────────

export type GroupsStackParamList = {
  GroupsList: undefined;
  CreateGroup: undefined;
  GroupDetail: { groupId: string; groupName: string };
  GroupBalances: { groupId: string; groupName: string };
};

// ─── Expenses Stack ───────────────────────────────────────────────────────────

export type ExpensesStackParamList = {
  AddExpense: { groupId?: string };
  ManualExpense: { groupId?: string; receiptId?: string };
  ReceiptUpload: { groupId?: string; fileType?: 'image' | 'pdf' };
  ReceiptReview: { receiptId: string; groupId?: string };
  ExpenseDetail: { expenseId: string };
};

// ─── Settlements Stack ────────────────────────────────────────────────────────

export type SettlementsStackParamList = {
  SettlementsList: undefined;
  InitiateSettlement: { toUserId: string; suggestedAmount?: number; groupId?: string };
  PendingSettlements: undefined;
  SettlementDetail: { settlementId: string };
};

// ─── Main Tab Navigator ───────────────────────────────────────────────────────

export type MainTabParamList = {
  Dashboard: undefined;
  Friends: NavigatorScreenParams<FriendsStackParamList>;
  Groups: NavigatorScreenParams<GroupsStackParamList>;
  Settlements: NavigatorScreenParams<SettlementsStackParamList>;
  Profile: undefined;
};

// ─── Root Navigator ───────────────────────────────────────────────────────────

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  // Expense flows are modal-style stacks accessible from anywhere
  ExpenseFlow: NavigatorScreenParams<ExpensesStackParamList>;
};
