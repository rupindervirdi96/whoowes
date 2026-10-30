/**
 * Date formatting in the app's language (and the phone's region for order and
 * 12/24-hour time). Uses Intl for dates and date-fns for "3 days ago".
 */

import { formatDistanceToNow, isToday, isYesterday, isThisWeek, isThisYear, parseISO } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { es } from 'date-fns/locale/es';
import { fr } from 'date-fns/locale/fr';
import { hi } from 'date-fns/locale/hi';
import { currentLanguage, currentLocale, translate } from '../i18n';

const DATE_FNS_LOCALES = { en: enUS, fr, es, hi };

/**
 * Parses a date value that can be a string, Date, or number.
 */
function toDate(date: string | Date | number): Date {
  if (typeof date === 'string') return parseISO(date);
  if (date instanceof Date) return date;
  return new Date(date);
}

function fmt(d: Date, options: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat(currentLocale(), options).format(d);
  } catch {
    return d.toDateString();
  }
}

/**
 * Short relative date for list rows (no time, so rows stay on one line):
 * Today · Yesterday · Monday · Jan 15 · Jan 15, 2024
 */
export function formatSmartDate(date: string | Date | number): string {
  const d = toDate(date);
  if (isToday(d)) return translate('date.today');
  if (isYesterday(d)) return translate('date.yesterday');
  if (isThisWeek(d)) return capitalize(fmt(d, { weekday: 'long' }));
  if (isThisYear(d)) return fmt(d, { month: 'short', day: 'numeric' });
  return fmt(d, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Date with time for detail screens: "Today at 2:30 PM", "Jan 15 at 9:00 AM". */
export function formatDateTime(date: string | Date | number): string {
  const d = toDate(date);
  const time = fmt(d, { hour: 'numeric', minute: '2-digit' });
  if (isToday(d)) return translate('date.todayAt', { time });
  if (isYesterday(d)) return translate('date.yesterdayAt', { time });
  const day = fmt(d, isThisYear(d) ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
  return translate('date.dayAt', { day, time });
}

/**
 * Returns a human-readable relative time string ("2 hours ago", "3 days ago").
 */
export function timeAgo(date: string | Date | number): string {
  return formatDistanceToNow(toDate(date), { addSuffix: true, locale: DATE_FNS_LOCALES[currentLanguage()] });
}

/**
 * Formats a date as "February 18, 2025".
 */
export function formatFullDate(date: string | Date | number): string {
  return fmt(toDate(date), { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Formats a date as "Feb 18, 2025".
 */
export function formatShortDate(date: string | Date | number): string {
  return fmt(toDate(date), { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Formats a date as "2025-02-18" (ISO date, useful for inputs).
 */
export function formatISODate(date: string | Date | number): string {
  const d = toDate(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Returns a display label for the month and year: "February 2025".
 */
export function formatMonthYear(date: string | Date | number): string {
  return capitalize(fmt(toDate(date), { month: 'long', year: 'numeric' }));
}

/** Month name only: "February". */
export function formatMonthName(date: string | Date | number): string {
  return capitalize(fmt(toDate(date), { month: 'long' }));
}

/**
 * Returns the current ISO timestamp string.
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/** French and Spanish write month and day names in lower case; headings look better capitalised. */
function capitalize(s: string) {
  return s.charAt(0).toLocaleUpperCase() + s.slice(1);
}
