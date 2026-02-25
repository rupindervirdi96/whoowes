/**
 * Currency formatting utilities.
 * Centralizes all monetary display logic to ensure consistency.
 */

import { CURRENCIES, DEFAULT_CURRENCY } from '../constants';

/**
 * Formats a numeric amount into a localized currency string.
 *
 * @param amount - The numeric value to format
 * @param currency - ISO 4217 currency code (default: USD)
 * @param options - Optional overrides for Intl.NumberFormat
 */
export function formatCurrency(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  options?: Partial<Intl.NumberFormatOptions>,
): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options,
    }).format(amount);
  } catch {
    // Fallback for unsupported currencies
    const currencyInfo = CURRENCIES[currency];
    const symbol = currencyInfo?.symbol ?? currency;
    return `${symbol}${amount.toFixed(2)}`;
  }
}

/**
 * Returns just the currency symbol for a given code.
 */
export function getCurrencySymbol(currency: string = DEFAULT_CURRENCY): string {
  return CURRENCIES[currency]?.symbol ?? currency;
}

/**
 * Parses a string amount (possibly with $ prefix) to a float.
 * Returns 0 if parsing fails.
 */
export function parseAmount(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Rounds a number to exactly 2 decimal places to avoid floating-point drift.
 */
export function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Distributes a total amount among `count` people, handling rounding:
 * - Most people get Math.floor(total / count)
 * - Remaining cents go to the last person
 */
export function distributeEvenly(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor((total * 100) / count);
  const remainder = Math.round(total * 100) - base * count;
  return Array.from({ length: count }, (_, i) => {
    const cents = i < count - 1 ? base : base + remainder;
    return roundToCents(cents / 100);
  });
}

/**
 * Checks if a formatted string is a valid positive monetary amount.
 */
export function isValidAmount(value: string): boolean {
  const parsed = parseFloat(value);
  return !isNaN(parsed) && parsed > 0;
}
