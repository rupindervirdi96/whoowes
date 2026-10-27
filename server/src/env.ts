import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';

/** Empty strings in .env mean "not set". */
const optional = () => z.preprocess((v) => (v === '' ? undefined : v), z.string().optional());

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  /** Public HTTPS URL of this server, e.g. https://whoowes-api.onrender.com (Stripe redirects here). */
  PUBLIC_URL: z.string().url().default(process.env.RENDER_EXTERNAL_URL || 'http://localhost:4000'),
  NODE_ENV: z.string().default('development'),

  /** PostgreSQL connection string. Unset in local development = embedded PGlite. */
  DATABASE_URL: optional(),
  PGLITE_DIR: z.string().default('data/pglite'),

  /** Signs session tokens. Required in production; generated and saved locally in development. */
  AUTH_JWT_SECRET: optional(),

  STRIPE_SECRET_KEY: optional(),
  STRIPE_WEBHOOK_SECRET: optional(),
  TRIAL_DAYS: z.coerce.number().int().min(0).default(7),

  ANTHROPIC_API_KEY: optional(),

  // Phone sign-in codes are sent with Twilio Verify. Without these, development
  // servers accept the code 123456 (and print it); production refuses phone sign-in.
  TWILIO_ACCOUNT_SID: optional(),
  TWILIO_AUTH_TOKEN: optional(),
  TWILIO_VERIFY_SERVICE_SID: optional(),

  /** Development only: treat every user as being on this plan (free | plus | pro). */
  DEV_PLAN: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['free', 'plus', 'pro']).optional()),
});

export const env = schema.parse(process.env);
export const isProduction = env.NODE_ENV === 'production';

if (isProduction && !env.AUTH_JWT_SECRET) {
  throw new Error('AUTH_JWT_SECRET must be set in production (any long random string).');
}
if (isProduction && !env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set in production.');
}

/** Development: keep one signing key across restarts so sessions survive. */
function devSecret(): string {
  const file = 'data/dev-jwt-secret';
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  mkdirSync('data', { recursive: true });
  const secret = randomBytes(32).toString('hex');
  writeFileSync(file, secret);
  return secret;
}

export const jwtSecret = env.AUTH_JWT_SECRET ?? devSecret();

export const twilioConfigured = !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_VERIFY_SERVICE_SID);

/** Test codes (123456) only on non-production servers without Twilio. */
export const devCodesAllowed = !twilioConfigured && !isProduction;

/** The plan override for local testing (never applies in production). */
export const devPlan = isProduction ? undefined : env.DEV_PLAN;
