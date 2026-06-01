import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { cronJobMetricsTable, emailSequenceQueueTable } from "@workspace/db";
import { desc, count, eq, lte, and, gte } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../admin-panel/middleware";
import { runAllHealthChecks } from "../../services/platform-health";
import { logger } from "../../lib/logger";

const router = Router();

// GET /api/admin/platform-health — anlık sağlık kontrolü
router.get("/admin/platform-health", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const health = await runAllHealthChecks();
    res.json(health);
  } catch (err) {
    logger.error({ err }, "Platform health check failed");
    res.status(500).json({ error: "Sağlık kontrolü başarısız" });
  }
});

// GET /api/admin/platform-health/crons — cron iş metrikleri
router.get("/admin/platform-health/crons", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db.select()
      .from(cronJobMetricsTable)
      .orderBy(desc(cronJobMetricsTable.lastRunAt));
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Failed to get cron metrics");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/admin/platform-health/email-queue — e-posta kuyruğu özeti
router.get("/admin/platform-health/email-queue", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const [pending] = await db.select({ total: count() })
      .from(emailSequenceQueueTable)
      .where(eq(emailSequenceQueueTable.status, "pending"));
    const [sent24h] = await db.select({ total: count() })
      .from(emailSequenceQueueTable)
      .where(and(
        eq(emailSequenceQueueTable.status, "sent"),
        gte(emailSequenceQueueTable.sentAt, new Date(Date.now() - 86_400_000))
      ));
    const [failed] = await db.select({ total: count() })
      .from(emailSequenceQueueTable)
      .where(eq(emailSequenceQueueTable.status, "failed"));
    const recent = await db.select()
      .from(emailSequenceQueueTable)
      .orderBy(desc(emailSequenceQueueTable.createdAt))
      .limit(20);
    res.json({
      pending: pending?.total ?? 0,
      sent24h: sent24h?.total ?? 0,
      failed: failed?.total ?? 0,
      recent,
    });
  } catch (err) {
    logger.error({ err }, "Failed to get email queue stats");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /api/admin/platform-health/email-queue/:id/retry — başarısız e-posta yeniden dene
router.post("/admin/platform-health/email-queue/:id/retry", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"]), 10);
  try {
    await db.update(emailSequenceQueueTable)
      .set({ status: "pending", sendAt: new Date() })
      .where(eq(emailSequenceQueueTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to retry email");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
