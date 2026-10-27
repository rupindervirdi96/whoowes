/**
 * Services barrel.
 *
 * With EXPO_PUBLIC_API_URL set, everything talks to the WhoOwes server
 * (phone sign-in, friends, groups, expenses, payments, receipts, billing, AI).
 * Without it, the app runs on the in-memory demo data in services/mock/*.
 */

export {
  AuthService,
  FriendService,
  GroupService,
  ExpenseService,
  ReceiptService,
  SettlementService,
  ReminderService,
} from './impl';
export { BillingService } from './billing';
export { AIService } from './ai';
export type { ReceiptFile, QuickAddContext, MonthStats } from './ai';
export { ContactsService } from './contacts';
export { PhoneAuthService, DEMO_CODE } from './phoneAuth';
