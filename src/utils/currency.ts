/**
 * Money formatting and currency helpers.
 *
 * Amounts are always kept per currency and never converted. Display follows the
 * app language + phone region (see i18n): "CA$12.50", "12,50 $ CA", "₹1,250.00".
 */

import { getLocales } from 'expo-localization';
import { CURRENCY_TABLE } from '../i18n/currencies';
import { currentLanguage, currentLocale, type Language } from '../i18n';

const LANG_INDEX: Record<Language, number> = { en: 2, fr: 3, es: 4, hi: 5 };
const BY_CODE = new Map(CURRENCY_TABLE.map((row) => [row[0], row]));

export const FALLBACK_CURRENCY = 'USD';

/** Every currency in circulation (ISO 4217 codes). */
export const ALL_CURRENCIES: string[] = CURRENCY_TABLE.map((row) => row[0]);

export const isKnownCurrency = (code: string | null | undefined): code is string => !!code && BY_CODE.has(code);

/** Decimals shown and typed. Amounts are stored in hundredths, so never more than 2. */
export function currencyDecimals(currency: string): number {
  return Math.min(BY_CODE.get(currency)?.[1] ?? 2, 2);
}

/** "Canadian Dollar" / "dollar canadien" / "कनाडाई डॉलर". */
export function currencyName(currency: string, lang: Language = currentLanguage()): string {
  const row = BY_CODE.get(currency);
  return row ? (row[LANG_INDEX[lang]] as string) : currency;
}

/** The currency of the phone's region (Canada → CAD), else USD. */
export function deviceCurrency(): string {
  try {
    for (const l of getLocales()) {
      if (isKnownCurrency(l.currencyCode)) return l.currencyCode;
    }
  } catch {
    // fall through
  }
  return FALLBACK_CURRENCY;
}

/** Formats an amount in a currency for the current language and region. */
export function formatCurrency(amount: number, currency: string, options?: Partial<Intl.NumberFormatOptions>): string {
  const digits = currencyDecimals(currency);
  try {
    return new Intl.NumberFormat(currentLocale(), {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      ...options,
    }).format(amount);
  } catch {
    return `${getCurrencySymbol(currency)}${amount.toFixed(digits)}`;
  }
}

/** Several amounts in different currencies, e.g. "CA$20.00 + €5.00". Never summed. */
export function formatAmounts(list: Array<{ currency: string; amount: number }>, separator = ' + '): string {
  return list.map((x) => formatCurrency(x.amount, x.currency)).join(separator);
}

const symbolCache = new Map<string, string>();

/** "$", "CA$", "€", "₹" — whatever the locale writes next to the number. */
export function getCurrencySymbol(currency: string): string {
  const key = `${currentLocale()}|${currency}`;
  const hit = symbolCache.get(key);
  if (hit) return hit;
  let symbol = currency;
  try {
    const sample = new Intl.NumberFormat(currentLocale(), { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(0);
    const stripped = sample.replace(/[0\s  ]/g, '');
    if (stripped) symbol = stripped;
  } catch {
    // keep the code
  }
  symbolCache.set(key, symbol);
  return symbol;
}

/** Reads what someone typed: "12,50" and "12.50" both mean twelve and a half. */
export function parseAmount(value: string): number {
  const cleaned = value.replace(',', '.').replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/** Keeps only digits and one decimal separator, limited to the currency's decimals. */
export function cleanAmountInput(value: string, currency: string): string {
  const decimals = currencyDecimals(currency);
  const normalized = value.replace(',', '.').replace(/[^0-9.]/g, '');
  const [whole, ...rest] = normalized.split('.');
  if (decimals === 0) return whole;
  return rest.length ? `${whole}.${rest.join('').slice(0, decimals)}` : whole;
}

/** An amount as plain text for an input field ("12.5" → "12.50", "1000" in JPY). */
export function amountToInput(amount: number, currency: string): string {
  return amount.toFixed(currencyDecimals(currency));
}

/**
 * Rounds a number to exactly 2 decimal places to avoid floating-point drift.
 */
export function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Rounds to what the currency actually uses (whole yen, cents for dollars). */
export function roundForCurrency(value: number, currency: string): number {
  const f = 10 ** currencyDecimals(currency);
  return Math.round(value * f) / f;
}

/**
 * Distributes a total among `count` people in the currency's smallest unit;
 * any remainder goes to the last person.
 */
export function distributeEvenly(total: number, count: number, decimals = 2): number[] {
  if (count <= 0) return [];
  const f = 10 ** decimals;
  const units = Math.round(total * f);
  const base = Math.floor(units / count);
  const remainder = units - base * count;
  return Array.from({ length: count }, (_, i) => {
    const share = i < count - 1 ? base : base + remainder;
    return roundToCents(share / f);
  });
}

/**
 * Checks if a formatted string is a valid positive monetary amount.
 */
export function isValidAmount(value: string): boolean {
  const parsed = parseAmount(value);
  return parsed > 0;
}
