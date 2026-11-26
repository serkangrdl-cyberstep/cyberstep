import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../../middleware/auth";

const router = Router();

router.get("/admin-panel/ct-monitor/events", requireAdmin, async (req: Request, res: Response) => {
  const suspicious = req.query["suspicious"] === "true" ? true : null;
  const domain = typeof req.query["domain"] === "string" ? req.query["domain"] : null;
  const limit = Math.min(Number(req.query["limit"] ?? 100), 500);

  try {
    const rows = await db.execute(sql`
      SELECT e.id, e.domain, e.cert_domain, e.issuer, e.sans, e.not_before, e.not_after,
             e.cert_fingerprint, e.detected_at, e.is_suspicious,
             c.company_name AS customer_name, e.customer_id
      FROM ct_certificate_events e
      JOIN customers c ON c.id = e.customer_id
      WHERE 1=1
        ${suspicious !== null ? sql`AND e.is_suspicious = ${suspicious}` : sql``}
        ${domain ? sql`AND e.domain = ${domain}` : sql``}
      ORDER BY e.detected_at DESC
      LIMIT ${limit}
    `);
    res.json({ events: rows.rows });
  } catch (err) {
    req.log.error({ err }, "admin ct-monitor: failed to fetch events");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.get("/admin-panel/ct-monitor/stats", requireAdmin, async (req: Request, res: Response) => {
  try {
    const [global] = (await db.execute(sql`
      SELECT
        COUNT(*)::int AS total_events,
        COUNT(*) FILTER (WHERE is_suspicious = true)::int AS suspicious_total,
        COUNT(*) FILTER (WHERE detected_at > NOW() - INTERVAL '24 hours')::int AS last_24h,
        COUNT(*) FILTER (WHERE detected_at > NOW() - INTERVAL '7 days')::int AS last_7d,
        COUNT(DISTINCT customer_id)::int AS monitored_customers,
        COUNT(DISTINCT domain)::int AS monitored_domains
      FROM ct_certificate_events
    `)).rows as [{ total_events: number; suspicious_total: number; last_24h: number; last_7d: number; monitored_customers: number; monitored_domains: number }];

    const topDomains = (await db.execute(sql`
      SELECT domain, COUNT(*)::int AS cnt, COUNT(*) FILTER (WHERE is_suspicious)::int AS suspicious
      FROM ct_certificate_events
      GROUP BY domain
      ORDER BY cnt DESC
      LIMIT 10
    `)).rows;

    res.json({ stats: global, topDomains });
  } catch (err) {
    req.log.error({ err }, "admin ct-monitor: stats failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
