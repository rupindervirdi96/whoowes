/**
 * Mock Groups Service.
 *
 * Manages group creation, membership, and retrieval.
 * Real backend endpoints: GET /groups, POST /groups, GET /groups/:id, etc.
 */

import { Group, GroupMember, CreateGroupPayload, User } from '../../types';
import { MOCK_GROUPS, MOCK_USERS } from '../../constants/sampleData';
import { generateId } from '../../utils/idGenerator';
import { nowISO } from '../../utils/date';
import { mockDelay } from './mockHelpers';

let groups: Group[] = [...MOCK_GROUPS];
const users: User[] = [...MOCK_USERS];

const GroupService = {
  /**
   * Get all groups for the current user.
   * Real backend: GET /groups
   */
  async getGroups(userId: string): Promise<Group[]> {
    await mockDelay();
    return groups.filter((g) => g.members.some((m) => m.userId === userId));
  },

  /**
   * Get a single group by ID.
   * Real backend: GET /groups/:id
   */
  async getGroup(groupId: string): Promise<Group> {
    await mockDelay();
    const group = groups.find((g) => g.id === groupId);
    if (!group) return Promise.reject({ message: 'Group not found', statusCode: 404 });
    return group;
  },

  /**
   * Create a new group.
   * Real backend: POST /groups
   */
  async createGroup(userId: string, payload: CreateGroupPayload): Promise<Group> {
    await mockDelay(600);

    const creator = users.find((u) => u.id === userId);
    if (!creator) return Promise.reject({ message: 'User not found', statusCode: 404 });

    const memberIds = Array.from(new Set([userId, ...payload.memberIds]));
    const members: GroupMember[] = memberIds.map((mid): GroupMember => {
      const user = users.find((u) => u.id === mid) ?? {
        id: mid, name: 'Unknown', email: '', createdAt: nowISO(), updatedAt: nowISO(),
      };
      return {
        userId: mid,
        user,
        role: mid === userId ? 'admin' : 'member',
        joinedAt: nowISO(),
      };
    });

    const newGroup: Group = {
      id: generateId(),
      name: payload.name,
      description: payload.description,
      members,
      createdBy: userId,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      totalExpenses: 0,
    };

    groups.push(newGroup);
    return newGroup;
  },

  /**
   * Add a member to a group.
   * Real backend: POST /groups/:id/members
   */
  async addMember(groupId: string, newUserId: string): Promise<Group> {
    await mockDelay(400);
    const idx = groups.findIndex((g) => g.id === groupId);
    if (idx === -1) return Promise.reject({ message: 'Group not found', statusCode: 404 });

    const alreadyMember = groups[idx].members.some((m) => m.userId === newUserId);
    if (alreadyMember) return Promise.reject({ message: 'User is already a member', statusCode: 409 });

    const user = users.find((u) => u.id === newUserId);
    if (!user) return Promise.reject({ message: 'User not found', statusCode: 404 });

    const updatedGroup: Group = {
      ...groups[idx],
      members: [
        ...groups[idx].members,
        { userId: newUserId, user, role: 'member', joinedAt: nowISO() },
      ],
      updatedAt: nowISO(),
    };
    groups[idx] = updatedGroup;
    return updatedGroup;
  },

  /**
   * Remove a member from a group.
   * Real backend: DELETE /groups/:id/members/:userId
   */
  async removeMember(groupId: string, memberUserId: string): Promise<Group> {
    await mockDelay(400);
    const idx = groups.findIndex((g) => g.id === groupId);
    if (idx === -1) return Promise.reject({ message: 'Group not found', statusCode: 404 });

    const updatedGroup: Group = {
      ...groups[idx],
      members: groups[idx].members.filter((m) => m.userId !== memberUserId),
      updatedAt: nowISO(),
    };
    groups[idx] = updatedGroup;
    return updatedGroup;
  },

  /**
   * Delete a group.
   * Real backend: DELETE /groups/:id
   */
  async deleteGroup(groupId: string): Promise<void> {
    await mockDelay(400);
    const exists = groups.some((g) => g.id === groupId);
    if (!exists) return Promise.reject({ message: 'Group not found', statusCode: 404 });
    groups = groups.filter((g) => g.id !== groupId);
  },

  /**
   * Update group total expenses (called after expense mutations).
   */
  async updateGroupTotal(groupId: string, total: number): Promise<void> {
    const idx = groups.findIndex((g) => g.id === groupId);
    if (idx !== -1) {
      groups[idx] = { ...groups[idx], totalExpenses: total, updatedAt: nowISO() };
    }
  },
};

export default GroupService;
