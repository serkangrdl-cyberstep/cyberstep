import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { dailySummariesTable } from "@workspace/db";
import { desc, gte } from "drizzle-orm";
import { requireAdmin } from "../../middleware/auth";
import { collectDailySummary } from "../../services/dailyDashboard";
import { logger } from "../../lib/logger";

const router = Router();

// GET /api/admin/dashboard/summary — bugünkü veya en son özet
router.get("/admin/dashboard/summary", requireAdmin, async (_req: Request, res: Response) => {
  const [latest] = await db.select()
    .from(dailySummariesTable)
    .orderBy(desc(dailySummariesTable.summaryDate))
    .limit(1);

  if (!latest) {
    res.status(404).json({ error: "Henüz özet oluşturulmamış. Manuel üret butonunu kullanın." });
    return;
  }

  res.json(latest);
});

// GET /api/admin/dashboard/history — son 30 günlük özet listesi
router.get("/admin/dashboard/history", requireAdmin, async (_req: Request, res: Response) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateStr = thirtyDaysAgo.toISOString().slice(0, 10);

  const rows = await db.select({
    summaryDate: dailySummariesTable.summaryDate,
    mrrTrl: dailySummariesTable.mrrTrl,
    activeSubscriptions: dailySummariesTable.activeSubscriptions,
    newCustomersToday: dailySummariesTable.newCustomersToday,
    highChurnRiskCount: dailySummariesTable.highChurnRiskCount,
    generatedAt: dailySummariesTable.generatedAt,
  }).from(dailySummariesTable)
    .where(gte(dailySummariesTable.summaryDate, dateStr))
    .orderBy(desc(dailySummariesTable.summaryDate))
    .limit(30);

  res.json(rows);
});

// POST /api/admin/dashboard/generate — manuel tetikleme
router.post("/admin/dashboard/generate", requireAdmin, async (_req: Request, res: Response) => {
  logger.info("Daily summary: manual generation triggered");
  setImmediate(async () => {
    try {
      await collectDailySummary(new Date());
    } catch (err) {
      logger.error({ err }, "Daily summary manual generation failed");
    }
  });
  res.json({ ok: true, message: "Özet oluşturma başladı. Birkaç saniye içinde hazır olacak." });
});

export default router;
