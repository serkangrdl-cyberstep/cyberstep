/**
 * Reputation Monitor Admin API — Part 5
 *
 * GET  /api/admin-panel/reputation/summary  — özet istatistikler
 * POST /api/admin-panel/reputation/run-now  — manuel tetikleme (async)
 * GET  /api/admin-panel/reputation/alerts   — sorunlu domain listesi
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { db, domainScansTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "./middleware";
import { logger } from "../../lib/logger";

const router = Router();

// ─── GET /api/admin-panel/reputation/summary ──────────────────────────────────
router.get("/admin-panel/reputation/summary", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await db.execute<{
      total_checked:           number;
      blacklisted_count:       number;
      blacklist_critical_count: number;
      ssl_expiring_soon:       number;
      ssl_critical:            number;
      ssl_invalid:             number;
      poor_mail_reputation:    number;
      unchecked_count:         number;
      last_run_at:             string | null;
    }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE blacklist_checked_at IS NOT NULL)::int    AS total_checked,
        COUNT(*) FILTER (WHERE blacklist_score < 100)::int               AS blacklisted_count,
        COUNT(*) FILTER (WHERE blacklist_score < 50)::int                AS blacklist_critical_count,
        COUNT(*) FILTER (WHERE ssl_days_remaining BETWEEN 8 AND 30)::int AS ssl_expiring_soon,
        COUNT(*) FILTER (WHERE ssl_days_remaining <= 7
                            OR ssl_is_valid = false)::int                AS ssl_critical,
        COUNT(*) FILTER (WHERE ssl_is_valid = false)::int                AS ssl_invalid,
        COUNT(*) FILTER (WHERE mail_reputation_score < 50)::int          AS poor_mail_reputation,
        COUNT(*) FILTER (WHERE blacklist_checked_at IS NULL)::int        AS unchecked_count,
        MAX(blacklist_checked_at)                                         AS last_run_at
      FROM domain_scans
    `);
    res.json(result.rows[0] ?? {});
  } catch (err) {
    logger.error({ err }, "reputation/summary hatası");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/admin-panel/reputation/run-now ─────────────────────────────────
router.post("/admin-panel/reputation/run-now", requireAdmin, async (_req: Request, res: Response) => {
  res.json({ message: "started", timestamp: new Date().toISOString() });
  setImmediate(async () => {
    try {
      const { runReputationMonitoring } = await import("../../services/reputationOrchestrator");
      await runReputationMonitoring();
    } catch (err) {
      logger.error({ err }, "reputation/run-now arka plan hatası");
    }
  });
});

// ─── GET /api/admin-panel/reputation/alerts ───────────────────────────────────
router.get("/admin-panel/reputation/alerts", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await db.execute<{
      domain:               string;
      blacklist_score:      number | null;
      ssl_days_remaining:   number | null;
      ssl_is_valid:         boolean | null;
      ssl_issuer:           string | null;
      mail_reputation_score: number | null;
      mail_spf_valid:       boolean | null;
      mail_dmarc_valid:     boolean | null;
      blacklist_hits:       unknown;
      blacklist_checked_at: string | null;
    }>(sql`
      SELECT
        ds.domain,
        ds.blacklist_score,
        ds.ssl_days_remaining,
        ds.ssl_is_valid,
        ds.ssl_issuer,
        ds.mail_reputation_score,
        ds.mail_spf_valid,
        ds.mail_dmarc_valid,
        ds.blacklist_hits,
        ds.blacklist_checked_at
      FROM domain_scans ds
      WHERE
        ds.blacklist_score < 100
        OR ds.ssl_days_remaining <= 30
        OR ds.ssl_is_valid = false
        OR ds.mail_reputation_score < 50
      ORDER BY
        CASE
          WHEN ds.blacklist_score < 50                                         THEN 0
          WHEN ds.ssl_is_valid = false OR ds.ssl_days_remaining <= 7           THEN 1
          WHEN ds.blacklist_score < 100                                        THEN 2
          WHEN ds.mail_reputation_score < 50                                   THEN 3
          ELSE 4
        END,
        ds.created_at DESC
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (err) {
    logger.error({ err }, "reputation/alerts hatası");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
