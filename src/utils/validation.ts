/**
 * Zod validation schemas for form inputs and API payloads.
 * Centralizes validation logic for reuse across screens and services.
 */

import { z } from 'zod';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(50, 'Name is too long'),
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Invalid email address'),
    phone: z
      .string()
      .regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number')
      .optional()
      .or(z.literal('')),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

// ─── Friends ─────────────────────────────────────────────────────────────────

export const addFriendSchema = z.object({
  emailOrPhone: z
    .string()
    .min(1, 'Email or phone is required')
    .refine(
      (val) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^\+?[1-9]\d{7,14}$/;
        return emailRegex.test(val) || phoneRegex.test(val);
      },
      { message: 'Enter a valid email address or phone number' },
    ),
});

// ─── Groups ──────────────────────────────────────────────────────────────────

export const createGroupSchema = z.object({
  name: z
    .string()
    .min(2, 'Group name must be at least 2 characters')
    .max(50, 'Group name is too long'),
  description: z.string().max(200, 'Description is too long').optional(),
  memberIds: z
    .array(z.string())
    .min(1, 'Select at least one member'),
});

// ─── Expenses ────────────────────────────────────────────────────────────────

export const createExpenseSchema = z.object({
  title: z
    .string()
    .min(2, 'Title must be at least 2 characters')
    .max(100, 'Title is too long'),
  description: z.string().max(300, 'Description is too long').optional(),
  amount: z
    .number({ message: 'Amount must be a number' })
    .positive('Amount must be greater than 0')
    .max(1_000_000, 'Amount is too large'),
  currency: z.string().length(3, 'Invalid currency code').default('USD'),
  category: z.enum([
    'food', 'transport', 'accommodation', 'entertainment',
    'utilities', 'shopping', 'health', 'other',
  ]),
  paidBy: z.string().min(1, 'Paid by is required'),
  splitType: z.enum(['equal', 'custom', 'percentage', 'item_based']),
  groupId: z.string().optional(),
  date: z.string().optional(),
});

// ─── Settlements ─────────────────────────────────────────────────────────────

export const createSettlementSchema = z.object({
  toUserId: z.string().min(1, 'Recipient is required'),
  amount: z
    .number()
    .positive('Amount must be greater than 0')
    .max(1_000_000, 'Amount is too large'),
  currency: z.string().length(3).default('USD'),
  note: z.string().max(200, 'Note is too long').optional(),
  groupId: z.string().optional(),
});

// ─── Inferred types from schemas ─────────────────────────────────────────────

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
export type AddFriendFormValues = z.infer<typeof addFriendSchema>;
export type CreateGroupFormValues = z.infer<typeof createGroupSchema>;
export type CreateExpenseFormValues = z.infer<typeof createExpenseSchema>;
export type CreateSettlementFormValues = z.infer<typeof createSettlementSchema>;
