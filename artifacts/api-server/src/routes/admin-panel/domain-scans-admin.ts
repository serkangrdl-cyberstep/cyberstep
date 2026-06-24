import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { domainScansTable } from "@workspace/db";
import { count, avg, sql, desc, ilike, or, eq } from "drizzle-orm";
import { requireAdmin } from "./middleware";
import { logger } from "../../lib/logger";

const router = Router();

// ─── Stats ─────────────────────────────────────────────────────────────────────
router.get("/admin-panel/domain-scans/stats", requireAdmin, async (_req: Request, res: Response) => {
  const [total] = await db.select({ count: count() }).from(domainScansTable);
  const [avgScore] = await db.select({ avg: avg(domainScansTable.overallScore) }).from(domainScansTable);

  const passRates = await db.execute(sql`
    SELECT
      ROUND(100.0 * SUM(CASE WHEN spf_pass THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) AS spf,
      ROUND(100.0 * SUM(CASE WHEN dmarc_pass THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) AS dmarc,
      ROUND(100.0 * SUM(CASE WHEN dkim_pass THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) AS dkim,
      ROUND(100.0 * SUM(CASE WHEN mx_pass THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) AS mx,
      ROUND(100.0 * SUM(CASE WHEN ssl_pass THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) AS ssl,
      ROUND(100.0 * SUM(CASE WHEN NOT blacklisted THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) AS clean_blacklist,
      ROUND(100.0 * SUM(CASE WHEN hibp_breach_count = 0 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) AS clean_hibp
    FROM domain_scans
  `);

  const monthly = await db.execute(sql`
    SELECT
      TO_CHAR(created_at, 'YYYY-MM') AS month,
      COUNT(*)::int AS scan_count,
      ROUND(AVG(overall_score)) AS avg_score
    FROM domain_scans
    WHERE created_at >= NOW() - INTERVAL '6 months'
    GROUP BY TO_CHAR(created_at, 'YYYY-MM')
    ORDER BY month ASC
  `);

  const rates = (passRates.rows[0] ?? {}) as Record<string, string>;

  res.json({
    total: Number(total.count),
    avgScore: Math.round(Number(avgScore.avg ?? 0)),
    passRates: {
      spf:            Number(rates.spf ?? 0),
      dmarc:          Number(rates.dmarc ?? 0),
      dkim:           Number(rates.dkim ?? 0),
      mx:             Number(rates.mx ?? 0),
      ssl:            Number(rates.ssl ?? 0),
      cleanBlacklist: Number(rates.clean_blacklist ?? 0),
      cleanHibp:      Number(rates.clean_hibp ?? 0),
    },
    monthly: monthly.rows,
  });
});

// ─── Extended Stats (günlük/haftalık/aylık + trend + dağılım + en riskli) ──────
router.get("/admin-panel/domain-scans/stats/extended", requireAdmin, async (_req: Request, res: Response) => {
  const [periods] = await db.execute(sql`
    SELECT
      COUNT(*)::int                                                                   AS total_count,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day')::int           AS today_count,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int          AS week_count,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int         AS month_count,
      ROUND(AVG(overall_score))                                                       AS avg_score_all,
      ROUND(AVG(overall_score) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'))  AS avg_score_week,
      ROUND(AVG(overall_score) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')) AS avg_score_month,
      COUNT(DISTINCT domain)::int                                                     AS unique_domain_count
    FROM domain_scans
  `).then(r => r.rows) as Record<string, unknown>[];

  const row = (periods[0] ?? {}) as Record<string, unknown>;

  const distRows = await db.execute(sql`
    SELECT
      CASE
        WHEN overall_score BETWEEN 0  AND 20  THEN '0-20'
        WHEN overall_score BETWEEN 21 AND 40  THEN '21-40'
        WHEN overall_score BETWEEN 41 AND 60  THEN '41-60'
        WHEN overall_score BETWEEN 61 AND 80  THEN '61-80'
        ELSE '81-100'
      END AS bucket,
      COUNT(*)::int AS cnt
    FROM domain_scans
    GROUP BY 1
    ORDER BY 1
  `).then(r => r.rows) as Array<{ bucket: string; cnt: number }>;

  const dailyTrend = await db.execute(sql`
    SELECT
      TO_CHAR(created_at AT TIME ZONE 'Europe/Istanbul', 'MM-DD') AS day,
      COUNT(*)::int AS cnt
    FROM domain_scans
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY TO_CHAR(created_at AT TIME ZONE 'Europe/Istanbul', 'MM-DD')
    ORDER BY day ASC
  `).then(r => r.rows) as Array<{ day: string; cnt: number }>;

  const topRisk = await db.execute(sql`
    SELECT DISTINCT ON (domain)
      domain, email, overall_score, created_at
    FROM domain_scans
    WHERE created_at >= NOW() - INTERVAL '90 days'
    ORDER BY domain, created_at DESC
  `).then(r => r.rows) as Array<{ domain: string; email: string | null; overall_score: number; created_at: string }>;

  topRisk.sort((a, b) => Number(a.overall_score) - Number(b.overall_score));
  const bottomFive = topRisk.slice(0, 5);

  const topFive = [...topRisk].sort((a, b) => Number(b.overall_score) - Number(a.overall_score)).slice(0, 5);

  res.json({
    totalCount:        Number(row.total_count ?? 0),
    todayCount:        Number(row.today_count ?? 0),
    weekCount:         Number(row.week_count ?? 0),
    monthCount:        Number(row.month_count ?? 0),
    avgScoreAll:       Number(row.avg_score_all ?? 0),
    avgScoreWeek:      row.avg_score_week != null ? Number(row.avg_score_week) : null,
    avgScoreMonth:     row.avg_score_month != null ? Number(row.avg_score_month) : null,
    uniqueDomainCount: Number(row.unique_domain_count ?? 0),
    scoreDistribution: distRows.map(r => ({ bucket: r.bucket, count: Number(r.cnt) })),
    dailyTrend:        dailyTrend.map(r => ({ day: r.day, count: Number(r.cnt) })),
    topRiskDomains:    bottomFive.map(r => ({ domain: r.domain, email: r.email, score: Number(r.overall_score), scannedAt: r.created_at })),
    topSafeDomains:    topFive.map(r => ({ domain: r.domain, email: r.email, score: Number(r.overall_score), scannedAt: r.created_at })),
  });
});

// ─── CSV Export ────────────────────────────────────────────────────────────────
router.get("/admin-panel/domain-scans/export", requireAdmin, async (_req: Request, res: Response) => {
  const rows = await db
    .select({
      id: domainScansTable.id,
      domain: domainScansTable.domain,
      email: domainScansTable.email,
      overallScore: domainScansTable.overallScore,
      spfPass: domainScansTable.spfPass,
      dmarcPass: domainScansTable.dmarcPass,
      dkimPass: domainScansTable.dkimPass,
      mxPass: domainScansTable.mxPass,
      sslPass: domainScansTable.sslPass,
      sslExpiry: domainScansTable.sslExpiry,
      hibpBreachCount: domainScansTable.hibpBreachCount,
      blacklisted: domainScansTable.blacklisted,
      blacklistCount: domainScansTable.blacklistCount,
      createdAt: domainScansTable.createdAt,
    })
    .from(domainScansTable)
    .orderBy(desc(domainScansTable.createdAt));

  const header = "id,domain,email,skor,spf,dmarc,dkim,mx,ssl,ssl_bitis,hibp_ihlal,karalisteye_alinmis,karalisteye_alinmis_sayi,tarih\n";
  const csvRows = rows.map(r =>
    [
      r.id,
      `"${r.domain}"`,
      `"${r.email ?? ""}"`,
      r.overallScore,
      r.spfPass ? "evet" : "hayir",
      r.dmarcPass ? "evet" : "hayir",
      r.dkimPass ? "evet" : "hayir",
      r.mxPass ? "evet" : "hayir",
      r.sslPass ? "evet" : "hayir",
      `"${r.sslExpiry ?? ""}"`,
      r.hibpBreachCount,
      r.blacklisted ? "evet" : "hayir",
      r.blacklistCount ?? 0,
      new Date(r.createdAt).toISOString(),
    ].join(",")
  );

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="domain-taramalar-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send("\uFEFF" + header + csvRows.join("\n"));
});

// ─── List ─────────────────────────────────────────────────────────────────────
router.get("/admin-panel/domain-scans", requireAdmin, async (req: Request, res: Response) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = 50;
  const offset = (page - 1) * limit;

  const where = q ? or(ilike(domainScansTable.domain, `%${q}%`), ilike(domainScansTable.email, `%${q}%`)) : undefined;

  const [{ cnt }] = await db
    .select({ cnt: count() })
    .from(domainScansTable)
    .where(where);

  const rows = await db
    .select({
      id: domainScansTable.id,
      domain: domainScansTable.domain,
      email: domainScansTable.email,
      overallScore: domainScansTable.overallScore,
      spfPass: domainScansTable.spfPass,
      dmarcPass: domainScansTable.dmarcPass,
      dkimPass: domainScansTable.dkimPass,
      mxPass: domainScansTable.mxPass,
      sslPass: domainScansTable.sslPass,
      hibpBreachCount: domainScansTable.hibpBreachCount,
      blacklisted: domainScansTable.blacklisted,
      shadowItServices: domainScansTable.shadowItServices,
      asnNumber: domainScansTable.asnNumber,
      asnName: domainScansTable.asnName,
      orphanedAssets: domainScansTable.orphanedAssets,
      createdAt: domainScansTable.createdAt,
    })
    .from(domainScansTable)
    .where(where)
    .orderBy(desc(domainScansTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ total: Number(cnt), page, rows });
});

// ─── Scheduled / upcoming re-scans ── MUST be before /:id ────────────────────
router.get("/admin-panel/domain-scans/scheduled", requireAdmin, async (_req: Request, res: Response) => {
  const now = new Date();
  const day25 = new Date(now.getTime() - 25 * 24 * 3600 * 1000);
  const day30 = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

  const rows = await db.execute<{
    id: number; domain: string; email: string | null;
    overall_score: number; created_at: Date; notified_at: Date | null;
  }>(sql`
    SELECT DISTINCT ON (domain) id, domain, email, overall_score, created_at, notified_at
    FROM domain_scans
    WHERE email IS NOT NULL
    ORDER BY domain, created_at DESC
  `);

  const all = (rows.rows ?? []) as Array<{ id: number; domain: string; email: string | null; overall_score: number; created_at: Date; notified_at: Date | null }>;

  const overdue = all.filter(r => r.notified_at === null && new Date(r.created_at) <= day30);
  const upcoming = all.filter(r => r.notified_at === null && new Date(r.created_at) > day30 && new Date(r.created_at) <= day25);
  const completed = all.filter(r => r.notified_at !== null);

  res.json({ overdue, upcoming, completed: completed.slice(0, 20) });
});

// ─── By Domain (latest scan) — MUST be before /:id ───────────────────────────
router.get("/admin-panel/domain-scans/by-domain/:domain", requireAdmin, async (req: Request, res: Response) => {
  const domain = String(req.params.domain).toLowerCase().trim();
  if (!domain) { res.status(400).json({ error: "Geçersiz domain" }); return; }

  const [scan] = await db
    .select()
    .from(domainScansTable)
    .where(eq(domainScansTable.domain, domain))
    .orderBy(desc(domainScansTable.createdAt))
    .limit(1);

  if (!scan) { res.status(404).json({ error: "Bu domain için tarama bulunamadı" }); return; }
  res.json(scan);
});

// ─── Detail ───────────────────────────────────────────────────────────────────
router.get("/admin-panel/domain-scans/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const [scan] = await db.select().from(domainScansTable).where(eq(domainScansTable.id, id));
  if (!scan) { res.status(404).json({ error: "Tarama bulunamadı" }); return; }

  res.json(scan);
});

// ─── Delete ───────────────────────────────────────────────────────────────────
router.delete("/admin-panel/domain-scans/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const [deleted] = await db.delete(domainScansTable).where(eq(domainScansTable.id, id)).returning({ id: domainScansTable.id });
  if (!deleted) { res.status(404).json({ error: "Tarama bulunamadı" }); return; }

  logger.info({ scanId: id }, "Domain scan deleted by admin");
  res.json({ ok: true });
});

// ─── Manual scan trigger ──────────────────────────────────────────────────────
router.post("/admin-panel/domain-scans/scan", requireAdmin, async (req: Request, res: Response) => {
  const rawDomain: unknown = req.body?.domain;
  if (!rawDomain || typeof rawDomain !== "string" || rawDomain.trim().length < 3) {
    res.status(400).json({ error: "Geçersiz alan adı" });
    return;
  }

  const { sanitizeDomain, checkSPF, checkDMARC, checkDKIM, checkMX, checkSSL, checkHIBP, checkBlacklists, checkShadowIT, calcScore, checkGoogleSafeBrowsing, checkSSLLabs, checkShodan, detectFinalDomain } =
    await import("../domain-scan/index");

  const domain = sanitizeDomain(rawDomain);
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/.test(domain)) {
    res.status(400).json({ error: "Geçersiz alan adı formatı" });
    return;
  }

  logger.info({ domain }, "Admin triggered domain scan");

  try {
    const [spf, dmarc, dkim, mx, ssl, hibp, blacklist, shadowIt, safeBrowsing, sslLabs, shodan] = await Promise.all([
      checkSPF(domain),
      checkDMARC(domain),
      checkDKIM(domain),
      checkMX(domain),
      checkSSL(domain),
      checkHIBP(domain),
      checkBlacklists(domain),
      checkShadowIT(domain),
      checkGoogleSafeBrowsing(domain),
      checkSSLLabs(domain),
      checkShodan(domain),
    ]);

    const { total: overallScore } = calcScore(spf.strength, dmarc.policy ?? null, dkim.pass, mx.pass, ssl.daysUntilExpiry);

    const [scan] = await db.insert(domainScansTable).values({
      domain,
      email: req.body?.email || null,
      spfPass: spf.pass, spfRecord: spf.record,
      dmarcPass: dmarc.pass, dmarcRecord: dmarc.record,
      dkimPass: dkim.pass, dkimSelectors: dkim.selectors,
      mxPass: mx.pass, mxRecords: mx.records,
      sslPass: ssl.pass, sslExpiry: ssl.expiryDate, sslIssuer: ssl.issuer, sslDaysUntilExpiry: ssl.daysUntilExpiry,
      overallScore,
      hibpBreachCount: hibp.breachCount, hibpBreaches: hibp.breaches,
      blacklisted: blacklist.blacklisted, blacklistCount: blacklist.blacklistCount, blacklistResults: blacklist.results,
      shadowItServices: shadowIt.services,
      safeBrowsingFlagged: safeBrowsing !== null ? safeBrowsing.flagged : null,
      safeBrowsingThreats: safeBrowsing?.threats ?? [],
      sslLabsGrade: sslLabs.grade,
      shodanOpenPorts: shodan?.openPorts ?? null,
      shodanVulnCount: shodan?.vulnCount ?? 0,
      shodanCountry: shodan?.country ?? null,
      shodanIsp: shodan?.isp ?? null,
    }).returning();

    // Fire-and-forget: detect redirect domain
    if (scan) {
      setImmediate(async () => {
        try {
          const finalDomain = await detectFinalDomain(domain);
          if (finalDomain && finalDomain !== domain && finalDomain !== `www.${domain}`) {
            await db.execute(sql`UPDATE domain_scans SET redirected_to = ${finalDomain} WHERE id = ${scan.id}`);
            logger.info({ domain, finalDomain, scanId: scan.id }, "Redirect hedefi tespit edildi");
          }
        } catch (e) { logger.warn({ e }, "Redirect detection failed"); }
      });
    }

    logger.info({ domain, overallScore, scanId: scan?.id, hasShodan: !!shodan }, "Admin domain scan complete");
    res.json(scan);
  } catch (err) {
    logger.error({ err, domain }, "Admin domain scan failed");
    res.status(500).json({ error: "Tarama sırasında bir hata oluştu" });
  }
});

// ─── Backfill: open_ports_count + critical/high_cve_count ──────────────────────
router.post("/admin-panel/domain-scans/backfill-counts", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const portResult = await db.execute(sql`
      UPDATE domain_scans
      SET open_ports_count = jsonb_array_length(shodan_open_ports)
      WHERE shodan_open_ports IS NOT NULL
        AND shodan_open_ports::text != 'null'
        AND jsonb_typeof(shodan_open_ports) = 'array'
        AND jsonb_array_length(shodan_open_ports) > 0
        AND open_ports_count = 0
    `);

    const cveResult = await db.execute(sql`
      UPDATE domain_scans
      SET
        critical_cve_count = (
          SELECT COUNT(*)::int
          FROM jsonb_array_elements(cve_summary) AS cve
          WHERE (cve->>'cvssScore')::numeric >= 9.0
        ),
        high_cve_count = (
          SELECT COUNT(*)::int
          FROM jsonb_array_elements(cve_summary) AS cve
          WHERE (cve->>'cvssScore')::numeric >= 7.0
            AND (cve->>'cvssScore')::numeric < 9.0
        )
      WHERE cve_summary IS NOT NULL
        AND cve_summary::text != 'null'
        AND jsonb_typeof(cve_summary) = 'array'
        AND jsonb_array_length(cve_summary) > 0
        AND critical_cve_count = 0
        AND high_cve_count = 0
    `);

    const verifyResult = await db.execute(sql`
      SELECT
        COUNT(*) AS toplam,
        COUNT(*) FILTER (WHERE open_ports_count > 0) AS port_dolu,
        COUNT(*) FILTER (WHERE critical_cve_count > 0) AS kritik_cve_dolu,
        COUNT(*) FILTER (WHERE high_cve_count > 0) AS yuksek_cve_dolu,
        ROUND(AVG(open_ports_count)::numeric, 1) AS ort_port,
        MAX(open_ports_count) AS max_port,
        MAX(critical_cve_count) AS max_kritik_cve
      FROM domain_scans
    `);

    logger.info({ portRows: portResult.rowCount, cveRows: cveResult.rowCount }, "Backfill tamamlandı");
    res.json({
      portUpdated: portResult.rowCount,
      cveUpdated: cveResult.rowCount,
      verification: verifyResult.rows[0],
    });
  } catch (err) {
    logger.error({ err }, "Backfill hatası");
    res.status(500).json({ error: String(err) });
  }
});

export default router;
