/**
 * Database access (MongoDB).
 *
 * - Production (and any time MONGODB_URI is set): MongoDB Atlas or any MongoDB
 *   server, through the official driver.
 * - Local development without MONGODB_URI: a real MongoDB started in-process by
 *   mongodb-memory-server, with its files in server/data/mongo so data survives
 *   restarts. The first start downloads MongoDB once (a few hundred MB, cached
 *   in node_modules/.cache).
 *
 * Every record uses a string id (a UUID) as `_id`, and money is stored as
 * integer cents, so totals never pick up float rounding errors.
 *
 * Things that change together live in one document (an expense holds its
 * splits; a group holds its members), so single-document writes stay atomic
 * without multi-document transactions.
 */

import { mkdirSync } from 'node:fs';
import { MongoClient, type Collection, type Db } from 'mongodb';
import { env } from '../env.js';

// ─── Document shapes ─────────────────────────────────────────────────────────

export interface UserDoc {
  _id: string;
  phone: string;
  /** sha256(E.164), used for contact matching. Empty once the account is deleted. */
  phoneHash: string;
  name: string;
  email: string | null;
  /** Lower-cased email, for case-insensitive lookups. */
  emailLower: string | null;
  avatarUrl: string | null;
  /** Preferred currency (ISO 4217). Set from the phone's region on sign-up; changeable. */
  currency?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FriendshipDoc {
  _id: string;
  requesterId: string;
  addresseeId: string;
  /** Both ids sorted and joined; a unique index keeps one friendship per pair. */
  pair: string;
  status: 'pending' | 'accepted';
  createdAt: Date;
  respondedAt: Date | null;
}

export interface GroupMember {
  userId: string;
  role: 'admin' | 'member';
  joinedAt: Date;
}

export interface GroupDoc {
  _id: string;
  name: string;
  description: string | null;
  createdBy: string;
  members: GroupMember[];
  /** Default currency for new expenses in this group. */
  currency?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExpenseSplit {
  userId: string;
  amountCents: number;
  percentage: number | null;
  paid: boolean;
}

export interface ExpenseItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  assignedTo: string[];
}

export interface ExpenseDoc {
  _id: string;
  groupId: string | null;
  title: string;
  description: string | null;
  amountCents: number;
  currency: string;
  category: string;
  paidBy: string;
  splitType: string;
  splits: ExpenseSplit[];
  /** The payer plus everyone in the split, for "my expenses" lookups. */
  participants: string[];
  items: ExpenseItem[] | null;
  receiptId: string | null;
  date: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SettlementDoc {
  _id: string;
  fromUserId: string;
  toUserId: string;
  amountCents: number;
  currency: string;
  note: string | null;
  status: 'pending' | 'confirmed' | 'rejected';
  groupId: string | null;
  expenseIds: string[] | null;
  initiatedAt: Date;
  confirmedAt: Date | null;
  rejectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReminderDoc {
  _id: string;
  fromUserId: string;
  toUserId: string;
  amountCents: number | null;
  currency?: string | null;
  createdAt: Date;
  dismissedAt: Date | null;
}

export interface ReceiptDoc {
  _id: string;
  userId: string;
  sourceType: string;
  fileName: string | null;
  mimeType: string | null;
  parsedData: unknown;
  aiPrompt: string | null;
  expenseId: string | null;
  createdAt: Date;
}

/** A Google Play / App Store subscription, as last reported by RevenueCat. */
export interface StoreSubscriptionDoc {
  /** RevenueCat's store name, e.g. PLAY_STORE or APP_STORE. */
  store: string;
  productId: string;
  plan: string;
  status: string;
  interval: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  syncedAt: Date;
}

export interface BillingAccountDoc {
  /** The user id. */
  _id: string;
  // Stripe (web) subscription.
  stripeCustomerId: string | null;
  subscriptionId: string | null;
  plan: string;
  status: string;
  interval: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  /** App store subscription (through RevenueCat), kept apart from the Stripe fields. */
  store?: StoreSubscriptionDoc | null;
  updatedAt: Date;
}

export interface AiUsageDoc {
  /** `${userId}:${YYYY-MM}` */
  _id: string;
  userId: string;
  month: string;
  scans: number;
}

export interface ProcessedEventDoc {
  /** The Stripe event id. */
  _id: string;
  processedAt: Date;
}

// ─── Connection ──────────────────────────────────────────────────────────────

interface Collections {
  users: Collection<UserDoc>;
  friendships: Collection<FriendshipDoc>;
  groups: Collection<GroupDoc>;
  expenses: Collection<ExpenseDoc>;
  settlements: Collection<SettlementDoc>;
  reminders: Collection<ReminderDoc>;
  receipts: Collection<ReceiptDoc>;
  billingAccounts: Collection<BillingAccountDoc>;
  aiUsage: Collection<AiUsageDoc>;
  processedEvents: Collection<ProcessedEventDoc>;
}

let client: MongoClient | null = null;
let database: Db | null = null;
let collections: Collections | null = null;
let stopLocal: (() => Promise<unknown>) | null = null;
let label = '';

/** Starts a local MongoDB for development (never used in production). */
async function startLocalMongo(dir: string): Promise<string> {
  const { MongoMemoryServer } = await import('mongodb-memory-server-core');
  mkdirSync(dir, { recursive: true });
  const server = await MongoMemoryServer.create({ instance: { dbPath: dir, storageEngine: 'wiredTiger' } });
  stopLocal = () => server.stop({ doCleanup: false });
  return server.getUri();
}

async function createIndexes(c: Collections) {
  await Promise.all([
    c.users.createIndexes([{ key: { phone: 1 }, unique: true }, { key: { phoneHash: 1 } }, { key: { emailLower: 1 } }]),
    c.friendships.createIndexes([{ key: { pair: 1 }, unique: true }, { key: { requesterId: 1 } }, { key: { addresseeId: 1 } }]),
    c.groups.createIndexes([{ key: { 'members.userId': 1 } }]),
    c.expenses.createIndexes([{ key: { participants: 1, date: -1 } }, { key: { groupId: 1, date: -1 } }]),
    c.settlements.createIndexes([{ key: { fromUserId: 1 } }, { key: { toUserId: 1, status: 1 } }, { key: { groupId: 1 } }]),
    c.reminders.createIndexes([{ key: { toUserId: 1, createdAt: -1 } }, { key: { fromUserId: 1, toUserId: 1, createdAt: -1 } }]),
    c.receipts.createIndexes([{ key: { userId: 1 } }]),
    c.billingAccounts.createIndexes([
      { key: { stripeCustomerId: 1 }, unique: true, partialFilterExpression: { stripeCustomerId: { $type: 'string' } } },
    ]),
  ]);
}

/** Connects and makes sure the indexes exist. Call once at startup. */
export async function initDb(): Promise<void> {
  if (collections) return;
  const uri = env.MONGODB_URI ?? (await startLocalMongo(env.MONGO_LOCAL_DIR));
  label = env.MONGODB_URI ? `MongoDB database "${env.MONGODB_DB}"` : `local MongoDB at ${env.MONGO_LOCAL_DIR}`;
  // Fail requests (and /health) after 10 s instead of the driver's default 30 s
  // when the cluster can't be reached, e.g. this server's IP isn't allowed in Atlas.
  client = new MongoClient(uri, { appName: 'whoowes-api', maxPoolSize: 10, serverSelectionTimeoutMS: 10_000 });
  await client.connect();
  database = client.db(env.MONGODB_DB);
  const d = database;
  collections = {
    users: d.collection<UserDoc>('users'),
    friendships: d.collection<FriendshipDoc>('friendships'),
    groups: d.collection<GroupDoc>('groups'),
    expenses: d.collection<ExpenseDoc>('expenses'),
    settlements: d.collection<SettlementDoc>('settlements'),
    reminders: d.collection<ReminderDoc>('reminders'),
    receipts: d.collection<ReceiptDoc>('receipts'),
    billingAccounts: d.collection<BillingAccountDoc>('billing_accounts'),
    aiUsage: d.collection<AiUsageDoc>('ai_usage'),
    processedEvents: d.collection<ProcessedEventDoc>('processed_events'),
  };
  await createIndexes(collections);
  console.log(`[db] ready (${label})`);
}

function current(): Collections {
  if (!collections) throw new Error('Database not initialised: call initDb() first');
  return collections;
}

/** The collections, e.g. `db.users.findOne(...)`. */
export const db = new Proxy({} as Collections, {
  get: (_target, name: keyof Collections) => current()[name],
});

export async function pingDb(): Promise<boolean> {
  try {
    await database?.command({ ping: 1 });
    return !!database;
  } catch {
    return false;
  }
}

export async function closeDb(): Promise<void> {
  await client?.close();
  await stopLocal?.();
  client = null;
  database = null;
  collections = null;
}

/** True when a write failed because a unique index already has that value. */
export const isDuplicateKey = (err: unknown) => (err as { code?: number })?.code === 11000;
