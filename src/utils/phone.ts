/**
 * Phone numbers: parse what people type (or what's in their address book) into
 * E.164 (+14155550123), format it for display, and hash it for contact matching.
 */

import { AsYouType, getCountryCallingCode, isSupportedCountry, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { getLocales } from 'expo-localization';
import * as Crypto from 'expo-crypto';

/** The phone's region (from its language settings), e.g. 'US', 'IN', 'GB'. */
export function deviceCountry(): CountryCode {
  try {
    const region = getLocales()[0]?.regionCode?.toUpperCase();
    if (region && isSupportedCountry(region)) return region as CountryCode;
  } catch {
    // fall through
  }
  return 'US';
}

export function callingCode(country: CountryCode): string {
  return `+${getCountryCallingCode(country)}`;
}

/** Flag emoji for a two-letter country code. */
export function flag(country: CountryCode): string {
  return String.fromCodePoint(...[...country].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

/**
 * Parses a number typed by the user or stored in a contact. Numbers without a
 * country code are read as local to `country`. Returns null if it can't be a phone number.
 */
export function toE164(raw: string, country: CountryCode = deviceCountry()): string | null {
  const cleaned = raw.replace(/[^\d+]/g, '').replace(/^00/, '+');
  if (cleaned.replace(/\D/g, '').length < 6) return null;
  const parsed = parsePhoneNumberFromString(cleaned, country);
  return parsed && parsed.isPossible() ? parsed.number : null;
}

/** "+14155550123" → "+1 415 555 0123" (or the national format for local numbers). */
export function formatPhone(e164: string, country: CountryCode = deviceCountry()): string {
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) return e164;
  return parsed.country === country ? parsed.formatNational() : parsed.formatInternational();
}

/** Formats digits as they're typed, for the national part of the number. */
export function formatAsYouType(digits: string, country: CountryCode): string {
  return new AsYouType(country).input(digits);
}

/**
 * SHA-256 of the E.164 number. Contact matching sends only these hashes,
 * never the numbers themselves.
 */
export function hashPhone(e164: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, e164);
}
