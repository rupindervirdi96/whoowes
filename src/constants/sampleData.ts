/**
 * Sample/seed data used by the mock service layer.
 * Replace these with real API calls when connecting to a backend.
 */

import { User, Friend, Group, Expense, Settlement, Receipt } from '../types';

// ─── Users ────────────────────────────────────────────────────────────────────

export const MOCK_CURRENT_USER: User = {
  id: 'user-001',
  name: 'Alex Johnson',
  email: 'alex@example.com',
  phone: '+1-555-0100',
  avatarUrl: undefined,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

export const MOCK_USERS: User[] = [
  MOCK_CURRENT_USER,
  {
    id: 'user-002',
    name: 'Sarah Miller',
    email: 'sarah@example.com',
    phone: '+1-555-0101',
    createdAt: '2025-01-02T00:00:00Z',
    updatedAt: '2025-01-02T00:00:00Z',
  },
  {
    id: 'user-003',
    name: 'David Kim',
    email: 'david@example.com',
    phone: '+1-555-0102',
    createdAt: '2025-01-03T00:00:00Z',
    updatedAt: '2025-01-03T00:00:00Z',
  },
  {
    id: 'user-004',
    name: 'Priya Patel',
    email: 'priya@example.com',
    phone: '+1-555-0103',
    createdAt: '2025-01-04T00:00:00Z',
    updatedAt: '2025-01-04T00:00:00Z',
  },
  {
    id: 'user-005',
    name: 'Carlos Rivera',
    email: 'carlos@example.com',
    phone: '+1-555-0104',
    createdAt: '2025-01-05T00:00:00Z',
    updatedAt: '2025-01-05T00:00:00Z',
  },
];

// ─── Friends ─────────────────────────────────────────────────────────────────

export const MOCK_FRIENDS: Friend[] = [
  {
    id: 'friend-001',
    userId: 'user-001',
    friendId: 'user-002',
    friendUser: MOCK_USERS[1],
    status: 'accepted',
    createdAt: '2025-01-10T00:00:00Z',
  },
  {
    id: 'friend-002',
    userId: 'user-001',
    friendId: 'user-003',
    friendUser: MOCK_USERS[2],
    status: 'accepted',
    createdAt: '2025-01-11T00:00:00Z',
  },
  {
    id: 'friend-003',
    userId: 'user-001',
    friendId: 'user-004',
    friendUser: MOCK_USERS[3],
    status: 'accepted',
    createdAt: '2025-01-12T00:00:00Z',
  },
  {
    id: 'friend-004',
    userId: 'user-001',
    friendId: 'user-005',
    friendUser: MOCK_USERS[4],
    status: 'pending',
    createdAt: '2025-02-01T00:00:00Z',
  },
];

// ─── Groups ───────────────────────────────────────────────────────────────────

export const MOCK_GROUPS: Group[] = [
  {
    id: 'group-001',
    name: 'Apartment 4B',
    description: 'Monthly shared expenses for apartment',
    members: [
      { userId: 'user-001', user: MOCK_USERS[0], role: 'admin', joinedAt: '2025-01-01T00:00:00Z' },
      { userId: 'user-002', user: MOCK_USERS[1], role: 'member', joinedAt: '2025-01-01T00:00:00Z' },
      { userId: 'user-003', user: MOCK_USERS[2], role: 'member', joinedAt: '2025-01-01T00:00:00Z' },
    ],
    createdBy: 'user-001',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-02-15T00:00:00Z',
    totalExpenses: 1240.50,
  },
  {
    id: 'group-002',
    name: 'Vegas Trip 🎲',
    description: 'Vegas weekend trip - March 2025',
    members: [
      { userId: 'user-001', user: MOCK_USERS[0], role: 'admin', joinedAt: '2025-02-10T00:00:00Z' },
      { userId: 'user-002', user: MOCK_USERS[1], role: 'member', joinedAt: '2025-02-10T00:00:00Z' },
      { userId: 'user-004', user: MOCK_USERS[3], role: 'member', joinedAt: '2025-02-10T00:00:00Z' },
      { userId: 'user-005', user: MOCK_USERS[4], role: 'member', joinedAt: '2025-02-10T00:00:00Z' },
    ],
    createdBy: 'user-001',
    createdAt: '2025-02-10T00:00:00Z',
    updatedAt: '2025-02-20T00:00:00Z',
    totalExpenses: 3540.00,
  },
];

// ─── Expenses ─────────────────────────────────────────────────────────────────

export const MOCK_EXPENSES: Expense[] = [
  {
    id: 'exp-001',
    groupId: 'group-001',
    title: 'Monthly Rent',
    description: 'February rent split 3 ways',
    amount: 2400.00,
    currency: 'USD',
    category: 'accommodation',
    paidBy: 'user-001',
    paidByUser: MOCK_USERS[0],
    splitType: 'equal',
    splits: [
      { userId: 'user-001', user: MOCK_USERS[0], amount: 800.00, paid: true },
      { userId: 'user-002', user: MOCK_USERS[1], amount: 800.00, paid: false },
      { userId: 'user-003', user: MOCK_USERS[2], amount: 800.00, paid: false },
    ],
    date: '2025-02-01T00:00:00Z',
    createdBy: 'user-001',
    createdAt: '2025-02-01T08:00:00Z',
    updatedAt: '2025-02-01T08:00:00Z',
  },
  {
    id: 'exp-002',
    groupId: 'group-001',
    title: 'Grocery Run',
    amount: 145.60,
    currency: 'USD',
    category: 'food',
    paidBy: 'user-002',
    paidByUser: MOCK_USERS[1],
    splitType: 'equal',
    splits: [
      { userId: 'user-001', user: MOCK_USERS[0], amount: 48.53, paid: false },
      { userId: 'user-002', user: MOCK_USERS[1], amount: 48.53, paid: true },
      { userId: 'user-003', user: MOCK_USERS[2], amount: 48.54, paid: false },
    ],
    date: '2025-02-10T00:00:00Z',
    createdBy: 'user-002',
    createdAt: '2025-02-10T14:00:00Z',
    updatedAt: '2025-02-10T14:00:00Z',
  },
  {
    id: 'exp-003',
    groupId: 'group-002',
    title: 'Hotel Booking',
    amount: 1200.00,
    currency: 'USD',
    category: 'accommodation',
    paidBy: 'user-001',
    paidByUser: MOCK_USERS[0],
    splitType: 'equal',
    splits: [
      { userId: 'user-001', user: MOCK_USERS[0], amount: 300.00, paid: true },
      { userId: 'user-002', user: MOCK_USERS[1], amount: 300.00, paid: false },
      { userId: 'user-004', user: MOCK_USERS[3], amount: 300.00, paid: false },
      { userId: 'user-005', user: MOCK_USERS[4], amount: 300.00, paid: false },
    ],
    date: '2025-02-15T00:00:00Z',
    createdBy: 'user-001',
    createdAt: '2025-02-15T10:00:00Z',
    updatedAt: '2025-02-15T10:00:00Z',
  },
  {
    id: 'exp-004',
    groupId: null,
    title: 'Dinner at Nobu',
    amount: 210.00,
    currency: 'USD',
    category: 'food',
    paidBy: 'user-001',
    paidByUser: MOCK_USERS[0],
    splitType: 'custom',
    splits: [
      { userId: 'user-001', user: MOCK_USERS[0], amount: 85.00, paid: true },
      { userId: 'user-002', user: MOCK_USERS[1], amount: 125.00, paid: false },
    ],
    date: '2025-02-18T00:00:00Z',
    createdBy: 'user-001',
    createdAt: '2025-02-18T21:00:00Z',
    updatedAt: '2025-02-18T21:00:00Z',
  },
];

// ─── Settlements ─────────────────────────────────────────────────────────────

export const MOCK_SETTLEMENTS: Settlement[] = [
  {
    id: 'stl-001',
    fromUserId: 'user-002',
    toUserId: 'user-001',
    fromUser: MOCK_USERS[1],
    toUser: MOCK_USERS[0],
    amount: 800.00,
    currency: 'USD',
    note: 'Rent for February',
    status: 'pending',
    groupId: 'group-001',
    initiatedAt: '2025-02-20T00:00:00Z',
    createdAt: '2025-02-20T00:00:00Z',
    updatedAt: '2025-02-20T00:00:00Z',
  },
  {
    id: 'stl-002',
    fromUserId: 'user-003',
    toUserId: 'user-001',
    fromUser: MOCK_USERS[2],
    toUser: MOCK_USERS[0],
    amount: 848.54,
    currency: 'USD',
    note: 'Rent + groceries',
    status: 'confirmed',
    groupId: 'group-001',
    initiatedAt: '2025-02-19T00:00:00Z',
    confirmedAt: '2025-02-19T12:00:00Z',
    createdAt: '2025-02-19T00:00:00Z',
    updatedAt: '2025-02-19T12:00:00Z',
  },
];

// ─── Receipts ─────────────────────────────────────────────────────────────────

export const MOCK_PARSED_RECEIPT = {
  merchant: 'Olive Garden',
  date: '2025-02-18',
  items: [
    { id: 'item-001', name: 'Pasta Carbonara', price: 18.99, quantity: 2, assignedTo: [] },
    { id: 'item-002', name: 'Chicken Alfredo', price: 21.50, quantity: 1, assignedTo: [] },
    { id: 'item-003', name: 'House Wine x2', price: 24.00, quantity: 1, assignedTo: [] },
    { id: 'item-004', name: 'Tiramisu', price: 9.99, quantity: 2, assignedTo: [] },
    { id: 'item-005', name: 'Garlic Bread', price: 5.99, quantity: 1, assignedTo: [] },
  ],
  subtotal: 100.45,
  tax: 12.06,
  total: 112.51,
  currency: 'USD',
};
