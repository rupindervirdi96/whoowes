/**
 * Picks the data layer: the WhoOwes server when EXPO_PUBLIC_API_URL is set,
 * otherwise the in-memory demo (services/mock/*). Same methods either way.
 */

import { USE_MOCK_API } from '../config';
import MockAuth from './mock/authService';
import MockFriends from './mock/friendService';
import MockGroups from './mock/groupService';
import MockExpenses from './mock/expenseService';
import MockReceipts from './mock/receiptService';
import MockSettlements from './mock/settlementService';
import MockReminders from './mock/reminderService';
import {
  LiveAuthService,
  LiveExpenseService,
  LiveFriendService,
  LiveGroupService,
  LiveReceiptService,
  LiveReminderService,
  LiveSettlementService,
} from './api/live';

export const AuthService = USE_MOCK_API ? MockAuth : LiveAuthService;
export const FriendService = USE_MOCK_API ? MockFriends : LiveFriendService;
export const GroupService = USE_MOCK_API ? MockGroups : LiveGroupService;
export const ExpenseService = USE_MOCK_API ? MockExpenses : LiveExpenseService;
export const ReceiptService = USE_MOCK_API ? MockReceipts : LiveReceiptService;
export const SettlementService = USE_MOCK_API ? MockSettlements : LiveSettlementService;
export const ReminderService = USE_MOCK_API ? MockReminders : LiveReminderService;
