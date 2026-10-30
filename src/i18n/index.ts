/**
 * Translations: English, French, Spanish and Hindi.
 *
 *   const { t } = useT();          // in components (re-renders on language change)
 *   t('home.balances')             // "Balances"
 *   t('friends.count', { count })  // plural forms: { one, other }
 *   translate('toast.saved')       // outside React (toasts in mutation callbacks)
 *
 * The language follows the phone unless the user picks one in Account. Numbers,
 * dates and currencies are formatted for that language plus the phone's region
 * (e.g. fr-CA), so a Canadian sees "12,50 $" in French and "$12.50" in English.
 */

import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import en, { type Dict, type TKey } from './locales/en';
import fr from './locales/fr';
import es from './locales/es';
import hi from './locales/hi';

export type Language = 'en' | 'fr' | 'es' | 'hi';
export type LanguagePreference = 'system' | Language;
export type { TKey };

/** Shown in each language's own name, so people can find theirs. */
export const LANGUAGES: Array<{ code: Language; native: string }> = [
  { code: 'en', native: 'English' },
  { code: 'fr', native: 'Français' },
  { code: 'es', native: 'Español' },
  { code: 'hi', native: 'हिन्दी' },
];

const DICTS: Record<Language, Dict> = { en, fr, es, hi };
const SUPPORTED = new Set<Language>(['en', 'fr', 'es', 'hi']);

function phoneLocales() {
  try {
    return getLocales();
  } catch {
    return [];
  }
}

/** The first of the phone's preferred languages that the app supports. */
export function deviceLanguage(): Language {
  for (const l of phoneLocales()) {
    const code = l.languageCode?.toLowerCase() as Language | undefined;
    if (code && SUPPORTED.has(code)) return code;
  }
  return 'en';
}

/** The phone's region, e.g. "CA". */
export function deviceRegion(): string | null {
  return phoneLocales()[0]?.regionCode ?? null;
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface LanguageStore {
  preference: LanguagePreference;
  setPreference: (p: LanguagePreference) => void;
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set) => ({
      preference: 'system',
      setPreference: (preference) => set({ preference }),
    }),
    { name: '@whoowes/language', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

const resolve = (p: LanguagePreference): Language => (p === 'system' ? deviceLanguage() : p);

export function currentLanguage(): Language {
  return resolve(useLanguageStore.getState().preference);
}

/** BCP 47 tag for number and date formatting: app language + phone region. */
export function localeFor(lang: Language): string {
  const region = deviceRegion();
  return region ? `${lang}-${region}` : lang;
}

export function currentLocale(): string {
  return localeFor(currentLanguage());
}

// ─── Lookup ───────────────────────────────────────────────────────────────────

export type Params = Record<string, string | number>;

/** CLDR plural category, close enough for these four languages. */
function isOne(lang: Language, n: number) {
  if (lang === 'fr' || lang === 'hi') return n === 0 || n === 1;
  return n === 1;
}

function lookup(lang: Language, key: TKey, params?: Params): string {
  const entry = DICTS[lang][key] ?? en[key];
  let text: string;
  if (typeof entry === 'string') {
    text = entry;
  } else {
    const n = Number(params?.count ?? 0);
    text = isOne(lang, n) ? entry.one : entry.other;
  }
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** Outside React, e.g. in toasts. Uses the language at the time of the call. */
export function translate(key: TKey, params?: Params): string {
  return lookup(currentLanguage(), key, params);
}

/**
 * Splits a translated string around {placeholders} so links or bold text can be
 * dropped in: tRich('welcome.agree', { terms: <Link/>, privacy: <Link/> }).
 */
function rich<T>(text: string, parts: Record<string, T>): Array<string | T> {
  const out: Array<string | T> = [];
  let last = 0;
  for (const m of text.matchAll(/\{(\w+)\}/g)) {
    if (!(m[1] in parts)) continue;
    if (m.index! > last) out.push(text.slice(last, m.index));
    out.push(parts[m[1]]);
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/**
 * The language, locale and translate functions; re-renders when the language changes.
 * The functions keep the same identity until then, so they're safe in effect deps.
 */
export function useT() {
  const preference = useLanguageStore((s) => s.preference);
  const lang = resolve(preference);
  return useMemo(
    () => ({
      lang,
      locale: localeFor(lang),
      t: (key: TKey, params?: Params) => lookup(lang, key, params),
      tRich: <T,>(key: TKey, parts: Record<string, T>, params?: Params) => rich(lookup(lang, key, params), parts),
    }),
    [lang],
  );
}

export function useLanguage(): Language {
  return resolve(useLanguageStore((s) => s.preference));
}
