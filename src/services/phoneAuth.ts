/**
 * Sign in or sign up with a phone number: we text a 6-digit code, the user types it.
 *
 * Live mode: the WhoOwes server sends the code with Twilio Verify and returns a
 * signed session token. Demo mode: no text is sent; the code is always 123456,
 * and the account opens on the sample data so there is something to explore.
 */

import { USE_MOCK_API } from '../config';
import { MOCK_CURRENT_USER } from '../constants/sampleData';
import type { AuthResponse, PhoneCodeSent, User } from '../types';
import { generateId } from '../utils/idGenerator';
import { nowISO } from '../utils/date';
import apiClient from './api/apiClient';
import { mockDelay } from './mock/mockHelpers';
import { db } from './mock/db';

export const DEMO_CODE = '123456';

export const PhoneAuthService = {
  async start(phone: string): Promise<PhoneCodeSent> {
    if (USE_MOCK_API) {
      await mockDelay(700);
      return { phone, isNewUser: !db.users.some((u) => u.phone === phone), devCode: DEMO_CODE };
    }
    const res = await apiClient.post<{ isNewUser: boolean; devCode?: string }>('/auth/phone/start', { phone });
    return { phone, ...res.data };
  },

  async verify(input: { phone: string; code: string; name?: string }): Promise<AuthResponse & { isNewUser: boolean }> {
    if (!USE_MOCK_API) {
      const res = await apiClient.post<AuthResponse & { isNewUser: boolean }>('/auth/phone/verify', input);
      return res.data;
    }
    await mockDelay(800);
    if (input.code !== DEMO_CODE) {
      return Promise.reject({ message: "That code isn't right. In demo mode it's 123456.", statusCode: 400, code: 'invalid_code' });
    }
    const existing = db.users.find((u) => u.phone === input.phone);
    if (existing) return { user: existing, token: `mock_token_${generateId()}`, isNewUser: false };
    if (!input.name?.trim()) {
      return Promise.reject({ message: 'Tell us your name to finish signing up.', statusCode: 400, code: 'name_required' });
    }
    // Demo: a new number takes over the sample account (renamed), so the app has data to show.
    const user: User = { ...MOCK_CURRENT_USER, name: input.name.trim(), phone: input.phone, email: '', updatedAt: nowISO() };
    const idx = db.users.findIndex((u) => u.id === user.id);
    if (idx !== -1) db.users[idx] = user;
    return { user, token: `mock_token_${generateId()}`, isNewUser: true };
  },
};
