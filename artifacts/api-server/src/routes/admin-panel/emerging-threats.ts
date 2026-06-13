import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { emergingThreatAlertsTable, cveTrackerTable, customersTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAdmin } from "./middleware";
import { logger } from "../../lib/logger";

const router = Router();

router.get("/admin-panel/emerging-threats", requireAdmin, async (_req: Request, res: Response) => {
  const alerts = await db.select({
    id: emergingThreatAlertsTable.id,
    cveId: emergingThreatAlertsTable.cveId,
    customerId: emergingThreatAlertsTable.customerId,
    technologyMatched: emergingThreatAlertsTable.technologyMatched,
    emailStatus: emergingThreatAlertsTable.emailStatus,
    sentAt: emergingThreatAlertsTable.sentAt,
    createdAt: emergingThreatAlertsTable.createdAt,
    customerEmail: customersTable.email,
    customerName: customersTable.fullName,
    cvssScore: cveTrackerTable.cvssScore,
    cveTitle: cveTrackerTable.title,
    patchAvailable: cveTrackerTable.patchAvailable,
    exploitPublic: cveTrackerTable.exploitPublic,
  })
    .from(emergingThreatAlertsTable)
    .leftJoin(customersTable, eq(emergingThreatAlertsTable.customerId, customersTable.id))
    .leftJoin(cveTrackerTable, eq(emergingThreatAlertsTable.cveId, cveTrackerTable.cveId))
    .orderBy(desc(emergingThreatAlertsTable.createdAt));

  res.json(alerts);
});

router.post("/admin-panel/emerging-threats/:id/send", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  try {
    const { sendEmergingThreatAlert } = await import("../../services/emergingThreatService");
    const result = await sendEmergingThreatAlert(id);
    if (!result.ok) { res.status(400).json({ error: result.error }); return; }
    logger.info({ alertId: id }, "Emerging threat alert sent by admin");
    res.json({ ok: true });
  } catch (e: unknown) {
    logger.error({ err: String(e), alertId: id }, "Emerging threat send failed");
    res.status(500).json({ error: "Gönderim hatası" });
  }
});

router.post("/admin-panel/emerging-threats/:id/reject", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  await db.update(emergingThreatAlertsTable).set({ emailStatus: "failed" }).where(
    and(eq(emergingThreatAlertsTable.id, id))
  );
  res.json({ ok: true });
});

router.post("/admin-panel/emerging-threats/check-now", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const { checkEmergingThreats } = await import("../../services/emergingThreatService");
    checkEmergingThreats().catch((e: unknown) => logger.error({ err: String(e) }, "Manual emerging threat check failed"));
    res.json({ ok: true, message: "Kontrol başlatıldı" });
  } catch (e: unknown) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
