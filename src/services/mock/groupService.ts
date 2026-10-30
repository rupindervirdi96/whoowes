/**
 * Mock Groups Service.
 */

import { Group, GroupMember, CreateGroupPayload, UpdateGroupPayload } from '../../types';
import { generateId } from '../../utils/idGenerator';
import { nowISO } from '../../utils/date';
import { mockDelay } from './mockHelpers';
import { db, findUser, withTotals } from './db';

const notFound = () => Promise.reject({ message: 'Group not found', statusCode: 404 });

const GroupService = {
  async getGroups(userId: string): Promise<Group[]> {
    await mockDelay();
    return db.groups
      .filter((g) => g.members.some((m) => m.userId === userId))
      .map(withTotals)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async getGroup(groupId: string): Promise<Group> {
    await mockDelay();
    const group = db.groups.find((g) => g.id === groupId);
    return group ? withTotals(group) : notFound();
  },

  async createGroup(userId: string, payload: CreateGroupPayload): Promise<Group> {
    await mockDelay(600);
    const memberIds = Array.from(new Set([userId, ...payload.memberIds]));
    const members: GroupMember[] = memberIds.map((id) => ({
      userId: id,
      user: findUser(id),
      role: id === userId ? 'admin' : 'member',
      joinedAt: nowISO(),
    }));
    const group: Group = {
      id: generateId(),
      name: payload.name,
      description: payload.description,
      members,
      currency: payload.currency,
      createdBy: userId,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      totalExpenses: 0,
    };
    db.groups.push(group);
    return group;
  },

  async updateGroup(groupId: string, payload: UpdateGroupPayload): Promise<Group> {
    await mockDelay(300);
    const idx = db.groups.findIndex((g) => g.id === groupId);
    if (idx === -1) return notFound();
    db.groups[idx] = { ...db.groups[idx], ...payload, updatedAt: nowISO() };
    return withTotals(db.groups[idx]);
  },

  async addMember(groupId: string, newUserId: string): Promise<Group> {
    await mockDelay(400);
    const idx = db.groups.findIndex((g) => g.id === groupId);
    if (idx === -1) return notFound();
    if (db.groups[idx].members.some((m) => m.userId === newUserId)) {
      return Promise.reject({ message: 'Already in this group', statusCode: 409 });
    }
    db.groups[idx] = {
      ...db.groups[idx],
      members: [
        ...db.groups[idx].members,
        { userId: newUserId, user: findUser(newUserId), role: 'member', joinedAt: nowISO() },
      ],
      updatedAt: nowISO(),
    };
    return withTotals(db.groups[idx]);
  },

  async removeMember(groupId: string, memberUserId: string): Promise<Group> {
    await mockDelay(400);
    const idx = db.groups.findIndex((g) => g.id === groupId);
    if (idx === -1) return notFound();
    db.groups[idx] = {
      ...db.groups[idx],
      members: db.groups[idx].members.filter((m) => m.userId !== memberUserId),
      updatedAt: nowISO(),
    };
    return withTotals(db.groups[idx]);
  },

  async deleteGroup(groupId: string): Promise<void> {
    await mockDelay(400);
    if (!db.groups.some((g) => g.id === groupId)) return notFound();
    db.groups = db.groups.filter((g) => g.id !== groupId);
    // Expenses stay, just unlinked from the deleted group.
    db.expenses = db.expenses.map((e) => (e.groupId === groupId ? { ...e, groupId: null } : e));
  },
};

export default GroupService;
