import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { onboardingProgressTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireCustomer } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { getGuideBySlug, GUIDE_SLUGS } from "../../services/onboarding/guides/index";

const router = Router();

// GET /api/portal/onboarding — onboarding durumunu getir
router.get("/portal/onboarding", requireCustomer, async (req: Request, res: Response) => {
  const customerId = (req.session as unknown as Record<string, unknown>)["customerId"] as number;
  try {
    let [progress] = await db.select().from(onboardingProgressTable)
      .where(eq(onboardingProgressTable.customerId, customerId));

    if (!progress) {
      [progress] = await db.insert(onboardingProgressTable)
        .values({ customerId, completionPct: 0 })
        .returning();
    }
    res.json(progress);
  } catch (err) {
    logger.error({ err }, "Failed to get onboarding");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /api/portal/onboarding/step — adım tamamla
router.post("/portal/onboarding/step", requireCustomer, async (req: Request, res: Response) => {
  const customerId = (req.session as unknown as Record<string, unknown>)["customerId"] as number;
  const { step } = req.body as { step: string };

  const validSteps = [
    "domain_added", "first_scan_completed", "first_report_viewed",
    "email_notifications_enabled", "profile_completed",
    "first_finding_acknowledged", "whatsapp_connected",
  ];
  if (!validSteps.includes(step)) {
    res.status(400).json({ error: "Geçersiz adım" });
    return;
  }

  try {
    let [progress] = await db.select().from(onboardingProgressTable)
      .where(eq(onboardingProgressTable.customerId, customerId));

    if (!progress) {
      [progress] = await db.insert(onboardingProgressTable)
        .values({ customerId })
        .returning();
    }

    const updates: Record<string, unknown> = {};
    const stepKey = step as keyof typeof progress;

    if (!progress[stepKey]) {
      updates[step] = true;
      const stepAtKey = `${step}At`.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase());
      updates[stepAtKey] = new Date();
    }

    // Recalculate pct
    const steps = [
      "domainAdded", "firstScanCompleted", "firstReportViewed",
      "emailNotificationsEnabled", "profileCompleted",
      "firstFindingAcknowledged", "whatsappConnected",
    ];
    const updatedProgress = { ...progress, ...updates };
    const done = steps.filter(s => updatedProgress[s as keyof typeof updatedProgress]).length;
    updates.completionPct = Math.round((done / steps.length) * 100);
    if (updates.completionPct === 100 && !progress.completedAt) {
      updates.completedAt = new Date();
    }

    if (Object.keys(updates).length > 0) {
      await db.update(onboardingProgressTable).set(updates).where(eq(onboardingProgressTable.customerId, customerId));
    }

    res.json({ ok: true, completionPct: updates.completionPct });
  } catch (err) {
    logger.error({ err }, "Failed to update onboarding step");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/portal/integrations/:service/guide — servis kurulum kılavuzu
router.get("/portal/integrations/:service/guide", requireCustomer, (req: Request, res: Response) => {
  const service = String(req.params["service"]);
  const guide = getGuideBySlug(service);
  if (!guide) {
    res.status(404).json({ error: "Bu servis için kurulum kılavuzu bulunamadı." });
    return;
  }
  res.json(guide);
});

// GET /api/portal/integrations/guide-list — kılavuzu olan servisler
router.get("/portal/integrations/guide-list", requireCustomer, (_req: Request, res: Response) => {
  res.json({ slugs: GUIDE_SLUGS });
});

export default router;
