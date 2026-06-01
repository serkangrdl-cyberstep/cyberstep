import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAdmin } from "./middleware";
import { logger } from "../../lib/logger";

const router = Router();

// GET /api/admin-panel/servicenow/summary
router.get("/admin-panel/servicenow/summary", requireAdmin, async (_req, res) => {
  try {
    const { rows: [totals] } = await pool.query<{
      total_configs: string; active_configs: string;
      total_incidents: string; open_incidents: string;
    }>(
      `SELECT
         COUNT(DISTINCT snc.id)::int AS total_configs,
         COUNT(DISTINCT CASE WHEN snc.active THEN snc.id END)::int AS active_configs,
         COUNT(sni.id)::int AS total_incidents,
         COUNT(CASE WHEN sni.sn_state NOT IN (6, 7) THEN 1 END)::int AS open_incidents
       FROM servicenow_configs snc
       LEFT JOIN servicenow_incidents sni ON sni.config_id = snc.id`
    );

    // Aggregate webhook stats from configs only — no incident join to avoid row multiplication
    const { rows: [webhookTotals] } = await pool.query<{
      total_webhook_events: string; configs_with_webhook: string;
    }>(
      `SELECT
         COALESCE(SUM(webhook_event_count), 0)::int AS total_webhook_events,
         COUNT(CASE WHEN last_webhook_at IS NOT NULL THEN 1 END)::int AS configs_with_webhook
       FROM servicenow_configs`
    );

    const { rows: [syncStats] } = await pool.query<{ success: string; errors: string }>(
      `SELECT
         COUNT(CASE WHEN last_sync_error IS NULL AND last_sync_at IS NOT NULL THEN 1 END)::int AS success,
         COUNT(CASE WHEN last_sync_error IS NOT NULL THEN 1 END)::int AS errors
       FROM servicenow_configs
       WHERE last_sync_at >= NOW() - INTERVAL '24 hours' OR last_sync_error IS NOT NULL`
    );

    // Pending cases: created in last 48h, no servicenow_incidents record, customer has a SN config
    const { rows: [pendingRow] } = await pool.query<{ total_pending: string; customers_with_pending: string }>(
      `SELECT
         COUNT(sc.id)::int AS total_pending,
         COUNT(DISTINCT sc.customer_id)::int AS customers_with_pending
       FROM soc_cases sc
       WHERE sc.created_at >= NOW() - INTERVAL '48 hours'
         AND NOT EXISTS (
           SELECT 1 FROM servicenow_incidents sni WHERE sni.soc_case_id = sc.id
         )
         AND EXISTS (
           SELECT 1 FROM servicenow_configs snc WHERE snc.customer_id = sc.customer_id
         )`
    );

    res.json({
      totalConfigs: Number(totals?.total_configs ?? 0),
      activeConfigs: Number(totals?.active_configs ?? 0),
      totalIncidents: Number(totals?.total_incidents ?? 0),
      openIncidents: Number(totals?.open_incidents ?? 0),
      syncSuccess24h: Number(syncStats?.success ?? 0),
      syncErrors24h: Number(syncStats?.errors ?? 0),
      totalWebhookEvents: Number(webhookTotals?.total_webhook_events ?? 0),
      configsWithWebhook: Number(webhookTotals?.configs_with_webhook ?? 0),
      totalPendingCases: Number(pendingRow?.total_pending ?? 0),
      customersWithPending: Number(pendingRow?.customers_with_pending ?? 0),
    });
  } catch (err) {
    logger.error({ err }, "GET /api/admin-panel/servicenow/summary error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/admin-panel/servicenow/configs
router.get("/admin-panel/servicenow/configs", requireAdmin, async (_req, res) => {
  try {
    const errOnly = _req.query.errOnly === "1";
    const pendingOnly = _req.query.pendingOnly === "1";
    const { rows } = await pool.query(
      `SELECT snc.id, snc.customer_id AS "customerId",
              c.email AS "customerEmail", c.company_name AS "companyName",
              snc.instance_url AS "instanceUrl", snc.username,
              snc.assignment_group AS "assignmentGroup", snc.category,
              snc.active, snc.last_sync_at AS "lastSyncAt",
              snc.last_sync_error AS "lastSyncError",
              snc.conn_check_alerted_at AS "connCheckAlertedAt",
              snc.last_webhook_at AS "lastWebhookAt",
              snc.webhook_event_count AS "webhookEventCount",
              COUNT(sni.id)::int AS "incidentCount",
              COUNT(CASE WHEN sni.sn_state NOT IN (6, 7) THEN 1 END)::int AS "openCount",
              (
                SELECT COUNT(sc.id)::int
                FROM soc_cases sc
                WHERE sc.customer_id = snc.customer_id
                  AND sc.created_at >= NOW() - INTERVAL '48 hours'
                  AND NOT EXISTS (
                    SELECT 1 FROM servicenow_incidents sni2 WHERE sni2.soc_case_id = sc.id
                  )
              ) AS "pendingCaseCount"
       FROM servicenow_configs snc
       JOIN customers c ON c.id = snc.customer_id
       LEFT JOIN servicenow_incidents sni ON sni.config_id = snc.id
       ${errOnly ? "WHERE snc.last_sync_error IS NOT NULL" : ""}
       GROUP BY snc.id, c.email, c.company_name
       ${pendingOnly ? `HAVING (
         SELECT COUNT(sc.id) FROM soc_cases sc
         WHERE sc.customer_id = snc.customer_id
           AND sc.created_at >= NOW() - INTERVAL '48 hours'
           AND NOT EXISTS (SELECT 1 FROM servicenow_incidents sni2 WHERE sni2.soc_case_id = sc.id)
       ) > 0` : ""}
       ORDER BY "pendingCaseCount" DESC NULLS LAST, snc.last_sync_error DESC NULLS LAST, snc.created_at DESC`
    );
    res.json({ configs: rows });
  } catch (err) {
    logger.error({ err }, "GET /api/admin-panel/servicenow/configs error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/admin-panel/servicenow/incidents
router.get("/admin-panel/servicenow/incidents", requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT sni.id, sni.sn_number AS "snNumber", sni.sn_state AS "snState",
              sni.last_synced_at AS "lastSyncedAt", sni.sync_error AS "syncError",
              sni.created_at AS "createdAt",
              sc.case_number AS "caseNumber", sc.title AS "caseTitle",
              sc.status AS "caseStatus", sc.severity,
              c.company_name AS "companyName"
       FROM servicenow_incidents sni
       JOIN soc_cases sc ON sc.id = sni.soc_case_id
       JOIN customers c ON c.id = sni.customer_id
       ORDER BY sni.created_at DESC
       LIMIT 200`
    );
    res.json({ incidents: rows });
  } catch (err) {
    logger.error({ err }, "GET /api/admin-panel/servicenow/incidents error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
