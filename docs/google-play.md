# Publishing WhoOwes on Google Play

A start-to-finish checklist. The server is `https://whoowes-api-nbi9.onrender.com`; the app id is `com.whoowes.app`.

WhoOwes is free. Each AI feature has 3 free uses a month; after that, people can watch a short rewarded ad (Google AdMob) to unlock one more. There are no subscriptions or in-app purchases.

```
1. Accounts           Play Console ($25), Expo, AdMob (free)
2. Server settings    SUPPORT_EMAIL, REVIEW_PHONE/CODE on Render
3. First build        eas build → upload .aab to Internal testing
4. Ads                AdMob app + rewarded unit → ids → verification → rebuild
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
- **Google AdMob**: free at [admob.google.com](https://admob.google.com). Add payment details there to get paid for ads.
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

1. **Play Console → Create app**: name `WhoOwes`, default language, **App**, **Free**. Accept the declarations.
2. **Testing → Internal testing → Create new release**. Download the `.aab` from the EAS build page and upload it. Keep **Play App Signing** on (the default); the EAS key becomes your upload key.
3. Add yourself under **Testers** (an email list), save, and roll out. Open the opt-in link on your phone and install from Play.

The first upload has to be done by hand like this. Later builds can go up with `npx eas-cli submit -p android` once you add a Google service account key to EAS.

Version codes are counted by EAS (`"autoIncrement": true` in `eas.json`), so every production build gets a new one automatically.

## 4. Rewarded ads (AdMob)

The server does the counting and timing (by its own clock, so changing the phone's date does nothing). AdMob only supplies the ads.

### 4a. Create the app and the ad unit

1. [AdMob](https://admob.google.com) → **Apps → Add app** → Android, "Is the app listed on a supported app store?" **No** for now (link it to the Play listing once it's live). Name it WhoOwes.
2. Copy the **App ID** (`ca-app-pub-…~…`, App settings).
3. **Ad units → Add ad unit → Rewarded**. Name it "Unlock AI use". Reward: amount `1`, item `ai_use`. Copy the **ad unit ID** (`ca-app-pub-…/…`).
4. **Privacy & messaging → GDPR** (and **US state regulations**): create the consent messages and publish them. The app shows them by itself before the first ad where the law requires it.

### 4b. Server-side verification (stops faked ad views)

1. Edit the rewarded ad unit → **Server-side verification** → callback URL `https://whoowes-api-nbi9.onrender.com/ai/ad/ssv` → **Verify URL**, then save.
2. On Render, set `ADMOB_SSV_REQUIRED` to `true`. From then on an ad only unlocks a use after Google confirms it was watched *and* 30 seconds have passed on the server.

Until this is on, the server's 30-second timer is the only check.

### 4c. Ids into the build

```bash
npx eas-cli env:create --name ADMOB_ANDROID_APP_ID --value "ca-app-pub-XXXX~YYYY" --environment production --visibility plaintext
```

and add the ad unit id to the `production` profile's `env` in `eas.json`:

```json
"EXPO_PUBLIC_ADMOB_REWARDED_ANDROID": "ca-app-pub-XXXX/ZZZZ"
```

Then rebuild. Builds without these show Google's test ads (and earn nothing). Development builds always show test ads, so you never click your own real ads (AdMob bans accounts for that).

### 4d. Check it

Install from Internal testing, use a receipt scan 3 times, then try a 4th: the "Watch a 30-second ad" sheet appears, the ad plays, and the scan carries on. **Account** shows the counts and when they reset.

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
> • No banner ads: a short ad only plays if you choose to unlock more AI
>
> FREE, WITH AI WHEN YOU WANT IT
> Unlimited expenses, friends and groups, and CSV export, all free. Every AI feature (receipt scans, Quick Add like "Tacos 64 with Sam and Priya", the Split Assistant and monthly spending summaries) has 3 free uses a month. Need more? Watch a short ad to unlock another.
>
> WhoOwes records who owes what. It doesn't move money or connect to your bank.

**Graphics**:
- App icon: `assets/store/play-icon-512.png`
- Feature graphic: `assets/store/feature-graphic.png` (regenerate both with `npm run store-assets`)
- Phone screenshots: 2 to 8, taken on your phone from the real app. Good ones: Home with balances, a group, the receipt scan result, settle up, the AI uses card in Account. Use the sample data account, not real friends' names and numbers.

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
| Ads | **Yes, my app contains ads** (rewarded ads only, shown when the user asks for one). |
| Content rating | Fill in the questionnaire honestly. Category: **Utility, productivity, communication or other**. WhoOwes has no violence, sexual content, gambling or drugs. Users can share content with friends (names, expenses, reminders), and the app shows optional rewarded ads. |
| Target audience | **18 and over** |
| News app | No |
| Health apps | No health features |
| Financial features | WhoOwes doesn't lend, bank, invest, or move money. Declare that it provides none of the listed financial features. |
| Government app | No |
| Advertising ID | **Yes**: the Google Mobile Ads SDK uses it for ads (and fraud prevention). The build already declares the `AD_ID` permission. |
| Data safety | See below |
| Account deletion | In-app: Account → Delete account. Web link: `https://whoowes-api-nbi9.onrender.com/delete-account` |

### Data safety answers

**Does your app collect or share user data?** Yes. **Is all data encrypted in transit?** Yes. **Can users request deletion?** Yes.

Services that work for you (Twilio, Anthropic, MongoDB, Render) count as **service providers, not sharing**. The ad SDK is different: what it collects is listed separately below, following [Google's AdMob Data safety guidance](https://developers.google.com/admob/android/privacy/play-data-disclosure).

| Data type | Collected | Required? | Processed ephemerally? | Purposes |
|---|---|---|---|---|
| Personal info → **Name** | Yes | Required | No | App functionality, Account management |
| Personal info → **Email address** | Yes | Optional | No | App functionality, Account management |
| Personal info → **Phone number** | Yes | Required | No | App functionality, Account management, Fraud prevention & security |
| Personal info → **User IDs** | Yes | Required | No | App functionality, Account management |
| Financial info → **Other financial info** (expenses, balances, payments between friends) | Yes | Required | No | App functionality |
| Photos and videos → **Photos** (receipt photos) | Yes | Optional | **Yes**: sent to the AI to read and not stored | App functionality |
| Files and docs (receipt PDFs) | Yes | Optional | **Yes** | App functionality |
| Contacts | Yes | Optional | **Yes**: hashed numbers are compared and not stored | App functionality |
| App activity → **Other user-generated content** (Quick Add text, expense notes) | Yes | Optional | No | App functionality |

Collected by the **Google Mobile Ads SDK** (when someone watches an ad). Check these against Google's page above before submitting, as it's the source of truth:

| Data type | Collected | Shared | Purposes |
|---|---|---|---|
| Location → **Approximate location** (from IP address) | Yes | Yes | Advertising or marketing, Analytics, Fraud prevention |
| Device or other IDs (**advertising ID**, app set ID) | Yes | Yes | Advertising or marketing, Analytics, Fraud prevention |
| App activity → **App interactions** (ad views and taps) | Yes | Yes | Advertising or marketing, Analytics |
| App info and performance → **Diagnostics**, **Crash logs** (SDK performance) | Yes | Yes | Analytics, Fraud prevention |

Not collected by WhoOwes itself: precise location, web browsing, messages, audio, health, calendar. If you add other analytics or crash reporting, update this form.

## 7. Testing tracks

1. **Internal testing** (up to 100 people, no review): use it for your own checks.
2. **Closed testing**: create a track, add at least **12 testers** (an email list or a Google Group), and roll out a build. Google reviews this one, which typically takes a few days.
   - Testers must **opt in** through the link and **keep the app installed**. New personal accounts need 12 opted-in testers for **14 days in a row**.
   - Testers need real phone numbers that can receive texts (Twilio upgraded, see step 1).
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
| "Couldn't load an ad" | New AdMob accounts and ad units can take a few hours to serve ads, and fill is lower in some countries. Test ads always load. Check the ad unit id in `eas.json`. |
| The ad finished but nothing unlocked | With `ADMOB_SSV_REQUIRED=true` the unlock waits for Google's callback: check the ad unit's verification URL and Render's logs for `[ads]`. `/health` → `adVerification` shows which check is on. |
| Only test ads in the store build | `ADMOB_ANDROID_APP_ID` (EAS environment) or `EXPO_PUBLIC_ADMOB_REWARDED_ANDROID` (`eas.json`) is missing. Add them and rebuild. |
| Reviewer can't sign in | `/health` → `reviewLogin` must be `true`, and the instructions must say to pick **+1 (United States)**. |
