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
> • Any currency: each group and expense keeps its own, and balances are never mixed or converted
> • In English, French, Spanish and Hindi
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
> Free covers unlimited expenses, friends and groups, plus 3 AI receipt scans a month. Plus adds 30 scans, AI Quick Add (type "Tacos 64 with Sam and Priya") and CSV export. Pro adds unlimited scans, the AI Split Assistant and monthly spending insights. Subscriptions are billed through Google Play and can be cancelled any time.
>
> WhoOwes records who owes what. It doesn't move money or connect to your bank.

**Graphics**:
- App icon: `assets/store/play-icon-512.png`
- Feature graphic: `assets/store/feature-graphic.png` (regenerate both with `npm run store-assets`)
- Phone screenshots: 2 to 8, taken on your phone from the real app. Good ones: Home with balances, a group, the receipt scan result, settle up, the plans screen. Use the sample data account, not real friends' names and numbers.

**Category**: Finance. **Contact email**: your `SUPPORT_EMAIL`. **Privacy policy**: `https://whoowes-api-nbi9.onrender.com/privacy`.

### 5b. Translated listings (French, Spanish, Hindi)

The app follows the phone's language (people can also pick one in **Account → Language**, or on the first screen). Give the store listing the same languages: **Main store listing → Manage translations → Add your own translations**, add **French (fr-FR and fr-CA)**, **Spanish (es-419, es-ES and es-US)** and **Hindi (hi-IN)**, and paste the text below. Leave anything you don't translate (like screenshots) and Play shows the English version. Screenshots of the app in each language are a nice extra, not a requirement.

**French**

- App name: `WhoOwes : partage de frais`
- Short description:
  > Partagez les dépenses entre amis. Photographiez le reçu, l’IA fait le partage.
- Full description:
  > WhoOwes garde la trace des dépenses partagées, pour que personne n’ait à se souvenir de qui a payé quoi.
  >
  > PARTAGEZ TOUT
  > • Ajoutez une dépense en quelques secondes et partagez-la à parts égales, par montant, par pourcentage ou par article
  > • Des groupes pour les voyages, la colocation et les dîners, ou un partage en tête-à-tête avec un ami
  > • Voyez en un coup d’œil qui vous doit et à qui vous devez
  > • Toutes les devises : chaque groupe et chaque dépense gardent la leur, et les soldes ne sont jamais mélangés ni convertis
  > • En français, anglais, espagnol et hindi
  >
  > PHOTOGRAPHIEZ LE REÇU
  > • Prenez un reçu en photo : l’IA lit chaque article, les taxes et le pourboire
  > • Touchez qui a pris quoi, et le partage est fait
  >
  > RÉGLEZ VOS COMPTES
  > • Des suggestions intelligentes règlent un groupe avec le moins de paiements possible
  > • Enregistrez les paiements, votre ami confirme quand l’argent arrive
  > • Envoyez un petit rappel quand quelqu’un oublie
  >
  > CONFIDENTIEL PAR NATURE
  > • Connexion avec votre numéro de téléphone, sans mot de passe à retenir
  > • Trouvez vos amis dans vos contacts : les numéros sont brouillés sur votre téléphone et jamais stockés
  > • Pas de publicité, pas de pistage
  >
  > WHOOWES PLUS ET PRO
  > Le forfait Gratuit comprend dépenses, amis et groupes illimités, plus 3 scans de reçus IA par mois. Plus ajoute 30 scans, l’Ajout rapide IA (tapez « Tacos 64 avec Sam et Priya ») et l’export CSV. Pro ajoute les scans illimités, l’Assistant de partage IA et une analyse mensuelle des dépenses. Les abonnements sont facturés par Google Play et résiliables à tout moment.
  >
  > WhoOwes note qui doit quoi. L’app ne transfère pas d’argent et ne se connecte pas à votre banque.

**Spanish**

- App name: `WhoOwes: divide gastos`
- Short description:
  > Divide gastos con amigos. Hazle una foto al recibo y la IA lo divide por ti.
- Full description:
  > WhoOwes lleva la cuenta de los gastos compartidos para que nadie tenga que recordar quién pagó qué.
  >
  > DIVIDE LO QUE SEA
  > • Añade un gasto en segundos y divídelo a partes iguales, por importe, por porcentaje o por artículo
  > • Grupos para viajes, compañeros de piso y cenas, o divide con un solo amigo
  > • Mira de un vistazo quién te debe y a quién le debes
  > • Cualquier moneda: cada grupo y cada gasto conserva la suya, y los saldos nunca se mezclan ni se convierten
  > • En español, inglés, francés e hindi
  >
  > FOTOGRAFÍA EL RECIBO
  > • Hazle una foto a un recibo y la IA lee cada artículo, los impuestos y la propina
  > • Toca quién tomó qué y listo
  >
  > SALDA CUENTAS
  > • Sugerencias inteligentes para saldar un grupo con el menor número de pagos
  > • Registra los pagos y tu amigo confirma cuando le llega el dinero
  > • Envía un recordatorio amable cuando alguien se olvida
  >
  > PRIVADO DESDE EL DISEÑO
  > • Inicia sesión con tu número de teléfono, sin contraseñas que recordar
  > • Encuentra amigos en tus contactos: los números se codifican en tu teléfono y nunca se guardan
  > • Sin anuncios ni rastreo
  >
  > WHOOWES PLUS Y PRO
  > El plan Gratis incluye gastos, amigos y grupos ilimitados, más 3 escaneos de recibos con IA al mes. Plus añade 30 escaneos, el Añadido rápido con IA (escribe «Tacos 64 con Sam y Priya») y la exportación CSV. Pro añade escaneos ilimitados, el Asistente de división con IA y estadísticas mensuales de gastos. Las suscripciones se cobran a través de Google Play y se pueden cancelar cuando quieras.
  >
  > WhoOwes registra quién debe qué. No mueve dinero ni se conecta a tu banco.

**Hindi**

- App name: `WhoOwes: बिल बाँटें`
- Short description:
  > दोस्तों के साथ खर्च बाँटें। रसीद की फ़ोटो लें, AI आपके लिए बाँट देगा।
- Full description:
  > WhoOwes साझा खर्चों का हिसाब रखता है, ताकि किसी को याद न रखना पड़े कि किसने कितना दिया।
  >
  > कुछ भी बाँटें
  > • सेकंडों में खर्च जोड़ें और उसे बराबर, रकम, प्रतिशत या चीज़ों के हिसाब से बाँटें
  > • ट्रिप, रूममेट और डिनर के लिए ग्रुप, या किसी एक दोस्त के साथ सीधा बँटवारा
  > • एक नज़र में देखें किसे आपको देना है और आपको किसे देना है
  > • कोई भी मुद्रा: हर ग्रुप और खर्च अपनी मुद्रा में रहता है, और बकाया कभी मिलाया या बदला नहीं जाता
  > • हिन्दी, अंग्रेज़ी, फ़्रेंच और स्पैनिश में
  >
  > रसीद की फ़ोटो लें
  > • रसीद की फ़ोटो लें और AI हर चीज़, टैक्स और टिप पढ़ लेगा
  > • बताएं किसने क्या लिया, और बँटवारा हो गया
  >
  > हिसाब चुकाएं
  > • स्मार्ट सुझाव, जिनसे सबसे कम भुगतानों में पूरे ग्रुप का हिसाब हो जाए
  > • भुगतान दर्ज करें, और पैसे मिलने पर आपका दोस्त पुष्टि करेगा
  > • कोई भूल जाए तो प्यार से याद दिलाएं
  >
  > आपकी निजता सबसे पहले
  > • फ़ोन नंबर से साइन इन, कोई पासवर्ड याद रखने की ज़रूरत नहीं
  > • कॉन्टैक्ट्स से दोस्त ढूंढें: नंबर आपके फ़ोन पर ही बदल दिए जाते हैं और कभी सेव नहीं होते
  > • कोई विज्ञापन नहीं, कोई ट्रैकिंग नहीं
  >
  > WHOOWES PLUS और PRO
  > फ़्री प्लान में अनलिमिटेड खर्च, दोस्त और ग्रुप, साथ में हर महीने 3 AI रसीद स्कैन। Plus में 30 स्कैन, AI झटपट जोड़ें ("समोसे 120 सैम और प्रिया के साथ" लिखें) और CSV एक्सपोर्ट। Pro में अनलिमिटेड स्कैन, AI बँटवारा सहायक और हर महीने खर्च का विश्लेषण। सब्सक्रिप्शन Google Play से बिल होते हैं और कभी भी रद्द किए जा सकते हैं।
  >
  > WhoOwes सिर्फ़ हिसाब रखता है कि किसे कितना देना है। यह पैसे नहीं भेजता और आपके बैंक से नहीं जुड़ता।

These translations (and the app's) were written by AI. Have a native speaker of each language read the listing and click through the app once before launch.

### 5c. Countries

**Test and release → Production → Countries / regions**: add the countries you want. A sensible start is English- and French-speaking Canada and the US, the UK, Ireland, Australia, New Zealand and India, then more once you see where people come from.

Then match it in **Twilio → Verify → Geo permissions**: allow texts only to those countries, and turn on **Fraud Guard**. Sign-in texts cost much more in some countries, and fraudsters send thousands of sign-in requests to expensive numbers.

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
