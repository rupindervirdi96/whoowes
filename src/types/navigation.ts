/**
 * React Navigation typed param lists.
 *
 * Layout: one root stack holds the tab bar plus every detail / modal screen,
 * so any screen can open any other without nested-navigator casts.
 */

import { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { QuickAddDraft } from './index';

export type AuthStackParamList = {
  Welcome: undefined;
  PhoneVerify: { phone: string; isNewUser: boolean; devCode?: string };
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Friends: undefined;
  Add: undefined; // placeholder — the center button opens the add sheet
  Groups: undefined;
  Activity: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;

  // Friends & groups
  FriendDetail: { friendId: string };
  AddFriend: undefined;
  FindFriends: undefined;
  GroupDetail: { groupId: string };
  CreateGroup: undefined;

  // Expenses
  ManualExpense: { groupId?: string; friendId?: string; draft?: QuickAddDraft } | undefined;
  /** focus: 'comments' scrolls down to the conversation (opened from a comment notification). */
  ExpenseDetail: { expenseId: string; focus?: 'comments' };
  ReceiptScan: { groupId?: string; source?: 'camera' | 'gallery' | 'pdf' } | undefined;
  ReceiptReview: { receiptId: string; groupId?: string };
  QuickAdd: { groupId?: string } | undefined;

  // Payments
  SettleUp: { userId?: string; amount?: number; currency?: string; groupId?: string } | undefined;
  Settlements: undefined;
  SettlementDetail: { settlementId: string };

  // Account
  Account: undefined;
  Insights: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // Gives useNavigation() full typing everywhere.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
