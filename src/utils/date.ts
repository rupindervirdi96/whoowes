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
 * Short relative date for list rows (no time, so rows stay on one line):
 * Today · Yesterday · Monday · Jan 15 · Jan 15, 2024
 */
export function formatSmartDate(date: string | Date | number): string {
  const d = toDate(date);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  if (isThisWeek(d)) return format(d, 'EEEE');
  if (isThisYear(d)) return format(d, 'MMM d');
  return format(d, 'MMM d, yyyy');
}

/** Date with time for detail screens: "Today at 2:30 PM", "Jan 15 at 9:00 AM". */
export function formatDateTime(date: string | Date | number): string {
  const d = toDate(date);
  const time = format(d, 'h:mm a');
  if (isToday(d)) return `Today at ${time}`;
  if (isYesterday(d)) return `Yesterday at ${time}`;
  return `${format(d, isThisYear(d) ? 'MMM d' : 'MMM d, yyyy')} at ${time}`;
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
