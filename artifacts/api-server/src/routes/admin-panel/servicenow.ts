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

    const { rows: [syncStats] } = await pool.query<{ success: string; errors: string }>(
      `SELECT
         COUNT(CASE WHEN last_sync_error IS NULL AND last_sync_at IS NOT NULL THEN 1 END)::int AS success,
         COUNT(CASE WHEN last_sync_error IS NOT NULL THEN 1 END)::int AS errors
       FROM servicenow_configs
       WHERE last_sync_at >= NOW() - INTERVAL '24 hours' OR last_sync_error IS NOT NULL`
    );

    res.json({
      totalConfigs: Number(totals?.total_configs ?? 0),
      activeConfigs: Number(totals?.active_configs ?? 0),
      totalIncidents: Number(totals?.total_incidents ?? 0),
      openIncidents: Number(totals?.open_incidents ?? 0),
      syncSuccess24h: Number(syncStats?.success ?? 0),
      syncErrors24h: Number(syncStats?.errors ?? 0),
    });
  } catch (err) {
    logger.error({ err }, "GET /api/admin-panel/servicenow/summary error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/admin-panel/servicenow/configs
router.get("/admin-panel/servicenow/configs", requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT snc.id, snc.customer_id AS "customerId",
              c.email AS "customerEmail", c.company_name AS "companyName",
              snc.instance_url AS "instanceUrl", snc.username,
              snc.assignment_group AS "assignmentGroup", snc.category,
              snc.active, snc.last_sync_at AS "lastSyncAt",
              snc.last_sync_error AS "lastSyncError",
              COUNT(sni.id)::int AS "incidentCount",
              COUNT(CASE WHEN sni.sn_state NOT IN (6, 7) THEN 1 END)::int AS "openCount"
       FROM servicenow_configs snc
       JOIN customers c ON c.id = snc.customer_id
       LEFT JOIN servicenow_incidents sni ON sni.config_id = snc.id
       GROUP BY snc.id, c.email, c.company_name
       ORDER BY snc.created_at DESC`
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
