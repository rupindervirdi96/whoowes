/**
 * Date formatting and comparison utilities.
 * Uses date-fns for reliable date manipulation.
 */

import {
  format,
  formatDistanceToNow,
  isToday,
  isYesterday,
  isThisWeek,
  isThisYear,
  parseISO,
} from 'date-fns';

/**
 * Parses a date value that can be a string, Date, or number.
 */
function toDate(date: string | Date | number): Date {
  if (typeof date === 'string') return parseISO(date);
  if (date instanceof Date) return date;
  return new Date(date);
}

/**
 * Smart relative date display:
 * - Today → "Today at 2:30 PM"
 * - Yesterday → "Yesterday at 8:00 AM"
 * - This week → "Mon at 3:00 PM"
 * - This year → "Jan 15"
 * - Older → "Jan 15, 2024"
 */
export function formatSmartDate(date: string | Date | number): string {
  const d = toDate(date);
  if (isToday(d)) return `Today at ${format(d, 'h:mm a')}`;
  if (isYesterday(d)) return `Yesterday at ${format(d, 'h:mm a')}`;
  if (isThisWeek(d)) return format(d, "EEE 'at' h:mm a");
  if (isThisYear(d)) return format(d, 'MMM d');
  return format(d, 'MMM d, yyyy');
}

/**
 * Returns a human-readable relative time string ("2 hours ago", "3 days ago").
 */
export function timeAgo(date: string | Date | number): string {
  return formatDistanceToNow(toDate(date), { addSuffix: true });
}

/**
 * Formats a date as "February 18, 2025".
 */
export function formatFullDate(date: string | Date | number): string {
  return format(toDate(date), 'MMMM d, yyyy');
}

/**
 * Formats a date as "Feb 18, 2025".
 */
export function formatShortDate(date: string | Date | number): string {
  return format(toDate(date), 'MMM d, yyyy');
}

/**
 * Formats a date as "2025-02-18" (ISO date, useful for inputs).
 */
export function formatISODate(date: string | Date | number): string {
  return format(toDate(date), 'yyyy-MM-dd');
}

/**
 * Returns a display label for the month and year: "February 2025".
 */
export function formatMonthYear(date: string | Date | number): string {
  return format(toDate(date), 'MMMM yyyy');
}

/**
 * Returns the current ISO timestamp string.
 */
export function nowISO(): string {
  return new Date().toISOString();
}
