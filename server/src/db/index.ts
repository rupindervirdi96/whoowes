/**
 * Database access.
 *
 * - Production (and any time DATABASE_URL is set): PostgreSQL via node-postgres.
 *   In production this is a Neon connection string; TLS is turned on
 *   automatically for hosted databases.
 * - Local development without DATABASE_URL: PGlite, a real Postgres compiled to
 *   WebAssembly, stored in server/data/pglite. Same SQL, nothing to install.
 *
 * Every query goes through `db.query` or `db.tx`, so both backends behave the same.
 */

import { mkdirSync } from 'node:fs';
import pg from 'pg';
import { env } from '../env.js';
import { MIGRATIONS } from './schema.js';

export interface QueryResult<T> {
  rows: T[];
}
export interface Queryable {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
}

interface Backend extends Queryable {
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  kind: 'postgres' | 'pglite';
}

let backend: Backend | null = null;

/**
 * Hosted databases (Neon, Render external URLs, …) get TLS with full certificate
 * checks; local and Render-internal hosts (no dots, e.g. dpg-abc123-a) don't.
 * SSL settings in the URL (`sslmode=require` from Neon) are removed so this
 * choice applies and node-postgres doesn't print its sslmode warning.
 */
function poolConfig(url: string): pg.PoolConfig {
  const parsed = new URL(url);
  const host = parsed.hostname;
  const hosted = host.includes('.') && host !== 'localhost' && host !== '127.0.0.1';
  for (const key of ['sslmode', 'sslrootcert', 'uselibpqcompat']) parsed.searchParams.delete(key);
  return {
    connectionString: parsed.toString(),
    ssl: hosted ? { rejectUnauthorized: true } : undefined,
    max: 10,
  };
}

async function connectPostgres(url: string): Promise<Backend> {
  const pool = new pg.Pool(poolConfig(url));
  pool.on('error', (err) => console.error('[db] idle client error', err.message));
  return {
    kind: 'postgres',
    query: async <T>(text: string, params?: unknown[]) => ({ rows: (await pool.query(text, params)).rows as T[] }),
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({ query: async <T>(text: string, params?: unknown[]) => ({ rows: (await client.query(text, params)).rows as T[] }) });
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

async function connectPglite(dir: string): Promise<Backend> {
  const { PGlite } = await import('@electric-sql/pglite');
  mkdirSync(dir, { recursive: true });
  const lite = await PGlite.create(dir);
  const wrap = (q: { query: (t: string, p?: unknown[]) => Promise<{ rows: unknown[] }> }): Queryable => ({
    query: async <T>(text: string, params?: unknown[]) => ({ rows: (await q.query(text, params)).rows as T[] }),
  });
  return {
    kind: 'pglite',
    ...wrap(lite),
    tx: (fn) => lite.transaction((t) => fn(wrap(t))),
    close: () => lite.close(),
  };
}

async function migrate(b: Backend) {
  await b.query(`create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())`);
  const { rows } = await b.query<{ id: string }>('select id from schema_migrations');
  const done = new Set(rows.map((r) => r.id));
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    await b.tx(async (q) => {
      for (const statement of m.sql.split(/;\s*$/m).map((s) => s.trim()).filter(Boolean)) {
        await q.query(statement);
      }
      await q.query('insert into schema_migrations (id) values ($1)', [m.id]);
    });
    console.log(`[db] applied migration ${m.id}`);
  }
}

/** Connects and runs pending migrations. Call once at startup. */
export async function initDb(): Promise<void> {
  if (backend) return;
  backend = env.DATABASE_URL ? await connectPostgres(env.DATABASE_URL) : await connectPglite(env.PGLITE_DIR);
  await migrate(backend);
  console.log(`[db] ready (${backend.kind === 'postgres' ? 'PostgreSQL' : `PGlite at ${env.PGLITE_DIR}`})`);
}

function current(): Backend {
  if (!backend) throw new Error('Database not initialised: call initDb() first');
  return backend;
}

export const db = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]) {
    return current().query<T>(text, params);
  },
  /** Runs `fn` in a transaction: everything commits together or not at all. */
  tx<T>(fn: (q: Queryable) => Promise<T>) {
    return current().tx(fn);
  },
  async one<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T | undefined> {
    return (await current().query<T>(text, params)).rows[0];
  },
  close() {
    return backend?.close();
  },
};
