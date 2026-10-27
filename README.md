# WhoOwes

> Split it. Settle it. Stay friends. — Expense splitting for friends, homes and trips, with AI that reads your receipts.

Expo + React Native app, plus a small Node server (`server/`) for **Stripe subscriptions** and **Claude-powered AI features**.

---

## What's in v2

**New design system** — new owl logo, violet + citrus brand, Plus Jakarta Sans, light **and dark mode** (System / Light / Dark in Account), a redesigned screen for every flow, and a new tab bar with a center **+** button.

**Free features**
- **Sign in with your phone number** (6-digit text code), with email sign-in still available
- **Friends from contacts**: see which contacts are already on WhoOwes, add them in one tap, or text an invite. Numbers are hashed on the phone before they are checked, and the address book is never uploaded
- Home: balance card, a "Needs your attention" list (payments to confirm, friend requests, contacts who joined), balances by person, recent activity
- **Activity** tab: one timeline of expenses + payments, grouped by month, with search and filters
- **Groups**: true per-group balances, the *fewest payments* that settle the group, members, add people
- **Settle up**: suggested person + amount, payment method, confirm/decline flow
- Expenses: equal / exact / percentage splits, group picker, date, notes
- Spending **Insights**: your share per month, by category, who you split with most

**Paid features (Plus / Pro)**

| | Free | Plus · $2.99/mo | Pro · $5.99/mo |
|---|---|---|---|
| Expenses, groups, settle-ups | Unlimited | Unlimited | Unlimited |
| **AI receipt scanning** (photo or PDF) | 3 / month | 30 / month | Unlimited |
| **AI Quick Add** — "Tacos $64 with Sam, I paid" | — | ✓ | ✓ |
| CSV export | — | ✓ | ✓ |
| **AI Split Assistant** — "Sam had the wine, split the rest" | — | — | ✓ |
| **Monthly AI insights** | — | — | ✓ |

Yearly: Plus $24.99, Pro $49.99. New subscribers get a 7-day trial (configurable).

---

## How it runs

The app talks to the WhoOwes server (`server/`) whenever `EXPO_PUBLIC_API_URL` is set:

```
Phone app (Expo) ──HTTPS──► WhoOwes API (Node, server/) ──► MongoDB (Atlas)
                                   ├──► Twilio Verify   (sign-in codes by SMS)
                                   ├──► Claude API      (receipt reading, Quick Add, insights)
                                   └──► Stripe          (Plus / Pro subscriptions)
```

Everything is stored on the server: accounts, friends, groups, expenses, payments, receipts, reminders and subscriptions. The server checks every request: you only see expenses you're part of (or groups you're in), you can only split with friends or group members, and split amounts must add up to the cent.

Without `EXPO_PUBLIC_API_URL` the app runs as a self-contained **demo** on sample data (handy for design work).

---

## Run it locally (no accounts needed)

```bash
# 1. Server: local MongoDB (starts by itself), test SMS code 123456
cd server
npm install
cp .env.example .env         # optional: add ANTHROPIC_API_KEY for real receipt reading
npm run dev                  # http://localhost:4000/health

# 2. App, pointed at your computer (use its Wi-Fi IP so your phone can reach it)
cd ..
echo EXPO_PUBLIC_API_URL=http://192.168.x.x:4000 > .env
npx expo start -c            # scan the QR code with Expo Go
```

Sign up with your real number: no text is sent locally, and the code is **123456** (the app shows it). Locally the server starts its own MongoDB, stored in `server/data/mongo`; delete that folder to start fresh. The first start downloads MongoDB once (a few hundred MB), so it takes a minute; after that it starts in seconds. To use your Atlas cluster locally instead, set `MONGODB_URI` in `server/.env`. `DEV_PLAN=pro` in `server/.env` unlocks the paid AI features without Stripe.

---

## Go live on Render

The server has to be online so everyone's phone can reach it. Render runs the server; the database is MongoDB Atlas. Both have free tiers:

1. **Push this repo to GitHub.**
2. **MongoDB Atlas** (the database): sign up at mongodb.com/atlas.
   - Create a project (e.g. "WhoOwes"), then **Create cluster** → **Free**, provider **AWS**, region **Oregon (us-west-2)** to sit next to the Render server.
   - **Database Access** → add a database user with a password (use **Autogenerate**, which avoids characters that need escaping in the URL).
   - **Network Access** → **Add IP address** → **Allow access from anywhere** (`0.0.0.0/0`). Render's free servers don't have a fixed IP, so this is required; the password protects the database.
   - **Clusters** → **Connect** → **Drivers** → copy the connection string (`mongodb+srv://<user>:<password>@cluster0.xxxx.mongodb.net/?…`) and put the user's password in place of `<password>`.
   - The server creates its collections and indexes on first start, in a database named `whoowes`.
3. **Twilio** (texts the sign-in codes): create an account at twilio.com. On a trial account, use Console → **Verify** → **Try out Verify**: the sample request contains the Service SID (`VA…`) and Account SID (`AC…`); the Auth Token is under **Account Info** on the Console home page. A trial can only text numbers you verify in the Console (up to 5); upgrade it before real users sign up.
4. **Render**: Dashboard → **New → Blueprint** → choose this repo and branch. `render.yaml` creates the `whoowes-api` web service (check it says **free**). Paste the Atlas connection string as `MONGODB_URI`, the Twilio values and your `ANTHROPIC_API_KEY` when asked; Stripe can stay empty until you charge.
5. When the deploy is live, open `https://<your-service>.onrender.com/health`. It should show `"database": true` and `"sms": "twilio"`. If `database` is `false`, check the Atlas **Network Access** list and the password in the connection string.
6. **Point the app at it**: in the app's `.env` set `EXPO_PUBLIC_API_URL=https://<your-service>.onrender.com`, then `npx expo start -c` (Expo Go) or build the app (below).

**Costs.** Everything above runs on free tiers, with limits:
- **Render free web service:** sleeps after 15 idle minutes, and the first request after that takes about a minute (the app just looks slow to load).
- **MongoDB Atlas free cluster:** doesn't expire. 0.5 GB of storage (plenty for many thousands of expenses), up to 100 operations a second. Atlas pauses it only after 30 days with no connections at all, and you can resume it from the dashboard.

When you have real users: upgrade the Render service to `0.5c-512mb` (a few dollars a month, see render.com/pricing) so it stops sleeping, and move Atlas to a paid tier when you need more storage, speed or point-in-time backups. Twilio Verify charges per code sent, and Claude charges per receipt read.

### Building the app for other people

Expo Go is for testing. To give the app to others, build it with `EXPO_PUBLIC_API_URL` set to the Render URL (the URL is baked in at build time):

- **Android APK**: `npx expo prebuild --platform android`, then `cd android` and `gradlew assembleRelease`; or `eas build -p android --profile preview` with Expo's cloud builds.
- **iPhone / app stores**: `eas build` + `eas submit` (iOS needs an Apple Developer account).

---

## Payments (Stripe)

```bash
cd server
npm run stripe:setup      # creates "WhoOwes Plus" + "WhoOwes Pro" and 4 prices (looked up by lookup_key)
```

Then in the Stripe Dashboard → Settings → Billing → **Customer portal**: enable it and allow customers to switch between the WhoOwes prices and cancel. Add a webhook endpoint `https://<your-service>.onrender.com/webhooks/stripe` for `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, and put its signing secret in `STRIPE_WEBHOOK_SECRET`. Locally, `npm run stripe:listen` forwards webhooks.

```
Paywall → POST /billing/checkout → Stripe Checkout (in-app browser)
       → Stripe → GET /billing/return → whoowes://billing/return → app refetches plan
Stripe webhooks → server keeps each user's plan/status in sync (renewals, cancels, failed cards)
Account → Manage billing → Stripe Customer Portal (switch plan, update card, cancel, invoices)
```

The server enforces plans: every AI endpoint checks the caller's plan and monthly scan quota and returns `402` with `code: upgrade_required | quota_exceeded`, which the app turns into the paywall.

---

## API

| Area | Endpoints |
|---|---|
| Sign-in | `POST /auth/phone/start` `{ phone }` · `POST /auth/phone/verify` `{ phone, code, name? }` → `{ user, token }` (30-day session) |
| Me | `GET/PATCH/DELETE /me` (delete anonymises the account and cancels any subscription) |
| Friends | `GET /friends` · `GET /friends/requests` · `POST /friends` · `POST /friends/requests/:id/accept` / `decline` · `DELETE /friends/:userId` · `GET /users/search?q=` |
| Contacts | `POST /contacts/match` `{ hashes: sha256(E.164)[] }`: the server never sees raw numbers |
| Reminders | `POST /friends/:userId/remind` · `GET /reminders` · `POST /reminders/:id/dismiss` |
| Groups | `GET/POST /groups` · `GET/DELETE /groups/:id` · `POST /groups/:id/members` · `DELETE /groups/:id/members/:userId` |
| Expenses | `GET /expenses?groupId=` · `GET/DELETE /expenses/:id` · `POST /expenses` · `POST /expenses/:id/splits/:userId/paid` |
| Payments | `GET /settlements?groupId=` · `GET /settlements/pending` · `POST /settlements` · `POST /settlements/:id/respond` · `DELETE /settlements/:id` |
| Receipts & AI | `POST /ai/receipts/parse` · `GET/PATCH /receipts/:id` · `POST /ai/expenses/quick-add` · `POST /ai/receipts/assign` · `POST /ai/insights` |
| Billing | `GET /billing/subscription` · `POST /billing/checkout` · `POST /billing/portal` · `POST /webhooks/stripe` |

Money is stored as integer cents. Sign-in code sends are rate-limited per number and per IP (SMS pumping costs real money); the limiter is in-memory, so move it to a shared store such as Redis if you run more than one server instance.

### AI

All AI runs server-side on **Claude Opus 5.5** (`claude-opus-5-5`) with structured outputs (Zod schemas), so responses always parse:

| Endpoint | Plan | What it does |
|---|---|---|
| `POST /ai/receipts/parse` | Free (3/mo), Plus (30/mo), Pro | Reads a receipt photo or PDF → merchant, line items, tax, tip, total |
| `POST /ai/expenses/quick-add` | Plus, Pro | One sentence → a ready-to-save expense |
| `POST /ai/receipts/assign` | Pro | "Who had what" instruction → item assignments |
| `POST /ai/insights` | Pro | Monthly read-out written from numbers computed on-device |

Photos are resized to 1600px JPEG on the phone before upload (this also converts iPhone HEIC photos). Requests opt into Anthropic's server-side refusal fallback, so a rare false-positive safety decline is retried instead of failing.

---

## Before launch

- **Push notifications.** Reminders and payment confirmations show up when people open the app. Push needs a development or production build (not Expo Go) plus `expo-notifications`.
- **Database backups.** Turn on backups for the free Atlas cluster (cluster → **Backup**): Atlas then takes a daily snapshot and keeps the last four. Paid tiers add continuous, point-in-time backups.
- **App Store / Google Play rules.** Selling digital subscriptions inside a mobile app is governed by store policies (Apple guideline 3.1.1 / Google Play Payments). Linking out to Stripe Checkout is currently allowed on Apple's **US** storefront, but most other storefronts still require in-app purchase for digital features. A common setup is Stripe for web/US plus StoreKit / Play Billing (for example via RevenueCat) elsewhere, all writing to the same entitlement record.
- **Privacy policy.** You collect phone numbers and check hashed contacts; both stores require a privacy policy that says so.

---

## Project structure

```
App.tsx                      Fonts, splash, providers
src/
  theme/                     Design tokens (light/dark palettes, type scale), ThemeProvider, makeStyles
  components/ui/             Text, Button, Card, Input, Chip, BottomSheet, Logo, Avatar, …
  components/                BalanceHero, ExpenseRow, SettlementRow, AddSheet, GroupTile
  navigation/                Root stack + MainTabs (custom tab bar with center +)
  screens/                   home, friends, groups, activity, expenses, receipts, settlements, account, insights, auth
  billing/plans.ts           Plan catalogue + feature gates (mirrors server/src/plans.ts)
  hooks/                     React Query hooks; useBilling (entitlements, checkout, paywall), useAI
  services/                  impl.ts picks api/live.ts (server) or mock/* (demo); ai, billing, contacts, phoneAuth
  utils/                     balanceEngine (net positions, debt simplification), splitEngine, insights, csv, phone
server/
  src/db/                    MongoDB connection, document shapes and indexes (local MongoDB in development)
  src/domain/                Permission checks, money helpers, JSON serializers
  src/routes/                phone.ts (sign-in), people.ts (me, friends, contacts, reminders),
                             money.ts (groups, expenses, payments, receipts), billing.ts, webhooks.ts, ai.ts
  src/ai/claude.ts           Claude prompts + schemas
  src/stripe.ts              Stripe client, price lookup, subscription → plan sync
  scripts/stripe-setup.ts    Creates products/prices
render.yaml                  Render Blueprint for the API (database: MongoDB Atlas, via MONGODB_URI)
assets/brand/                Logo source (owl-glyph.svg) — `npm run icons` regenerates every icon
```

## Brand

The owl's brow is a **W**; its pupils are **split coins**. Edit `assets/brand/owl-glyph.svg` and run `npm run icons` to regenerate `icon.png`, `adaptive-icon.png`, `splash-icon.png`, `favicon.png` and `assets/brand/logo-badge.svg`. In-app, the logo is drawn with SVG (`src/components/ui/Logo.tsx`).

## Scripts

| Command | |
|---|---|
| `npm start` / `npm run ios` / `npm run android` / `npm run web` | Run the app |
| `npm run typecheck` | TypeScript check |
| `npm run icons` | Regenerate app icons from the brand SVG |
| `npm run server:dev` | Start the API server (from the repo root) |
| `cd server && npm run stripe:setup` | Create Stripe products/prices |
| `cd server && npm run stripe:listen` | Forward Stripe webhooks to localhost |

## License

MIT
