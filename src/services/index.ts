/**
 * Services barrel export.
 * When switching to a real backend, replace mock imports with real API services
 * that use apiClient from ./api/apiClient.ts.
 */

export { default as AuthService } from './mock/authService';
export { default as FriendService } from './mock/friendService';
export { default as GroupService } from './mock/groupService';
export { default as ExpenseService } from './mock/expenseService';
export { default as ReceiptService } from './mock/receiptService';
export { default as SettlementService } from './mock/settlementService';
