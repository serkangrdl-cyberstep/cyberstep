import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { statusIncidentsTable, statusServiceHealthTable } from "@workspace/db";
import { eq, desc, isNull } from "drizzle-orm";
import { requireAdmin } from "../admin-panel/middleware";
import { logger } from "../../lib/logger";

const router = Router();

// GET /api/public/status
router.get("/public/status", async (_req: Request, res: Response) => {
  try {
    const services = await db.select().from(statusServiceHealthTable).orderBy(statusServiceHealthTable.displayName);
    const activeIncidents = await db.select().from(statusIncidentsTable)
      .where(isNull(statusIncidentsTable.resolvedAt))
      .orderBy(desc(statusIncidentsTable.startedAt));
    const recentIncidents = await db.select().from(statusIncidentsTable)
      .orderBy(desc(statusIncidentsTable.startedAt))
      .limit(20);
    res.json({ services, activeIncidents, recentIncidents });
  } catch (err) {
    logger.error({ err }, "Failed to get status");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// Admin: GET /api/admin/status/services
router.get("/admin/status/services", requireAdmin, async (_req, res: Response) => {
  try {
    const rows = await db.select().from(statusServiceHealthTable).orderBy(statusServiceHealthTable.displayName);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Failed to get services");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// Admin: PATCH /api/admin/status/services/:name
router.patch("/admin/status/services/:name", requireAdmin, async (req: Request, res: Response) => {
  const name = String(req.params["name"]);
  const { currentStatus } = req.body as { currentStatus: string };
  const allowed = ["operational", "degraded", "partial_outage", "major_outage"];
  if (!allowed.includes(currentStatus)) {
    res.status(400).json({ error: "Geçersiz durum" });
    return;
  }
  try {
    await db.update(statusServiceHealthTable)
      .set({ currentStatus, lastCheckedAt: new Date() })
      .where(eq(statusServiceHealthTable.serviceName, name));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to update service status");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// Admin: GET /api/admin/status/incidents
router.get("/admin/status/incidents", requireAdmin, async (_req, res: Response) => {
  try {
    const rows = await db.select().from(statusIncidentsTable).orderBy(desc(statusIncidentsTable.startedAt)).limit(50);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Failed to get incidents");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// Admin: POST /api/admin/status/incidents
router.post("/admin/status/incidents", requireAdmin, async (req: Request, res: Response) => {
  const { title, description, severity, affectedServices } = req.body as {
    title: string; description?: string; severity: string; affectedServices: string[];
  };
  try {
    const [row] = await db.insert(statusIncidentsTable).values({
      title, description, severity, affectedServices,
      status: "investigating",
    }).returning();
    res.json(row);
  } catch (err) {
    logger.error({ err }, "Failed to create incident");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// Admin: PATCH /api/admin/status/incidents/:id
router.patch("/admin/status/incidents/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"]));
  const { status, description } = req.body as { status: string; description?: string };
  const allowed = ["investigating", "identified", "monitoring", "resolved"];
  if (!allowed.includes(status)) { res.status(400).json({ error: "Geçersiz durum" }); return; }
  try {
    const updates: Record<string, unknown> = { status };
    if (description) updates.description = description;
    if (status === "resolved") updates.resolvedAt = new Date();
    await db.update(statusIncidentsTable).set(updates).where(eq(statusIncidentsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to update incident");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
