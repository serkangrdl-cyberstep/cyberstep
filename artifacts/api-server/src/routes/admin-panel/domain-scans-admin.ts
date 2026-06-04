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
      createdAt: domainScansTable.createdAt,
    })
    .from(domainScansTable)
    .where(where)
    .orderBy(desc(domainScansTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ total: Number(cnt), page, rows });
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

// ─── Scheduled / upcoming re-scans ────────────────────────────────────────────
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

    const overallScore = calcScore(spf.pass, dmarc.policy ?? null, dkim.pass, mx.pass, ssl.daysUntilExpiry ?? 999);

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

export default router;
