import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import {
  aiMonitoringSubscriptionsTable,
  aiMonitoringAlertsTable,
  aiToolPolicySnapshotsTable,
  aiToolsRegistryTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireCustomer, getCustomerId, requireAdmin } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { checkAllToolsForChanges } from "../../services/ai-tool-monitor";

const router = Router();

// ─── Subscription ─────────────────────────────────────────────────────────────

router.get("/api/ai-monitoring/subscription", requireCustomer, async (req: Request, res: Response): Promise<void> => {
  const cid = getCustomerId(req)!;
  const [sub] = await db.select().from(aiMonitoringSubscriptionsTable).where(eq(aiMonitoringSubscriptionsTable.customerId, cid));
  res.json(sub ?? null);
});

router.post("/api/ai-monitoring/subscription", requireCustomer, async (req: Request, res: Response): Promise<void> => {
  const cid = getCustomerId(req)!;
  const existing = await db.select().from(aiMonitoringSubscriptionsTable).where(eq(aiMonitoringSubscriptionsTable.customerId, cid));
  if (existing.length > 0) { res.status(409).json({ error: "Abonelik zaten mevcut" }); return; }
  const { toolIds, aiAssessmentId } = req.body as { toolIds?: number[]; aiAssessmentId?: number };
  const nextBilling = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [sub] = await db.insert(aiMonitoringSubscriptionsTable).values({
    customerId: cid,
    monitoredToolIds: toolIds ?? [],
    aiAssessmentId: aiAssessmentId ?? null,
    status: "active",
    nextBillingDate: nextBilling,
  }).returning();
  res.status(201).json(sub);
});

router.put("/api/ai-monitoring/subscription", requireCustomer, async (req: Request, res: Response): Promise<void> => {
  const cid = getCustomerId(req)!;
  const { toolIds, notifyEmail, alertOnCritical, alertOnImportant, alertOnMinor, status } = req.body as Record<string, unknown>;
  const update: Record<string, unknown> = {};
  if (toolIds !== undefined) update["monitoredToolIds"] = toolIds;
  if (notifyEmail !== undefined) update["notifyEmail"] = notifyEmail;
  if (alertOnCritical !== undefined) update["alertOnCritical"] = alertOnCritical;
  if (alertOnImportant !== undefined) update["alertOnImportant"] = alertOnImportant;
  if (alertOnMinor !== undefined) update["alertOnMinor"] = alertOnMinor;
  if (status !== undefined) update["status"] = status;
  const [sub] = await db.update(aiMonitoringSubscriptionsTable).set(update).where(eq(aiMonitoringSubscriptionsTable.customerId, cid)).returning();
  res.json(sub);
});

router.delete("/api/ai-monitoring/subscription", requireCustomer, async (req: Request, res: Response): Promise<void> => {
  const cid = getCustomerId(req)!;
  await db.update(aiMonitoringSubscriptionsTable).set({ status: "cancelled" }).where(eq(aiMonitoringSubscriptionsTable.customerId, cid));
  res.json({ message: "Abonelik iptal edildi" });
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

router.get("/api/ai-monitoring/dashboard", requireCustomer, async (req: Request, res: Response): Promise<void> => {
  const cid = getCustomerId(req)!;
  const [sub] = await db.select().from(aiMonitoringSubscriptionsTable).where(eq(aiMonitoringSubscriptionsTable.customerId, cid));
  if (!sub) { res.json({ subscription: null, tools: [], recentAlerts: [] }); return; }

  const toolIds = sub.monitoredToolIds ?? [];
  const allTools = await db.select().from(aiToolsRegistryTable);
  const monitoredTools = toolIds.length > 0 ? allTools.filter(t => toolIds.includes(t.id)) : allTools.slice(0, 10);

  // Latest snapshots per tool
  const toolsWithStatus = await Promise.all(monitoredTools.map(async (tool) => {
    const [snap] = await db.select().from(aiToolPolicySnapshotsTable)
      .where(eq(aiToolPolicySnapshotsTable.toolId, tool.id))
      .orderBy(desc(aiToolPolicySnapshotsTable.createdAt))
      .limit(1);
    return { ...tool, latestSnapshot: snap ?? null, hasChange: snap?.isChanged ?? false };
  }));

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const allAlerts = await db.select().from(aiMonitoringAlertsTable).where(eq(aiMonitoringAlertsTable.customerId, cid)).orderBy(desc(aiMonitoringAlertsTable.createdAt)).limit(20);
  const recentAlerts = allAlerts.filter(a => a.createdAt > weekAgo);

  res.json({
    subscription: sub,
    tools: toolsWithStatus,
    recentAlerts,
    changesThisWeek: recentAlerts.length,
    criticalCount: recentAlerts.filter(a => a.severity === "critical").length,
  });
});

router.get("/api/ai-monitoring/tools", requireCustomer, async (req: Request, res: Response): Promise<void> => {
  const cid = getCustomerId(req)!;
  const [sub] = await db.select().from(aiMonitoringSubscriptionsTable).where(eq(aiMonitoringSubscriptionsTable.customerId, cid));
  if (!sub) { res.json([]); return; }
  const toolIds = sub.monitoredToolIds ?? [];
  const allTools = await db.select().from(aiToolsRegistryTable);
  const tools = toolIds.length > 0 ? allTools.filter(t => toolIds.includes(t.id)) : allTools.slice(0, 10);
  res.json(tools);
});

router.get("/api/ai-monitoring/alerts", requireCustomer, async (req: Request, res: Response): Promise<void> => {
  const cid = getCustomerId(req)!;
  const alerts = await db.select().from(aiMonitoringAlertsTable)
    .where(eq(aiMonitoringAlertsTable.customerId, cid))
    .orderBy(desc(aiMonitoringAlertsTable.createdAt))
    .limit(50);
  res.json(alerts);
});

router.get("/api/ai-monitoring/tools/:id/history", requireCustomer, async (req: Request, res: Response): Promise<void> => {
  const toolId = Number(req.params["id"]);
  const cid = getCustomerId(req)!;
  const [sub] = await db.select().from(aiMonitoringSubscriptionsTable).where(eq(aiMonitoringSubscriptionsTable.customerId, cid));
  const toolIds = sub?.monitoredToolIds ?? [];
  if (sub && toolIds.length > 0 && !toolIds.includes(toolId)) { res.status(403).json({ error: "Bu araç izleme listenizde değil" }); return; }
  const history = await db.select().from(aiToolPolicySnapshotsTable)
    .where(eq(aiToolPolicySnapshotsTable.toolId, toolId))
    .orderBy(desc(aiToolPolicySnapshotsTable.createdAt))
    .limit(20);
  res.json(history);
});

// ─── Admin ─────────────────────────────────────────────────────────────────────

router.get("/api/admin/ai-monitoring/stats", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const subs = await db.select().from(aiMonitoringSubscriptionsTable);
  const snaps = await db.select().from(aiToolPolicySnapshotsTable);
  const alerts = await db.select().from(aiMonitoringAlertsTable);
  res.json({
    totalSubscriptions: subs.length,
    activeSubscriptions: subs.filter(s => s.status === "active").length,
    totalSnapshots: snaps.length,
    totalAlerts: alerts.length,
    criticalAlerts: alerts.filter(a => a.severity === "critical").length,
  });
});

router.post("/api/admin/ai-monitoring/check-all", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  res.json({ message: "Araç kontrolü başlatıldı" });
  checkAllToolsForChanges().catch(err => logger.error({ err }, "Admin check-all failed"));
});

export default router;
