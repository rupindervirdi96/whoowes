/**
 * AI routes. Every feature has a few free uses a month, then one use per watched
 * ad (see aiPass.ts). Counted here by the server's clock — never trust the client.
 *
 *   GET  /ai/pass                 what's left this month, per feature
 *   POST /ai/ad/start             { feature }    → { sessionId, adSeconds }
 *   POST /ai/ad/claim             { sessionId }  → the new pass status
 *   POST /ai/receipts/parse       receipt_scan
 *   POST /ai/expenses/quick-add   quick_add
 *   POST /ai/receipts/assign      split_assistant
 *   POST /ai/insights             insights (the same month's numbers again are free;
 *                                 { cachedOnly: true } only returns an earlier one, or null)
 *
 * GET /ai/ad/ssv (AdMob's signed callback) is public and mounted in index.ts.
 */

import { createHash, randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../auth.js';
import { db } from '../db/index.js';
import { route } from '../domain/common.js';
import { AI_FEATURES, claimAd, passStatus, startAd, takePass } from '../aiPass.js';
import { IMAGE_TYPES, assignItems, monthlyInsights, parseReceipt, quickAdd } from '../ai/claude.js';
import { langOf } from '../i18n.js';

export const aiRouter = Router();
aiRouter.use(requireUser);

const MAX_BASE64 = Math.ceil((10 * 1024 * 1024 * 4) / 3); // 10 MB file

// ─── Passes and ads ──────────────────────────────────────────────────────────

aiRouter.get(
  '/pass',
  route(async (req, res) => {
    res.json(await passStatus(req.user!.id));
  }),
);

aiRouter.post(
  '/ad/start',
  route(async (req, res) => {
    const { feature } = z.object({ feature: z.enum(AI_FEATURES as [string, ...string[]]) }).parse(req.body);
    res.json(await startAd(req.user!.id, feature as (typeof AI_FEATURES)[number]));
  }),
);

aiRouter.post(
  '/ad/claim',
  route(async (req, res) => {
    const { sessionId } = z.object({ sessionId: z.string().uuid() }).parse(req.body);
    res.json(await claimAd(req.user!.id, sessionId));
  }),
);

// ─── Features ────────────────────────────────────────────────────────────────

aiRouter.post(
  '/receipts/parse',
  route(async (req, res) => {
    const body = z
      .object({
        file: z.object({
          data: z.string().min(100).max(MAX_BASE64),
          mediaType: z.enum([...IMAGE_TYPES, 'application/pdf']),
        }),
        instructions: z.string().max(500).optional(),
        sourceType: z.enum(['camera', 'gallery', 'pdf']).default('gallery'),
        fileName: z.string().max(200).optional(),
      })
      .parse(req.body);
    // Claude accepts images up to 5 MB (PDFs up to 32 MB). The app shrinks photos
    // before upload; this catches anything that slipped through with a clear message.
    const bytes = Math.floor((body.file.data.length * 3) / 4);
    if (body.file.mediaType !== 'application/pdf' && bytes > 5 * 1024 * 1024) {
      return res.status(413).json({ message: 'That photo is too large. Try again with a smaller image.', code: 'file_too_large' });
    }
    const pass = await takePass(req.user!.id, 'receipt_scan');
    let receipt;
    try {
      receipt = await parseReceipt(body.file, body.instructions, langOf(req));
    } catch (err) {
      await pass.refund(); // a failed read doesn't use up a scan
      throw err;
    }
    // Keep the parsed result so the review screen can reload it and the expense can link to it.
    const receiptId = randomUUID();
    await db.receipts.insertOne({
      _id: receiptId,
      userId: req.user!.id,
      sourceType: body.sourceType,
      fileName: body.fileName ?? null,
      mimeType: body.file.mediaType,
      parsedData: receipt,
      aiPrompt: body.instructions ?? null,
      expenseId: null,
      createdAt: new Date(),
    });
    res.json({ ...receipt, receiptId });
  }),
);

aiRouter.post(
  '/expenses/quick-add',
  route(async (req, res) => {
    const person = z.object({ id: z.string(), name: z.string().max(100) });
    const body = z
      .object({
        text: z.string().min(3).max(500),
        me: person,
        people: z.array(person).max(500),
        groups: z.array(z.object({ id: z.string(), name: z.string().max(100), memberIds: z.array(z.string()) })).max(200),
        currency: z.string().length(3),
        today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(req.body);
    const pass = await takePass(req.user!.id, 'quick_add');
    try {
      res.json(await quickAdd({ ...body, language: langOf(req) }));
    } catch (err) {
      await pass.refund();
      throw err;
    }
  }),
);

aiRouter.post(
  '/receipts/assign',
  route(async (req, res) => {
    const body = z
      .object({
        instruction: z.string().min(3).max(500),
        items: z.array(z.object({ id: z.string(), name: z.string(), price: z.number(), quantity: z.number() })).max(200),
        people: z.array(z.object({ id: z.string(), name: z.string(), isMe: z.boolean().optional() })).max(50),
      })
      .parse(req.body);
    const pass = await takePass(req.user!.id, 'split_assistant');
    try {
      res.json(await assignItems(body));
    } catch (err) {
      await pass.refund();
      throw err;
    }
  }),
);

aiRouter.post(
  '/insights',
  route(async (req, res) => {
    const { stats, cachedOnly } = z
      .object({
        cachedOnly: z.boolean().optional(),
        stats: z.object({
          month: z.string(),
          // Older app versions don't send it; their amounts were always USD.
          currency: z.string().length(3).default('USD'),
          total: z.number(),
          previousTotal: z.number(),
          count: z.number(),
          byCategory: z.array(z.object({ category: z.string(), amount: z.number() })).max(20),
          topPeople: z.array(z.object({ name: z.string(), amount: z.number() })).max(10),
          biggest: z.array(z.object({ title: z.string(), amount: z.number(), category: z.string() })).max(10),
        }),
      })
      .parse(req.body);
    const me = req.user!.id;
    const lang = langOf(req);
    // Same month, same numbers, same language: hand back the earlier write-up for free.
    const _id = `${me}:${stats.month}:${stats.currency}:${lang}`;
    const statsHash = createHash('sha256').update(JSON.stringify(stats)).digest('hex');
    const cached = await db.insightsCache.findOne({ _id, statsHash });
    if (cached) return res.json(cached.result);
    if (cachedOnly) return res.json(null);

    const pass = await takePass(me, 'insights');
    let result;
    try {
      result = await monthlyInsights(stats, lang);
    } catch (err) {
      await pass.refund();
      throw err;
    }
    await db.insightsCache.updateOne({ _id }, { $set: { userId: me, statsHash, result, createdAt: new Date() } }, { upsert: true });
    res.json(result);
  }),
);
