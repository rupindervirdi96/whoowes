/**
 * People brought over from Splitwise who aren't on WhoOwes yet ("placeholders").
 *
 * A placeholder is a user with no phone, so nobody can sign in as them. They
 * can be in groups and expenses like anyone else. When the real person joins,
 * someone who knows the placeholder asks them to take it over; once they accept,
 * everything the placeholder was part of becomes theirs (`takeOver`).
 */

import { randomUUID } from 'node:crypto';
import { db, type ExpenseDoc, type ExpenseSplit, type UserDoc } from '../db/index.js';
import { pairKey } from './common.js';

/** A new placeholder, friends with whoever brought them over. */
export async function createPlaceholder(ownerId: string, name: string): Promise<UserDoc> {
  const id = randomUUID();
  const now = new Date();
  const doc: UserDoc = {
    _id: id,
    phone: `placeholder:${id}`,
    phoneHash: '',
    name,
    email: null,
    emailLower: null,
    avatarUrl: null,
    placeholder: { ownerId, source: 'splitwise' },
    claim: null,
    mergedInto: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.users.insertOne(doc);
  await db.friendships.insertOne({
    _id: randomUUID(),
    requesterId: ownerId,
    addresseeId: id,
    pair: pairKey(ownerId, id),
    status: 'accepted',
    createdAt: now,
    respondedAt: now,
  });
  return doc;
}

/** Can I see this placeholder: I brought them over, or we share a group. */
export async function knowsPlaceholder(p: UserDoc, me: string) {
  if (p.placeholder?.ownerId === me) return true;
  return !!(await db.groups.findOne({ 'members.userId': { $all: [me, p._id] } }, { projection: { _id: 1 } }));
}

/** An expense with the placeholder swapped for the real person; their two shares join if both were on it. */
function swapInExpense(e: ExpenseDoc, from: string, to: string): ExpenseDoc {
  const swap = (id: string) => (id === from ? to : id);
  const paidBy = swap(e.paidBy);
  const splits: ExpenseSplit[] = [];
  for (const s of e.splits) {
    const userId = swap(s.userId);
    const same = splits.find((x) => x.userId === userId);
    if (same) {
      same.amountCents += s.amountCents;
      same.paid = userId === paidBy || (same.paid && s.paid);
    } else {
      splits.push({ ...s, userId, paid: userId === paidBy || s.paid });
    }
  }
  return {
    ...e,
    paidBy,
    createdBy: swap(e.createdBy),
    splits,
    participants: [...new Set(e.participants.map(swap))],
    items: e.items?.map((it) => ({ ...it, assignedTo: [...new Set(it.assignedTo.map(swap))] })) ?? null,
    updatedAt: new Date(),
  };
}

/**
 * Moves everything the placeholder was part of to a real account: expenses,
 * payments, groups and friendships. Safe to run again if it stops halfway.
 */
export async function takeOver(placeholderId: string, realId: string) {
  // Expenses, in batches.
  const cursor = db.expenses.find({ participants: placeholderId });
  let batch: ExpenseDoc[] = [];
  const flush = async () => {
    if (!batch.length) return;
    await db.expenses.bulkWrite(batch.map((e) => ({ replaceOne: { filter: { _id: e._id }, replacement: swapInExpense(e, placeholderId, realId) } })));
    batch = [];
  };
  for await (const e of cursor) {
    batch.push(e);
    if (batch.length >= 200) await flush();
  }
  await flush();
  await db.expenses.updateMany({ createdBy: placeholderId }, { $set: { createdBy: realId } });

  // Payments; one between the two of them would now be to themselves, so it goes.
  await db.settlements.deleteMany({
    $or: [
      { fromUserId: placeholderId, toUserId: realId },
      { fromUserId: realId, toUserId: placeholderId },
    ],
  });
  await db.settlements.updateMany({ fromUserId: placeholderId }, { $set: { fromUserId: realId } });
  await db.settlements.updateMany({ toUserId: placeholderId }, { $set: { toUserId: realId } });

  // Groups: they take the placeholder's place, unless they're already in it.
  await db.groups.updateMany({ 'members.userId': { $all: [placeholderId, realId] } }, { $pull: { members: { userId: placeholderId } } });
  await db.groups.updateMany({ 'members.userId': placeholderId }, { $set: { 'members.$[m].userId': realId, updatedAt: new Date() } }, { arrayFilters: [{ 'm.userId': placeholderId }] });

  // Whoever was friends with the placeholder is now friends with them.
  const friendships = await db.friendships.find({ $or: [{ requesterId: placeholderId }, { addresseeId: placeholderId }] }).toArray();
  for (const f of friendships) {
    const other = f.requesterId === placeholderId ? f.addresseeId : f.requesterId;
    await db.friendships.deleteOne({ _id: f._id });
    if (other === realId) continue;
    const pair = pairKey(other, realId);
    const now = new Date();
    await db.friendships.updateOne(
      { pair },
      {
        $set: { status: 'accepted', respondedAt: now },
        $setOnInsert: { _id: randomUUID(), requesterId: other, addresseeId: realId, createdAt: now },
      },
      { upsert: true },
    );
  }

  // Kept (with its name) so old edit notes that mention it still read right.
  await db.users.updateOne({ _id: placeholderId }, { $set: { mergedInto: realId, claim: null, updatedAt: new Date() } });
}
