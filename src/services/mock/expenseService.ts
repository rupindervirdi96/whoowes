/**
 * Mock Expenses Service.
 */

import { Expense, CreateExpensePayload, ExpenseSplit, ExpenseActivity, ExpenseReactionEmoji } from '../../types';
import { generateId } from '../../utils/idGenerator';
import { nowISO } from '../../utils/date';
import { mockDelay } from './mockHelpers';
import { db, findUser } from './db';

const notFound = () => Promise.reject({ message: 'Expense not found', statusCode: 404 });

/** Reactions and comments per expense (demo only, gone on restart). */
const activityByExpense = new Map<string, ExpenseActivity>();
const activityOf = (expenseId: string): ExpenseActivity => {
  const a = activityByExpense.get(expenseId) ?? { reactions: [], comments: [] };
  activityByExpense.set(expenseId, a);
  return a;
};
const snapshot = (a: ExpenseActivity): ExpenseActivity => ({ reactions: [...a.reactions], comments: [...a.comments] });

const ExpenseService = {
  async getExpenses(userId: string, groupId?: string): Promise<Expense[]> {
    await mockDelay();
    return db.expenses
      .filter((e) => e.paidBy === userId || e.splits.some((s) => s.userId === userId))
      .filter((e) => (groupId ? e.groupId === groupId : true))
      .sort((a, b) => b.date.localeCompare(a.date));
  },

  async getExpense(expenseId: string): Promise<Expense> {
    await mockDelay(250);
    return db.expenses.find((e) => e.id === expenseId) ?? notFound();
  },

  async createExpense(createdBy: string, payload: CreateExpensePayload): Promise<Expense> {
    await mockDelay(600);
    const paidByUser = findUser(payload.paidBy);
    const splits: ExpenseSplit[] = payload.splits.map((s) => ({
      ...s,
      user: findUser(s.userId),
      paid: s.userId === payload.paidBy,
    }));
    const expense: Expense = {
      id: generateId(),
      groupId: payload.groupId ?? null,
      title: payload.title,
      description: payload.description,
      amount: payload.amount,
      currency: payload.currency ?? 'USD',
      category: payload.category,
      paidBy: payload.paidBy,
      paidByUser,
      splitType: payload.splitType,
      splits,
      items: payload.items?.map((item) => ({ ...item, id: generateId() })),
      receiptId: payload.receiptId,
      date: payload.date ?? nowISO(),
      createdBy,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    db.expenses.push(expense);
    return expense;
  },

  async deleteExpense(expenseId: string): Promise<void> {
    await mockDelay(400);
    if (!db.expenses.some((e) => e.id === expenseId)) return notFound();
    db.expenses = db.expenses.filter((e) => e.id !== expenseId);
    activityByExpense.delete(expenseId);
  },

  async markSplitPaid(expenseId: string, userId: string): Promise<Expense> {
    await mockDelay(400);
    const idx = db.expenses.findIndex((e) => e.id === expenseId);
    if (idx === -1) return notFound();
    db.expenses[idx] = {
      ...db.expenses[idx],
      splits: db.expenses[idx].splits.map((s) => (s.userId === userId ? { ...s, paid: true } : s)),
      updatedAt: nowISO(),
    };
    return db.expenses[idx];
  },

  async getActivity(expenseId: string): Promise<ExpenseActivity> {
    await mockDelay(200);
    if (!db.expenses.some((e) => e.id === expenseId)) return notFound();
    return snapshot(activityOf(expenseId));
  },

  async react(userId: string, expenseId: string, emoji: ExpenseReactionEmoji | null): Promise<ExpenseActivity> {
    await mockDelay(200);
    const a = activityOf(expenseId);
    a.reactions = a.reactions.filter((r) => r.userId !== userId);
    if (emoji) a.reactions.push({ userId, user: findUser(userId), emoji, updatedAt: nowISO() });
    return snapshot(a);
  },

  async addComment(userId: string, expenseId: string, text: string): Promise<ExpenseActivity> {
    await mockDelay(300);
    const a = activityOf(expenseId);
    a.comments.push({ id: generateId(), userId, user: findUser(userId), text: text.trim(), createdAt: nowISO() });
    return snapshot(a);
  },

  async deleteComment(userId: string, expenseId: string, commentId: string): Promise<ExpenseActivity> {
    await mockDelay(200);
    const a = activityOf(expenseId);
    a.comments = a.comments.filter((c) => !(c.id === commentId && c.userId === userId));
    return snapshot(a);
  },
};

export default ExpenseService;
