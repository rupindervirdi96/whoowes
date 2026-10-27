/**
 * AI routes. Plans and quotas are enforced here — never trust the client.
 *
 *   POST /ai/receipts/parse       Free: 3/mo · Plus: 30/mo · Pro: unlimited
 *   POST /ai/expenses/quick-add   Plus, Pro
 *   POST /ai/receipts/assign      Pro
 *   POST /ai/insights             Pro
 */

import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireUser } from '../auth.js';
import { PLANS, minPlanFor, planIncludes, type Feature } from '../plans.js';
import { randomUUID } from 'node:crypto';
import { planOf, recordScan, scansUsed } from '../store.js';
import { db } from '../db/index.js';
import { IMAGE_TYPES, assignItems, monthlyInsights, parseReceipt, quickAdd } from '../ai/claude.js';

export const aiRouter = Router();
aiRouter.use(requireUser);

function gate(feature: Feature) {
  return async (req: Request, res: Response, next: NextFunction) => {
   try {
    const plan = await planOf(req.user!.id);
    if (!planIncludes(plan, feature)) {
      return res.status(402).json({
        code: 'upgrade_required',
        feature,
        message: `This needs WhoOwes ${PLANS[minPlanFor(feature)].name}.`,
      });
    }
    if (feature === 'receipt_scan') {
      const limit = PLANS[plan].monthlyScanLimit;
      if (limit !== null && (await scansUsed(req.user!.id)) >= limit) {
        return res.status(402).json({
          code: 'quota_exceeded',
          feature,
          message: `You've used all ${limit} AI scans on ${PLANS[plan].name} this month.`,
        });
      }
    }
    next();
   } catch (err) {
    next(err);
   }
  };
}

const MAX_BASE64 = Math.ceil((10 * 1024 * 1024 * 4) / 3); // 10 MB file

aiRouter.post('/receipts/parse', gate('receipt_scan'), async (req, res, next) => {
  try {
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
    const receipt = await parseReceipt(body.file, body.instructions);
    await recordScan(req.user!.id); // count only successful reads
    // Keep the parsed result so the review screen can reload it and the expense can link to it.
    const receiptId = randomUUID();
    await db.query(
      'insert into receipts (id, user_id, source_type, file_name, mime_type, parsed_data, ai_prompt) values ($1, $2, $3, $4, $5, $6, $7)',
      [receiptId, req.user!.id, body.sourceType, body.fileName ?? null, body.file.mediaType, JSON.stringify(receipt), body.instructions ?? null],
    );
    res.json({ ...receipt, receiptId });
  } catch (err) {
    next(err);
  }
});

aiRouter.post('/expenses/quick-add', gate('ai_quick_add'), async (req, res, next) => {
  try {
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
    res.json(await quickAdd(body));
  } catch (err) {
    next(err);
  }
});

aiRouter.post('/receipts/assign', gate('ai_split_assistant'), async (req, res, next) => {
  try {
    const body = z
      .object({
        instruction: z.string().min(3).max(500),
        items: z.array(z.object({ id: z.string(), name: z.string(), price: z.number(), quantity: z.number() })).max(200),
        people: z.array(z.object({ id: z.string(), name: z.string(), isMe: z.boolean().optional() })).max(50),
      })
      .parse(req.body);
    res.json(await assignItems(body));
  } catch (err) {
    next(err);
  }
});

aiRouter.post('/insights', gate('ai_insights'), async (req, res, next) => {
  try {
    const { stats } = z
      .object({
        stats: z.object({
          month: z.string(),
          total: z.number(),
          previousTotal: z.number(),
          count: z.number(),
          byCategory: z.array(z.object({ category: z.string(), amount: z.number() })).max(20),
          topPeople: z.array(z.object({ name: z.string(), amount: z.number() })).max(10),
          biggest: z.array(z.object({ title: z.string(), amount: z.number(), category: z.string() })).max(10),
        }),
      })
      .parse(req.body);
    res.json(await monthlyInsights(stats));
  } catch (err) {
    next(err);
  }
});
