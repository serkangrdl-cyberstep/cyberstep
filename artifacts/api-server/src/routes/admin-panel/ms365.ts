import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAdmin } from "../../middleware/auth";
import { logger } from "../../lib/logger";

const router = Router();

// GET /api/admin-panel/ms365/stats
router.get("/admin-panel/ms365/stats", requireAdmin, async (req, res) => {
  try {
    const tenantCount = (await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM ms365_integrations WHERE status = 'active'`
    )).rows[0]?.count ?? "0";

    const highRiskCount = (await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM ms365_signin_logs
       WHERE risk_level IN ('high','medium') AND created_at >= NOW() - INTERVAL '24 hours'`
    )).rows[0]?.count ?? "0";

    const emailThreatCount = (await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM ms365_email_alerts
       WHERE created_at >= NOW() - INTERVAL '24 hours'`
    )).rows[0]?.count ?? "0";

    const correlationCount = (await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM ms365_signin_logs
       WHERE correlated_soc_case_id IS NOT NULL AND created_at >= NOW() - INTERVAL '24 hours'`
    )).rows[0]?.count ?? "0";

    const errorCount = (await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM ms365_integrations WHERE status = 'error'`
    )).rows[0]?.count ?? "0";

    res.json({
      tenantCount: parseInt(tenantCount, 10),
      highRiskSigninCount: parseInt(highRiskCount, 10),
      emailThreatCount: parseInt(emailThreatCount, 10),
      crossCorrelationCount: parseInt(correlationCount, 10),
      errorCount: parseInt(errorCount, 10),
    });
  } catch (err) {
    logger.error({ err }, "GET /api/admin-panel/ms365/stats error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/admin-panel/ms365/tenants
router.get("/admin-panel/ms365/tenants", requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.id, i.customer_id AS "customerId", i.azure_tenant_id AS "azureTenantId",
              i.status, i.last_sync_at AS "lastSyncAt", i.sync_error AS "syncError",
              i.created_at AS "createdAt",
              c.company_name AS "companyName", c.contact_email AS "contactEmail"
       FROM ms365_integrations i
       LEFT JOIN customers c ON c.id = i.customer_id
       ORDER BY i.created_at DESC`
    );
    res.json({ tenants: rows });
  } catch (err) {
    logger.error({ err }, "GET /api/admin-panel/ms365/tenants error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/admin-panel/ms365/signin-logs
router.get("/admin-panel/ms365/signin-logs", requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT sl.id, sl.customer_id AS "customerId", sl.user_principal_name AS "userPrincipalName",
              sl.ip_address AS "ipAddress", sl.location, sl.risk_level AS "riskLevel",
              sl.risk_detail AS "riskDetail", sl.event_time AS "eventTime",
              sl.correlated_soc_case_id AS "correlatedSocCaseId",
              sl.created_at AS "createdAt",
              c.company_name AS "companyName"
       FROM ms365_signin_logs sl
       LEFT JOIN customers c ON c.id = sl.customer_id
       WHERE sl.risk_level IN ('high','medium')
       ORDER BY sl.event_time DESC
       LIMIT 100`
    );
    res.json({ logs: rows });
  } catch (err) {
    logger.error({ err }, "GET /api/admin-panel/ms365/signin-logs error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/admin-panel/ms365/email-alerts
router.get("/admin-panel/ms365/email-alerts", requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ea.id, ea.customer_id AS "customerId", ea.title, ea.severity,
              ea.category, ea.description, ea.affected_user AS "affectedUser",
              ea.correlated_soc_case_id AS "correlatedSocCaseId",
              ea.created_at AS "createdAt",
              c.company_name AS "companyName"
       FROM ms365_email_alerts ea
       LEFT JOIN customers c ON c.id = ea.customer_id
       ORDER BY ea.created_at DESC
       LIMIT 100`
    );
    res.json({ alerts: rows });
  } catch (err) {
    logger.error({ err }, "GET /api/admin-panel/ms365/email-alerts error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
