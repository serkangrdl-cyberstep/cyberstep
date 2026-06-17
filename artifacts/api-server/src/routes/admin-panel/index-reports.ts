import { Router } from "express";
import { db } from "@workspace/db";
import { indexReportsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireAdmin } from "./middleware";
import { logger } from "../../lib/logger";
import { calculateIndexStats } from "../../services/indexReportCalculator";
import { generateIndexContent } from "../../services/indexReportWriter";

const router = Router();

// ─── GET /api/admin-panel/index/dashboard ────────────────────────────────────
router.get("/admin-panel/index/dashboard", requireAdmin, async (req, res) => {
  const {
    start = new Date(new Date().setDate(1)).toISOString().split("T")[0],
    end   = new Date().toISOString().split("T")[0],
  } = req.query;

  try {
    const startDate = new Date(String(start));
    const endDate   = new Date(String(end));
    endDate.setHours(23, 59, 59, 999);

    const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 90) {
      res.status(400).json({ error: "Maksimum 90 günlük aralık seçilebilir" });
      return;
    }

    const summaryRows = await db.execute(sql`
      WITH latest AS (
        SELECT DISTINCT ON (domain) *
        FROM domain_scans
        WHERE created_at BETWEEN ${startDate} AND ${endDate}
        ORDER BY domain, created_at DESC
      )
      SELECT
        COUNT(*)::int as total,
        COUNT(CASE WHEN included_in_index THEN 1 END)::int as qualifying,
        ROUND(AVG(overall_score)::numeric, 1)::text as avg_score,
        MIN(overall_score)::int as min_score,
        MAX(overall_score)::int as max_score,
        COUNT(CASE WHEN overall_score < 40 THEN 1 END)::int as critical_count,
        COUNT(CASE WHEN overall_score BETWEEN 40 AND 59 THEN 1 END)::int as high_count,
        COUNT(CASE WHEN overall_score BETWEEN 60 AND 79 THEN 1 END)::int as medium_count,
        COUNT(CASE WHEN overall_score >= 80 THEN 1 END)::int as low_count
      FROM latest
    `);

    const dailyTrend = await db.execute(sql`
      WITH latest AS (
        SELECT DISTINCT ON (domain) *
        FROM domain_scans
        WHERE created_at BETWEEN ${startDate} AND ${endDate}
        ORDER BY domain, created_at DESC
      )
      SELECT
        DATE(created_at)::text as scan_date,
        COUNT(*)::int as count,
        ROUND(AVG(overall_score)::numeric, 1)::text as avg_score
      FROM latest
      WHERE included_in_index = true
      GROUP BY DATE(created_at)
      ORDER BY scan_date ASC
    `);

    const emailRows = await db.execute(sql`
      WITH latest AS (
        SELECT DISTINCT ON (domain) *
        FROM domain_scans
        WHERE created_at BETWEEN ${startDate} AND ${endDate}
        ORDER BY domain, created_at DESC
      )
      SELECT
        ROUND(100.0 * SUM(CASE WHEN dmarc_record IS NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1)::text as dmarc_missing_pct,
        ROUND(100.0 * SUM(CASE WHEN dmarc_record LIKE '%p=none%' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1)::text as dmarc_none_pct,
        ROUND(100.0 * SUM(CASE WHEN dmarc_record LIKE '%p=reject%' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1)::text as dmarc_reject_pct,
        ROUND(100.0 * SUM(CASE WHEN spf_record IS NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1)::text as spf_missing_pct,
        ROUND(100.0 * SUM(CASE WHEN dkim_pass = false THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1)::text as dkim_missing_pct
      FROM latest
      WHERE included_in_index = true
    `);

    const portRows = await db.execute(sql`
      WITH latest AS (
        SELECT DISTINCT ON (domain) *
        FROM domain_scans
        WHERE created_at BETWEEN ${startDate} AND ${endDate}
        ORDER BY domain, created_at DESC
      )
      SELECT
        ROUND(100.0 * SUM(CASE WHEN 3306 = ANY(ARRAY(SELECT (elem->>'port')::int FROM jsonb_array_elements(COALESCE(shodan_open_ports, '[]'::jsonb)) elem)) THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1)::text as mysql_pct,
        ROUND(100.0 * SUM(CASE WHEN 21 = ANY(ARRAY(SELECT (elem->>'port')::int FROM jsonb_array_elements(COALESCE(shodan_open_ports, '[]'::jsonb)) elem)) THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1)::text as ftp_pct,
        ROUND(100.0 * SUM(CASE WHEN 3389 = ANY(ARRAY(SELECT (elem->>'port')::int FROM jsonb_array_elements(COALESCE(shodan_open_ports, '[]'::jsonb)) elem)) THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1)::text as rdp_pct
      FROM latest
      WHERE included_in_index = true
    `);

    const sectorStats = await db.execute(sql`
      WITH latest AS (
        SELECT DISTINCT ON (domain) *
        FROM domain_scans
        WHERE created_at BETWEEN ${startDate} AND ${endDate}
        ORDER BY domain, created_at DESC
      )
      SELECT
        COALESCE(sector, 'diger') as sector,
        COUNT(*)::int as count,
        ROUND(AVG(overall_score)::numeric, 1)::text as avg_score
      FROM latest
      WHERE included_in_index = true
      GROUP BY sector
      ORDER BY count DESC
      LIMIT 10
    `);

    const scoreDistrib = await db.execute(sql`
      WITH latest AS (
        SELECT DISTINCT ON (domain) *
        FROM domain_scans
        WHERE created_at BETWEEN ${startDate} AND ${endDate}
        ORDER BY domain, created_at DESC
      )
      SELECT
        SUM(CASE WHEN overall_score <= 20 THEN 1 ELSE 0 END)::int as "0-20",
        SUM(CASE WHEN overall_score BETWEEN 21 AND 40 THEN 1 ELSE 0 END)::int as "21-40",
        SUM(CASE WHEN overall_score BETWEEN 41 AND 60 THEN 1 ELSE 0 END)::int as "41-60",
        SUM(CASE WHEN overall_score BETWEEN 61 AND 80 THEN 1 ELSE 0 END)::int as "61-80",
        SUM(CASE WHEN overall_score > 80 THEN 1 ELSE 0 END)::int as "81-100"
      FROM latest
      WHERE included_in_index = true
    `);

    res.json({
      period: { start, end },
      summary: summaryRows.rows[0] ?? {},
      scoreDistribution: scoreDistrib.rows[0] ?? {},
      dailyTrend: dailyTrend.rows,
      emailSecurity: emailRows.rows[0] ?? {},
      portRisk: portRows.rows[0] ?? {},
      sectorBreakdown: sectorStats.rows,
    });
  } catch (err) {
    logger.error({ err }, "Index dashboard hatası");
    res.status(500).json({ error: String(err) });
  }
});

// ─── POST /api/admin-panel/index/generate ────────────────────────────────────
router.post("/admin-panel/index/generate", requireAdmin, async (req, res) => {
  const { start, end, reportMonth } = req.body as { start?: string; end?: string; reportMonth?: string };

  if (!start || !end || !reportMonth) {
    res.status(400).json({ error: "start, end ve reportMonth zorunlu" });
    return;
  }

  const startDate = new Date(start);
  const endDate   = new Date(end);
  endDate.setHours(23, 59, 59, 999);

  try {
    const stats = await calculateIndexStats(startDate, endDate);

    if (stats.totalScanned < 10) {
      res.status(400).json({
        error: `Yetersiz veri: ${stats.totalScanned} domain. Minimum 10 gerekli.`,
        current: stats.totalScanned,
      });
      return;
    }

    const prevReports = await db.select().from(indexReportsTable)
      .where(sql`report_month < ${reportMonth}`)
      .orderBy(desc(indexReportsTable.reportMonth))
      .limit(1);
    const prevRep = prevReports[0];

    const prevStats = prevRep ? {
      avgScore: parseFloat(prevRep.avgSecurityScore ?? "0"),
      email: { dmarcMissing: parseFloat(prevRep.dmarcMissingPct ?? "0"), dmarcNone: 0, dmarcQuarantine: 0, dmarcReject: 0, spfMissing: 0, dkimMissing: 0 },
      ssl: { sslValid: 0, sslExpiring: 0, sslExpired: 0 },
      ports: { mysqlExposed: 0, ftpExposed: 0, rdpExposed: 0, anyHighRisk: 0 },
      cve: { withCVE: 0, withCriticalCVE: 0 },
      tech: { wordpressUsage: 0, cdnUsage: 0 },
      blacklisted: 0,
      totalScanned: prevRep.totalDomainsScanned ?? 0,
      qualifyingDomains: prevRep.qualifyingDomains ?? 0,
      scoreDistribution: {},
      sectorStats: [],
      cityStats: [],
      hostingStats: [],
    } : null;

    const content = await generateIndexContent(stats, reportMonth, prevStats);

    await db.insert(indexReportsTable).values({
      reportMonth,
      periodStart: start,
      periodEnd:   end,
      totalDomainsScanned: stats.totalScanned,
      qualifyingDomains:   stats.qualifyingDomains,
      avgSecurityScore:    String(stats.avgScore),
      scoreDistribution:   stats.scoreDistribution,
      dmarcMissingPct:     String(stats.email.dmarcMissing),
      dmarcNonePct:        String(stats.email.dmarcNone),
      dmarcQuarantinePct:  String(stats.email.dmarcQuarantine),
      dmarcRejectPct:      String(stats.email.dmarcReject),
      spfMissingPct:       String(stats.email.spfMissing),
      dkimMissingPct:      String(stats.email.dkimMissing),
      sslValidPct:         String(stats.ssl.sslValid),
      sslExpiring30dPct:   String(stats.ssl.sslExpiring),
      sslExpiredPct:       String(stats.ssl.sslExpired),
      mysqlExposedPct:     String(stats.ports.mysqlExposed),
      ftpExposedPct:       String(stats.ports.ftpExposed),
      rdpExposedPct:       String(stats.ports.rdpExposed),
      anyHighRiskPortPct:  String(stats.ports.anyHighRisk),
      domainsWithCvePct:   String(stats.cve.withCVE),
      domainsWithCriticalCvePct: String(stats.cve.withCriticalCVE),
      wordpressUsagePct:   String(stats.tech.wordpressUsage),
      cdnUsagePct:         String(stats.tech.cdnUsage),
      blacklistedPct:      String(stats.blacklisted),
      sectorStats:         stats.sectorStats,
      cityStats:           stats.cityStats,
      hostingStats:        stats.hostingStats,
      executiveSummary:    content.executiveSummary,
      keyFindings:         content.keyFindings,
      globalContext:       content.globalContext,
      status:              "draft",
      updatedAt:           new Date(),
    }).onConflictDoUpdate({
      target: indexReportsTable.reportMonth,
      set: {
        totalDomainsScanned: stats.totalScanned,
        avgSecurityScore:    String(stats.avgScore),
        executiveSummary:    content.executiveSummary,
        keyFindings:         content.keyFindings,
        globalContext:       content.globalContext,
        scoreDistribution:   stats.scoreDistribution,
        sectorStats:         stats.sectorStats,
        status:              "draft",
        updatedAt:           new Date(),
      },
    });

    logger.info({ reportMonth, totalScanned: stats.totalScanned, avgScore: stats.avgScore }, "Index raporu oluşturuldu");

    res.json({
      success: true,
      reportMonth,
      stats: { totalScanned: stats.totalScanned, avgScore: stats.avgScore, dmarcMissing: stats.email.dmarcMissing },
      message: "Rapor taslak olarak oluşturuldu.",
    });
  } catch (err) {
    logger.error({ err }, "Index rapor üretim hatası");
    res.status(500).json({ error: String(err) });
  }
});

// ─── GET /api/admin-panel/index/reports ──────────────────────────────────────
router.get("/admin-panel/index/reports", requireAdmin, async (_req, res) => {
  const reports = await db.select().from(indexReportsTable).orderBy(desc(indexReportsTable.reportMonth));
  res.json(reports);
});

// ─── GET /api/admin-panel/index/:month ───────────────────────────────────────
router.get("/admin-panel/index/:month", requireAdmin, async (req, res) => {
  const month = String(req.params["month"]);
  const reports = await db.select().from(indexReportsTable).where(eq(indexReportsTable.reportMonth, month));
  const report = reports[0];
  if (!report) { res.status(404).json({ error: "Rapor bulunamadı" }); return; }
  res.json(report);
});

// ─── POST /api/admin-panel/index/:month/publish ───────────────────────────────
router.post("/admin-panel/index/:month/publish", requireAdmin, async (req, res) => {
  const month = String(req.params["month"]);
  const adminReq = req as typeof req & { admin?: { email?: string } };

  await db.update(indexReportsTable).set({
    status:      "published",
    publishedAt: new Date(),
    publishedBy: adminReq.admin?.email ?? "admin",
    updatedAt:   new Date(),
  }).where(eq(indexReportsTable.reportMonth, month));

  res.json({ success: true, publishedAt: new Date() });
});

// ─── DELETE /api/admin-panel/index/:month ────────────────────────────────────
router.delete("/admin-panel/index/:month", requireAdmin, async (req, res) => {
  const month = String(req.params["month"]);
  await db.delete(indexReportsTable).where(eq(indexReportsTable.reportMonth, month));
  res.json({ success: true });
});

export default router;
