/**
 * Admin Panel — Haiku Domain Enrichment Endpoints
 *
 * POST /api/admin-panel/enrichment/run          — batch'i fire-and-forget başlat
 * GET  /api/admin-panel/enrichment/status       — istatistik + ilerleme
 * POST /api/admin-panel/enrichment/retry-failed — failed → pending sıfırla
 */
import { Router } from "express";
import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAdmin } from "./middleware";
import { logger } from "../../lib/logger";

const router = Router();

let batchRunning = false;

router.post("/admin-panel/enrichment/run", requireAdmin, async (_req: Request, res: Response) => {
  if (batchRunning) {
    res.json({ queued: false, message: "Batch zaten çalışıyor, lütfen bekleyin" });
    return;
  }

  batchRunning = true;
  res.json({ queued: true, message: "Batch başlatıldı — 500 domain işlenecek" });

  setImmediate(async () => {
    try {
      const { runEnrichmentBatch } = await import("../../services/enrichment/batch-enrichment");
      const result = await runEnrichmentBatch();
      logger.info({ result }, "Manuel enrichment batch tamamlandı");
    } catch (err) {
      logger.error({ err }, "Manuel enrichment batch hatası");
    } finally {
      batchRunning = false;
    }
  });
});

router.get("/admin-panel/enrichment/status", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await db.execute<{
      total: number;
      pending: number;
      enriched: number;
      no_match: number;
      failed: number;
    }>(sql`
      SELECT
        COUNT(*)                                                    AS total,
        COUNT(*) FILTER (WHERE enrichment_status = 'pending')      AS pending,
        COUNT(*) FILTER (WHERE enrichment_status = 'enriched')     AS enriched,
        COUNT(*) FILTER (WHERE enrichment_status = 'no_match')     AS no_match,
        COUNT(*) FILTER (WHERE enrichment_status = 'failed')       AS failed
      FROM lead_candidates
    `);

    const row = result.rows[0] ?? { total: 0, pending: 0, enriched: 0, no_match: 0, failed: 0 };
    const total = Number(row.total);
    const pending = Number(row.pending);
    const enriched = Number(row.enriched);
    const noMatch = Number(row.no_match);
    const failed = Number(row.failed);
    const done = enriched + noMatch + failed;
    const completionPct = total > 0 ? Math.round((done / total) * 1000) / 10 : 0;
    const estimatedBatches = Math.ceil(pending / 500);
    const estimatedCost = Math.round(total * 0.00016 * 100) / 100;

    res.json({
      total,
      pending,
      enriched,
      no_match: noMatch,
      failed,
      completion_pct: completionPct,
      estimated_remaining_batches: estimatedBatches,
      estimated_cost_usd: estimatedCost,
      batch_running: batchRunning,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/admin-panel/enrichment/retry-failed", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await db.execute<{ count: number }>(sql`
      UPDATE lead_candidates
      SET enrichment_status = 'pending',
          enrichment_attempted_at = NULL,
          enrichment_completed_at = NULL
      WHERE enrichment_status = 'failed'
      RETURNING id
    `);
    const count = result.rows.length;
    logger.info({ count }, "Failed enrichment kayıtları pending'e alındı");
    res.json({ reset: count, message: `${count} kayıt yeniden kuyruğa alındı` });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
