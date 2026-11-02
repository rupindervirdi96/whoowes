# WhoOwes

> Split it. Settle it. Stay friends. — Expense splitting for friends, homes and trips, with AI that reads your receipts.

Expo + React Native app, plus a small Node server (`server/`) for accounts, shared data and **Claude-powered AI features**. The app is free: each AI feature has 3 free uses a month, then a short rewarded ad (Google AdMob) unlocks one more.

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
- **Any currency**: every expense, payment and group has its own currency (all ISO 4217 currencies). Your default comes from your phone's region and can be changed in Account. Balances and totals are kept per currency and never converted
- **English, French, Spanish and Hindi**: the app follows the phone's language, or pick one in Account (or on the first screen). Server messages, AI notes and sign-in texts come back in the same language

**Paid features (Plus / Pro)**

| | Free | Plus · $2.99/mo | Pro · $5.99/mo |
|---|---|---|---|
| Expenses, groups, settle-ups | Unlimited | Unlimited | Unlimited |
| **AI receipt scanning** (photo or PDF) | 3 / month | 30 / month | Unlimited |
| **AI Quick Add** — "Tacos 64 with Sam, I paid" | — | ✓ | ✓ |
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
                                   └──► Google AdMob    (rewarded ads, server-side verification)
```

Everything is stored on the server: accounts, friends, groups, expenses, payments, receipts, reminders and each user's monthly AI usage. The server checks every request: you only see expenses you're part of (or groups you're in), you can only split with friends or group members, and split amounts must add up to the cent.

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

Sign up with your real number: no text is sent locally, and the code is **123456** (the app shows it). Locally the server starts its own MongoDB, stored in `server/data/mongo`; delete that folder to start fresh. The first start downloads MongoDB once (a few hundred MB), so it takes a minute; after that it starts in seconds. To use your Atlas cluster locally instead, set `MONGODB_URI` in `server/.env`. For quicker testing, set `AD_UNLOCK_SECONDS=5` in `server/.env`.

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
4. **Render**: Dashboard → **New → Blueprint** → choose this repo and branch. `render.yaml` creates the `whoowes-api` web service (check it says **free**). Paste the Atlas connection string as `MONGODB_URI`, the Twilio values and your `ANTHROPIC_API_KEY` when asked.
5. When the deploy is live, open `https://<your-service>.onrender.com/health`. It should show `"database": true` and `"sms": "twilio"`. If `database` is `false`, check the Atlas **Network Access** list and the password in the connection string.
6. **Point the app at it**: in the app's `.env` set `EXPO_PUBLIC_API_URL=https://<your-service>.onrender.com`, then `npx expo start -c` (Expo Go) or build the app (below).

**Costs.** Everything above runs on free tiers, with limits:
- **Render free web service:** sleeps after 15 idle minutes, and the first request after that takes about a minute (the app just looks slow to load).
- **MongoDB Atlas free cluster:** doesn't expire. 0.5 GB of storage (plenty for many thousands of expenses), up to 100 operations a second. Atlas pauses it only after 30 days with no connections at all, and you can resume it from the dashboard.

When you have real users: upgrade the Render service to `0.5c-512mb` (a few dollars a month, see render.com/pricing) so it stops sleeping, and move Atlas to a paid tier when you need more storage, speed or point-in-time backups. Twilio Verify charges per code sent, and Claude charges per receipt read.

### Building the app for other people

Expo Go is for testing. To give the app to others, build it with `EXPO_PUBLIC_API_URL` set to the Render URL (the URL is baked in at build time). `eas.json` already sets it for cloud builds, because `.env` is git-ignored and never uploaded to Expo's build servers.

- **Android APK** (install directly on phones): `npx eas-cli build -p android --profile preview`. When it finishes, Expo gives a download link and QR code.
- **Google Play** (`.aab`): `npx eas-cli build -p android --profile production`. The full publishing checklist (AdMob, store listing, Data safety answers, testers) is in [docs/google-play.md](docs/google-play.md).
- **Local build without Expo's servers**: `npx expo prebuild --platform android`, then `cd android` and `gradlew assembleRelease`. This reads `.env`. It needs Android Studio and a Java JDK.
- **iPhone / app stores**: `eas build` + `eas submit` (iOS needs an Apple Developer account).

### Push notifications

The server sends a notification when someone sends or accepts a friend request, adds an expense you're on (with what you owe or get back), reminds you to pay, records a payment to you, confirms or declines your payment, or adds you to a group. Tapping one opens that screen. They go through Expo's free push service (`server/src/push.ts`); the app registers each phone after sign-in (`src/services/notifications.ts`).

They work in installed builds (APK, Play Store, TestFlight), not in Expo Go on Android. One-time setup:

1. **Android (Firebase)**: at [console.firebase.google.com](https://console.firebase.google.com) create a project → add an Android app with package `com.whoowes.app` → download `google-services.json` into the project root (it isn't secret; `app.config.js` picks it up). Then in Firebase **Project settings → Service accounts → Generate new private key**, and upload that JSON with `npx eas-cli credentials` → Android → production → **Google Service Account → FCM V1**. Delete the downloaded key afterwards.
2. **iPhone**: `eas build` sets up the Apple push key for you when asked (needs the Apple Developer account).
3. Rebuild the app. The server needs no changes; `EXPO_ACCESS_TOKEN` is only needed if you turn on "Enhanced push security" at expo.dev.

People can mute "Friends & groups" and keep "Money" alerts in Android's notification settings for the app.

---

## AI passes and ads

Every AI feature (receipt scan, Quick Add, Split Assistant, AI insights) has **3 free uses a month**. After that, each use is unlocked by watching a **rewarded ad**.

The server is the only judge, using its own clock:

- Uses are counted per user per calendar month (UTC) in `ai_usage`. The phone's date and time are never used, so changing them resets nothing.
- Each AI route takes a use before calling Claude (with atomic updates, so two requests can't both take the last one) and gives it back if the call fails.
- The same month's AI insights again are free: the write-up is cached and only rewritten when the numbers change.

```
AI call → 402 ad_required → "Watch a 30-second ad" sheet
       → POST /ai/ad/start   (server notes the time; returns a session id)
       → rewarded ad plays   (AdMob gets user id + session id for verification)
       → AdMob → GET /ai/ad/ssv   (signed by Google; checked against Google's keys)
       → POST /ai/ad/claim   (refused until 30 s of server time have passed and,
                              with ADMOB_SSV_REQUIRED=true, Google has confirmed it)
       → the AI call runs again by itself
```

Other limits: one unlock per ad session, at most `AD_UNLOCKS_PER_DAY` (20) ads per person per day.

In Expo Go and on the web there's no ad SDK; development builds show a 30-second stand-in ad instead, so the flow can still be tested. AdMob setup (app id, ad unit, consent messages, verification URL) is in [docs/google-play.md](docs/google-play.md#4-rewarded-ads-admob).

## API

| Area | Endpoints |
|---|---|
| Sign-in | `POST /auth/phone/start` `{ phone }` · `POST /auth/phone/verify` `{ phone, code, name?, currency? }` → `{ user, token }` (30-day session) |
| Me | `GET/PATCH/DELETE /me` (`PATCH` takes `name`, `email`, `currency`; delete anonymises the account and removes receipts and AI usage) |
| Friends | `GET /friends` · `GET /friends/requests` · `POST /friends` · `POST /friends/requests/:id/accept` / `decline` · `DELETE /friends/:userId` · `GET /users/search?q=` |
| Contacts | `POST /contacts/match` `{ hashes: sha256(E.164)[] }`: the server never sees raw numbers |
| Reminders | `POST /friends/:userId/remind` · `GET /reminders` · `POST /reminders/:id/dismiss` |
| Groups | `GET/POST /groups` · `GET/PATCH/DELETE /groups/:id` (`PATCH`: name, description, currency) · `POST /groups/:id/members` · `DELETE /groups/:id/members/:userId` |
| Expenses | `GET /expenses?groupId=` · `GET/DELETE /expenses/:id` · `POST /expenses` · `POST /expenses/:id/splits/:userId/paid` |
| Payments | `GET /settlements?groupId=` · `GET /settlements/pending` · `POST /settlements` · `POST /settlements/:id/respond` · `DELETE /settlements/:id` |
| Receipts & AI | `POST /ai/receipts/parse` · `GET/PATCH /receipts/:id` · `POST /ai/expenses/quick-add` · `POST /ai/receipts/assign` · `POST /ai/insights` |
| AI pass | `GET /ai/pass` · `POST /ai/ad/start` · `POST /ai/ad/claim` · `GET /ai/ad/ssv` (AdMob's signed callback) |
| Public pages | `GET /privacy` · `GET /terms` · `GET /delete-account` (contact address from `SUPPORT_EMAIL`) |

Money is stored as integer cents with an ISO 4217 currency on every expense and payment. Without one, the server uses the group's currency, then the user's, then USD. Group totals come back per currency (`totals`).

Every request carries `Accept-Language` (en, fr, es or hi). The server translates its error messages (`server/src/i18n.ts`), asks Twilio for the sign-in text in that language, and has the AI write receipt notes, Quick Add notes and insights in it.

Sign-in code sends are rate-limited per number and per IP (SMS pumping costs real money); the limiter is in-memory, so move it to a shared store such as Redis if you run more than one server instance.

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
- **iPhone ads.** Add an iOS app and rewarded unit in AdMob, set `ADMOB_IOS_APP_ID` and `EXPO_PUBLIC_ADMOB_REWARDED_IOS`, and consider the App Tracking Transparency prompt for personalised ads.
- **Translations.** French, Spanish and Hindi were written by AI. Have a native speaker click through the app in each language. New text goes in `src/i18n/locales/en.ts` first; TypeScript then lists every language that's missing it.
- **Privacy policy and terms.** The server serves drafts at `/privacy` and `/terms`, written from what the app actually does. Have them checked before you rely on them.
- **Reviewer sign-in.** `REVIEW_PHONE` + `REVIEW_CODE` let store reviewers in without a text message. Change the code after each review, or clear both to turn it off.

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
  hooks/                     React Query hooks; useBilling (entitlements, checkout, paywall), useAI
  services/                  impl.ts picks api/live.ts (server) or mock/* (demo); ai, billing, contacts, phoneAuth
  utils/                     balanceEngine (per-currency balances, debt simplification), splitEngine, insights, csv, phone, currency
  i18n/                      useT() / translate(), locales/{en,fr,es,hi}.ts, generated currency and country names
server/
  src/db/                    MongoDB connection, document shapes and indexes (local MongoDB in development)
  src/domain/                Permission checks, money helpers, JSON serializers
  src/routes/                phone.ts (sign-in), people.ts (me, friends, contacts, reminders),
                             money.ts (groups, expenses, payments, receipts), billing.ts, webhooks.ts, ai.ts
  src/ai/claude.ts           Claude prompts + schemas
  src/aiPass.ts              Free monthly AI uses, ad sessions, AdMob verification
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
| `npm run store-assets` | Google Play icon (512×512) and feature graphic (1024×500) into `assets/store/` |
| `npm run locale-data` | Regenerate currency and country names in every app language (`src/i18n/currencies.ts`, `countries.ts`) |
| `npm run server:dev` | Start the API server (from the repo root) |

## License

MIT
