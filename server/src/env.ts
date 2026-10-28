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

  /** MongoDB connection string (Atlas: mongodb+srv://…). Unset in local development = a local MongoDB. */
  MONGODB_URI: optional(),
  /** Database name inside the cluster. */
  MONGODB_DB: z.preprocess((v) => (v === '' ? undefined : v), z.string().default('whoowes')),
  /** Where the local development MongoDB keeps its files. */
  MONGO_LOCAL_DIR: z.string().default('data/mongo'),

  /** Signs session tokens. Required in production; generated and saved locally in development. */
  AUTH_JWT_SECRET: optional(),

  STRIPE_SECRET_KEY: optional(),
  STRIPE_WEBHOOK_SECRET: optional(),
  TRIAL_DAYS: z.coerce.number().int().min(0).default(7),

  // Google Play / App Store subscriptions go through RevenueCat.
  /** RevenueCat secret API key (v1), used to read a customer's subscriptions. */
  REVENUECAT_SECRET_KEY: optional(),
  /** The exact Authorization header value set on the RevenueCat webhook. */
  REVENUECAT_WEBHOOK_AUTH: optional(),

  ANTHROPIC_API_KEY: optional(),

  // Phone sign-in codes are sent with Twilio Verify. Without these, development
  // servers accept the code 123456 (and print it); production refuses phone sign-in.
  TWILIO_ACCOUNT_SID: optional(),
  TWILIO_AUTH_TOKEN: optional(),
  TWILIO_VERIFY_SERVICE_SID: optional(),

  /**
   * A sign-in for app store reviewers, who can't receive our texts: this number
   * skips Twilio and accepts REVIEW_CODE instead. Leave both empty to turn it off.
   */
  REVIEW_PHONE: z.preprocess((v) => (v === '' ? undefined : v), z.string().regex(/^\+[1-9]\d{6,14}$/).optional()),
  REVIEW_CODE: z.preprocess((v) => (v === '' ? undefined : v), z.string().regex(/^\d{6}$/).optional()),

  /** Shown on the privacy, terms and account deletion pages. */
  SUPPORT_EMAIL: optional(),

  /** Development only: treat every user as being on this plan (free | plus | pro). */
  DEV_PLAN: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['free', 'plus', 'pro']).optional()),
});

export const env = schema.parse(process.env);
export const isProduction = env.NODE_ENV === 'production';

if (isProduction && !env.AUTH_JWT_SECRET) {
  throw new Error('AUTH_JWT_SECRET must be set in production (any long random string).');
}
if (isProduction && !env.MONGODB_URI) {
  throw new Error('MONGODB_URI must be set in production (your MongoDB Atlas connection string).');
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

export const revenueCatConfigured = !!env.REVENUECAT_SECRET_KEY;

/** The reviewer sign-in is on only when both values are set. */
export const reviewLogin = env.REVIEW_PHONE && env.REVIEW_CODE ? { phone: env.REVIEW_PHONE, code: env.REVIEW_CODE } : null;

/** The plan override for local testing (never applies in production). */
export const devPlan = isProduction ? undefined : env.DEV_PLAN;
