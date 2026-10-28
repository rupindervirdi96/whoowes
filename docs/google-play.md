# Publishing WhoOwes on Google Play

A start-to-finish checklist. The server is `https://whoowes-api-nbi9.onrender.com`; the app id is `com.whoowes.app`.

The order matters: Google only lets you create subscriptions after a build is uploaded, and RevenueCat can only see subscriptions after they exist in Play Console.

```
1. Accounts           Play Console ($25), Expo, RevenueCat (free)
2. Server settings    SUPPORT_EMAIL, REVIEW_PHONE/CODE on Render
3. First build        eas build → upload .aab to Internal testing
4. Subscriptions      Play products → RevenueCat → keys → rebuild
5. Store listing      text, graphics, screenshots
6. App content        privacy, Data safety, ratings, app access…
7. Testing            internal → closed (12 testers × 14 days for new personal accounts)
8. Production         apply for production access, release
```

---

## 1. Accounts

- **Google Play Console**: [play.google.com/console](https://play.google.com/console). One-time $25 USD fee and an identity check (government ID), which can take a few days.
  - A **personal** account created after November 2023 must run a **closed test with at least 12 testers for 14 days in a row** before it can publish to everyone. Start recruiting testers early.
  - An **organization** account skips that rule but needs a D-U-N-S number for your business.
- **Expo**: free account at [expo.dev](https://expo.dev), used by `eas build`.
- **RevenueCat**: free at [app.revenuecat.com](https://app.revenuecat.com) until $2.5k/month in revenue.
- **Twilio**: upgrade from the trial before testers sign up. The trial only texts 5 numbers you verify by hand, and closed testing needs 12 people. Verify costs about $0.05 per sign-in.

## 2. Server settings (Render → whoowes-api → Environment)

Add these, then save (Render redeploys by itself):

| Key | Value |
|---|---|
| `SUPPORT_EMAIL` | The address people can write to. It appears on the privacy, terms and account deletion pages. |
| `REVIEW_PHONE` | `+15555550123`, a fictional number nobody owns. |
| `REVIEW_CODE` | Any 6 digits you choose, e.g. `482916`. |

Check: [/privacy](https://whoowes-api-nbi9.onrender.com/privacy), [/terms](https://whoowes-api-nbi9.onrender.com/terms) and [/delete-account](https://whoowes-api-nbi9.onrender.com/delete-account) open and show your email, and `/health` shows `"reviewLogin": true`.

Then sign in on your own phone with the review number and code, and add a little sample data (a group, two or three expenses, one with a scanned receipt) so the reviewer doesn't land in an empty app.

## 3. First build and upload

```bash
npx eas-cli build -p android --profile production
```

The first time, let EAS create the signing key. Then:

1. **Play Console → Create app**: name `WhoOwes`, default language, **App**, **Free** (in-app subscriptions are fine in a free app; a paid app can never become free). Accept the declarations.
2. **Testing → Internal testing → Create new release**. Download the `.aab` from the EAS build page and upload it. Keep **Play App Signing** on (the default); the EAS key becomes your upload key.
3. Add yourself under **Testers** (an email list), save, and roll out. Open the opt-in link on your phone and install from Play.

The first upload has to be done by hand like this. Later builds can go up with `npx eas-cli submit -p android` once you add a Google service account key to EAS.

Version codes are counted by EAS (`"autoIncrement": true` in `eas.json`), so every production build gets a new one automatically.

## 4. Subscriptions (Google Play + RevenueCat)

### 4a. Products in Play Console

**Monetize with Play → Products → Subscriptions → Create subscription** (available once the build from step 3 is uploaded):

| Product ID | Name | Base plans (ID → billing period) | Suggested price |
|---|---|---|---|
| `whoowes_plus` | WhoOwes Plus | `monthly` → 1 month, `yearly` → 1 year | $2.99 / $24.99 |
| `whoowes_pro` | WhoOwes Pro | `monthly` → 1 month, `yearly` → 1 year | $5.99 / $49.99 |

- Base plan ids **must contain "month" or "year"**; the server reads the billing interval from them.
- Make both base plans **auto-renewing**, set the price (Play converts it for other countries), and **Activate** them.
- Optional free trial: on a base plan, **Add offer** → eligibility **New customer acquisition** → a 7-day free phase. The paywall shows the trial automatically to people who qualify.
- Product ids can never be reused after deletion, so type them carefully.

### 4b. Let RevenueCat talk to Google

RevenueCat's guide: [Creating Play service credentials](https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials). In short:

1. In Google Cloud, enable the **Google Play Android Developer API** and the **Google Play Developer Reporting API**.
2. Create a **service account** with the roles **Pub/Sub Editor** and **Monitoring Viewer**, and download a **JSON key**.
3. In Play Console → **Users and permissions**, invite the service account's email. Under App permissions add WhoOwes, and grant: view app information, **view financial data**, **manage orders and subscriptions**, and manage store presence.
4. In RevenueCat: create a project → **Apps → Add app → Google Play Store**, package `com.whoowes.app`. Upload the JSON key, then delete the downloaded file.
5. Turn on **Google real-time developer notifications** in the same RevenueCat app page (it gives you a Pub/Sub topic to paste into Play Console → Monetization setup). This makes renewals and cancellations show up within seconds.

Google can take **up to 36 hours** before the credentials work.

### 4c. Products, entitlements and the offering in RevenueCat

1. **Products**: import the four Play products (`whoowes_plus:monthly`, `whoowes_plus:yearly`, `whoowes_pro:monthly`, `whoowes_pro:yearly`).
2. **Entitlements**: create two, with identifiers exactly `plus` and `pro`. Attach the two Plus products to `plus` and the two Pro products to `pro`.
3. **Offerings**: create one (e.g. `default`) and make it **Current**. Add four packages with **custom identifiers** exactly:

| Package identifier | Product |
|---|---|
| `plus_monthly` | `whoowes_plus:monthly` |
| `plus_yearly` | `whoowes_plus:yearly` |
| `pro_monthly` | `whoowes_pro:monthly` |
| `pro_yearly` | `whoowes_pro:yearly` |

### 4d. Keys and webhook

1. RevenueCat → **Project settings → API keys**:
   - Copy the **Google Play public SDK key** (starts with `goog_`). Add it to the app as `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, both in `.env` and in both build profiles in `eas.json`. It isn't secret.
   - Create a **secret API key** for **API v1** (starts with `sk_`). Put it on Render as `REVENUECAT_SECRET_KEY`. It is secret: never put it in the app or the repo.
2. Make up a long random string (e.g. `openssl rand -hex 24`). On Render set `REVENUECAT_WEBHOOK_AUTH` to `Bearer <that string>`.
3. RevenueCat → **Integrations → Webhooks → Add**:
   - URL `https://whoowes-api-nbi9.onrender.com/webhooks/revenuecat`
   - Authorization header value: exactly the same `Bearer <that string>`
   - Send a test event; RevenueCat should show **200**.
4. `/health` should now show `"appStoreBilling": true`.
5. **Rebuild** the app (step 3's command) and upload the new `.aab` to Internal testing. Builds made without the key show paid plans as "Coming soon".

### 4e. Test a purchase without paying

1. Play Console → **Settings → License testing**: add the Gmail accounts of your testers. Their purchases are free test purchases, and subscriptions renew every few minutes (a monthly plan renews every 5 minutes) so you can watch renewals and expiry.
2. Install from the Internal testing link (not a sideloaded APK), open **Account → See plans**, and subscribe.
3. Check that the plan switches to Pro and that **Account → Manage subscription** opens Google Play. Cancel there and confirm the app shows "Ends …".

## 5. Store listing (Grow users → Store presence → Main store listing)

**App name** (max 30): `WhoOwes: Split Bills`

**Short description** (max 80):
> Split bills with friends. Snap a receipt and AI splits it for you.

**Full description** (max 4000):
> WhoOwes keeps track of shared expenses so nobody has to remember who paid for what.
>
> SPLIT ANYTHING
> • Add an expense in seconds and split it equally, by amount, by percentage or by item
> • Groups for trips, roommates and dinners, or split one-to-one with a friend
> • See at a glance who owes you and who you owe
>
> SNAP THE RECEIPT
> • Take a photo of a receipt and AI reads every item, the tax and the tip
> • Tap who had what and the split is done
>
> SETTLE UP
> • Smart suggestions settle a group in the fewest payments
> • Record payments, and your friend confirms when the money arrives
> • Send a friendly reminder when someone forgets
>
> PRIVATE BY DESIGN
> • Sign in with your phone number, no password to remember
> • Find friends from your contacts: numbers are scrambled on your phone first and never stored
> • No ads, no tracking
>
> WHOOWES PLUS AND PRO
> Free covers unlimited expenses, friends and groups, plus 3 AI receipt scans a month. Plus adds 30 scans, AI Quick Add (type "Tacos $64 with Sam and Priya") and CSV export. Pro adds unlimited scans, the AI Split Assistant and monthly spending insights. Subscriptions are billed through Google Play and can be cancelled any time.
>
> WhoOwes records who owes what. It doesn't move money or connect to your bank.

**Graphics**:
- App icon: `assets/store/play-icon-512.png`
- Feature graphic: `assets/store/feature-graphic.png` (regenerate both with `npm run store-assets`)
- Phone screenshots: 2 to 8, taken on your phone from the real app. Good ones: Home with balances, a group, the receipt scan result, settle up, the plans screen. Use the sample data account, not real friends' names and numbers.

**Category**: Finance. **Contact email**: your `SUPPORT_EMAIL`. **Privacy policy**: `https://whoowes-api-nbi9.onrender.com/privacy`.

## 6. App content (Policy → App content)

| Section | Answer |
|---|---|
| Privacy policy | `https://whoowes-api-nbi9.onrender.com/privacy` |
| App access | **All or some functionality is restricted.** Add instructions: *"Sign in with phone number +1 555-555-0123 (choose United States, +1). No text message is sent; enter code `<your REVIEW_CODE>`. The account has sample groups and expenses."* |
| Ads | No ads |
| Content rating | Fill in the questionnaire honestly. Category: **Utility, productivity, communication or other**. WhoOwes has no violence, sexual content, gambling or drugs. Users can share content with friends (names, expenses, reminders), and the app sells digital subscriptions. |
| Target audience | **18 and over** |
| News app | No |
| Health apps | No health features |
| Financial features | WhoOwes doesn't lend, bank, invest, or move money. Declare that it provides none of the listed financial features. |
| Government app | No |
| Data safety | See below |
| Account deletion | In-app: Account → Delete account. Web link: `https://whoowes-api-nbi9.onrender.com/delete-account` |

### Data safety answers

**Does your app collect or share user data?** Yes. **Is all data encrypted in transit?** Yes. **Can users request deletion?** Yes.

Services that work for you (Twilio, Anthropic, MongoDB, Render, RevenueCat, Google Play) count as **service providers, not sharing**. Answer **Shared: No** for everything below.

| Data type | Collected | Required? | Processed ephemerally? | Purposes |
|---|---|---|---|---|
| Personal info → **Name** | Yes | Required | No | App functionality, Account management |
| Personal info → **Email address** | Yes | Optional | No | App functionality, Account management |
| Personal info → **Phone number** | Yes | Required | No | App functionality, Account management, Fraud prevention & security |
| Personal info → **User IDs** | Yes | Required | No | App functionality, Account management |
| Financial info → **Purchase history** | Yes | Optional | No | App functionality |
| Financial info → **Other financial info** (expenses, balances, payments between friends) | Yes | Required | No | App functionality |
| Photos and videos → **Photos** (receipt photos) | Yes | Optional | **Yes**: sent to the AI to read and not stored | App functionality |
| Files and docs (receipt PDFs) | Yes | Optional | **Yes** | App functionality |
| Contacts | Yes | Optional | **Yes**: hashed numbers are compared and not stored | App functionality |
| App activity → **Other user-generated content** (Quick Add text, expense notes) | Yes | Optional | No | App functionality |

Not collected: location, web browsing, messages, audio, health, calendar, device or other IDs, crash logs, diagnostics. If you later add analytics or crash reporting, update this form. RevenueCat's SDK only adds **Purchase history**, which is already listed ([RevenueCat: Google Play's Data safety](https://www.revenuecat.com/docs/platform-resources/google-platform-resources/google-plays-data-safety)).

## 7. Testing tracks

1. **Internal testing** (up to 100 people, no review): use it for your own checks.
2. **Closed testing**: create a track, add at least **12 testers** (an email list or a Google Group), and roll out a build. Google reviews this one, which typically takes a few days.
   - Testers must **opt in** through the link and **keep the app installed**. New personal accounts need 12 opted-in testers for **14 days in a row**.
   - Testers need real phone numbers that can receive texts (Twilio upgraded, see step 1).
   - Add testers' Gmail addresses to **License testing** too if they should try subscriptions for free.
3. When the 14 days are up, **Dashboard → Apply for production access** and answer the questions about your test.

## 8. Production

Create a release on the **Production** track with the latest `.aab` and roll out (consider a staged rollout, e.g. 20%). Before you do:

- [ ] Twilio upgraded from trial
- [ ] Render upgraded from the free plan (`0.5c-512mb`). A sleeping server makes the first open take about a minute, which reviewers and new users read as broken.
- [ ] Atlas backups turned on
- [ ] Privacy policy and terms read through and adjusted for your situation (e.g. your business name and country)
- [ ] `REVIEW_CODE` changed after each review round, or both review settings cleared once you're approved

## Troubleshooting

| Problem | Fix |
|---|---|
| Plans say "Coming soon" | The build has no `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`. Add it to `eas.json` and rebuild. |
| Plans say "Not available right now" | RevenueCat returned no matching packages: check the offering is **Current** and the four package identifiers match exactly. Within the first 36 hours this can also be the Google credentials not working yet. |
| Paid, but the app still shows Free | `/health` → `appStoreBilling` must be `true`. Check Render's logs for `[revenuecat]` errors (wrong secret key or webhook value), and that the entitlements are named `plus` and `pro`. **Plans → Restore purchases** re-syncs. |
| "You need to sign in to Google" in the payment sheet | The phone's Play Store account isn't a tester on the track. |
| Reviewer can't sign in | `/health` → `reviewLogin` must be `true`, and the instructions must say to pick **+1 (United States)**. |
