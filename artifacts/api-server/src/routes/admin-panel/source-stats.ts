import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "./middleware";

const router = Router();

router.get("/admin-panel/source-stats", requireAdmin, async (req: Request, res: Response) => {
  try {
    const days = Math.min(parseInt(req.query["days"] as string) || 30, 9999);
    const since = days >= 9999
      ? new Date("2000-01-01")
      : new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [statsResult, totalsResult, trendResult, tldResult, enrichmentResult, sectorMethodResult, cityMethodResult] = await Promise.all([
      db.execute(sql`
        SELECT
          COALESCE(source, 'unknown')                               AS source,
          COUNT(*)                                                  AS total_discovered,
          COUNT(*) FILTER (WHERE scan_status != 'pending')          AS total_scanned,
          COUNT(*) FILTER (WHERE is_qualified = true)               AS qualified_count,
          COUNT(*) FILTER (WHERE teaser_sent_at IS NOT NULL)        AS teaser_sent,
          ROUND(AVG(risk_score) FILTER (WHERE risk_score IS NOT NULL), 1) AS avg_score,
          ROUND(
            COUNT(*) FILTER (WHERE is_qualified = true)::numeric
            / NULLIF(COUNT(*) FILTER (WHERE scan_status != 'pending'), 0) * 100
          , 1)                                                      AS qualification_rate,
          MIN(created_at)                                           AS first_seen,
          MAX(created_at)                                           AS last_seen,
          COUNT(*) FILTER (WHERE created_at >= ${since})            AS discovered_last_period
        FROM lead_candidates
        GROUP BY source
        ORDER BY total_discovered DESC
      `),
      db.execute(sql`
        SELECT
          COUNT(*)                                                  AS total,
          COUNT(*) FILTER (WHERE is_qualified = true)               AS total_qualified,
          ROUND(
            COUNT(*) FILTER (WHERE is_qualified = true)::numeric
            / NULLIF(COUNT(*) FILTER (WHERE scan_status != 'pending'), 0) * 100
          , 1)                                                      AS overall_qualification_rate,
          COUNT(DISTINCT source)                                    AS active_sources
        FROM lead_candidates
      `),
      db.execute(sql`
        SELECT
          DATE(created_at) AS day,
          COALESCE(source, 'unknown') AS source,
          COUNT(*) AS count
        FROM lead_candidates
        WHERE created_at >= NOW() - INTERVAL '14 days'
        GROUP BY DATE(created_at), source
        ORDER BY day ASC
      `),
      db.execute(sql`
        SELECT
          CASE
            WHEN domain LIKE '%.com.tr'  THEN 'com.tr'
            WHEN domain LIKE '%.net.tr'  THEN 'net.tr'
            WHEN domain LIKE '%.org.tr'  THEN 'org.tr'
            WHEN domain LIKE '%.biz.tr'  THEN 'biz.tr'
            WHEN domain LIKE '%.edu.tr'  THEN 'edu.tr'
            WHEN domain LIKE '%.web.tr'  THEN 'web.tr'
            WHEN domain LIKE '%.gen.tr'  THEN 'gen.tr'
            WHEN domain LIKE '%.info.tr' THEN 'info.tr'
            ELSE 'other'
          END                                                       AS tld,
          COUNT(*)                                                  AS total,
          ROUND(AVG(risk_score) FILTER (WHERE risk_score IS NOT NULL), 1) AS avg_score,
          COUNT(*) FILTER (WHERE is_qualified = true)               AS qualified,
          ROUND(
            COUNT(*) FILTER (WHERE is_qualified = true)::numeric
            / NULLIF(COUNT(*) FILTER (WHERE scan_status != 'pending'), 0) * 100
          , 1)                                                      AS qualification_rate
        FROM lead_candidates
        GROUP BY tld
        ORDER BY total DESC
      `),
      db.execute(sql`
        SELECT
          COALESCE(source, 'unknown')                                                     AS source,
          COUNT(*)                                                                         AS total,
          COUNT(*) FILTER (WHERE sector IS NOT NULL AND sector != '')                     AS has_sector,
          COUNT(*) FILTER (WHERE city IS NOT NULL AND city != '')                         AS has_city,
          COUNT(*) FILTER (WHERE sector IS NOT NULL AND sector != ''
                               AND city IS NOT NULL AND city != '')                       AS has_both,
          ROUND(
            COUNT(*) FILTER (WHERE sector IS NOT NULL AND sector != '')::numeric
            / NULLIF(COUNT(*), 0) * 100
          , 1)                                                                             AS sector_fill_rate,
          ROUND(
            COUNT(*) FILTER (WHERE city IS NOT NULL AND city != '')::numeric
            / NULLIF(COUNT(*), 0) * 100
          , 1)                                                                             AS city_fill_rate
        FROM lead_candidates
        GROUP BY source
        ORDER BY total DESC
      `),
      // Sektör zenginleştirme yöntemi dağılımı
      db.execute(sql`
        SELECT
          CASE
            WHEN sector_confidence = 'tld_rule'        THEN 'tld_rule'
            WHEN sector_confidence = 'keyword_multi'   THEN 'keyword_multi'
            WHEN sector_confidence = 'keyword_single'  THEN 'keyword_single'
            WHEN sector_enriched_at IS NOT NULL AND sector IS NULL THEN 'unmatched'
            WHEN sector_enriched_at IS NULL             THEN 'pending'
            ELSE 'manual_import'
          END                                           AS method,
          COUNT(*)                                      AS count,
          ROUND(COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER (), 0) * 100, 1) AS pct
        FROM lead_candidates
        GROUP BY 1
        ORDER BY count DESC
      `),
      // Şehir zenginleştirme yöntemi dağılımı
      db.execute(sql`
        SELECT
          CASE
            WHEN city IS NOT NULL AND domain LIKE '%.bel.tr' THEN 'bel_tr_pattern'
            WHEN city IS NOT NULL AND geo_enriched_at IS NOT NULL THEN 'geo_api'
            WHEN city IS NOT NULL                              THEN 'other_source'
            ELSE 'empty'
          END                                           AS method,
          COUNT(*)                                      AS count,
          ROUND(COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER (), 0) * 100, 1) AS pct
        FROM lead_candidates
        GROUP BY 1
        ORDER BY count DESC
      `),
    ]);

    res.json({
      stats: statsResult.rows,
      totals: totalsResult.rows[0] ?? {
        total: 0, total_qualified: 0,
        overall_qualification_rate: 0, active_sources: 0,
      },
      trend: trendResult.rows,
      tldStats: tldResult.rows,
      enrichmentStats: enrichmentResult.rows,
      sectorMethodStats: sectorMethodResult.rows,
      cityMethodStats: cityMethodResult.rows,
      period: days,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export async function getSourceQualityStats(days = 30): Promise<Array<{
  source: string;
  total_scanned: number;
  qualified_count: number;
  qualification_rate: number;
}>> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await db.execute(sql`
    SELECT
      COALESCE(source, 'unknown') AS source,
      COUNT(*) FILTER (WHERE scan_status != 'pending') AS total_scanned,
      COUNT(*) FILTER (WHERE is_qualified = true)       AS qualified_count,
      ROUND(
        COUNT(*) FILTER (WHERE is_qualified = true)::numeric
        / NULLIF(COUNT(*) FILTER (WHERE scan_status != 'pending'), 0) * 100
      , 1) AS qualification_rate
    FROM lead_candidates
    WHERE created_at >= ${since}
    GROUP BY source
  `);
  return result.rows as Array<{
    source: string; total_scanned: number;
    qualified_count: number; qualification_rate: number;
  }>;
}

export default router;
