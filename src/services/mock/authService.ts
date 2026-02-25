/**
 * Mock Authentication Service.
 *
 * Simulates login, register, logout, and token persistence.
 * Replace with real API calls to POST /auth/login, /auth/register, etc.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthResponse, LoginPayload, RegisterPayload, User } from '../../types';
import { STORAGE_KEYS } from '../../constants';
import { MOCK_CURRENT_USER } from '../../constants/sampleData';
import { generateId } from '../../utils/idGenerator';
import { nowISO } from '../../utils/date';
import { mockDelay } from './mockHelpers';

// Simulated user store (in-memory)
let users: User[] = [MOCK_CURRENT_USER];
let currentToken: string | null = null;

const AuthService = {
  /**
   * Simulate login with email/password.
   * Real backend: POST /auth/login
   */
  async login(payload: LoginPayload): Promise<AuthResponse> {
    await mockDelay(600);

    // Mock validation
    if (!payload.email || !payload.password) {
      return Promise.reject({ message: 'Email and password required', statusCode: 400 });
    }

    // For demo purposes, any email ending in @example.com with password 'password123' works
    if (payload.password.length < 6) {
      return Promise.reject({ message: 'Invalid credentials', statusCode: 401 });
    }

    // Find or create mock user
    let user = users.find((u) => u.email === payload.email);
    if (!user) {
      user = { ...MOCK_CURRENT_USER, email: payload.email };
    }

    const token = `mock_token_${generateId()}`;
    currentToken = token;

    await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));

    return { user, token };
  },

  /**
   * Simulate user registration.
   * Real backend: POST /auth/register
   */
  async register(payload: RegisterPayload): Promise<AuthResponse> {
    await mockDelay(800);

    // Check for duplicate email
    const existing = users.find((u) => u.email === payload.email);
    if (existing) {
      return Promise.reject({ message: 'Email already in use', statusCode: 409 });
    }

    const newUser: User = {
      id: generateId(),
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };

    users.push(newUser);
    const token = `mock_token_${generateId()}`;
    currentToken = token;

    await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));

    return { user: newUser, token };
  },

  /**
   * Log out and clear stored credentials.
   * Real backend: POST /auth/logout
   */
  async logout(): Promise<void> {
    await mockDelay(200);
    currentToken = null;
    await AsyncStorage.multiRemove([STORAGE_KEYS.AUTH_TOKEN, STORAGE_KEYS.USER]);
  },

  /**
   * Restore session from AsyncStorage (app startup).
   */
  async restoreSession(): Promise<AuthResponse | null> {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    const userJson = await AsyncStorage.getItem(STORAGE_KEYS.USER);

    if (token && userJson) {
      const user: User = JSON.parse(userJson);
      currentToken = token;
      return { user, token };
    }
    return null;
  },

  /**
   * Update current user profile.
   * Real backend: PATCH /users/me
   */
  async updateProfile(update: Partial<Pick<User, 'name' | 'phone' | 'avatarUrl'>>): Promise<User> {
    await mockDelay(500);
    const userJson = await AsyncStorage.getItem(STORAGE_KEYS.USER);
    if (!userJson) return Promise.reject({ message: 'Not authenticated', statusCode: 401 });

    const user: User = { ...JSON.parse(userJson), ...update, updatedAt: nowISO() };
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    return user;
  },
};

export default AuthService;
