import { Router } from "express";
import type { Request, Response } from "express";
import { eq, desc, sql, and, count } from "drizzle-orm";
import {
  db,
  vulncheckKevTable,
  annualIntelReportsTable,
  intelFeedItemsTable,
  intelFeedSourcesTable,
} from "@workspace/db";
import { requireAdmin } from "./middleware";
import { logger } from "../../lib/logger";
import { fetchVulnCheckKEV } from "../../services/intelligence/vulncheckService";
import { checkIntelFeeds, getFeedStatus, getRecentRelevantItems } from "../../services/intelligence/intelFeedWatcher";
import { analyzeAnnualReport, ANNUAL_REPORTS_CALENDAR } from "../../services/intelligence/annualReportScheduler";

const router = Router();

// ── VulnCheck KEV stats ────────────────────────────────────────────────────────

router.get("/admin-panel/cti-intel/vulncheck/stats", requireAdmin, async (req: Request, res: Response) => {
  try {
    const [total] = await db.select({ count: count() }).from(vulncheckKevTable);
    const [edgeCount] = await db.select({ count: count() }).from(vulncheckKevTable)
      .where(eq(vulncheckKevTable.isNetworkEdge, true));
    const [ransomwareCount] = await db.select({ count: count() }).from(vulncheckKevTable)
      .where(eq(vulncheckKevTable.ransomwareUse, true));
    const [inCisaCount] = await db.select({ count: count() }).from(vulncheckKevTable)
      .where(eq(vulncheckKevTable.inCisaKev, true));

    const totalVal = total?.count ?? 0;
    const cisaVal = inCisaCount?.count ?? 0;
    const blindSpotVal = Number(totalVal) - Number(cisaVal);

    const [lastFetch] = await db.select({ lastFetchedAt: vulncheckKevTable.lastFetchedAt })
      .from(vulncheckKevTable)
      .orderBy(desc(vulncheckKevTable.lastFetchedAt))
      .limit(1);

    res.json({
      total: totalVal,
      edgeCount: edgeCount?.count ?? 0,
      ransomwareCount: ransomwareCount?.count ?? 0,
      inCisaKev: cisaVal,
      blindSpot: blindSpotVal > 0 ? blindSpotVal : 0,
      blindSpotPct: totalVal > 0 ? Math.round((blindSpotVal / Number(totalVal)) * 100) : 0,
      lastFetchedAt: lastFetch?.lastFetchedAt ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "VulnCheck stats error");
    res.status(500).json({ error: "İstatistikler alınamadı" });
  }
});

// ── VulnCheck KEV list ─────────────────────────────────────────────────────────

router.get("/admin-panel/cti-intel/vulncheck", requireAdmin, async (req: Request, res: Response) => {
  try {
    const onlyEdge = req.query["edge"] === "1";
    const onlyRansomware = req.query["ransomware"] === "1";

    const rows = await db.select().from(vulncheckKevTable)
      .where(
        onlyEdge ? eq(vulncheckKevTable.isNetworkEdge, true) :
        onlyRansomware ? eq(vulncheckKevTable.ransomwareUse, true) : undefined,
      )
      .orderBy(desc(vulncheckKevTable.epssScore))
      .limit(200);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "VulnCheck list error");
    res.status(500).json({ error: "Liste alınamadı" });
  }
});

// ── VulnCheck manual refresh ───────────────────────────────────────────────────

router.post("/admin-panel/cti-intel/vulncheck/refresh", requireAdmin, async (req: Request, res: Response) => {
  res.json({ ok: true, message: "VulnCheck KEV yenileniyor..." });
  setImmediate(async () => {
    try {
      const result = await fetchVulnCheckKEV();
      logger.info(result, "Admin triggered VulnCheck KEV refresh");
    } catch (err) {
      logger.error({ err }, "Admin VulnCheck KEV refresh failed");
    }
  });
});

// ── Intel Feed status ──────────────────────────────────────────────────────────

router.get("/admin-panel/cti-intel/feeds", requireAdmin, async (req: Request, res: Response) => {
  try {
    const status = await getFeedStatus();
    res.json(status);
  } catch (err) {
    req.log.error({ err }, "Feed status error");
    res.status(500).json({ error: "Feed durumu alınamadı" });
  }
});

router.get("/admin-panel/cti-intel/feeds/items", requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query["limit"] ?? 50), 200);
    const items = await getRecentRelevantItems(limit);
    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Feed items error");
    res.status(500).json({ error: "İçerikler alınamadı" });
  }
});

router.post("/admin-panel/cti-intel/feeds/check", requireAdmin, async (req: Request, res: Response) => {
  res.json({ ok: true, message: "Feed'ler kontrol ediliyor..." });
  setImmediate(async () => {
    try {
      const result = await checkIntelFeeds();
      logger.info(result, "Admin triggered intel feed check");
    } catch (err) {
      logger.error({ err }, "Admin intel feed check failed");
    }
  });
});

// ── Annual reports ─────────────────────────────────────────────────────────────

router.get("/admin-panel/cti-intel/annual-reports", requireAdmin, async (req: Request, res: Response) => {
  try {
    const dbReports = await db.select().from(annualIntelReportsTable)
      .orderBy(desc(annualIntelReportsTable.updatedAt));

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const calendar = ANNUAL_REPORTS_CALENDAR.map((r) => {
      const dbRow = dbReports.find((d) => d.reportKey === r.key);
      return {
        ...r,
        status: dbRow?.status ?? "pending",
        analyzedAt: dbRow?.updatedAt ?? null,
        reportYear: dbRow?.reportYear ?? currentYear,
        isThisMonth: r.expectedMonth === currentMonth,
        dbRow,
      };
    });

    res.json({ calendar, analyzed: dbReports });
  } catch (err) {
    req.log.error({ err }, "Annual reports error");
    res.status(500).json({ error: "Raporlar alınamadı" });
  }
});

router.get("/admin-panel/cti-intel/annual-reports/:key", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const [row] = await db.select().from(annualIntelReportsTable)
      .where(eq(annualIntelReportsTable.reportKey, String(req.params["key"])));
    if (!row) { res.status(404).json({ error: "Rapor bulunamadı" }); return; }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Annual report detail error");
    res.status(500).json({ error: "Rapor alınamadı" });
  }
});

router.post("/admin-panel/cti-intel/annual-reports/analyze", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { reportKey, title, publisher, content, reportYear } = req.body as {
      reportKey: string;
      title: string;
      publisher: string;
      content: string;
      reportYear?: number;
    };

    if (!reportKey || !title || !content || content.length < 200) {
      res.status(400).json({ error: "reportKey, title ve en az 200 karakter content gerekli" });
      return;
    }

    const meta = ANNUAL_REPORTS_CALENDAR.find((r) => r.key === reportKey);
    res.json({ ok: true, message: "Analiz başlatıldı. Birkaç dakika içinde hazır olacak." });

    setImmediate(async () => {
      try {
        await analyzeAnnualReport({
          reportKey,
          title: title || meta?.title || reportKey,
          publisher: publisher || meta?.publisher || "Bilinmiyor",
          content,
          reportYear: reportYear ?? new Date().getFullYear(),
        });
      } catch (err) {
        logger.error({ err, reportKey }, "Annual report analysis failed");
      }
    });
  } catch (err) {
    req.log.error({ err }, "Annual report analyze endpoint error");
    res.status(500).json({ error: "Analiz başlatılamadı" });
  }
});

export default router;
