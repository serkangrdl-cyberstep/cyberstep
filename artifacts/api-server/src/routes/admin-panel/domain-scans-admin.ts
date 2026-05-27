import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { domainScansTable } from "@workspace/db";
import { count, avg, sql, desc, ilike, or } from "drizzle-orm";
import { requireAdmin } from "./middleware";

const router = Router();

// GET /api/admin-panel/domain-scans/stats
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

// GET /api/admin-panel/domain-scans
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

export default router;
