import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../../middleware/auth";
import { logger } from "../../lib/logger";

const router = Router();

// GET /api/admin-panel/dns-monitor/changes — severity-prioritized, with SOC case link
router.get("/admin-panel/dns-monitor/changes", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT
        e.id,
        e.customer_id,
        c.email      AS customer_email,
        c.company_name,
        e.domain,
        e.record_type,
        e.old_values,
        e.new_values,
        e.severity,
        e.soc_case_id,
        sc.case_number AS soc_case_number,
        e.detected_at
      FROM dns_change_events e
      JOIN customers c ON c.id = e.customer_id
      LEFT JOIN soc_cases sc ON sc.id = e.soc_case_id
      ORDER BY
        CASE e.severity
          WHEN 'critical' THEN 1
          WHEN 'high'     THEN 2
          WHEN 'medium'   THEN 3
          ELSE 4
        END,
        e.detected_at DESC
      LIMIT 100
    `);
    res.json((result as unknown as { rows: unknown[] }).rows);
  } catch (err) {
    logger.error({ err }, "GET admin dns-monitor/changes failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/admin-panel/dns-monitor/domains — all watched domains
router.get("/admin-panel/dns-monitor/domains", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT
        d.id,
        d.customer_id,
        c.email      AS customer_email,
        c.company_name,
        d.domain,
        d.is_active,
        d.created_at,
        d.last_checked_at,
        (SELECT COUNT(*) FROM dns_change_events e WHERE e.customer_id = d.customer_id AND e.domain = d.domain)::int AS change_count
      FROM dns_watched_domains d
      JOIN customers c ON c.id = d.customer_id
      ORDER BY d.created_at DESC
    `);
    res.json((result as unknown as { rows: unknown[] }).rows);
  } catch (err) {
    logger.error({ err }, "GET admin dns-monitor/domains failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/admin-panel/dns-monitor/stats
router.get("/admin-panel/dns-monitor/stats", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await db.execute<{ watched: string; changes24h: string; critical24h: string }>(sql`
      SELECT
        (SELECT COUNT(*) FROM dns_watched_domains WHERE is_active = true)::text AS watched,
        (SELECT COUNT(*) FROM dns_change_events WHERE detected_at > NOW() - INTERVAL '24 hours')::text AS changes24h,
        (SELECT COUNT(*) FROM dns_change_events
          WHERE detected_at > NOW() - INTERVAL '24 hours'
            AND severity IN ('critical','high'))::text AS critical24h
    `);
    const row = (result as unknown as { rows: { watched: string; changes24h: string; critical24h: string }[] }).rows[0];
    res.json({
      watched: Number(row?.watched ?? 0),
      changes24h: Number(row?.changes24h ?? 0),
      critical24h: Number(row?.critical24h ?? 0),
    });
  } catch (err) {
    logger.error({ err }, "GET admin dns-monitor/stats failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
