/**
 * Public pages the app stores require as web links:
 *
 *   GET /privacy          → privacy policy
 *   GET /terms            → terms of service
 *   GET /delete-account   → how to delete your account and data (Google Play "Data deletion")
 *
 * The wording is a starting point written from what this server actually does.
 * Have it checked before you rely on it; it isn't legal advice.
 */

import { Router } from 'express';
import { env } from '../env.js';

export const legalRouter = Router();

const UPDATED = 'October 27, 2026';

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function contact() {
  const email = env.SUPPORT_EMAIL ? escapeHtml(env.SUPPORT_EMAIL) : '';
  return email ? `<a href="mailto:${email}">${email}</a>` : '<em>(support email not set yet)</em>';
}

function page(title: string, body: string) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · WhoOwes</title>
<style>
  :root { --bg: #f6f5fb; --card: #ffffff; --text: #1b1838; --muted: #5d5a78; --accent: #5b4cf5; --border: #e4e2f0; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #0e0c1d; --card: #17142c; --text: #ecebf7; --muted: #a7a4c2; --accent: #9d93ff; --border: #2a2647; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 720px; margin: 0 auto; padding: 32px 16px 64px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 24px; }
  h1 { font-size: 28px; line-height: 1.2; margin: 0 0 4px; }
  h2 { font-size: 19px; margin: 28px 0 8px; }
  p, li { color: var(--text); }
  .muted { color: var(--muted); font-size: 14px; }
  a { color: var(--accent); }
  ul, ol { padding-left: 22px; }
  nav { margin-top: 24px; font-size: 14px; display: flex; gap: 16px; flex-wrap: wrap; }
</style>
</head>
<body>
<main>
<div class="card">
${body}
</div>
<nav><a href="/privacy">Privacy policy</a><a href="/terms">Terms of service</a><a href="/delete-account">Delete your account</a></nav>
</main>
</body>
</html>`;
}

legalRouter.get('/privacy', (_req, res) => {
  res.type('html').send(
    page(
      'Privacy policy',
      `<h1>Privacy policy</h1>
<p class="muted">Last updated ${UPDATED}</p>

<p>WhoOwes helps friends keep track of shared expenses and who owes whom. This page explains what information the app collects, why, who else handles it, and how to delete it.</p>

<h2>What we collect</h2>
<ul>
  <li><strong>Your phone number</strong>, to sign you in with a text message code and so friends can find you.</li>
  <li><strong>Your name</strong>, and an <strong>email address</strong> if you choose to add one.</li>
  <li><strong>What you put into the app</strong>: friends, groups, expenses, amounts, payments between friends, and payment reminders.</li>
  <li><strong>Receipts and Quick Add text.</strong> When you scan a receipt, the photo or PDF is sent to our AI provider to read the items and prices. We keep the items it read, not the photo. When you use Quick Add, we keep the text you typed.</li>
  <li><strong>Subscription status</strong>: which plan you have and when it renews. Card and bank details are handled by Google Play (or Apple, or Stripe on the web) and never reach us.</li>
  <li><strong>How many AI scans you used</strong> this month, to apply your plan's limits.</li>
</ul>

<h2>Contacts</h2>
<p>If you choose <em>Find friends from contacts</em>, the phone numbers in your address book are scrambled on your phone (with a one-way hash, SHA-256) before anything is sent. We compare those scrambled values with WhoOwes accounts to show which contacts already use the app, and we don't store them. Names and other contact details never leave your phone, and we never message your contacts.</p>

<h2>What we don't do</h2>
<ul>
  <li>We don't sell your information or share it for advertising.</li>
  <li>The app has no ads and no third-party analytics or tracking.</li>
  <li>WhoOwes records who owes what; it doesn't move money or connect to your bank.</li>
</ul>

<h2>Who else handles your data</h2>
<p>We use these services to run WhoOwes. Each only gets what it needs for its job:</p>
<ul>
  <li><strong>Twilio</strong>: sends your sign-in codes (gets your phone number).</li>
  <li><strong>Anthropic</strong>: the AI that reads receipts and Quick Add text. Anthropic doesn't use this data to train its models.</li>
  <li><strong>MongoDB Atlas</strong> (hosted on Amazon Web Services in the United States): our database.</li>
  <li><strong>Render</strong> (United States): runs our server.</li>
  <li><strong>Google Play, Apple and RevenueCat</strong>: handle subscriptions bought in the app. <strong>Stripe</strong> handles subscriptions bought on the web.</li>
</ul>
<p>Your information is stored in the United States. All connections are encrypted (HTTPS).</p>

<h2>What other people see</h2>
<p>Friends and people in your groups see your name and the expenses and payments you share with them. People can find you by your exact phone number or email address, or by name if you're in a group together.</p>

<h2>How long we keep it</h2>
<p>We keep your information while you have an account. When you delete your account, we remove your name, phone number, email, friends list, reminders, receipt readings and Quick Add text right away. Expenses and payments you shared with others stay in their history, shown as "Deleted user", so their balances stay correct. Subscription records may be kept as long as tax and accounting rules require.</p>

<h2>Deleting your account</h2>
<p>In the app, open <strong>Account → Delete account</strong>. You can also ask us by email. See <a href="/delete-account">how to delete your account</a>.</p>

<h2>Children</h2>
<p>WhoOwes is meant for adults and isn't directed at children.</p>

<h2>Changes</h2>
<p>If we change this policy, we'll update the date at the top and, for significant changes, tell you in the app.</p>

<h2>Contact</h2>
<p>Questions or requests: ${contact()}</p>`,
    ),
  );
});

legalRouter.get('/terms', (_req, res) => {
  res.type('html').send(
    page(
      'Terms of service',
      `<h1>Terms of service</h1>
<p class="muted">Last updated ${UPDATED}</p>

<p>By using WhoOwes you agree to these terms. If you don't agree, please don't use the app.</p>

<h2>What WhoOwes is</h2>
<p>WhoOwes is a record-keeping tool for shared expenses. It works out who owes whom based on what you and your friends enter. It doesn't hold, send or receive money; payments between friends happen outside the app, and marking a payment in WhoOwes only records it.</p>

<h2>Your account</h2>
<ul>
  <li>You need a phone number that can receive text messages, and you must be an adult.</li>
  <li>Keep your phone secure: anyone who can read your texts can sign in as you.</li>
  <li>Use your real name so friends can recognise you.</li>
</ul>

<h2>Fair use</h2>
<p>Don't use WhoOwes to harass anyone, send unwanted reminders, enter other people's information without good reason, break the law, or interfere with the service (for example by automated sign-ups or overloading it). We may suspend accounts that do.</p>

<h2>AI features</h2>
<p>Receipt scanning, Quick Add, the Split Assistant and spending insights use AI, which can make mistakes. Check amounts before you save an expense. You're responsible for what you save.</p>

<h2>Subscriptions</h2>
<ul>
  <li>WhoOwes Plus and Pro are optional subscriptions, billed monthly or yearly by Google Play (or Apple, or Stripe on the web) at the price shown before you buy.</li>
  <li>They renew automatically until cancelled. Cancel at least 24 hours before renewal in Google Play → <em>Payments &amp; subscriptions → Subscriptions</em> (or your Apple ID settings). You keep the plan until the end of the period you paid for.</li>
  <li>If a free trial is offered, you're charged when it ends unless you cancel before then.</li>
  <li>Refunds follow the store's refund policy.</li>
  <li>We may change prices for future billing periods; the store will tell you before a change applies.</li>
</ul>

<h2>The service</h2>
<p>We work to keep WhoOwes available and your data safe, but the app is provided "as is", without guarantees that it will always be available or error-free. We may change or discontinue features. To the extent the law allows, we aren't liable for indirect losses, or for disagreements between you and your friends about money.</p>

<h2>Ending your account</h2>
<p>You can delete your account at any time in <strong>Account → Delete account</strong>. Deleting the account doesn't cancel a Google Play or Apple subscription; cancel that in the store.</p>

<h2>Changes</h2>
<p>If we change these terms, we'll update the date at the top. Continuing to use the app after a change means you accept it.</p>

<h2>Contact</h2>
<p>${contact()}</p>`,
    ),
  );
});

legalRouter.get('/delete-account', (_req, res) => {
  res.type('html').send(
    page(
      'Delete your account',
      `<h1>Delete your WhoOwes account</h1>
<p class="muted">WhoOwes</p>

<h2>In the app (fastest)</h2>
<ol>
  <li>Open WhoOwes and, on the Home screen, tap your profile picture (top right) to open <strong>Account</strong>.</li>
  <li>Scroll to the bottom and tap <strong>Delete account</strong>, then confirm.</li>
</ol>
<p>Your account is deleted immediately.</p>

<h2>Without the app</h2>
<p>Email ${contact()} from any address, with the phone number you signed in with. We'll confirm by text message to that number before deleting, and finish within 30 days.</p>

<h2>What gets deleted</h2>
<ul>
  <li>Your name, phone number and email address</li>
  <li>Your friends list and payment reminders</li>
  <li>Receipt readings and Quick Add text</li>
  <li>Your membership of groups</li>
</ul>

<h2>What stays</h2>
<ul>
  <li>Expenses and payments you shared with other people stay in their history, shown as "Deleted user", so their balances remain correct. They no longer include your name or number.</li>
  <li>Subscription records may be kept as long as tax and accounting rules require.</li>
</ul>

<h2>Subscriptions</h2>
<p>Deleting your account doesn't cancel a subscription bought through Google Play or Apple. Cancel it first in Google Play → <em>Payments &amp; subscriptions → Subscriptions</em> (or your Apple ID settings).</p>`,
    ),
  );
});
