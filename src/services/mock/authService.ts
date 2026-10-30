/**
 * Mock Authentication Service.
 * Any password of 6+ characters works. Unknown emails sign in as the demo user
 * so the app always has data to show.
 */

import { AuthResponse, LoginPayload, RegisterPayload, User } from '../../types';
import { MOCK_CURRENT_USER } from '../../constants/sampleData';
import { generateId } from '../../utils/idGenerator';
import { nowISO } from '../../utils/date';
import { mockDelay } from './mockHelpers';
import { db } from './db';

const AuthService = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    await mockDelay(600);
    if (!payload.email || payload.password.length < 6) {
      return Promise.reject({ message: 'Invalid email or password', statusCode: 401 });
    }
    const email = payload.email.trim().toLowerCase();
    const user = db.users.find((u) => u.email === email) ?? { ...MOCK_CURRENT_USER, email };
    return { user, token: `mock_token_${generateId()}` };
  },

  async register(payload: RegisterPayload): Promise<AuthResponse> {
    await mockDelay(800);
    const email = payload.email.trim().toLowerCase();
    if (db.users.some((u) => u.email === email)) {
      return Promise.reject({ message: 'That email already has an account', statusCode: 409 });
    }
    const user: User = {
      id: generateId(),
      name: payload.name.trim(),
      email,
      phone: payload.phone || undefined,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    db.users.push(user);
    return { user, token: `mock_token_${generateId()}` };
  },

  async logout(): Promise<void> {
    await mockDelay(200);
  },

  /** Demo: nothing is stored anywhere, so signing out is enough. */
  async deleteAccount(): Promise<void> {
    await mockDelay(500);
  },

  async updateProfile(
    current: User,
    update: Partial<Pick<User, 'name' | 'phone' | 'avatarUrl' | 'email' | 'currency'>>,
  ): Promise<User> {
    await mockDelay(500);
    const user: User = { ...current, ...update, updatedAt: nowISO() };
    const idx = db.users.findIndex((u) => u.id === user.id);
    if (idx !== -1) db.users[idx] = user;
    return user;
  },
};

export default AuthService;
