/**
 * Services backed by the WhoOwes server (used when EXPO_PUBLIC_API_URL is set).
 * Each one mirrors its demo counterpart in services/mock/* method for method,
 * so hooks and screens don't care which is active.
 */

import type {
  AddFriendPayload,
  AuthResponse,
  CreateExpensePayload,
  CreateGroupPayload,
  CreateSettlementPayload,
  Expense,
  Friend,
  Group,
  LoginPayload,
  ParsedReceipt,
  Receipt,
  ReceiptSourceType,
  RegisterPayload,
  Reminder,
  RespondSettlementPayload,
  Settlement,
  User,
} from '../../types';
import { toE164 } from '../../utils/phone';
import { AIService, type ReceiptFile } from '../ai';
import apiClient from './apiClient';

const get = async <T>(url: string, params?: Record<string, string | undefined>) => (await apiClient.get<T>(url, { params })).data;
const post = async <T>(url: string, body?: unknown) => (await apiClient.post<T>(url, body ?? {})).data;
const patch = async <T>(url: string, body?: unknown) => (await apiClient.patch<T>(url, body)).data;
const del = async (url: string) => {
  await apiClient.delete(url);
};

const emailSignInOff = () =>
  Promise.reject({ message: 'Sign in with your phone number instead.', statusCode: 400, code: 'email_auth_disabled' });

export const LiveAuthService = {
  login: (_p: LoginPayload): Promise<AuthResponse> => emailSignInOff(),
  register: (_p: RegisterPayload): Promise<AuthResponse> => emailSignInOff(),
  async logout() {
    // Sessions are stateless tokens; dropping it on the device signs you out.
  },
  updateProfile: (_current: User, update: Partial<Pick<User, 'name' | 'phone' | 'avatarUrl' | 'email'>>) =>
    patch<User>('/me', { name: update.name, email: update.email, avatarUrl: update.avatarUrl }),
  deleteAccount: () => del('/me'),
};

/** Turns "(415) 555-0123" into "+14155550123"; leaves emails alone. */
const normaliseContact = (v: string) => (v.includes('@') ? v.trim() : (toE164(v) ?? v.trim()));

export const LiveFriendService = {
  getFriends: (_userId: string) => get<Friend[]>('/friends'),
  getPendingRequests: (_userId: string) => get<Friend[]>('/friends/requests'),
  addFriend: (_userId: string, payload: AddFriendPayload) =>
    post<Friend>('/friends', payload.userId ? { userId: payload.userId } : { emailOrPhone: normaliseContact(payload.emailOrPhone ?? '') }),
  acceptFriendRequest: (_currentUserId: string, requestId: string) => post<Friend>(`/friends/requests/${requestId}/accept`),
  declineFriendRequest: (requestId: string) => post<void>(`/friends/requests/${requestId}/decline`),
  removeFriend: (_currentUserId: string, friendUserId: string) => del(`/friends/${friendUserId}`),
  searchUsers: (_currentUserId: string, query: string) => {
    const q = /^[\d\s()+-]{7,}$/.test(query.trim()) ? (toE164(query) ?? query) : query.trim();
    return get<User[]>('/users/search', { q });
  },
  remind: (friendUserId: string, amount?: number) => post<void>(`/friends/${friendUserId}/remind`, { amount }),
};

export const LiveReminderService = {
  getReminders: () => get<Reminder[]>('/reminders'),
  dismiss: (id: string) => post<void>(`/reminders/${id}/dismiss`),
};

export const LiveGroupService = {
  getGroups: (_userId: string) => get<Group[]>('/groups'),
  getGroup: (groupId: string) => get<Group>(`/groups/${groupId}`),
  createGroup: (_userId: string, payload: CreateGroupPayload) => post<Group>('/groups', payload),
  addMember: (groupId: string, newUserId: string) => post<Group>(`/groups/${groupId}/members`, { userId: newUserId }),
  removeMember: async (groupId: string, memberUserId: string) =>
    (await apiClient.delete<Group>(`/groups/${groupId}/members/${memberUserId}`)).data,
  deleteGroup: (groupId: string) => del(`/groups/${groupId}`),
};

export const LiveExpenseService = {
  getExpenses: (_userId: string, groupId?: string) => get<Expense[]>('/expenses', { groupId }),
  getExpense: (expenseId: string) => get<Expense>(`/expenses/${expenseId}`),
  createExpense: (_createdBy: string, payload: CreateExpensePayload) => post<Expense>('/expenses', payload),
  deleteExpense: (expenseId: string) => del(`/expenses/${expenseId}`),
  markSplitPaid: (expenseId: string, userId: string) => post<Expense>(`/expenses/${expenseId}/splits/${userId}/paid`),
};

export const LiveSettlementService = {
  getSettlements: (_userId: string) => get<Settlement[]>('/settlements'),
  getGroupSettlements: (groupId: string) => get<Settlement[]>('/settlements', { groupId }),
  getPendingSettlements: (_userId: string) => get<Settlement[]>('/settlements/pending'),
  getSettlement: (settlementId: string) => get<Settlement>(`/settlements/${settlementId}`),
  createSettlement: (_fromUserId: string, payload: CreateSettlementPayload) => post<Settlement>('/settlements', payload),
  respondToSettlement: (_userId: string, payload: RespondSettlementPayload) =>
    post<Settlement>(`/settlements/${payload.settlementId}/respond`, { action: payload.action }),
  cancelSettlement: (_userId: string, settlementId: string) => del(`/settlements/${settlementId}`),
};

export const LiveReceiptService = {
  async scanReceipt(input: {
    file: ReceiptFile;
    fileUri: string;
    fileName?: string;
    sourceType: ReceiptSourceType;
    instructions?: string;
  }): Promise<Receipt> {
    const { receiptId, ...parsedData } = await AIService.extractReceipt(input.file, input.instructions, {
      sourceType: input.sourceType,
      fileName: input.fileName,
    });
    return {
      id: receiptId ?? `local-${Date.now()}`,
      sourceType: input.sourceType,
      fileUri: input.fileUri,
      fileName: input.fileName,
      mimeType: input.file.mimeType,
      parsedData,
      aiPrompt: input.instructions,
      createdAt: new Date().toISOString(),
    };
  },
  getReceipt: (receiptId: string) => get<Receipt>(`/receipts/${receiptId}`),
  updateReceiptData: (receiptId: string, parsedData: ParsedReceipt) => patch<Receipt>(`/receipts/${receiptId}`, { parsedData }),
  /** The server links the receipt when the expense is created. */
  async linkToExpense(_receiptId: string, _expenseId: string) {},
};
