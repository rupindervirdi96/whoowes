/**
 * Mock Friends Service.
 * Friend rows are stored from the current user's perspective once accepted
 * (userId = me, friendUser = them). Incoming requests have friendId = me.
 */

import { Friend, User, AddFriendPayload, FriendPrefsPayload } from '../../types';
import { generateId } from '../../utils/idGenerator';
import { nowISO } from '../../utils/date';
import { mockDelay } from './mockHelpers';
import { db } from './db';
import { REMIND_COOLDOWN_MS } from '../../constants';

const FriendService = {
  async getFriends(userId: string): Promise<Friend[]> {
    await mockDelay();
    return db.friends
      .filter((f) => f.userId === userId && f.status === 'accepted')
      .sort((a, b) => a.friendUser.name.localeCompare(b.friendUser.name));
  },

  /** Incoming requests (someone asked to be my friend) and outgoing ones I sent. */
  async getPendingRequests(userId: string): Promise<Friend[]> {
    await mockDelay();
    return db.friends.filter(
      (f) => f.status === 'pending' && (f.friendId === userId || f.userId === userId),
    );
  },

  async addFriend(userId: string, payload: AddFriendPayload): Promise<Friend> {
    await mockDelay(700);
    const q = (payload.emailOrPhone ?? '').trim().toLowerCase();
    const target = payload.userId ? db.users.find((u) => u.id === payload.userId) : db.users.find((u) => u.email === q || u.phone === q);
    if (!target) {
      return Promise.reject({ message: `No WhoOwes account for ${payload.emailOrPhone}`, statusCode: 404 });
    }
    if (target.id === userId) {
      return Promise.reject({ message: "That's you! Try a friend's email.", statusCode: 400 });
    }
    const existing = db.friends.find(
      (f) =>
        (f.userId === userId && f.friendId === target.id) ||
        (f.userId === target.id && f.friendId === userId),
    );
    if (existing?.status === 'accepted') {
      return Promise.reject({ message: 'You are already friends', statusCode: 409 });
    }
    if (existing && existing.userId === userId) {
      return Promise.reject({ message: 'Request already sent', statusCode: 409 });
    }
    if (existing) {
      // They already asked me: adding them back accepts it (same as the server).
      return FriendService.acceptFriendRequest(userId, existing.id);
    }
    const friend: Friend = {
      id: generateId(),
      userId,
      friendId: target.id,
      friendUser: target,
      status: 'pending',
      createdAt: nowISO(),
    };
    db.friends.push(friend);
    return friend;
  },

  async acceptFriendRequest(currentUserId: string, requestId: string): Promise<Friend> {
    await mockDelay(400);
    const idx = db.friends.findIndex((f) => f.id === requestId);
    if (idx === -1) return Promise.reject({ message: 'Request not found', statusCode: 404 });
    const req = db.friends[idx];
    // Only the person who received the request can accept it.
    if (req.status !== 'pending' || req.friendId !== currentUserId) {
      return Promise.reject({ message: 'Request not found', statusCode: 404 });
    }
    const requester = db.users.find((u) => u.id === req.userId) ?? req.friendUser;
    // Re-store from my perspective so getFriends() finds it.
    const accepted: Friend = {
      ...req,
      userId: currentUserId,
      friendId: requester.id,
      friendUser: requester,
      status: 'accepted',
      friendsSince: nowISO(),
    };
    db.friends[idx] = accepted;
    return accepted;
  },

  async declineFriendRequest(requestId: string): Promise<void> {
    await mockDelay(300);
    db.friends = db.friends.filter((f) => f.id !== requestId);
  },

  /** Removes the friendship. `friendUserId` is the other person's user id. */
  async removeFriend(currentUserId: string, friendUserId: string): Promise<void> {
    await mockDelay(400);
    db.friends = db.friends.filter(
      (f) =>
        !(
          (f.userId === currentUserId && f.friendId === friendUserId) ||
          (f.userId === friendUserId && f.friendId === currentUserId)
        ),
    );
  },

  /** My private nickname and pin for a friend. */
  async updateFriend(friendUserId: string, prefs: FriendPrefsPayload): Promise<Friend> {
    await mockDelay(250);
    const idx = db.friends.findIndex((f) => f.friendId === friendUserId && f.status === 'accepted');
    if (idx === -1) return Promise.reject({ message: 'You are not friends with this person.', statusCode: 404 });
    const next: Friend = { ...db.friends[idx] };
    if (prefs.nickname !== undefined) next.nickname = prefs.nickname?.trim() || undefined;
    if (prefs.pinned !== undefined) next.pinned = prefs.pinned || undefined;
    db.friends[idx] = next;
    return next;
  },

  async searchUsers(currentUserId: string, query: string): Promise<User[]> {
    await mockDelay(350);
    const q = query.trim().toLowerCase();
    return db.users.filter(
      (u) =>
        u.id !== currentUserId &&
        (u.email.toLowerCase().includes(q) ||
          u.name.toLowerCase().includes(q) ||
          (u.phone ?? '').includes(q)),
    );
  },

  /** Sends a payment reminder. Like the server, at most one per person every 12 hours. */
  async remind(friendUserId: string, _amount?: number, _currency?: string): Promise<void> {
    await mockDelay(500);
    const idx = db.friends.findIndex((f) => f.friendId === friendUserId && f.status === 'accepted');
    const last = idx === -1 ? undefined : db.friends[idx].lastRemindedAt;
    if (last && Date.now() - new Date(last).getTime() < REMIND_COOLDOWN_MS) {
      return Promise.reject({ message: 'You already sent a reminder today. Give them a little time.', statusCode: 429 });
    }
    if (idx !== -1) db.friends[idx] = { ...db.friends[idx], lastRemindedAt: nowISO() };
  },
};

export default FriendService;
