/**
 * Mock Friends Service.
 *
 * Manages friend relationships: add, list, remove.
 * Replace with real API calls when backend is available.
 * Real backend endpoints: GET /friends, POST /friends, DELETE /friends/:id
 */

import { Friend, User, AddFriendPayload } from '../../types';
import { MOCK_FRIENDS, MOCK_USERS } from '../../constants/sampleData';
import { generateId } from '../../utils/idGenerator';
import { nowISO } from '../../utils/date';
import { mockDelay } from './mockHelpers';

// In-memory store (will be replaced by real API + React Query cache)
let friends: Friend[] = [...MOCK_FRIENDS];
let users: User[] = [...MOCK_USERS];

const FriendService = {
  /**
   * Fetch all friends for the current user.
   * Real backend: GET /friends
   */
  async getFriends(userId: string): Promise<Friend[]> {
    await mockDelay();
    return friends.filter(
      (f) => f.userId === userId && f.status === 'accepted',
    );
  },

  /**
   * Fetch all friend requests (pending) for the current user.
   * Real backend: GET /friends?status=pending
   */
  async getPendingRequests(userId: string): Promise<Friend[]> {
    await mockDelay();
    return friends.filter(
      (f) => (f.userId === userId || f.friendId === userId) && f.status === 'pending',
    );
  },

  /**
   * Send a friend request by email or phone.
   * Real backend: POST /friends
   */
  async addFriend(userId: string, payload: AddFriendPayload): Promise<Friend> {
    await mockDelay(700);

    // Find the target user by email or phone
    const targetUser = users.find(
      (u) =>
        u.email === payload.emailOrPhone ||
        u.phone === payload.emailOrPhone,
    );

    if (!targetUser) {
      return Promise.reject({
        message: `No user found with email or phone: ${payload.emailOrPhone}`,
        statusCode: 404,
      });
    }

    if (targetUser.id === userId) {
      return Promise.reject({ message: "You can't add yourself as a friend", statusCode: 400 });
    }

    // Check if already friends
    const existing = friends.find(
      (f) =>
        (f.userId === userId && f.friendId === targetUser.id) ||
        (f.userId === targetUser.id && f.friendId === userId),
    );
    if (existing) {
      return Promise.reject({
        message: existing.status === 'accepted' ? 'Already friends' : 'Friend request already sent',
        statusCode: 409,
      });
    }

    const newFriend: Friend = {
      id: generateId(),
      userId,
      friendId: targetUser.id,
      friendUser: targetUser,
      status: 'pending',
      createdAt: nowISO(),
    };

    friends.push(newFriend);
    return newFriend;
  },

  /**
   * Accept a friend request.
   * Real backend: PATCH /friends/:id/accept
   */
  async acceptFriendRequest(friendId: string): Promise<Friend> {
    await mockDelay(400);
    const idx = friends.findIndex((f) => f.id === friendId);
    if (idx === -1) return Promise.reject({ message: 'Friend request not found', statusCode: 404 });
    friends[idx] = { ...friends[idx], status: 'accepted' };
    return friends[idx];
  },

  /**
   * Remove a friend.
   * Real backend: DELETE /friends/:id
   */
  async removeFriend(friendId: string): Promise<void> {
    await mockDelay(400);
    friends = friends.filter((f) => f.id !== friendId);
  },

  /**
   * Search users by email or phone (for adding friends).
   * Real backend: GET /users/search?q=...
   */
  async searchUsers(query: string): Promise<User[]> {
    await mockDelay(500);
    const q = query.toLowerCase();
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        (u.phone && u.phone.includes(q)),
    );
  },
};

export default FriendService;
