/**
 * Push notifications, sent through Expo's push service (which delivers to
 * Firebase Cloud Messaging on Android and APNs on iPhone).
 *
 * Routes call `notify([...])` after their write succeeds. It never throws and
 * never delays the response: failures are logged, and phones that were
 * uninstalled or signed out (DeviceNotRegistered) are forgotten.
 *
 * Each phone registers with its app language, so a French phone gets French text.
 */

import { db, type PushTokenDoc } from './db/index.js';
import { env } from './env.js';
import type { Lang } from './i18n.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100; // Expo's limit per request

/** Android channels created by the app: people can mute "social" and keep "money". */
type Channel = 'money' | 'social';

export type PushKind =
  | 'friend_request'
  | 'friend_accepted'
  | 'expense_owe'
  | 'expense_owed'
  | 'reminder'
  | 'payment_recorded'
  | 'payment_confirmed'
  | 'payment_declined'
  | 'added_to_group'
  | 'member_left'
  | 'removed_from_group'
  | 'group_deleted';

/** Matches PushData in the app (src/services/notifications.ts): tells a tap which screen to open. */
interface PushData {
  type:
    | 'friend_request'
    | 'friend_accepted'
    | 'expense_added'
    | 'reminder'
    | 'payment_recorded'
    | 'payment_confirmed'
    | 'payment_declined'
    | 'added_to_group'
    | 'member_left'
    | 'removed_from_group'
    | 'group_deleted';
  expenseId?: string;
  settlementId?: string;
  groupId?: string;
  userId?: string;
}

interface Params {
  /** The other person's name. */
  name: string;
  /** Expense title. */
  title?: string;
  /** Group name. */
  group?: string;
  /** Money, in cents, with its currency. */
  cents?: number | null;
  currency?: string | null;
  /** Which way money is still open with the other person. */
  dir?: 'owesYou' | 'youOwe';
}

export interface PushItem {
  userId: string;
  kind: PushKind;
  params: Params;
  data: PushData;
}

// ─── Text ────────────────────────────────────────────────────────────────────

const LOCALES: Record<Lang, string> = { en: 'en-US', fr: 'fr-FR', es: 'es-ES', hi: 'hi-IN' };

function money(cents: number, currency: string, lang: Lang) {
  try {
    return new Intl.NumberFormat(LOCALES[lang], { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

type Text = { title: string; body: string };
type Writer = (p: Params & { amount: string }) => Text;

const TEXT: Record<PushKind, Record<Lang, Writer>> = {
  friend_request: {
    en: (p) => ({ title: 'New friend request', body: `${p.name} wants to be friends on WhoOwes.` }),
    fr: (p) => ({ title: 'Nouvelle demande d’ami', body: `${p.name} veut être votre ami sur WhoOwes.` }),
    es: (p) => ({ title: 'Nueva solicitud de amistad', body: `${p.name} quiere ser tu amigo en WhoOwes.` }),
    hi: (p) => ({ title: 'दोस्ती का नया अनुरोध', body: `${p.name} WhoOwes पर आपसे दोस्ती करना चाहते हैं।` }),
  },
  friend_accepted: {
    en: (p) => ({ title: `${p.name} accepted your request`, body: 'You can now split expenses together.' }),
    fr: (p) => ({ title: `${p.name} a accepté votre demande`, body: 'Vous pouvez maintenant partager vos dépenses.' }),
    es: (p) => ({ title: `${p.name} aceptó tu solicitud`, body: 'Ya pueden dividir gastos juntos.' }),
    hi: (p) => ({ title: `${p.name} ने आपका अनुरोध स्वीकार किया`, body: 'अब आप साथ में ख़र्चे बाँट सकते हैं।' }),
  },
  expense_owe: {
    en: (p) => ({ title: `${p.name} added “${p.title}”`, body: `You owe ${p.amount}${p.group ? ` · ${p.group}` : ''}` }),
    fr: (p) => ({ title: `${p.name} a ajouté « ${p.title} »`, body: `Vous devez ${p.amount}${p.group ? ` · ${p.group}` : ''}` }),
    es: (p) => ({ title: `${p.name} añadió “${p.title}”`, body: `Debes ${p.amount}${p.group ? ` · ${p.group}` : ''}` }),
    hi: (p) => ({ title: `${p.name} ने “${p.title}” जोड़ा`, body: `आपको ${p.amount} देने हैं${p.group ? ` · ${p.group}` : ''}` }),
  },
  expense_owed: {
    en: (p) => ({ title: `${p.name} added “${p.title}”`, body: `You paid. You get back ${p.amount}${p.group ? ` · ${p.group}` : ''}` }),
    fr: (p) => ({ title: `${p.name} a ajouté « ${p.title} »`, body: `Vous avez payé. On vous doit ${p.amount}${p.group ? ` · ${p.group}` : ''}` }),
    es: (p) => ({ title: `${p.name} añadió “${p.title}”`, body: `Pagaste tú. Te deben ${p.amount}${p.group ? ` · ${p.group}` : ''}` }),
    hi: (p) => ({ title: `${p.name} ने “${p.title}” जोड़ा`, body: `भुगतान आपने किया। आपको ${p.amount} वापस मिलेंगे${p.group ? ` · ${p.group}` : ''}` }),
  },
  reminder: {
    en: (p) => ({ title: `${p.name} sent you a reminder`, body: p.amount ? `You owe them ${p.amount}. Tap to settle up.` : 'Time to settle up. Tap to see what you owe.' }),
    fr: (p) => ({ title: `${p.name} vous a envoyé un rappel`, body: p.amount ? `Vous lui devez ${p.amount}. Touchez pour régler.` : 'Il est temps de régler. Touchez pour voir ce que vous devez.' }),
    es: (p) => ({ title: `${p.name} te envió un recordatorio`, body: p.amount ? `Le debes ${p.amount}. Toca para saldar.` : 'Es hora de saldar cuentas. Toca para ver lo que debes.' }),
    hi: (p) => ({ title: `${p.name} ने आपको याद दिलाया`, body: p.amount ? `आपको उन्हें ${p.amount} देने हैं। चुकाने के लिए टैप करें।` : 'हिसाब चुकाने का समय है। देखने के लिए टैप करें।' }),
  },
  payment_recorded: {
    en: (p) => ({ title: `${p.name} paid you ${p.amount}`, body: 'Tap to confirm you received it.' }),
    fr: (p) => ({ title: `${p.name} vous a payé ${p.amount}`, body: 'Touchez pour confirmer la réception.' }),
    es: (p) => ({ title: `${p.name} te pagó ${p.amount}`, body: 'Toca para confirmar que lo recibiste.' }),
    hi: (p) => ({ title: `${p.name} ने आपको ${p.amount} दिए`, body: 'मिलने की पुष्टि करने के लिए टैप करें।' }),
  },
  payment_confirmed: {
    en: (p) => ({ title: `${p.name} confirmed your payment`, body: `Your ${p.amount} payment is settled.` }),
    fr: (p) => ({ title: `${p.name} a confirmé votre paiement`, body: `Votre paiement de ${p.amount} est réglé.` }),
    es: (p) => ({ title: `${p.name} confirmó tu pago`, body: `Tu pago de ${p.amount} quedó saldado.` }),
    hi: (p) => ({ title: `${p.name} ने आपके भुगतान की पुष्टि की`, body: `आपका ${p.amount} का भुगतान पूरा हुआ।` }),
  },
  payment_declined: {
    en: (p) => ({ title: `${p.name} declined your payment`, body: `They didn’t confirm your ${p.amount} payment. Check with them.` }),
    fr: (p) => ({ title: `${p.name} a refusé votre paiement`, body: `Votre paiement de ${p.amount} n’a pas été confirmé. Voyez avec cette personne.` }),
    es: (p) => ({ title: `${p.name} rechazó tu pago`, body: `No confirmó tu pago de ${p.amount}. Consúltalo con esa persona.` }),
    hi: (p) => ({ title: `${p.name} ने आपका भुगतान अस्वीकार किया`, body: `आपके ${p.amount} के भुगतान की पुष्टि नहीं हुई। उनसे बात करें।` }),
  },
  added_to_group: {
    en: (p) => ({ title: `You’re in “${p.group}”`, body: `${p.name} added you to the group.` }),
    fr: (p) => ({ title: `Vous êtes dans « ${p.group} »`, body: `${p.name} vous a ajouté au groupe.` }),
    es: (p) => ({ title: `Estás en “${p.group}”`, body: `${p.name} te añadió al grupo.` }),
    hi: (p) => ({ title: `आप “${p.group}” में हैं`, body: `${p.name} ने आपको ग्रुप में जोड़ा।` }),
  },
  member_left: {
    en: (p) => ({
      title: `${p.name} left “${p.group}”`,
      body: p.dir === 'owesYou' ? `They still owe you ${p.amount}. You can still settle up.` : p.dir === 'youOwe' ? `You still owe them ${p.amount}. You can still settle up.` : 'They won’t see new expenses in this group.',
    }),
    fr: (p) => ({
      title: `${p.name} a quitté « ${p.group} »`,
      body: p.dir === 'owesYou' ? `Cette personne vous doit encore ${p.amount}. Vous pouvez toujours régler.` : p.dir === 'youOwe' ? `Vous lui devez encore ${p.amount}. Vous pouvez toujours régler.` : 'Cette personne ne verra plus les nouvelles dépenses du groupe.',
    }),
    es: (p) => ({
      title: `${p.name} salió de “${p.group}”`,
      body: p.dir === 'owesYou' ? `Todavía te debe ${p.amount}. Aún pueden saldar cuentas.` : p.dir === 'youOwe' ? `Todavía le debes ${p.amount}. Aún pueden saldar cuentas.` : 'Ya no verá los nuevos gastos del grupo.',
    }),
    hi: (p) => ({
      title: `${p.name} ने “${p.group}” छोड़ दिया`,
      body: p.dir === 'owesYou' ? `उन पर अब भी आपके ${p.amount} बाकी हैं। आप अब भी हिसाब चुका सकते हैं।` : p.dir === 'youOwe' ? `आप पर अब भी उनके ${p.amount} बाकी हैं। आप अब भी हिसाब चुका सकते हैं।` : 'उन्हें इस ग्रुप के नए ख़र्चे नहीं दिखेंगे।',
    }),
  },
  removed_from_group: {
    en: (p) => ({ title: `${p.name} removed you from “${p.group}”`, body: 'Your past expenses and balances stay in your history.' }),
    fr: (p) => ({ title: `${p.name} vous a retiré de « ${p.group} »`, body: 'Vos dépenses et soldes passés restent dans votre historique.' }),
    es: (p) => ({ title: `${p.name} te quitó de “${p.group}”`, body: 'Tus gastos y saldos anteriores siguen en tu historial.' }),
    hi: (p) => ({ title: `${p.name} ने आपको “${p.group}” से हटा दिया`, body: 'आपके पिछले ख़र्चे और बकाया आपके इतिहास में रहेंगे।' }),
  },
  group_deleted: {
    en: (p) => ({ title: `${p.name} deleted “${p.group}”`, body: 'Its expenses and balances stay in your history.' }),
    fr: (p) => ({ title: `${p.name} a supprimé « ${p.group} »`, body: 'Ses dépenses et soldes restent dans votre historique.' }),
    es: (p) => ({ title: `${p.name} eliminó “${p.group}”`, body: 'Sus gastos y saldos siguen en tu historial.' }),
    hi: (p) => ({ title: `${p.name} ने “${p.group}” मिटा दिया`, body: 'इसके ख़र्चे और बकाया आपके इतिहास में रहेंगे।' }),
  },
};

const CHANNEL: Record<PushKind, Channel> = {
  friend_request: 'social',
  friend_accepted: 'social',
  added_to_group: 'social',
  member_left: 'social',
  removed_from_group: 'social',
  group_deleted: 'social',
  expense_owe: 'money',
  expense_owed: 'money',
  reminder: 'money',
  payment_recorded: 'money',
  payment_confirmed: 'money',
  payment_declined: 'money',
};

function write(item: PushItem, lang: Lang): Text {
  const { cents, currency } = item.params;
  const amount = cents && currency ? money(cents, currency, lang) : '';
  return TEXT[item.kind][lang]({ ...item.params, amount });
}

// ─── Sending ─────────────────────────────────────────────────────────────────

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: PushData;
  sound: 'default';
  channelId: Channel;
  priority: 'high' | 'default';
}

type Ticket = { status: 'ok'; id: string } | { status: 'error'; message: string; details?: { error?: string } };

async function sendBatch(messages: ExpoMessage[]) {
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
    },
    body: JSON.stringify(messages),
  });
  if (!res.ok) throw new Error(`Expo push ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const { data } = (await res.json()) as { data: Ticket[] };
  // Tickets come back in the same order as the messages.
  const gone = data
    .map((t, i) => (t.status === 'error' && t.details?.error === 'DeviceNotRegistered' ? messages[i].to : null))
    .filter((t): t is string => !!t);
  if (gone.length) await db.pushTokens.deleteMany({ _id: { $in: gone } });
  for (const t of data) {
    if (t.status === 'error' && t.details?.error !== 'DeviceNotRegistered') console.warn('[push] not sent:', t.message);
  }
}

async function send(items: PushItem[]) {
  if (!items.length) return;
  const tokens = await db.pushTokens.find({ userId: { $in: [...new Set(items.map((i) => i.userId))] } }).toArray();
  if (!tokens.length) return;
  const byUser = new Map<string, PushTokenDoc[]>();
  for (const tok of tokens) byUser.set(tok.userId, [...(byUser.get(tok.userId) ?? []), tok]);

  const messages: ExpoMessage[] = [];
  for (const item of items) {
    for (const tok of byUser.get(item.userId) ?? []) {
      const text = write(item, tok.lang);
      messages.push({
        to: tok._id,
        ...text,
        data: item.data,
        sound: 'default',
        channelId: CHANNEL[item.kind],
        priority: CHANNEL[item.kind] === 'money' ? 'high' : 'default',
      });
    }
  }
  for (let i = 0; i < messages.length; i += BATCH) await sendBatch(messages.slice(i, i + BATCH));
}

/** Sends in the background; never throws, never holds up the request. */
export function notify(items: PushItem[]): void {
  send(items).catch((err) => console.error('[push] failed:', err instanceof Error ? err.message : err));
}

/** First name of a user, for notification text ("Alex paid you…"). */
export async function nameOf(userId: string): Promise<string> {
  const u = await db.users.findOne({ _id: userId }, { projection: { name: 1 } });
  return (u?.name ?? 'Someone').trim().split(/\s+/)[0] || 'Someone';
}

export const isExpoPushToken = (token: string) => /^(Exponent|Expo)PushToken\[[^\]]+\]$/.test(token);
