/**
 * Translated error messages. Routes throw (or send) the English text; the
 * response layer swaps in the user's language from the Accept-Language header.
 * Placeholders like {plan} are filled from the error's `params`.
 */

import type { Request } from 'express';

export type Lang = 'en' | 'fr' | 'es' | 'hi';
const SUPPORTED: Lang[] = ['en', 'fr', 'es', 'hi'];

export const LANGUAGE_NAMES: Record<Lang, string> = { en: 'English', fr: 'French', es: 'Spanish', hi: 'Hindi' };

/** First supported language in Accept-Language ("fr-CA,fr;q=0.9,en;q=0.8" → fr). */
export function langOf(req: Request): Lang {
  const header = req.headers['accept-language'];
  if (!header) return 'en';
  const tags = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { tag: tag.toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of tags) {
    const base = tag.split('-')[0] as Lang;
    if (SUPPORTED.includes(base)) return base;
  }
  return 'en';
}

type Translations = Record<Exclude<Lang, 'en'>, string>;

const MESSAGES: Record<string, Translations> = {
  // ── General ──
  'Something went wrong.': {
    fr: 'Une erreur est survenue.',
    es: 'Algo salió mal.',
    hi: 'कुछ गड़बड़ हो गई।',
  },
  'Not found': { fr: 'Introuvable', es: 'No encontrado', hi: 'नहीं मिला' },
  'Invalid request': { fr: 'Requête invalide', es: 'Solicitud no válida', hi: 'अमान्य अनुरोध' },
  'Please sign in again.': {
    fr: 'Veuillez vous reconnecter.',
    es: 'Vuelve a iniciar sesión.',
    hi: 'कृपया फिर से साइन इन करें।',
  },
  'Too many attempts. Please wait a few minutes and try again.': {
    fr: 'Trop de tentatives. Patientez quelques minutes puis réessayez.',
    es: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
    hi: 'बहुत ज़्यादा कोशिशें हो गईं। कुछ मिनट रुककर फिर कोशिश करें।',
  },
  'Too many attempts. Please wait {minutes} min and try again.': {
    fr: 'Trop de tentatives. Patientez {minutes} min puis réessayez.',
    es: 'Demasiados intentos. Espera {minutes} min y vuelve a intentarlo.',
    hi: 'बहुत ज़्यादा कोशिशें हो गईं। {minutes} मिनट रुककर फिर कोशिश करें।',
  },
  'Too many wrong codes. Ask for a new code and try again.': {
    fr: 'Trop de codes incorrects. Demandez un nouveau code puis réessayez.',
    es: 'Demasiados códigos incorrectos. Pide un código nuevo y vuelve a intentarlo.',
    hi: 'बहुत ज़्यादा गलत कोड। नया कोड मँगाकर फिर कोशिश करें।',
  },
  'Too many requests. Please wait a minute.': {
    fr: 'Trop de requêtes. Patientez une minute.',
    es: 'Demasiadas solicitudes. Espera un minuto.',
    hi: 'बहुत ज़्यादा अनुरोध। एक मिनट रुकें।',
  },

  // ── Phone sign-in ──
  'Phone sign-in is not set up on this server yet.': {
    fr: 'La connexion par téléphone n’est pas encore configurée sur ce serveur.',
    es: 'El inicio de sesión con teléfono aún no está configurado en este servidor.',
    hi: 'इस सर्वर पर फ़ोन से साइन इन अभी सेट अप नहीं है।',
  },
  "That phone number doesn't look right.": {
    fr: 'Ce numéro de téléphone ne semble pas valide.',
    es: 'Ese número de teléfono no parece correcto.',
    hi: 'यह फ़ोन नंबर सही नहीं लग रहा।',
  },
  "We couldn't send a code right now. Please try again.": {
    fr: 'Impossible d’envoyer un code pour le moment. Réessayez.',
    es: 'No pudimos enviar un código ahora. Inténtalo de nuevo.',
    hi: 'अभी कोड नहीं भेज सके। कृपया फिर कोशिश करें।',
  },
  "We couldn't check that code. Please try again.": {
    fr: 'Impossible de vérifier ce code. Réessayez.',
    es: 'No pudimos comprobar ese código. Inténtalo de nuevo.',
    hi: 'यह कोड जाँच नहीं सके। कृपया फिर कोशिश करें।',
  },
  "That code isn't right. Check the text and try again.": {
    fr: 'Ce code est incorrect. Vérifiez le SMS et réessayez.',
    es: 'Ese código no es correcto. Revisa el SMS e inténtalo de nuevo.',
    hi: 'यह कोड सही नहीं है। मैसेज देखकर फिर कोशिश करें।',
  },
  'Tell us your name to finish signing up.': {
    fr: 'Indiquez votre nom pour terminer l’inscription.',
    es: 'Dinos tu nombre para terminar el registro.',
    hi: 'साइन अप पूरा करने के लिए अपना नाम बताएं।',
  },

  // ── Friends ──
  'No WhoOwes account for {who}. Send them an invite instead.': {
    fr: 'Aucun compte WhoOwes pour {who}. Envoyez-lui plutôt une invitation.',
    es: 'No hay ninguna cuenta de WhoOwes para {who}. Envíale una invitación.',
    hi: '{who} का कोई WhoOwes खाता नहीं है। उन्हें न्योता भेजें।',
  },
  'Who do you want to add?': {
    fr: 'Qui voulez-vous ajouter ?',
    es: '¿A quién quieres añadir?',
    hi: 'आप किसे जोड़ना चाहते हैं?',
  },
  "That's you!": { fr: 'C’est vous !', es: '¡Ese eres tú!', hi: 'यह तो आप हैं!' },
  'That person is not on WhoOwes.': {
    fr: 'Cette personne n’est pas sur WhoOwes.',
    es: 'Esa persona no está en WhoOwes.',
    hi: 'यह व्यक्ति WhoOwes पर नहीं है।',
  },
  'You are already friends.': {
    fr: 'Vous êtes déjà amis.',
    es: 'Ya son amigos.',
    hi: 'आप पहले से दोस्त हैं।',
  },
  'Request already sent.': {
    fr: 'Demande déjà envoyée.',
    es: 'Solicitud ya enviada.',
    hi: 'अनुरोध पहले ही भेजा जा चुका है।',
  },
  'That request changed. Refresh and try again.': {
    fr: 'Cette demande a changé. Actualisez et réessayez.',
    es: 'Esa solicitud ha cambiado. Actualiza e inténtalo de nuevo.',
    hi: 'यह अनुरोध बदल गया है। रीफ़्रेश करके फिर कोशिश करें।',
  },
  'Request not found.': {
    fr: 'Demande introuvable.',
    es: 'Solicitud no encontrada.',
    hi: 'अनुरोध नहीं मिला।',
  },
  'You can only remind friends or people in your groups.': {
    fr: 'Vous ne pouvez relancer que vos amis ou les membres de vos groupes.',
    es: 'Solo puedes recordar a amigos o a personas de tus grupos.',
    hi: 'आप सिर्फ़ दोस्तों या अपने ग्रुप के लोगों को याद दिला सकते हैं।',
  },
  'You already sent a reminder today. Give them a little time.': {
    fr: 'Vous avez déjà envoyé un rappel aujourd’hui. Laissez-lui un peu de temps.',
    es: 'Ya enviaste un recordatorio hoy. Dale un poco de tiempo.',
    hi: 'आज आप पहले ही याद दिला चुके हैं। उन्हें थोड़ा समय दें।',
  },

  // ── Groups ──
  'Group not found.': { fr: 'Groupe introuvable.', es: 'Grupo no encontrado.', hi: 'ग्रुप नहीं मिला।' },
  'You can only add friends to a group.': {
    fr: 'Vous ne pouvez ajouter que des amis à un groupe.',
    es: 'Solo puedes añadir amigos a un grupo.',
    hi: 'ग्रुप में सिर्फ़ दोस्तों को जोड़ा जा सकता है।',
  },
  'You can only add your friends.': {
    fr: 'Vous ne pouvez ajouter que vos amis.',
    es: 'Solo puedes añadir a tus amigos.',
    hi: 'आप सिर्फ़ अपने दोस्तों को जोड़ सकते हैं।',
  },
  'Already in this group.': {
    fr: 'Déjà dans ce groupe.',
    es: 'Ya está en este grupo.',
    hi: 'पहले से इस ग्रुप में हैं।',
  },
  'Only group admins can remove people.': {
    fr: 'Seuls les administrateurs du groupe peuvent retirer des membres.',
    es: 'Solo los administradores del grupo pueden quitar a personas.',
    hi: 'सिर्फ़ ग्रुप एडमिन लोगों को हटा सकते हैं।',
  },
  'Only group admins can delete the group.': {
    fr: 'Seuls les administrateurs peuvent supprimer le groupe.',
    es: 'Solo los administradores pueden eliminar el grupo.',
    hi: 'सिर्फ़ ग्रुप एडमिन ग्रुप हटा सकते हैं।',
  },

  // ── Expenses ──
  'Expense not found.': { fr: 'Dépense introuvable.', es: 'Gasto no encontrado.', hi: 'खर्च नहीं मिला।' },
  'Each person can only appear once in the split.': {
    fr: 'Chaque personne ne peut apparaître qu’une fois dans le partage.',
    es: 'Cada persona solo puede aparecer una vez en la división.',
    hi: 'बँटवारे में हर व्यक्ति सिर्फ़ एक बार आ सकता है।',
  },
  'You can only add expenses you are part of.': {
    fr: 'Vous ne pouvez ajouter que des dépenses qui vous concernent.',
    es: 'Solo puedes añadir gastos en los que participas.',
    hi: 'आप सिर्फ़ वही खर्च जोड़ सकते हैं जिनमें आप शामिल हैं।',
  },
  'Everyone in the split must be in the group.': {
    fr: 'Toutes les personnes du partage doivent faire partie du groupe.',
    es: 'Todas las personas de la división deben estar en el grupo.',
    hi: 'बँटवारे में शामिल सभी लोग ग्रुप में होने चाहिए।',
  },
  'You can only split with friends or people in your groups.': {
    fr: 'Vous ne pouvez partager qu’avec vos amis ou les membres de vos groupes.',
    es: 'Solo puedes dividir con amigos o con personas de tus grupos.',
    hi: 'आप सिर्फ़ दोस्तों या अपने ग्रुप के लोगों के साथ बाँट सकते हैं।',
  },
  'The split amounts don’t add up to the total.': {
    fr: 'Les montants du partage ne correspondent pas au total.',
    es: 'Los importes de la división no suman el total.',
    hi: 'बँटवारे की रकम कुल रकम के बराबर नहीं है।',
  },
  'Receipt not found.': { fr: 'Reçu introuvable.', es: 'Recibo no encontrado.', hi: 'रसीद नहीं मिली।' },
  'Only the person who added or paid for this can delete it.': {
    fr: 'Seule la personne qui l’a ajoutée ou payée peut la supprimer.',
    es: 'Solo quien lo añadió o lo pagó puede eliminarlo.',
    hi: 'इसे सिर्फ़ वही हटा सकता है जिसने इसे जोड़ा या भुगतान किया।',
  },
  'Only the payer or that person can mark this paid.': {
    fr: 'Seul le payeur ou cette personne peut marquer ceci comme payé.',
    es: 'Solo quien pagó o esa persona pueden marcarlo como pagado.',
    hi: 'इसे सिर्फ़ भुगतान करने वाला या वही व्यक्ति चुकाया हुआ मार्क कर सकता है।',
  },

  // ── Payments ──
  'Payment not found.': { fr: 'Paiement introuvable.', es: 'Pago no encontrado.', hi: 'भुगतान नहीं मिला।' },
  "You can't pay yourself.": {
    fr: 'Vous ne pouvez pas vous payer vous-même.',
    es: 'No puedes pagarte a ti mismo.',
    hi: 'आप खुद को भुगतान नहीं कर सकते।',
  },
  'They are not in this group.': {
    fr: 'Cette personne n’est pas dans ce groupe.',
    es: 'Esa persona no está en este grupo.',
    hi: 'वे इस ग्रुप में नहीं हैं।',
  },
  'You can only pay friends or people in your groups.': {
    fr: 'Vous ne pouvez payer que vos amis ou les membres de vos groupes.',
    es: 'Solo puedes pagar a amigos o a personas de tus grupos.',
    hi: 'आप सिर्फ़ दोस्तों या अपने ग्रुप के लोगों को भुगतान कर सकते हैं।',
  },
  'Only the person being paid can confirm this.': {
    fr: 'Seule la personne qui reçoit le paiement peut le confirmer.',
    es: 'Solo quien recibe el pago puede confirmarlo.',
    hi: 'इसे सिर्फ़ पैसे पाने वाला ही पुष्टि कर सकता है।',
  },
  'This payment is already confirmed.': {
    fr: 'Ce paiement est déjà confirmé.',
    es: 'Este pago ya está confirmado.',
    hi: 'यह भुगतान पहले ही पुष्टि हो चुका है।',
  },
  'This payment was already declined.': {
    fr: 'Ce paiement a déjà été refusé.',
    es: 'Este pago ya fue rechazado.',
    hi: 'यह भुगतान पहले ही अस्वीकार हो चुका है।',
  },
  'This payment was already answered.': {
    fr: 'Ce paiement a déjà reçu une réponse.',
    es: 'Este pago ya se respondió.',
    hi: 'इस भुगतान का जवाब पहले ही दिया जा चुका है।',
  },
  'Only the sender can cancel.': {
    fr: 'Seul l’expéditeur peut annuler.',
    es: 'Solo quien lo envió puede cancelarlo.',
    hi: 'सिर्फ़ भेजने वाला ही रद्द कर सकता है।',
  },
  'Only pending payments can be cancelled.': {
    fr: 'Seuls les paiements en attente peuvent être annulés.',
    es: 'Solo se pueden cancelar los pagos pendientes.',
    hi: 'सिर्फ़ बाकी (पेंडिंग) भुगतान ही रद्द किए जा सकते हैं।',
  },

  // ── AI ──
  'AI features are not set up on this server yet.': {
    fr: 'Les fonctions d’IA ne sont pas encore configurées sur ce serveur.',
    es: 'Las funciones de IA aún no están configuradas en este servidor.',
    hi: 'इस सर्वर पर AI सुविधाएं अभी सेट अप नहीं हैं।',
  },
  'The AI response was incomplete. Please try again.': {
    fr: 'La réponse de l’IA était incomplète. Réessayez.',
    es: 'La respuesta de la IA llegó incompleta. Inténtalo de nuevo.',
    hi: 'AI का जवाब अधूरा था। कृपया फिर कोशिश करें।',
  },
  'The AI is busy right now — try again in a moment.': {
    fr: 'L’IA est occupée — réessayez dans un instant.',
    es: 'La IA está ocupada ahora mismo; inténtalo en un momento.',
    hi: 'AI अभी व्यस्त है — थोड़ी देर में फिर कोशिश करें।',
  },
  "AI isn't set up correctly on the server (API key rejected).": {
    fr: 'L’IA est mal configurée sur le serveur (clé API refusée).',
    es: 'La IA no está bien configurada en el servidor (clave de API rechazada).',
    hi: 'सर्वर पर AI ठीक से सेट अप नहीं है (API कुंजी अस्वीकार हुई)।',
  },
  "The AI couldn't open that file. Try a clearer photo, or a PDF under 10 MB.": {
    fr: 'L’IA n’a pas pu ouvrir ce fichier. Essayez une photo plus nette ou un PDF de moins de 10 Mo.',
    es: 'La IA no pudo abrir ese archivo. Prueba con una foto más nítida o un PDF de menos de 10 MB.',
    hi: 'AI यह फ़ाइल नहीं खोल सका। साफ़ फ़ोटो या 10 MB से छोटी PDF आज़माएं।',
  },
  'The AI service had a problem. Please try again.': {
    fr: 'Le service d’IA a rencontré un problème. Réessayez.',
    es: 'El servicio de IA tuvo un problema. Inténtalo de nuevo.',
    hi: 'AI सेवा में समस्या आई। कृपया फिर कोशिश करें।',
  },
  'That photo is too large. Try again with a smaller image.': {
    fr: 'Cette photo est trop lourde. Réessayez avec une image plus petite.',
    es: 'Esa foto es demasiado grande. Prueba con una imagen más pequeña.',
    hi: 'यह फ़ोटो बहुत बड़ी है। छोटी फ़ोटो के साथ फिर कोशिश करें।',
  },
  'This needs WhoOwes {plan}.': {
    fr: 'Cette fonction nécessite WhoOwes {plan}.',
    es: 'Esto requiere WhoOwes {plan}.',
    hi: 'इसके लिए WhoOwes {plan} चाहिए।',
  },
  "You've used all {limit} AI scans on {plan} this month.": {
    fr: 'Vous avez utilisé vos {limit} scans IA du forfait {plan} ce mois-ci.',
    es: 'Has usado los {limit} escaneos con IA de {plan} este mes.',
    hi: 'इस महीने आपने {plan} के सभी {limit} AI स्कैन इस्तेमाल कर लिए हैं।',
  },

  // ── Billing ──
  'Payments are not set up on this server yet.': {
    fr: 'Les paiements ne sont pas encore configurés sur ce serveur.',
    es: 'Los pagos aún no están configurados en este servidor.',
    hi: 'इस सर्वर पर भुगतान अभी सेट अप नहीं हैं।',
  },
  'Payment provider error. Please try again.': {
    fr: 'Erreur du prestataire de paiement. Réessayez.',
    es: 'Error del proveedor de pagos. Inténtalo de nuevo.',
    hi: 'भुगतान सेवा में गड़बड़ी। कृपया फिर कोशिश करें।',
  },
  'App store subscriptions are not set up on this server yet.': {
    fr: 'Les abonnements via les boutiques d’applications ne sont pas encore configurés sur ce serveur.',
    es: 'Las suscripciones de las tiendas de apps aún no están configuradas en este servidor.',
    hi: 'इस सर्वर पर ऐप स्टोर सब्सक्रिप्शन अभी सेट अप नहीं हैं।',
  },
  "We couldn't check your subscription. Please try again.": {
    fr: 'Impossible de vérifier votre abonnement. Réessayez.',
    es: 'No pudimos comprobar tu suscripción. Inténtalo de nuevo.',
    hi: 'आपका सब्सक्रिप्शन जाँच नहीं सके। कृपया फिर कोशिश करें।',
  },
  'Your subscription is billed by the app store. Change it from the app on your phone.': {
    fr: 'Votre abonnement est facturé par la boutique d’applications. Modifiez-le depuis l’app sur votre téléphone.',
    es: 'Tu suscripción la cobra la tienda de apps. Cámbiala desde la app en tu teléfono.',
    hi: 'आपका सब्सक्रिप्शन ऐप स्टोर से बिल होता है। इसे अपने फ़ोन की ऐप से बदलें।',
  },
  'No billing account yet — pick a plan first.': {
    fr: 'Pas encore de compte de facturation — choisissez d’abord un forfait.',
    es: 'Aún no hay cuenta de facturación; elige primero un plan.',
    hi: 'अभी कोई बिलिंग खाता नहीं है — पहले एक प्लान चुनें।',
  },
};

const fill = (text: string, params?: Record<string, string | number>) =>
  params ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : text;

/** English text (or template) → the user's language. Unknown text passes through unchanged. */
export function translate(message: string, lang: Lang, params?: Record<string, string | number>): string {
  const translated = lang === 'en' ? message : (MESSAGES[message]?.[lang] ?? message);
  return fill(translated, params);
}

/** For tests: every message has all three translations. */
export const messageCount = () => Object.keys(MESSAGES).length;
