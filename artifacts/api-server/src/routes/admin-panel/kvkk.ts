import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAdmin } from "./middleware";
import { logger } from "../../lib/logger";

const router = Router();

// GET /api/admin-panel/kvkk/summary
router.get("/admin-panel/kvkk/summary", requireAdmin, async (_req, res) => {
  try {
    const { rows: [total] } = await pool.query<{ cnt: string }>(
      `SELECT count(*)::int AS cnt FROM kvkk_notifications WHERE status NOT IN ('closed')`
    );
    const { rows: [expiring] } = await pool.query<{ cnt: string }>(
      `SELECT count(*)::int AS cnt FROM kvkk_notifications
       WHERE status NOT IN ('closed')
         AND deadline_72h <= NOW() + INTERVAL '24 hours'
         AND deadline_72h > NOW()`
    );
    const { rows: [overdue] } = await pool.query<{ cnt: string }>(
      `SELECT count(*)::int AS cnt FROM kvkk_notifications
       WHERE status NOT IN ('closed', 'sent', 'tracking')
         AND deadline_72h <= NOW()`
    );
    const { rows: [closed30d] } = await pool.query<{ cnt: string }>(
      `SELECT count(*)::int AS cnt FROM kvkk_notifications
       WHERE status = 'closed'
         AND updated_at >= NOW() - INTERVAL '30 days'`
    );
    res.json({
      active: Number(total?.cnt ?? 0),
      expiringIn24h: Number(expiring?.cnt ?? 0),
      overdue: Number(overdue?.cnt ?? 0),
      closedLast30d: Number(closed30d?.cnt ?? 0),
    });
  } catch (err) {
    logger.error({ err }, "GET /api/admin-panel/kvkk/summary error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/admin-panel/kvkk/notifications
router.get("/admin-panel/kvkk/notifications", requireAdmin, async (req, res) => {
  const statusFilter = req.query["status"] as string | undefined;
  try {
    const whereClause = statusFilter
      ? `WHERE kn.status = '${statusFilter.replace(/'/g, "''")}'`
      : "WHERE kn.status NOT IN ('closed')";

    const { rows } = await pool.query(
      `SELECT kn.id, kn.customer_id AS "customerId", c.email AS "customerEmail",
              c.company_name AS "companyName",
              sc.case_number AS "caseNumber", sc.title AS "caseTitle", sc.severity,
              ka.requires_notification AS "requiresNotification",
              ka.severity_category AS "severityCategory",
              ka.urgency, ka.ai_reasoning AS "aiReasoning",
              kn.status, kn.btk_reference_no AS "btkReferenceNo",
              kn.deadline_72h AS "deadline72h", kn.sent_at AS "sentAt",
              kn.created_at AS "createdAt"
       FROM kvkk_notifications kn
       JOIN kvkk_assessments ka ON ka.id = kn.assessment_id
       JOIN soc_cases sc ON sc.id = kn.soc_case_id
       JOIN customers c ON c.id = kn.customer_id
       ${whereClause}
       ORDER BY kn.deadline_72h ASC
       LIMIT 200`
    );
    res.json({ notifications: rows });
  } catch (err) {
    logger.error({ err }, "GET /api/admin-panel/kvkk/notifications error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/admin-panel/kvkk/assessments
router.get("/admin-panel/kvkk/assessments", requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ka.id, ka.customer_id AS "customerId", c.email AS "customerEmail",
              c.company_name AS "companyName",
              sc.case_number AS "caseNumber", sc.title AS "caseTitle",
              ka.requires_notification AS "requiresNotification",
              ka.severity_category AS "severityCategory",
              ka.urgency, ka.status, ka.assessed_at AS "assessedAt",
              ka.created_at AS "createdAt"
       FROM kvkk_assessments ka
       JOIN soc_cases sc ON sc.id = ka.soc_case_id
       JOIN customers c ON c.id = ka.customer_id
       ORDER BY ka.created_at DESC
       LIMIT 100`
    );
    res.json({ assessments: rows });
  } catch (err) {
    logger.error({ err }, "GET /api/admin-panel/kvkk/assessments error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
