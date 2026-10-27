import express, { type NextFunction, type Request, type Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { ZodError } from 'zod';
import { devPlan, env, isProduction, twilioConfigured } from './env.js';
import { closeDb, initDb, pingDb } from './db/index.js';
import { billingRouter } from './routes/billing.js';
import { aiRouter } from './routes/ai.js';
import { phoneRouter } from './routes/phone.js';
import { peopleRouter } from './routes/people.js';
import { moneyRouter } from './routes/money.js';
import { stripeWebhook } from './routes/webhooks.js';

const app = express();
app.disable('x-powered-by');

// Stripe signs the raw body — this route must be registered before express.json().
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhook);

// CORS for the web build of the app. Auth uses bearer tokens (no cookies), so
// allowing any origin doesn't expose sessions. Native apps don't use CORS at all.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// Receipt images arrive base64-encoded (10 MB file ≈ 13.4 MB of base64).
app.use(express.json({ limit: '15mb' }));
app.set('trust proxy', 1); // so rate limits see the client IP behind a load balancer

app.get('/health', async (_req, res) => {
  const database = await pingDb();
  res.status(database ? 200 : 503).json({
    ok: database,
    database,
    stripe: !!env.STRIPE_SECRET_KEY,
    webhooks: !!env.STRIPE_WEBHOOK_SECRET,
    ai: !!env.ANTHROPIC_API_KEY,
    sms: twilioConfigured ? 'twilio' : isProduction ? 'off' : 'dev-code',
    devPlan: devPlan ?? null,
  });
});

app.use('/billing', billingRouter);
app.use('/ai', aiRouter);
app.use('/auth/phone', phoneRouter);
// Data routes (each requires a signed-in user).
app.use(peopleRouter);
app.use(moneyRouter);

app.use((_req, res) => res.status(404).json({ message: 'Not found' }));

// One place that turns any thrown error into a JSON response the app understands.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ message: 'Invalid request', code: 'invalid_request', issues: err.issues });
  }
  if (err instanceof Anthropic.RateLimitError) {
    return res.status(429).json({ message: 'The AI is busy right now — try again in a moment.', code: 'ai_rate_limited' });
  }
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    console.error('[ai] ANTHROPIC_API_KEY was rejected:', err.message);
    return res.status(503).json({ message: "AI isn't set up correctly on the server (API key rejected).", code: 'ai_unavailable' });
  }
  if (err instanceof Anthropic.BadRequestError) {
    // Usually the file itself: too large, corrupt, or an unsupported format.
    console.error('[ai] request rejected:', err.message);
    return res.status(422).json({
      message: "The AI couldn't open that file. Try a clearer photo, or a PDF under 10 MB.",
      code: 'ai_bad_input',
    });
  }
  if (err instanceof Anthropic.APIError) {
    console.error('[ai] upstream error', err.status, err.message);
    return res.status(502).json({ message: 'The AI service had a problem. Please try again.', code: 'ai_upstream' });
  }
  const e = err as { status?: number; statusCode?: number; code?: string; message?: string; type?: string };
  if (e?.type?.startsWith?.('Stripe')) {
    console.error('[stripe]', e.message);
    return res.status(502).json({ message: 'Payment provider error. Please try again.', code: 'billing_upstream' });
  }
  const status = e?.status ?? e?.statusCode ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status >= 500 && !e?.code ? 'Something went wrong.' : e?.message, code: e?.code });
});

await initDb();

const server = app.listen(env.PORT, () => {
  console.log(`WhoOwes API listening on :${env.PORT}`);
  if (!env.STRIPE_SECRET_KEY) console.log('  ⚠ STRIPE_SECRET_KEY not set — billing routes will return 503');
  if (!env.ANTHROPIC_API_KEY) console.log('  ⚠ ANTHROPIC_API_KEY not set — AI routes will return 503');
  if (devPlan) console.log(`  ⚠ DEV_PLAN=${devPlan} — every user gets this plan (development only)`);
  if (!twilioConfigured) {
    console.log(
      isProduction
        ? '  ⚠ Twilio not configured — phone sign-in is off'
        : '  ⚠ Twilio not configured — phone sign-in accepts code 123456 (development only)',
    );
  }
});

// Render (and most hosts) send SIGTERM on deploys: finish requests, then close the database.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.close(() => {
      closeDb().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}
