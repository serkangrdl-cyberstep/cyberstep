import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireCustomer } from "../../middleware/auth";
import { logger } from "../../lib/logger";

const router = Router();

router.get("/portal/ct-monitor/events", requireCustomer, async (req: Request, res: Response) => {
  const session = req.session as { customerId?: number };
  const customerId = session.customerId;
  if (!customerId) { res.status(401).json({ error: "Oturum bulunamadı" }); return; }

  const suspicious = req.query["suspicious"] === "true" ? true : null;
  const domain = typeof req.query["domain"] === "string" ? req.query["domain"] : null;
  const limit = Math.min(Number(req.query["limit"] ?? 50), 200);

  try {
    const rows = await db.execute(sql`
      SELECT id, domain, cert_domain, issuer, sans, not_before, not_after,
             cert_fingerprint, detected_at, is_suspicious
      FROM ct_certificate_events
      WHERE customer_id = ${customerId}
        ${suspicious !== null ? sql`AND is_suspicious = ${suspicious}` : sql``}
        ${domain ? sql`AND domain = ${domain}` : sql``}
      ORDER BY detected_at DESC
      LIMIT ${limit}
    `);
    res.json({ events: rows.rows });
  } catch (err) {
    req.log.error({ err }, "ct-monitor: failed to fetch events");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.get("/portal/ct-monitor/stats", requireCustomer, async (req: Request, res: Response) => {
  const session = req.session as { customerId?: number };
  const customerId = session.customerId;
  if (!customerId) { res.status(401).json({ error: "Oturum bulunamadı" }); return; }

  try {
    const [stats] = (await db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE is_suspicious = true)::int AS suspicious,
        COUNT(*) FILTER (WHERE detected_at > NOW() - INTERVAL '24 hours')::int AS last_24h,
        COUNT(*) FILTER (WHERE detected_at > NOW() - INTERVAL '7 days')::int AS last_7d
      FROM ct_certificate_events
      WHERE customer_id = ${customerId}
    `)).rows as [{ total: number; suspicious: number; last_24h: number; last_7d: number }];

    res.json({ stats: stats ?? { total: 0, suspicious: 0, last_24h: 0, last_7d: 0 } });
  } catch (err) {
    req.log.error({ err }, "ct-monitor: failed to fetch stats");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;

export async function ensureCtTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ct_certificate_events (
      id               SERIAL PRIMARY KEY,
      customer_id      INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      domain           TEXT NOT NULL,
      cert_domain      TEXT NOT NULL,
      issuer           TEXT,
      sans             JSONB NOT NULL DEFAULT '[]',
      not_before       TIMESTAMP,
      not_after        TIMESTAMP,
      cert_fingerprint TEXT,
      detected_at      TIMESTAMP NOT NULL DEFAULT NOW(),
      is_suspicious    BOOLEAN NOT NULL DEFAULT false,
      UNIQUE(cert_fingerprint, domain)
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS ct_cert_events_customer_idx ON ct_certificate_events(customer_id, detected_at DESC)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS ct_cert_events_suspicious_idx ON ct_certificate_events(is_suspicious) WHERE is_suspicious = true`);
  logger.info("ct_certificate_events table ensured");
}
