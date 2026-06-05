/**
 * HITL Approval Queue — Admin Rotaları
 * GET  /api/admin-panel/approvals
 * GET  /api/admin-panel/approvals/:id
 * POST /api/admin-panel/approvals/:id/approve
 * POST /api/admin-panel/approvals/:id/reject
 */

import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  pendingApprovalsTable,
  approvalAuditLogTable,
} from "@workspace/db";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { requireAdmin } from "../../middleware/auth";
import { approveAction, rejectAction } from "../../services/approvalQueue";
import { logger } from "../../lib/logger";

const router = Router();

// GET /api/admin-panel/approvals — Listele
router.get("/", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const status = String(req.query["status"] || "pending");

  const approvals = await db.select().from(pendingApprovalsTable)
    .where(status === "all" ? undefined : eq(pendingApprovalsTable.status, status))
    .orderBy(
      asc(sql`CASE risk_level WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END`),
      asc(pendingApprovalsTable.expiresAt),
    );

  res.json({ approvals, count: approvals.length });
});

// GET /api/admin-panel/approvals/stats — İstatistik
router.get("/stats", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const pending = await db.select().from(pendingApprovalsTable)
    .where(eq(pendingApprovalsTable.status, "pending"))
    .orderBy(
      asc(sql`CASE risk_level WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END`),
      asc(pendingApprovalsTable.expiresAt),
    );

  const critical = pending.filter((a) => a.riskLevel === "critical").length;
  const high     = pending.filter((a) => a.riskLevel === "high").length;

  res.json({
    pending: pending.length,
    critical,
    high,
    items: pending,
  });
});

// GET /api/admin-panel/approvals/:id — Detay
router.get("/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params["id"]));

  const [approval] = await db.select().from(pendingApprovalsTable)
    .where(eq(pendingApprovalsTable.id, id)).limit(1);

  if (!approval) { res.status(404).json({ error: "Bulunamadı" }); return; }

  const auditLog = await db.select().from(approvalAuditLogTable)
    .where(eq(approvalAuditLogTable.approvalId, id))
    .orderBy(asc(approvalAuditLogTable.createdAt));

  res.json({ approval, auditLog });
});

// POST /api/admin-panel/approvals/:id/approve — Onayla
router.post("/:id/approve", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params["id"]));
  const approvedBy = (req as { admin?: { email?: string } }).admin?.email || "admin";
  try {
    await approveAction(id, approvedBy);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err, id }, "Approval error");
    res.status(400).json({ error: String(err) });
  }
});

// POST /api/admin-panel/approvals/:id/reject — Reddet
router.post("/:id/reject", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params["id"]));
  const { reason } = req.body as { reason?: string };
  if (!reason?.trim()) {
    res.status(400).json({ error: "Red sebebi zorunlu" });
    return;
  }
  const rejectedBy = (req as { admin?: { email?: string } }).admin?.email || "admin";
  try {
    await rejectAction(id, rejectedBy, reason);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err, id }, "Rejection error");
    res.status(400).json({ error: String(err) });
  }
});

export default router;
