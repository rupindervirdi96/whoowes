/**
 * Unique ID generator that works across React Native without requiring
 * crypto.getRandomValues() polyfills.
 *
 * When connecting to a real backend, server-generated IDs (UUIDs) will
 * replace these client-side IDs.
 */

let counter = 0;

/**
 * Generates a collision-resistant client-side ID.
 * Format: <timestamp_base36>-<counter>-<random>
 */
export function generateId(): string {
  counter += 1;
  const timestamp = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 9);
  return `${timestamp}-${counter}-${rand}`;
}

/**
 * Generates an ID with a readable prefix for debugging.
 * E.g., generatePrefixedId('exp') -> 'exp_lp3k2j1-5-abc123'
 */
export function generatePrefixedId(prefix: string): string {
  return `${prefix}_${generateId()}`;
}
