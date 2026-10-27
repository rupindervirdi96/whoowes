/**
 * Seed data for the mock service layer.
 * Dates are relative to "now" so the demo always has a fresh-looking activity feed.
 */

import { User, Friend, Group, Expense, Settlement, ExpenseCategory, ParsedReceipt } from '../types';

function daysAgo(days: number, hour = 12): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

// ─── Users ────────────────────────────────────────────────────────────────────

export const MOCK_CURRENT_USER: User = {
  id: 'user-001',
  name: 'Alex Johnson',
  email: 'alex@example.com',
  phone: '+14155550100',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

const u = (id: string, name: string, email: string, phone: string): User => ({
  id,
  name,
  email,
  phone,
  createdAt: '2025-01-02T00:00:00Z',
  updatedAt: '2025-01-02T00:00:00Z',
});

export const MOCK_USERS: User[] = [
  MOCK_CURRENT_USER,
  u('user-002', 'Sarah Miller', 'sarah@example.com', '+14155550101'),
  u('user-003', 'David Kim', 'david@example.com', '+14155550102'),
  u('user-004', 'Priya Patel', 'priya@example.com', '+14155550103'),
  u('user-005', 'Carlos Rivera', 'carlos@example.com', '+14155550104'),
  u('user-006', 'Mia Chen', 'mia@example.com', '+14155550105'),
  // On WhoOwes but not Alex's friends yet — found through contact matching.
  u('user-007', 'Jordan Lee', 'jordan@example.com', '+14155550106'),
  u('user-008', 'Emma Wilson', 'emma@example.com', '+14155550107'),
];

/**
 * Sample address book for platforms without one (the web preview).
 * Mixes friends, a pending request, members who aren't friends yet, and people to invite.
 */
export const DEMO_ADDRESS_BOOK: Array<{ id: string; name: string; phones: string[] }> = [
  { id: 'c1', name: 'Sarah Miller', phones: ['(415) 555-0101'] },
  { id: 'c2', name: 'Jordan Lee', phones: ['415-555-0106'] },
  { id: 'c3', name: 'Emma Wilson', phones: ['+1 415 555 0107'] },
  { id: 'c4', name: 'Mia Chen', phones: ['4155550105'] },
  { id: 'c5', name: 'Mom', phones: ['(415) 555-0142'] },
  { id: 'c6', name: 'Ben Carter', phones: ['415 555 0188'] },
  { id: 'c7', name: 'Olivia Brooks', phones: ['+1 (628) 555-0123'] },
  { id: 'c8', name: 'Noah Garcia', phones: ['650-555-0177'] },
];

const [ALEX, SARAH, DAVID, PRIYA, CARLOS, MIA] = MOCK_USERS;

// ─── Friends ─────────────────────────────────────────────────────────────────

export const MOCK_FRIENDS: Friend[] = [
  { id: 'friend-001', userId: ALEX.id, friendId: SARAH.id, friendUser: SARAH, status: 'accepted', createdAt: daysAgo(300) },
  { id: 'friend-002', userId: ALEX.id, friendId: DAVID.id, friendUser: DAVID, status: 'accepted', createdAt: daysAgo(280) },
  { id: 'friend-003', userId: ALEX.id, friendId: PRIYA.id, friendUser: PRIYA, status: 'accepted', createdAt: daysAgo(200) },
  { id: 'friend-004', userId: ALEX.id, friendId: CARLOS.id, friendUser: CARLOS, status: 'accepted', createdAt: daysAgo(120) },
  // Incoming request (Mia → Alex)
  { id: 'friend-005', userId: MIA.id, friendId: ALEX.id, friendUser: MIA, status: 'pending', createdAt: daysAgo(1) },
];

// ─── Groups ───────────────────────────────────────────────────────────────────

const member = (user: User, role: 'admin' | 'member' = 'member') => ({
  userId: user.id,
  user,
  role,
  joinedAt: daysAgo(200),
});

export const MOCK_GROUPS: Group[] = [
  {
    id: 'group-001',
    name: 'Apartment 4B',
    description: 'Rent, bills & groceries',
    members: [member(ALEX, 'admin'), member(SARAH), member(DAVID)],
    createdBy: ALEX.id,
    createdAt: daysAgo(200),
    updatedAt: daysAgo(2),
    totalExpenses: 0,
  },
  {
    id: 'group-002',
    name: 'Lisbon Trip 🇵🇹',
    description: 'Long weekend in Portugal',
    members: [member(ALEX, 'admin'), member(SARAH), member(PRIYA), member(CARLOS)],
    createdBy: ALEX.id,
    createdAt: daysAgo(40),
    updatedAt: daysAgo(5),
    totalExpenses: 0,
  },
];

// ─── Expenses ─────────────────────────────────────────────────────────────────

let expSeq = 0;
function equalExpense(
  title: string,
  amount: number,
  category: ExpenseCategory,
  payer: User,
  people: User[],
  groupId: string | null,
  date: string,
): Expense {
  expSeq += 1;
  const cents = Math.round(amount * 100);
  const base = Math.floor(cents / people.length);
  const remainder = cents - base * people.length;
  return {
    id: `exp-${String(expSeq).padStart(3, '0')}`,
    groupId,
    title,
    amount,
    currency: 'USD',
    category,
    paidBy: payer.id,
    paidByUser: payer,
    splitType: 'equal',
    splits: people.map((p, i) => ({
      userId: p.id,
      user: p,
      amount: (base + (i === people.length - 1 ? remainder : 0)) / 100,
      paid: p.id === payer.id,
    })),
    date,
    createdBy: payer.id,
    createdAt: date,
    updatedAt: date,
  };
}

const APT = [ALEX, SARAH, DAVID];
const TRIP = [ALEX, SARAH, PRIYA, CARLOS];

export const MOCK_EXPENSES: Expense[] = [
  equalExpense('October rent', 2400, 'accommodation', ALEX, APT, 'group-001', daysAgo(24, 9)),
  equalExpense('Electricity bill', 96.4, 'utilities', SARAH, APT, 'group-001', daysAgo(18, 18)),
  equalExpense('Trader Joe’s run', 145.6, 'food', DAVID, APT, 'group-001', daysAgo(9, 17)),
  equalExpense('Internet', 65, 'utilities', ALEX, APT, 'group-001', daysAgo(2, 10)),
  equalExpense('Airbnb Alfama', 860, 'accommodation', ALEX, TRIP, 'group-002', daysAgo(14, 11)),
  equalExpense('Pastéis & coffee', 28.8, 'food', PRIYA, TRIP, 'group-002', daysAgo(12, 9)),
  equalExpense('Tram 28 tickets', 25.6, 'transport', CARLOS, TRIP, 'group-002', daysAgo(12, 14)),
  equalExpense('Seafood dinner', 212.4, 'food', SARAH, TRIP, 'group-002', daysAgo(11, 21)),
  equalExpense('Sintra day trip', 96, 'entertainment', ALEX, TRIP, 'group-002', daysAgo(10, 10)),
  equalExpense('Concert tickets', 180, 'entertainment', ALEX, [ALEX, PRIYA], null, daysAgo(4, 20)),
  equalExpense('Uber home', 31.5, 'transport', DAVID, [ALEX, DAVID], null, daysAgo(3, 23)),
  equalExpense('Ramen night', 74, 'food', ALEX, [ALEX, SARAH], null, daysAgo(1, 20)),
  equalExpense('Weekend car rental', 620, 'transport', CARLOS, [ALEX, CARLOS], null, daysAgo(6, 10)),
  // Last month, for insights comparisons
  equalExpense('September rent', 2400, 'accommodation', ALEX, APT, 'group-001', daysAgo(54, 9)),
  equalExpense('Costco haul', 210.3, 'shopping', SARAH, APT, 'group-001', daysAgo(47, 15)),
];

// ─── Settlements ─────────────────────────────────────────────────────────────

export const MOCK_SETTLEMENTS: Settlement[] = [
  {
    id: 'stl-001',
    fromUserId: SARAH.id,
    toUserId: ALEX.id,
    fromUser: SARAH,
    toUser: ALEX,
    amount: 800,
    currency: 'USD',
    note: 'Rent 🏠',
    status: 'pending',
    groupId: 'group-001',
    initiatedAt: daysAgo(0, 8),
    createdAt: daysAgo(0, 8),
    updatedAt: daysAgo(0, 8),
  },
  {
    id: 'stl-002',
    fromUserId: DAVID.id,
    toUserId: ALEX.id,
    fromUser: DAVID,
    toUser: ALEX,
    amount: 800,
    currency: 'USD',
    note: 'October rent',
    status: 'confirmed',
    groupId: 'group-001',
    initiatedAt: daysAgo(20),
    confirmedAt: daysAgo(19),
    createdAt: daysAgo(20),
    updatedAt: daysAgo(19),
  },
  {
    id: 'stl-003',
    fromUserId: ALEX.id,
    toUserId: SARAH.id,
    fromUser: ALEX,
    toUser: SARAH,
    amount: 50,
    currency: 'USD',
    note: 'Seafood dinner',
    status: 'pending',
    groupId: 'group-002',
    initiatedAt: daysAgo(1, 9),
    createdAt: daysAgo(1, 9),
    updatedAt: daysAgo(1, 9),
  },
];

// ─── Receipts ─────────────────────────────────────────────────────────────────

export const MOCK_PARSED_RECEIPT: ParsedReceipt = {
  merchant: 'Taberna da Rua',
  date: new Date().toISOString().slice(0, 10),
  items: [
    { id: 'item-001', name: 'Bacalhau à Brás', price: 18.5, quantity: 1, assignedTo: [] },
    { id: 'item-002', name: 'Grilled octopus', price: 24, quantity: 1, assignedTo: [] },
    { id: 'item-003', name: 'Vinho verde (bottle)', price: 22, quantity: 1, assignedTo: [] },
    { id: 'item-004', name: 'Caldo verde', price: 6.5, quantity: 2, assignedTo: [] },
    { id: 'item-005', name: 'Pastel de nata', price: 2.2, quantity: 4, assignedTo: [] },
  ],
  subtotal: 86.3,
  tax: 7.77,
  total: 94.07,
  currency: 'USD',
};
