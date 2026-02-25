/**
 * Mock Expenses Service.
 *
 * Manages expense creation, retrieval, and deletion.
 * Real backend endpoints: GET /expenses, POST /expenses, etc.
 */

import { Expense, CreateExpensePayload, User, ExpenseSplit } from '../../types';
import { MOCK_EXPENSES, MOCK_USERS } from '../../constants/sampleData';
import { generateId } from '../../utils/idGenerator';
import { nowISO } from '../../utils/date';
import { mockDelay } from './mockHelpers';

let expenses: Expense[] = [...MOCK_EXPENSES];
const users: User[] = [...MOCK_USERS];

const ExpenseService = {
  /**
   * Get all expenses (optionally filtered by group).
   * Real backend: GET /expenses or GET /groups/:id/expenses
   */
  async getExpenses(userId: string, groupId?: string): Promise<Expense[]> {
    await mockDelay();
    let result = expenses.filter(
      (e) =>
        e.paidBy === userId ||
        e.splits.some((s) => s.userId === userId),
    );
    if (groupId) {
      result = result.filter((e) => e.groupId === groupId);
    }
    // Most recent first
    return result.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  },

  /**
   * Get a single expense by ID.
   * Real backend: GET /expenses/:id
   */
  async getExpense(expenseId: string): Promise<Expense> {
    await mockDelay();
    const expense = expenses.find((e) => e.id === expenseId);
    if (!expense) return Promise.reject({ message: 'Expense not found', statusCode: 404 });
    return expense;
  },

  /**
   * Create a new expense.
   * Real backend: POST /expenses
   */
  async createExpense(payload: CreateExpensePayload): Promise<Expense> {
    await mockDelay(700);

    const paidByUser = users.find((u) => u.id === payload.paidBy);
    if (!paidByUser) {
      return Promise.reject({ message: 'Paid-by user not found', statusCode: 404 });
    }

    // Populate split users
    const splits: ExpenseSplit[] = payload.splits.map((s) => {
      const user = users.find((u) => u.id === s.userId) ?? {
        id: s.userId, name: 'Unknown', email: '', createdAt: nowISO(), updatedAt: nowISO(),
      };
      return {
        ...s,
        user,
        paid: s.userId === payload.paidBy,
      };
    });

    const newExpense: Expense = {
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
      createdBy: payload.paidBy,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };

    expenses.push(newExpense);
    return newExpense;
  },

  /**
   * Update an existing expense.
   * Real backend: PATCH /expenses/:id
   */
  async updateExpense(expenseId: string, update: Partial<Expense>): Promise<Expense> {
    await mockDelay(500);
    const idx = expenses.findIndex((e) => e.id === expenseId);
    if (idx === -1) return Promise.reject({ message: 'Expense not found', statusCode: 404 });
    expenses[idx] = { ...expenses[idx], ...update, updatedAt: nowISO() };
    return expenses[idx];
  },

  /**
   * Delete an expense.
   * Real backend: DELETE /expenses/:id
   */
  async deleteExpense(expenseId: string): Promise<void> {
    await mockDelay(400);
    const exists = expenses.some((e) => e.id === expenseId);
    if (!exists) return Promise.reject({ message: 'Expense not found', statusCode: 404 });
    expenses = expenses.filter((e) => e.id !== expenseId);
  },

  /**
   * Mark a specific split as paid.
   * Real backend: PATCH /expenses/:id/splits/:userId
   */
  async markSplitPaid(expenseId: string, userId: string): Promise<Expense> {
    await mockDelay(400);
    const idx = expenses.findIndex((e) => e.id === expenseId);
    if (idx === -1) return Promise.reject({ message: 'Expense not found', statusCode: 404 });

    const updatedSplits = expenses[idx].splits.map((s) =>
      s.userId === userId ? { ...s, paid: true } : s,
    );
    expenses[idx] = { ...expenses[idx], splits: updatedSplits, updatedAt: nowISO() };
    return expenses[idx];
  },
};

export default ExpenseService;
