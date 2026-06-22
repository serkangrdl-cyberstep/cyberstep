import { Router } from "express";
import type { Request, Response } from "express";
import { eq, desc } from "drizzle-orm";
import { db, cyberRiskReportsTable, reportMetricsSnapshotTable } from "@workspace/db";
import { requireAdmin } from "./middleware";
import { logger } from "../../lib/logger";

const router = Router();

// GET /api/admin-panel/cyber-risk-reports/list
router.get("/admin-panel/cyber-risk-reports/list", requireAdmin, async (req: Request, res: Response) => {
  try {
    const status = req.query["status"] as string | undefined;
    const rows = status
      ? await db.select().from(cyberRiskReportsTable)
          .where(eq(cyberRiskReportsTable.status, status))
          .orderBy(desc(cyberRiskReportsTable.createdAt))
          .limit(50)
      : await db.select().from(cyberRiskReportsTable)
          .orderBy(desc(cyberRiskReportsTable.createdAt))
          .limit(50);
    res.json(rows);
  } catch (e) {
    req.log.error({ err: e }, "cyber-risk-reports list error");
    res.status(500).json({ error: "Liste alinamadi" });
  }
});

// GET /api/admin-panel/cyber-risk-reports/metrics
router.get("/admin-panel/cyber-risk-reports/metrics", requireAdmin, async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(reportMetricsSnapshotTable)
      .orderBy(desc(reportMetricsSnapshotTable.collectedAt))
      .limit(12);
    res.json(rows);
  } catch (e) {
    req.log.error({ err: e }, "metrics snapshot list error");
    res.status(500).json({ error: "Metrikler alinamadi" });
  }
});

// POST /api/admin-panel/cyber-risk-reports/collect-metrics — Manuel tetik
// Must be registered BEFORE /:id to avoid route conflict
router.post("/admin-panel/cyber-risk-reports/collect-metrics", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { runReportMetricsCollector } = await import("../../services/reportMetricsCollector");
    const result = await runReportMetricsCollector();
    res.json({ success: true, ...result });
  } catch (e) {
    req.log.error({ err: e }, "collect-metrics error");
    res.status(500).json({ error: "Metrik toplama basarisiz" });
  }
});

// GET /api/admin-panel/cyber-risk-reports/:id
router.get("/admin-panel/cyber-risk-reports/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params["id"]));
    const [row] = await db.select().from(cyberRiskReportsTable)
      .where(eq(cyberRiskReportsTable.id, id));
    if (!row) { res.status(404).json({ error: "Rapor bulunamadi" }); return; }
    res.json(row);
  } catch (e) {
    req.log.error({ err: e }, "cyber-risk-reports get error");
    res.status(500).json({ error: "Rapor alinamadi" });
  }
});

// POST /api/admin-panel/cyber-risk-reports — Manuel taslak oluştur
router.post("/admin-panel/cyber-risk-reports", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { periodType, periodLabel, sector, reportData, reviewNotes } = req.body as {
      periodType: string;
      periodLabel: string;
      sector?: string;
      reportData?: Record<string, unknown>;
      reviewNotes?: string;
    };
    if (!periodType || !periodLabel) {
      res.status(400).json({ error: "periodType ve periodLabel zorunlu" }); return;
    }
    if (!["monthly", "quarterly", "yearly"].includes(periodType)) {
      res.status(400).json({ error: "Gecersiz periodType" }); return;
    }
    const slug = `${periodType}-${periodLabel}${sector ? `-${sector.toLowerCase().replace(/\s+/g, "-")}` : ""}`;
    const [inserted] = await db.insert(cyberRiskReportsTable).values({
      periodType,
      periodLabel,
      sector: sector ?? null,
      status: "draft",
      reportData: reportData ?? null,
      webSlug: slug,
      reviewNotes: reviewNotes ?? null,
    }).returning();
    logger.info({ id: inserted?.id, periodLabel, sector }, "Siber risk raporu taslagi olusturuldu");
    res.json(inserted);
  } catch (e) {
    req.log.error({ err: e }, "cyber-risk-reports create error");
    res.status(500).json({ error: "Rapor olusturulamadi" });
  }
});

// PATCH /api/admin-panel/cyber-risk-reports/:id/submit — draft → pending_review
router.patch("/admin-panel/cyber-risk-reports/:id/submit", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params["id"]));
    const [updated] = await db.update(cyberRiskReportsTable)
      .set({ status: "pending_review" })
      .where(eq(cyberRiskReportsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Rapor bulunamadi" }); return; }
    res.json(updated);
  } catch (e) {
    req.log.error({ err: e }, "cyber-risk-reports submit error");
    res.status(500).json({ error: "Durum guncellenemedi" });
  }
});

// PATCH /api/admin-panel/cyber-risk-reports/:id/approve — pending_review → published
router.patch("/admin-panel/cyber-risk-reports/:id/approve", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params["id"]));
    const reviewedBy = (req as unknown as { adminEmail?: string }).adminEmail ?? "admin";
    const [updated] = await db.update(cyberRiskReportsTable)
      .set({
        status: "published",
        publishedAt: new Date(),
        reviewedBy,
        reviewNotes: (req.body as { reviewNotes?: string })?.reviewNotes ?? null,
      })
      .where(eq(cyberRiskReportsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Rapor bulunamadi" }); return; }
    logger.info({ id, reviewedBy }, "Siber risk raporu yayinlandi");
    res.json(updated);
  } catch (e) {
    req.log.error({ err: e }, "cyber-risk-reports approve error");
    res.status(500).json({ error: "Onay islemi basarisiz" });
  }
});

// PATCH /api/admin-panel/cyber-risk-reports/:id/reject — → draft
router.patch("/admin-panel/cyber-risk-reports/:id/reject", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params["id"]));
    const [updated] = await db.update(cyberRiskReportsTable)
      .set({
        status: "draft",
        reviewNotes: (req.body as { reviewNotes?: string })?.reviewNotes ?? null,
      })
      .where(eq(cyberRiskReportsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Rapor bulunamadi" }); return; }
    res.json(updated);
  } catch (e) {
    req.log.error({ err: e }, "cyber-risk-reports reject error");
    res.status(500).json({ error: "Red islemi basarisiz" });
  }
});

// DELETE /api/admin-panel/cyber-risk-reports/:id
router.delete("/admin-panel/cyber-risk-reports/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params["id"]));
    await db.delete(cyberRiskReportsTable).where(eq(cyberRiskReportsTable.id, id));
    res.json({ success: true });
  } catch (e) {
    req.log.error({ err: e }, "cyber-risk-reports delete error");
    res.status(500).json({ error: "Silme islemi basarisiz" });
  }
});

export default router;
