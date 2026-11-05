/**
 * Mock Splitwise import (demo only, gone on restart): the same rules as the
 * server, kept short. New people become placeholders; nothing is de-duplicated.
 */

import type { Expense, HistoryClaim, Settlement, SplitwiseImportPayload, SplitwiseImportResult, User } from '../../types';
import { generateId } from '../../utils/idGenerator';
import { nowISO } from '../../utils/date';
import { mockDelay } from './mockHelpers';
import { db, findUser } from './db';

const cents = (n: number) => Math.round(n * 100);

const ImportService = {
  async importSplitwise(me: string, payload: SplitwiseImportPayload): Promise<SplitwiseImportResult> {
    await mockDelay(900);
    const now = nowISO();
    const created: Array<{ name: string; userId: string }> = [];
    const ids = payload.people.map((p) => {
      if (p.as === 'me') return me;
      if (p.as !== 'new') return p.as.userId;
      const u: User = { id: generateId(), name: p.name, email: '', placeholder: true, createdAt: now, updatedAt: now };
      db.users.push(u);
      db.friends.push({ id: generateId(), userId: me, friendId: u.id, friendUser: u, status: 'accepted', createdAt: now, friendsSince: now });
      created.push({ name: p.name, userId: u.id });
      return u.id;
    });

    let groupId: string | null = null;
    if (payload.target.kind === 'newGroup') {
      groupId = generateId();
      db.groups.push({
        id: groupId,
        name: payload.target.name,
        members: [...new Set(ids)].map((userId) => ({ userId, user: findUser(userId), role: userId === me ? 'admin' : 'member', joinedAt: now })),
        currency: payload.rows[0]?.currency,
        createdBy: me,
        createdAt: now,
        updatedAt: now,
        totalExpenses: 0,
      });
    } else if (payload.target.kind === 'group') {
      groupId = payload.target.groupId;
      const g = db.groups.find((x) => x.id === groupId);
      for (const id of ids) if (g && !g.members.some((m) => m.userId === id)) g.members.push({ userId: id, user: findUser(id), role: 'member', joinedAt: now });
    }

    let expenses = 0;
    let payments = 0;
    let skipped = 0;
    for (const row of payload.rows) {
      const nets = row.nets.map(cents);
      const payers = nets.map((n, i) => ({ i, n })).filter((x) => x.n > 0);
      const owers = nets.map((n, i) => ({ i, n })).filter((x) => x.n < 0);
      if (!payers.length || !owers.length) {
        skipped++;
        continue;
      }
      const date = `${row.date}T12:00:00.000Z`;
      if (/^payment$/i.test(row.category) && payers.length === 1 && owers.length === 1) {
        const s: Settlement = {
          id: generateId(),
          fromUserId: ids[payers[0].i],
          toUserId: ids[owers[0].i],
          fromUser: findUser(ids[payers[0].i]),
          toUser: findUser(ids[owers[0].i]),
          amount: payers[0].n / 100,
          currency: row.currency,
          status: 'confirmed',
          groupId: groupId ?? undefined,
          initiatedAt: date,
          confirmedAt: date,
          createdAt: date,
          updatedAt: now,
        };
        db.settlements.push(s);
        payments++;
        continue;
      }
      // One expense per payer, each owing their share to the biggest payer first.
      const credit = payers.sort((a, b) => b.n - a.n).map((p) => ({ ...p }));
      const debt = owers.map((o) => ({ i: o.i, n: -o.n }));
      for (const p of credit) {
        const shares: Array<{ i: number; n: number }> = [];
        for (const d of debt) {
          const take = Math.min(p.n, d.n);
          if (take <= 0) continue;
          shares.push({ i: d.i, n: take });
          p.n -= take;
          d.n -= take;
        }
        if (!shares.length) continue;
        const own = credit.length === 1 ? Math.max(0, cents(row.cost) - shares.reduce((s, x) => s + x.n, 0)) : 0;
        if (own > 0) shares.push({ i: p.i, n: own });
        const total = shares.reduce((s, x) => s + x.n, 0);
        const e: Expense = {
          id: generateId(),
          groupId,
          title: row.description || 'Splitwise expense',
          amount: total / 100,
          currency: row.currency,
          category: 'other',
          paidBy: ids[p.i],
          paidByUser: findUser(ids[p.i]),
          splitType: 'custom',
          splits: shares.map((x) => ({ userId: ids[x.i], user: findUser(ids[x.i]), amount: x.n / 100, paid: x.i === p.i })),
          date,
          createdBy: me,
          createdAt: now,
          updatedAt: now,
        };
        db.expenses.push(e);
        expenses++;
      }
    }
    return { groupId, expenses, payments, skipped, alreadyHere: 0, newPeople: created.length, created };
  },

  async getClaims(): Promise<HistoryClaim[]> {
    await mockDelay(200);
    return [];
  },

  async requestClaim(_placeholderId: string, _userId: string): Promise<void> {
    await mockDelay(400);
  },

  async acceptClaim(_placeholderId: string): Promise<void> {
    await mockDelay(400);
  },

  async declineClaim(_placeholderId: string): Promise<void> {
    await mockDelay(200);
  },
};

export default ImportService;
