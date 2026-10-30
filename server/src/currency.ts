/**
 * Currency codes. Any ISO 4217 code the runtime knows is accepted; the app
 * picks a default from the phone's region and people can change it.
 */

import { z } from 'zod';

const KNOWN = new Set(Intl.supportedValuesOf('currency'));

export const isCurrency = (code: string) => KNOWN.has(code);

/** "cad" → "CAD"; rejects anything that isn't a real currency code. */
export const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .refine(isCurrency, { message: 'Unknown currency code' });

export const FALLBACK_CURRENCY = 'USD';
