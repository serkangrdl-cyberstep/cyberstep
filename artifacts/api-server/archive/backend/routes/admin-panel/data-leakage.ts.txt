import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../../middleware/auth";
import { logger } from "../../lib/logger";

const router = Router();

// ─── GET /api/admin-panel/data-leakage/summary ───────────────────────────────
router.get("/admin-panel/data-leakage/summary", requireAdmin, async (_req, res) => {
  try {
    const [totals, lastScan] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*)                                              AS total_incidents,
          COUNT(*) FILTER (WHERE severity = 'critical')        AS critical_count,
          COUNT(*) FILTER (WHERE severity = 'high')            AS high_count,
          COUNT(*) FILTER (WHERE is_new = true)                AS new_unread_count,
          COUNT(DISTINCT customer_id)                          AS customers_affected
        FROM leakage_incidents
      `),
      db.execute(sql`
        SELECT scanned_at FROM leakage_scan_log
        ORDER BY scanned_at DESC LIMIT 1
      `),
    ]);

    const t = totals.rows[0] as {
      total_incidents: string;
      critical_count: string;
      high_count: string;
      new_unread_count: string;
      customers_affected: string;
    } | undefined;

    res.json({
      total_incidents:       parseInt(t?.total_incidents  ?? "0", 10),
      critical_count:        parseInt(t?.critical_count   ?? "0", 10),
      high_count:            parseInt(t?.high_count       ?? "0", 10),
      new_unread_count:      parseInt(t?.new_unread_count ?? "0", 10),
      customers_affected:    parseInt(t?.customers_affected ?? "0", 10),
      last_scan_at:          (lastScan.rows[0] as { scanned_at: string } | undefined)?.scanned_at ?? null,
      hibp_configured:       !!process.env["HIBP_API_KEY"],
      dehashed_configured:   !!(process.env["DEHASHED_API_KEY"] && process.env["DEHASHED_EMAIL"]),
    });
  } catch (err) {
    logger.error({ err }, "data-leakage summary failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── GET /api/admin-panel/data-leakage/incidents ─────────────────────────────
router.get("/admin-panel/data-leakage/incidents", requireAdmin, async (req, res) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const severity   = q["severity"];
    const customerId = q["customer_id"] ? Number(q["customer_id"]) : null;
    const isNew      = q["is_new"] === "true" ? true : q["is_new"] === "false" ? false : null;

    const conditions: string[] = [];
    if (severity)              conditions.push(`li.severity = '${severity.replace(/['"]/g, "")}'`);
    if (customerId !== null)   conditions.push(`li.customer_id = ${customerId}`);
    if (isNew !== null)        conditions.push(`li.is_new = ${isNew}`);

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const rows = await db.execute(sql.raw(`
      SELECT
        li.id,
        li.customer_id,
        li.customer_domain,
        li.breach_source,
        li.breach_date,
        li.affected_email_count,
        li.data_types,
        li.severity,
        li.is_new,
        li.source_api,
        li.first_detected,
        li.last_verified,
        c.email         AS customer_email,
        c.company_name  AS customer_name
      FROM leakage_incidents li
      LEFT JOIN customers c ON c.id = li.customer_id
      ${where}
      ORDER BY li.first_detected DESC
      LIMIT 50
    `));

    // KVKK: affected_emails is never returned
    res.json(rows.rows);
  } catch (err) {
    logger.error({ err }, "data-leakage incidents failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── POST /api/admin-panel/data-leakage/mark-read ────────────────────────────
router.post("/admin-panel/data-leakage/mark-read", requireAdmin, async (req, res) => {
  const body = req.body as { incident_ids?: number[] };
  const ids  = body.incident_ids ?? [];
  if (ids.length === 0) { res.status(400).json({ error: "incident_ids gerekli" }); return; }
  try {
    await db.execute(sql`
      UPDATE leakage_incidents
      SET is_new = false
      WHERE id = ANY(${ids as unknown as number[]})
    `);
    res.json({ updated: ids.length });
  } catch (err) {
    logger.error({ err }, "data-leakage mark-read failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── POST /api/admin-panel/data-leakage/run-now ──────────────────────────────
router.post("/admin-panel/data-leakage/run-now", requireAdmin, async (_req, res) => {
  res.json({ message: "started", timestamp: new Date().toISOString() });
  setImmediate(async () => {
    try {
      const { runLeakageMonitoring } = await import("../../services/dataLeakage/leakageOrchestrator");
      const result = await runLeakageMonitoring();
      logger.info(result, "data-leakage run-now tamamlandı");
    } catch (err) {
      logger.error({ err }, "data-leakage run-now hatası");
    }
  });
});

// ─── GET /api/admin-panel/data-leakage/customer/:customerId ──────────────────
router.get("/admin-panel/data-leakage/customer/:customerId", requireAdmin, async (req, res) => {
  const customerId = Number(req.params["customerId"]);
  if (isNaN(customerId)) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  try {
    const [incidents, scanLog] = await Promise.all([
      db.execute(sql`
        SELECT
          id, breach_source, breach_date, affected_email_count,
          data_types, severity, is_new, source_api, first_detected, last_verified
        FROM leakage_incidents
        WHERE customer_id = ${customerId}
        ORDER BY first_detected DESC
      `),
      db.execute(sql`
        SELECT scanned_at, api_used, breaches_found, new_breaches, error_message, duration_ms
        FROM leakage_scan_log
        WHERE customer_id = ${customerId}
        ORDER BY scanned_at DESC
        LIMIT 10
      `),
    ]);
    res.json({ incidents: incidents.rows, scan_log: scanLog.rows });
  } catch (err) {
    logger.error({ err, customerId }, "data-leakage customer detail failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
