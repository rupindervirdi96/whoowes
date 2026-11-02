import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';

/** Empty strings in .env mean "not set". */
const optional = () => z.preprocess((v) => (v === '' ? undefined : v), z.string().optional());

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  /** Public HTTPS URL of this server, e.g. https://whoowes-api.onrender.com. */
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

  ANTHROPIC_API_KEY: optional(),

  // AI passes: free uses per feature each month, then one use per rewarded ad.
  /** Free uses of each AI feature per month. */
  AI_FREE_PER_MONTH: z.coerce.number().int().min(0).default(3),
  /** An ad only unlocks a use after this many seconds (server clock) since it started. */
  AD_UNLOCK_SECONDS: z.coerce.number().int().min(0).default(30),
  /** Most ads one person can watch for unlocks in 24 hours. */
  AD_UNLOCKS_PER_DAY: z.coerce.number().int().min(1).default(20),
  /**
   * "true" once AdMob server-side verification points at /ai/ad/ssv: then an ad
   * only unlocks a use after Google confirms it was watched.
   */
  ADMOB_SSV_REQUIRED: z.preprocess((v) => v === 'true' || v === '1', z.boolean()),

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

  /**
   * Optional Expo access token for sending push notifications. Only needed if
   * "Enhanced push security" is turned on for the project at expo.dev.
   */
  EXPO_ACCESS_TOKEN: optional(),

  /** Shown on the privacy, terms and account deletion pages. */
  SUPPORT_EMAIL: optional(),
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

/** The reviewer sign-in is on only when both values are set. */
export const reviewLogin = env.REVIEW_PHONE && env.REVIEW_CODE ? { phone: env.REVIEW_PHONE, code: env.REVIEW_CODE } : null;
