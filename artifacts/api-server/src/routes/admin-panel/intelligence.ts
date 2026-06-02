import { Router } from "express";
import { db } from "@workspace/db";
import { intelligenceReportsTable, reportSectorDetailsTable, reportLeadsTable, marketConfigsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { generateMonthlyReport } from "../../services/intelligence/reportWriter";
import { getActiveMarkets } from "../../services/intelligence/dataAggregator";
import { requireAdmin } from "./middleware";

const router = Router();

// GET /api/admin-panel/intelligence/markets
router.get("/admin-panel/intelligence/markets", requireAdmin, async (req, res) => {
  try {
    const markets = await db.select().from(marketConfigsTable).orderBy(marketConfigsTable.countryCode);
    const reports = await db
      .select({ countryCode: intelligenceReportsTable.countryCode, reportMonth: intelligenceReportsTable.reportMonth, reportYear: intelligenceReportsTable.reportYear, status: intelligenceReportsTable.status, domainsAnalyzed: intelligenceReportsTable.domainsAnalyzed, publishedAt: intelligenceReportsTable.publishedAt })
      .from(intelligenceReportsTable)
      .orderBy(desc(intelligenceReportsTable.reportYear), desc(intelligenceReportsTable.reportMonth));

    const lastByCountry: Record<string, typeof reports[0]> = {};
    for (const r of reports) {
      if (!lastByCountry[r.countryCode!]) lastByCountry[r.countryCode!] = r;
    }

    res.json({ markets: markets.map((m) => ({ ...m, lastReport: lastByCountry[m.countryCode] || null })) });
  } catch (e) {
    req.log.error({ err: e }, "Markets hatası");
    res.status(500).json({ error: "Pazarlar alınamadı" });
  }
});

// GET /api/admin-panel/intelligence/reports
router.get("/admin-panel/intelligence/reports", requireAdmin, async (req, res) => {
  try {
    const { countryCode } = req.query as { countryCode?: string };
    const query = db.select().from(intelligenceReportsTable).orderBy(desc(intelligenceReportsTable.reportYear), desc(intelligenceReportsTable.reportMonth));
    const reports = await query;
    const filtered = countryCode ? reports.filter((r) => r.countryCode === countryCode) : reports;
    res.json(filtered);
  } catch (e) {
    req.log.error({ err: e }, "Reports hatası");
    res.status(500).json({ error: "Raporlar alınamadı" });
  }
});

// GET /api/admin-panel/intelligence/reports/:id
router.get("/admin-panel/intelligence/reports/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params["id"]));
    const [report] = await db.select().from(intelligenceReportsTable).where(eq(intelligenceReportsTable.id, id));
    if (!report) { res.status(404).json({ error: "Rapor bulunamadı" }); return; }

    const sectors = await db.select().from(reportSectorDetailsTable).where(eq(reportSectorDetailsTable.reportId, id)).orderBy(reportSectorDetailsTable.sectorRank);
    const leads = await db.select().from(reportLeadsTable).where(eq(reportLeadsTable.reportId, id)).orderBy(desc(reportLeadsTable.downloadedAt));

    res.json({ ...report, sectors, leads, leadsCount: leads.length });
  } catch (e) {
    req.log.error({ err: e }, "Report detail hatası");
    res.status(500).json({ error: "Rapor alınamadı" });
  }
});

// POST /api/admin-panel/intelligence/generate
router.post("/admin-panel/intelligence/generate", requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const { countryCode = "TR", year = now.getFullYear(), month = now.getMonth() + 1 } = req.body as { countryCode?: string; year?: number; month?: number };
    const reportId = await generateMonthlyReport(countryCode, year, month);
    res.json({ reportId, message: "Rapor üretimi başlatıldı" });
  } catch (e) {
    req.log.error({ err: e }, "Generate report hatası");
    res.status(500).json({ error: "Rapor üretilemedi" });
  }
});

// PUT /api/admin-panel/intelligence/reports/:id
router.put("/admin-panel/intelligence/reports/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params["id"]));
    const { executiveSummary, linkedinPostShort, pressRelease, recommendations } = req.body as { executiveSummary?: string; linkedinPostShort?: string; pressRelease?: string; recommendations?: string };
    await db.update(intelligenceReportsTable).set({ executiveSummary, linkedinPostShort, pressRelease, recommendations, updatedAt: new Date() }).where(eq(intelligenceReportsTable.id, id));
    res.json({ success: true });
  } catch (e) {
    req.log.error({ err: e }, "Report update hatası");
    res.status(500).json({ error: "Rapor güncellenemedi" });
  }
});

// POST /api/admin-panel/intelligence/reports/:id/publish
router.post("/admin-panel/intelligence/reports/:id/publish", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params["id"]));
    await db.update(intelligenceReportsTable).set({ status: "published", publishedAt: new Date(), updatedAt: new Date() }).where(eq(intelligenceReportsTable.id, id));
    res.json({ success: true, message: "Rapor yayınlandı" });
  } catch (e) {
    req.log.error({ err: e }, "Report publish hatası");
    res.status(500).json({ error: "Rapor yayınlanamadı" });
  }
});

// GET /api/admin-panel/intelligence/reports/:id/leads
router.get("/admin-panel/intelligence/reports/:id/leads", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params["id"]));
    const leads = await db.select().from(reportLeadsTable).where(eq(reportLeadsTable.reportId, id)).orderBy(desc(reportLeadsTable.downloadedAt));
    res.json(leads);
  } catch (e) {
    req.log.error({ err: e }, "Report leads hatası");
    res.status(500).json({ error: "Leadler alınamadı" });
  }
});

export default router;
