/**
 * Brand & Typosquatting Monitor Admin API — Part 7
 *
 * GET  /api/admin-panel/brand-monitor/summary  — özet istatistikler
 * GET  /api/admin-panel/brand-monitor/alerts   — şüpheli / aktif TLD swap listesi
 * POST /api/admin-panel/brand-monitor/run-now  — manuel tetikleme (async)
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "./middleware";
import { logger } from "../../lib/logger";

const router = Router();

// ─── GET /api/admin-panel/brand-monitor/summary ───────────────────────────────
router.get(
  "/admin-panel/brand-monitor/summary",
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const result = await db.execute<{
        total_variants_tracked: number;
        suspicious_count:       number;
        active_count:           number;
        customers_monitored:    number;
        last_run_at:            string | null;
      }>(sql`
        SELECT
          COUNT(*)::int                                          AS total_variants_tracked,
          COUNT(*) FILTER (WHERE is_suspicious = true)::int     AS suspicious_count,
          COUNT(*) FILTER (WHERE is_active = true)::int         AS active_count,
          COUNT(DISTINCT customer_id)::int                      AS customers_monitored,
          MAX(last_checked)                                     AS last_run_at
        FROM brand_monitors
      `);
      res.json(result.rows[0] ?? {});
    } catch (err) {
      logger.error({ err }, "brand-monitor/summary hatası");
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── GET /api/admin-panel/brand-monitor/alerts ────────────────────────────────
router.get(
  "/admin-panel/brand-monitor/alerts",
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const result = await db.execute<{
        customer_domain:  string;
        variant_domain:   string;
        variant_type:     string;
        is_suspicious:    boolean;
        http_status:      number | null;
        page_title:       string | null;
        ip_address:       string | null;
        first_detected:   string;
        customer_name:    string | null;
      }>(sql`
        SELECT
          bm.original_domain  AS customer_domain,
          bm.variant_domain,
          bm.variant_type,
          bm.is_suspicious,
          bm.http_status,
          bm.page_title,
          bm.ip_address,
          bm.first_detected,
          c.company_name      AS customer_name
        FROM brand_monitors bm
        LEFT JOIN customers c ON c.id = bm.customer_id
        WHERE
          bm.is_suspicious = true
          OR (bm.is_active = true AND bm.variant_type = 'tld_swap')
        ORDER BY bm.first_detected DESC
        LIMIT 100
      `);
      res.json(result.rows);
    } catch (err) {
      logger.error({ err }, "brand-monitor/alerts hatası");
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── POST /api/admin-panel/brand-monitor/run-now ─────────────────────────────
router.post(
  "/admin-panel/brand-monitor/run-now",
  requireAdmin,
  async (_req: Request, res: Response) => {
    res.json({ message: "started", timestamp: new Date().toISOString() });
    setImmediate(async () => {
      try {
        const { runBrandMonitoring } = await import(
          "../../services/brandMonitor/brandMonitorOrchestrator"
        );
        await runBrandMonitoring();
      } catch (err) {
        logger.error({ err }, "brand-monitor/run-now arka plan hatası");
      }
    });
  }
);

export default router;
