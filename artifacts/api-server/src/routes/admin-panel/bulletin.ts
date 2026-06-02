import { Router } from "express";
import type { Request, Response } from "express";
import { eq, desc, sql, count } from "drizzle-orm";
import { db, weeklyBulletinsTable, bulletinSubscribersTable } from "@workspace/db";
import { requireAdmin } from "./middleware";
import { logger } from "../../lib/logger";
import { collectWeeklyData } from "../../services/bulletin/weeklyDataCollector";
import { generateBulletinContent } from "../../services/bulletin/bulletinWriter";
import { sendWeeklyBulletin, sendTestBulletin } from "../../services/bulletin/bulletinSender";
import { getISOWeek } from "../../services/discoveryPipeline";

const router = Router();

// GET /api/admin-panel/bulletin/list
router.get("/admin-panel/bulletin/list", requireAdmin, async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(weeklyBulletinsTable)
      .orderBy(desc(weeklyBulletinsTable.createdAt))
      .limit(20);
    res.json(rows);
  } catch (e) {
    req.log.error({ err: e }, "Bulletin list error");
    res.status(500).json({ error: "Liste alinamadi" });
  }
});

// GET /api/admin-panel/bulletin/stats
router.get("/admin-panel/bulletin/stats", requireAdmin, async (req: Request, res: Response) => {
  try {
    const [totalSubs] = await db.select({ count: count() }).from(bulletinSubscribersTable)
      .where(eq(bulletinSubscribersTable.isActive, true));
    const [newThisWeek] = await db.select({ count: count() }).from(bulletinSubscribersTable)
      .where(sql`subscribed_at > now() - interval '7 days'`);
    const [totalSent] = await db.select({ count: count() }).from(weeklyBulletinsTable)
      .where(eq(weeklyBulletinsTable.status, "sent"));
    res.json({
      totalSubscribers: Number(totalSubs?.count ?? 0),
      newThisWeek: Number(newThisWeek?.count ?? 0),
      totalSent: Number(totalSent?.count ?? 0),
    });
  } catch (e) {
    req.log.error({ err: e }, "Bulletin stats error");
    res.status(500).json({ error: "Istatistikler alinamadi" });
  }
});

// GET /api/admin-panel/bulletin/subscribers
router.get("/admin-panel/bulletin/subscribers", requireAdmin, async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(bulletinSubscribersTable)
      .orderBy(desc(bulletinSubscribersTable.subscribedAt))
      .limit(200);
    res.json(rows);
  } catch (e) {
    req.log.error({ err: e }, "Bulletin subscribers error");
    res.status(500).json({ error: "Abone listesi alinamadi" });
  }
});

// POST /api/admin-panel/bulletin/generate
router.post("/admin-panel/bulletin/generate", requireAdmin, async (req: Request, res: Response) => {
  const { weekNumber, year } = req.body as { weekNumber?: number; year?: number };
  const now = new Date();
  const wn = weekNumber ?? getISOWeek(now);
  const yr = year ?? now.getFullYear();
  const slug = `tr-${yr}-w${wn}`;

  const existing = await db.select({ id: weeklyBulletinsTable.id })
    .from(weeklyBulletinsTable)
    .where(eq(weeklyBulletinsTable.weekSlug, slug))
    .limit(1);
  if (existing[0]) {
    res.status(409).json({ error: "Bu hafta icin bulten zaten mevcut", id: existing[0].id });
    return;
  }

  res.json({ started: true, weekNumber: wn, year: yr });

  setImmediate(async () => {
    try {
      const weekEnd = now;
      const weekStart = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      const data = await collectWeeklyData(weekStart, weekEnd);
      const content = await generateBulletinContent(data, wn, yr);

      await db.insert(weeklyBulletinsTable).values({
        countryCode: "TR",
        weekNumber: wn,
        year: yr,
        weekSlug: slug,
        dateRangeStart: weekStart.toISOString().slice(0, 10),
        dateRangeEnd: weekEnd.toISOString().slice(0, 10),
        totalScansThisWeek: data.totalScans,
        newCriticalCves: data.newCriticalCVEs.length,
        topFindingType: data.topFindingType,
        notableSector: data.topSector ?? undefined,
        headline: content.headline,
        introText: content.introText,
        threatRadar: content.threatRadar,
        turkeyData: content.turkeyData,
        regulationSection: content.regulationSection,
        weeklyTip: content.weeklyTip,
        toolResource: content.toolResource,
        emailSubject: content.emailSubject,
        emailPreview: content.emailPreview,
        emailHtml: content.emailHtml,
        linkedinMiniPost: content.linkedinMiniPost,
        status: "review",
      });
      logger.info({ weekNumber: wn, year: yr }, "Haftalik bulten uretildi");
    } catch (err) {
      logger.error({ err }, "Bulletin generation failed");
    }
  });
});

// GET /api/admin-panel/bulletin/:id  — MUST be after /list and /stats
router.get("/admin-panel/bulletin/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"]));
  if (isNaN(id)) { res.status(400).json({ error: "Gecersiz ID" }); return; }
  try {
    const [row] = await db.select().from(weeklyBulletinsTable).where(eq(weeklyBulletinsTable.id, id));
    if (!row) { res.status(404).json({ error: "Bulten bulunamadi" }); return; }
    res.json(row);
  } catch (e) {
    req.log.error({ err: e }, "Bulletin detail error");
    res.status(500).json({ error: "Bulten alinamadi" });
  }
});

// PUT /api/admin-panel/bulletin/:id
router.put("/admin-panel/bulletin/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"]));
  if (isNaN(id)) { res.status(400).json({ error: "Gecersiz ID" }); return; }
  try {
    const { headline, introText, threatRadar, turkeyData, regulationSection, weeklyTip, toolResource, emailSubject } =
      req.body as Record<string, string>;
    await db.update(weeklyBulletinsTable).set({
      ...(headline !== undefined && { headline }),
      ...(introText !== undefined && { introText }),
      ...(threatRadar !== undefined && { threatRadar }),
      ...(turkeyData !== undefined && { turkeyData }),
      ...(regulationSection !== undefined && { regulationSection }),
      ...(weeklyTip !== undefined && { weeklyTip }),
      ...(toolResource !== undefined && { toolResource }),
      ...(emailSubject !== undefined && { emailSubject }),
      updatedAt: new Date(),
    }).where(eq(weeklyBulletinsTable.id, id));
    res.json({ success: true });
  } catch (e) {
    req.log.error({ err: e }, "Bulletin update error");
    res.status(500).json({ error: "Guncelleme basarisiz" });
  }
});

// POST /api/admin-panel/bulletin/:id/send
router.post("/admin-panel/bulletin/:id/send", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"]));
  if (isNaN(id)) { res.status(400).json({ error: "Gecersiz ID" }); return; }
  res.json({ started: true });
  setImmediate(async () => {
    try {
      const result = await sendWeeklyBulletin(id);
      logger.info({ id, ...result }, "Bulletin send complete");
    } catch (err) {
      logger.error({ err, id }, "Bulletin send failed");
    }
  });
});

// POST /api/admin-panel/bulletin/:id/send-test
router.post("/admin-panel/bulletin/:id/send-test", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"]));
  const { email } = req.body as { email?: string };
  if (!email) { res.status(400).json({ error: "email gerekli" }); return; }
  try {
    await sendTestBulletin(id, email);
    res.json({ success: true });
  } catch (e) {
    req.log.error({ err: e }, "Test send error");
    res.status(500).json({ error: String(e) });
  }
});

// POST /api/admin-panel/bulletin/:id/approve
router.post("/admin-panel/bulletin/:id/approve", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"]));
  await db.update(weeklyBulletinsTable).set({ status: "review", updatedAt: new Date() })
    .where(eq(weeklyBulletinsTable.id, id));
  res.json({ success: true });
});

export default router;
