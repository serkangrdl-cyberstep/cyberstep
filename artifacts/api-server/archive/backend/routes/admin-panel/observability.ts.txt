import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAdmin } from "./middleware";
import { logger } from "../../lib/logger";

const router = Router();

interface SummaryRow extends Record<string, unknown> { cnt: string }
interface IntegrationRow extends Record<string, unknown> {
  id: number; customer_id: number; customer_email: string | null;
  provider: string; display_name: string | null; is_active: boolean;
  last_event_at: string | null; event_count: number; created_at: string;
}
interface EventRow extends Record<string, unknown> {
  id: number; customer_id: number; customer_email: string | null;
  provider: string; event_type: string; severity: string | null;
  title: string | null; affected_service: string | null;
  processed: boolean; correlated_soc_case_id: number | null; received_at: string;
}

// GET /api/admin-panel/observability/summary
router.get("/admin-panel/observability/summary", requireAdmin, async (_req, res) => {
  try {
    const { rows: [total] } = await pool.query<SummaryRow>(
      `SELECT count(*)::int AS cnt FROM observability_integrations`
    );
    const { rows: [events24h] } = await pool.query<SummaryRow>(
      `SELECT count(*)::int AS cnt FROM observability_events WHERE received_at >= NOW() - INTERVAL '24 hours'`
    );
    const { rows: [correlated] } = await pool.query<SummaryRow>(
      `SELECT count(*)::int AS cnt FROM observability_events WHERE received_at >= NOW() - INTERVAL '24 hours' AND processed = true`
    );
    res.json({
      totalIntegrations: Number(total?.cnt ?? 0),
      events24h: Number(events24h?.cnt ?? 0),
      correlated24h: Number(correlated?.cnt ?? 0),
    });
  } catch (err) {
    logger.error({ err }, "GET /api/admin-panel/observability/summary error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/admin-panel/observability/integrations
router.get("/admin-panel/observability/integrations", requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query<IntegrationRow>(
      `SELECT oi.id, oi.customer_id, c.email AS customer_email,
              oi.provider, oi.display_name, oi.is_active,
              oi.last_event_at, oi.event_count, oi.created_at
       FROM observability_integrations oi
       LEFT JOIN customers c ON oi.customer_id = c.id
       ORDER BY oi.last_event_at DESC NULLS LAST`
    );
    const integrations = rows.map(r => ({
      id: r.id, customerId: r.customer_id, customerEmail: r.customer_email,
      provider: r.provider, displayName: r.display_name, isActive: r.is_active,
      lastEventAt: r.last_event_at, eventCount: r.event_count, createdAt: r.created_at,
    }));
    res.json({ integrations });
  } catch (err) {
    logger.error({ err }, "GET /api/admin-panel/observability/integrations error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/admin-panel/observability/events
router.get("/admin-panel/observability/events", requireAdmin, async (req, res) => {
  const provider = req.query["provider"] as string | undefined;
  try {
    const providerClause = provider ? `AND oe.provider = '${provider.replace(/'/g, "''")}'` : "";
    const { rows } = await pool.query<EventRow>(
      `SELECT oe.id, oe.customer_id, c.email AS customer_email,
              oe.provider, oe.event_type, oe.severity, oe.title,
              oe.affected_service, oe.processed, oe.correlated_soc_case_id, oe.received_at
       FROM observability_events oe
       LEFT JOIN customers c ON oe.customer_id = c.id
       WHERE 1=1 ${providerClause}
       ORDER BY oe.received_at DESC
       LIMIT 100`
    );
    const events = rows.map(r => ({
      id: r.id, customerId: r.customer_id, customerEmail: r.customer_email,
      provider: r.provider, eventType: r.event_type, severity: r.severity,
      title: r.title, affectedService: r.affected_service,
      processed: r.processed, correlatedSocCaseId: r.correlated_soc_case_id,
      receivedAt: r.received_at,
    }));
    res.json({ events });
  } catch (err) {
    logger.error({ err }, "GET /api/admin-panel/observability/events error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
