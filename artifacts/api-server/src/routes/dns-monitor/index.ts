import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireCustomer } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { resolveDnsSnapshot } from "../../services/dnsResolver";

const router = Router();

// ─── Portal: watched domains ──────────────────────────────────────────────────

router.get("/portal/dns-monitor/domains", requireCustomer, async (req: Request, res: Response) => {
  const customerId = (req as unknown as { customerId: number }).customerId;
  try {
    const result = await db.execute(sql`
      SELECT id, domain, is_active, created_at, last_checked_at
      FROM dns_watched_domains
      WHERE customer_id = ${customerId}
      ORDER BY created_at DESC
    `);
    res.json((result as unknown as { rows: unknown[] }).rows);
  } catch (err) {
    logger.error({ err }, "GET dns-monitor/domains failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.post("/portal/dns-monitor/domains", requireCustomer, async (req: Request, res: Response) => {
  const customerId = (req as unknown as { customerId: number }).customerId;
  const { domain } = req.body as { domain?: string };

  if (!domain || typeof domain !== "string") {
    res.status(400).json({ error: "domain zorunlu" });
    return;
  }

  const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  try {
    const existing = await db.execute(sql`
      SELECT id FROM dns_watched_domains WHERE customer_id = ${customerId} AND domain = ${clean}
    `);
    if ((existing as unknown as { rows: unknown[] }).rows.length > 0) {
      res.status(409).json({ error: "Bu domain zaten izleniyor" });
      return;
    }

    const countResult = await db.execute<{ cnt: string }>(sql`
      SELECT COUNT(*) AS cnt FROM dns_watched_domains WHERE customer_id = ${customerId} AND is_active = true
    `);
    const cnt = Number((countResult as unknown as { rows: { cnt: string }[] }).rows[0]?.cnt ?? 0);
    if (cnt >= 10) {
      res.status(400).json({ error: "En fazla 10 domain izlenebilir" });
      return;
    }

    await db.execute(sql`
      INSERT INTO dns_watched_domains (customer_id, domain, is_active)
      VALUES (${customerId}, ${clean}, true)
    `);

    // İlk snapshot al
    const snap = await resolveDnsSnapshot(clean).catch(() => null);
    if (snap) {
      await db.execute(sql`
        INSERT INTO dns_snapshots (customer_id, domain, a_records, mx_records, ns_records, txt_records, cname_records)
        VALUES (
          ${customerId}, ${clean},
          ${JSON.stringify(snap.A)}::jsonb, ${JSON.stringify(snap.MX)}::jsonb,
          ${JSON.stringify(snap.NS)}::jsonb, ${JSON.stringify(snap.TXT)}::jsonb,
          ${JSON.stringify(snap.CNAME)}::jsonb
        )
      `);
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "POST dns-monitor/domains failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

router.delete("/portal/dns-monitor/domains/:id", requireCustomer, async (req: Request, res: Response) => {
  const customerId = (req as unknown as { customerId: number }).customerId;
  const id = Number(req.params["id"]);

  try {
    await db.execute(sql`
      DELETE FROM dns_watched_domains WHERE id = ${id} AND customer_id = ${customerId}
    `);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE dns-monitor/domains failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── Portal: change events ────────────────────────────────────────────────────

router.get("/portal/dns-monitor/changes", requireCustomer, async (req: Request, res: Response) => {
  const customerId = (req as unknown as { customerId: number }).customerId;
  const domain = req.query["domain"] as string | undefined;

  try {
    const result = await db.execute(sql`
      SELECT id, domain, record_type, old_values, new_values, severity, soc_case_id, detected_at
      FROM dns_change_events
      WHERE customer_id = ${customerId}
        ${domain ? sql`AND domain = ${domain}` : sql``}
      ORDER BY detected_at DESC
      LIMIT 50
    `);
    res.json((result as unknown as { rows: unknown[] }).rows);
  } catch (err) {
    logger.error({ err }, "GET dns-monitor/changes failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── Portal: current snapshot ─────────────────────────────────────────────────

router.get("/portal/dns-monitor/snapshot/:domain", requireCustomer, async (req: Request, res: Response) => {
  const customerId = (req as unknown as { customerId: number }).customerId;
  const domain = req.params["domain"]!;

  try {
    const result = await db.execute(sql`
      SELECT a_records, mx_records, ns_records, txt_records, cname_records, checked_at
      FROM dns_snapshots
      WHERE customer_id = ${customerId} AND domain = ${domain}
      ORDER BY checked_at DESC
      LIMIT 1
    `);
    const row = (result as unknown as { rows: unknown[] }).rows[0];
    if (!row) {
      res.status(404).json({ error: "Snapshot bulunamadı" });
      return;
    }
    res.json(row);
  } catch (err) {
    logger.error({ err }, "GET dns-monitor/snapshot failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
