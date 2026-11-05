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
  /**
   * Someone brought over from Splitwise who isn't on WhoOwes yet. They can't sign
   * in; their history moves to a real account once that person accepts (see claim).
   */
  placeholder?: { ownerId: string; source: 'splitwise' } | null;
  /** A pending request for a WhoOwes user to take over this placeholder's history. */
  claim?: { userId: string; by: string; at: Date } | null;
  /** The account that took over this placeholder's history. */
  mergedInto?: string | null;
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
  /** Private to each person, keyed by their user id: what I call them, and whether I pinned them. */
  prefs?: Record<string, FriendPrefs>;
}

export interface FriendPrefs {
  nickname?: string | null;
  pinned?: boolean;
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
  /** Set on expenses brought over from Splitwise, so importing the same file twice adds nothing. */
  importKey?: string;
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
  /** Set on payments brought over from Splitwise. */
  importKey?: string;
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

/** The AI features, each with its own free monthly allowance. */
export type AIFeature = 'receipt_scan' | 'quick_add' | 'split_assistant' | 'insights';

/** One user's AI use in one month (server time, UTC), so changing the phone's clock changes nothing. */
export interface AiUsageDoc {
  /** `${userId}:${YYYY-MM}` */
  _id: string;
  userId: string;
  month: string;
  /** Free uses taken, per feature. */
  free?: Partial<Record<AIFeature, number>>;
  /** Uses unlocked by watching an ad and not spent yet, per feature. */
  unlocked?: Partial<Record<AIFeature, number>>;
  /** Uses paid for with an ad, per feature (for the record). */
  adUsed?: Partial<Record<AIFeature, number>>;
}

/**
 * One rewarded ad. Started by the app, timed by the server: it only counts once
 * enough server time has passed (and, when required, Google has confirmed it).
 */
export interface AdSessionDoc {
  _id: string;
  userId: string;
  feature: AIFeature;
  startedAt: Date;
  /** When AdMob's server-side verification callback confirmed the reward. */
  verifiedAt: Date | null;
  /** AdMob's transaction id, so one reward can't be counted twice. */
  transactionId: string | null;
  claimedAt: Date | null;
}

/** A written AI insight, kept so looking at the same month again doesn't use up a pass. */
export interface InsightsCacheDoc {
  /** `${userId}:${month}:${currency}:${lang}` */
  _id: string;
  userId: string;
  /** Hash of the numbers it was written from: new expenses mean a new write-up. */
  statsHash: string;
  result: { headline: string; highlights: string[]; tips: string[] };
  createdAt: Date;
}

/** One thing an edit changed. Amounts in cents; people and groups by id. */
export type ExpenseChange =
  | { field: 'title'; from: string; to: string }
  | { field: 'amount'; from: number; to: number; currency: string }
  | { field: 'currency'; from: string; to: string }
  | { field: 'category'; from: string; to: string }
  | { field: 'date'; from: string; to: string }
  | { field: 'paidBy'; from: string; to: string }
  | { field: 'split' }
  | { field: 'note' }
  | { field: 'group'; from: string | null; to: string | null };

/**
 * A comment under an expense, or (with `edit`) a note that someone edited it,
 * so the conversation shows why balances moved. Edit notes can't be deleted.
 */
export interface ExpenseCommentDoc {
  _id: string;
  expenseId: string;
  userId: string;
  text: string;
  createdAt: Date;
  edit?: ExpenseChange[];
}

/** One person's reaction to an expense (one each; picking another replaces it). */
export interface ExpenseReactionDoc {
  /** `${expenseId}:${userId}` */
  _id: string;
  expenseId: string;
  userId: string;
  /** null once taken back; the record stays so taking it back and re-adding can't spam everyone. */
  emoji: string | null;
  updatedAt: Date;
  /** When the others were last told about this person's reaction. */
  notifiedAt: Date | null;
}

/** A phone that receives a user's push notifications. One user can have several. */
export interface PushTokenDoc {
  /** The Expo push token, e.g. ExponentPushToken[xxxx]. */
  _id: string;
  userId: string;
  platform: 'ios' | 'android';
  /** The app's language on that phone, so notifications arrive in it. */
  lang: 'en' | 'fr' | 'es' | 'hi';
  createdAt: Date;
  updatedAt: Date;
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
  aiUsage: Collection<AiUsageDoc>;
  adSessions: Collection<AdSessionDoc>;
  insightsCache: Collection<InsightsCacheDoc>;
  pushTokens: Collection<PushTokenDoc>;
  expenseComments: Collection<ExpenseCommentDoc>;
  expenseReactions: Collection<ExpenseReactionDoc>;
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
    c.users.createIndexes([
      { key: { phone: 1 }, unique: true },
      { key: { phoneHash: 1 } },
      { key: { emailLower: 1 } },
      { key: { 'claim.userId': 1 }, sparse: true },
    ]),
    c.friendships.createIndexes([{ key: { pair: 1 }, unique: true }, { key: { requesterId: 1 } }, { key: { addresseeId: 1 } }]),
    c.groups.createIndexes([{ key: { 'members.userId': 1 } }]),
    c.expenses.createIndexes([{ key: { participants: 1, date: -1 } }, { key: { groupId: 1, date: -1 } }, { key: { importKey: 1 }, sparse: true }]),
    c.settlements.createIndexes([{ key: { fromUserId: 1 } }, { key: { toUserId: 1, status: 1 } }, { key: { groupId: 1 } }, { key: { importKey: 1 }, sparse: true }]),
    c.reminders.createIndexes([{ key: { toUserId: 1, createdAt: -1 } }, { key: { fromUserId: 1, toUserId: 1, createdAt: -1 } }]),
    c.receipts.createIndexes([{ key: { userId: 1 } }]),
    c.pushTokens.createIndexes([{ key: { userId: 1 } }]),
    c.expenseComments.createIndexes([{ key: { expenseId: 1, createdAt: 1 } }, { key: { userId: 1 } }]),
    c.expenseReactions.createIndexes([{ key: { expenseId: 1 } }, { key: { userId: 1 } }]),
    // Ad sessions are only needed for a while; old ones clear themselves.
    c.adSessions.createIndexes([
      { key: { userId: 1, startedAt: -1 } },
      { key: { transactionId: 1 }, unique: true, partialFilterExpression: { transactionId: { $type: 'string' } } },
      { key: { startedAt: 1 }, expireAfterSeconds: 45 * 24 * 60 * 60 },
    ]),
    c.insightsCache.createIndexes([{ key: { userId: 1 } }, { key: { createdAt: 1 }, expireAfterSeconds: 120 * 24 * 60 * 60 }]),
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
    aiUsage: d.collection<AiUsageDoc>('ai_usage'),
    adSessions: d.collection<AdSessionDoc>('ad_sessions'),
    insightsCache: d.collection<InsightsCacheDoc>('insights_cache'),
    pushTokens: d.collection<PushTokenDoc>('push_tokens'),
    expenseComments: d.collection<ExpenseCommentDoc>('expense_comments'),
    expenseReactions: d.collection<ExpenseReactionDoc>('expense_reactions'),
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
