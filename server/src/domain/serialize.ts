/**
 * Turns database rows into the JSON shapes the app uses (see src/types in the app).
 * Amounts leave the server as decimals (cents / 100).
 */

import { db, type Queryable } from '../db/index.js';
import { deletedUser, iso, toAmount, usersById } from './common.js';

// ─── Groups ──────────────────────────────────────────────────────────────────

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export async function loadGroups(ids: string[], viewer: string, q: Queryable = db) {
  if (ids.length === 0) return [];
  const [{ rows: groups }, { rows: members }, { rows: totals }] = await Promise.all([
    q.query<GroupRow>('select * from groups where id = any($1::text[])', [ids]),
    q.query<{ group_id: string; user_id: string; role: 'admin' | 'member'; joined_at: Date }>(
      'select * from group_members where group_id = any($1::text[]) order by joined_at',
      [ids],
    ),
    q.query<{ group_id: string; total: string | number; last: Date | null }>(
      'select group_id, coalesce(sum(amount_cents), 0) as total, max(date) as last from expenses where group_id = any($1::text[]) group by group_id',
      [ids],
    ),
  ]);
  const users = await usersById(members.map((m) => m.user_id), viewer, q);
  return groups.map((g) => {
    const t = totals.find((x) => x.group_id === g.id);
    const last = t?.last && t.last > g.updated_at ? t.last : g.updated_at;
    return {
      id: g.id,
      name: g.name,
      description: g.description ?? undefined,
      createdBy: g.created_by,
      createdAt: iso(g.created_at)!,
      updatedAt: iso(last)!,
      totalExpenses: toAmount(Number(t?.total ?? 0)),
      members: members
        .filter((m) => m.group_id === g.id)
        .map((m) => ({ userId: m.user_id, user: users.get(m.user_id) ?? deletedUser(m.user_id), role: m.role, joinedAt: iso(m.joined_at)! })),
    };
  });
}

// ─── Expenses ────────────────────────────────────────────────────────────────

export interface ExpenseRow {
  id: string;
  group_id: string | null;
  title: string;
  description: string | null;
  amount_cents: number;
  currency: string;
  category: string;
  paid_by: string;
  split_type: string;
  items: Array<{ id: string; name: string; price: number; quantity: number; assignedTo: string[] }> | null;
  receipt_id: string | null;
  date: Date;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export async function serializeExpenses(rows: ExpenseRow[], viewer: string, q: Queryable = db) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const { rows: splits } = await q.query<{ expense_id: string; user_id: string; amount_cents: number; percentage: string | null; paid: boolean }>(
    'select * from expense_splits where expense_id = any($1::text[])',
    [ids],
  );
  const users = await usersById([...rows.map((r) => r.paid_by), ...splits.map((s) => s.user_id)], viewer, q);
  const user = (id: string) => users.get(id) ?? deletedUser(id);
  return rows.map((e) => ({
    id: e.id,
    groupId: e.group_id,
    title: e.title,
    description: e.description ?? undefined,
    amount: toAmount(e.amount_cents),
    currency: e.currency,
    category: e.category,
    paidBy: e.paid_by,
    paidByUser: user(e.paid_by),
    splitType: e.split_type,
    splits: splits
      .filter((s) => s.expense_id === e.id)
      .map((s) => ({
        userId: s.user_id,
        user: user(s.user_id),
        amount: toAmount(s.amount_cents),
        percentage: s.percentage == null ? undefined : Number(s.percentage),
        paid: s.paid,
      })),
    items: e.items ?? undefined,
    receiptId: e.receipt_id ?? undefined,
    date: iso(e.date)!,
    createdBy: e.created_by,
    createdAt: iso(e.created_at)!,
    updatedAt: iso(e.updated_at)!,
  }));
}

// ─── Settlements ─────────────────────────────────────────────────────────────

export interface SettlementRow {
  id: string;
  from_user_id: string;
  to_user_id: string;
  amount_cents: number;
  currency: string;
  note: string | null;
  status: 'pending' | 'confirmed' | 'rejected';
  group_id: string | null;
  expense_ids: string[] | null;
  initiated_at: Date;
  confirmed_at: Date | null;
  rejected_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export async function serializeSettlements(rows: SettlementRow[], viewer: string, q: Queryable = db) {
  const users = await usersById(rows.flatMap((s) => [s.from_user_id, s.to_user_id]), viewer, q);
  const user = (id: string) => users.get(id) ?? deletedUser(id);
  return rows.map((s) => ({
    id: s.id,
    fromUserId: s.from_user_id,
    toUserId: s.to_user_id,
    fromUser: user(s.from_user_id),
    toUser: user(s.to_user_id),
    amount: toAmount(s.amount_cents),
    currency: s.currency,
    note: s.note ?? undefined,
    status: s.status,
    groupId: s.group_id ?? undefined,
    expenseIds: s.expense_ids ?? undefined,
    initiatedAt: iso(s.initiated_at)!,
    confirmedAt: iso(s.confirmed_at),
    rejectedAt: iso(s.rejected_at),
    createdAt: iso(s.created_at)!,
    updatedAt: iso(s.updated_at)!,
  }));
}
