import { Router } from "express";
import type { Request, Response } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, weeklyBulletinsTable, bulletinSubscribersTable } from "@workspace/db";
import { subscribeToBulletin, unsubscribeFromBulletin } from "../services/bulletin/bulletinSender";
import { logger } from "../lib/logger";

const router = Router();

// POST /api/bulletin/subscribe
router.post("/bulletin/subscribe", async (req: Request, res: Response) => {
  const { email, name, company, title, source } = req.body as Record<string, string>;
  if (!email || !email.includes("@")) { res.status(400).json({ error: "Gecerli e-posta gerekli" }); return; }
  try {
    await subscribeToBulletin({ email, name, company, title, source });
    res.json({ success: true, message: "Bultene basariyla abone oldunuz" });
  } catch (err) {
    logger.warn({ err, email }, "Bulletin subscribe error");
    res.status(500).json({ error: "Abonelik basarisiz" });
  }
});

// POST /api/bulletin/unsubscribe/:id
router.post("/bulletin/unsubscribe/:id", async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"]));
  if (isNaN(id)) { res.status(400).json({ error: "Gecersiz ID" }); return; }
  try {
    await unsubscribeFromBulletin(id, "email_link");
    res.json({ success: true, message: "Aboneliginiz iptal edildi" });
  } catch (err) {
    res.status(500).json({ error: "Iptal basarisiz" });
  }
});

// GET /api/bulletin/archive
router.get("/bulletin/archive", async (_req: Request, res: Response) => {
  const rows = await db.select({
    id: weeklyBulletinsTable.id,
    weekNumber: weeklyBulletinsTable.weekNumber,
    year: weeklyBulletinsTable.year,
    weekSlug: weeklyBulletinsTable.weekSlug,
    headline: weeklyBulletinsTable.headline,
    introText: weeklyBulletinsTable.introText,
    sentAt: weeklyBulletinsTable.sentAt,
    recipientCount: weeklyBulletinsTable.recipientCount,
  }).from(weeklyBulletinsTable)
    .where(eq(weeklyBulletinsTable.status, "sent"))
    .orderBy(desc(weeklyBulletinsTable.sentAt))
    .limit(52);
  res.json(rows);
});

// GET /api/bulletin/:slug  — MUST be after /archive
router.get("/bulletin/:slug", async (req: Request, res: Response) => {
  const slug = String(req.params["slug"]);
  const [row] = await db.select({
    id: weeklyBulletinsTable.id,
    weekNumber: weeklyBulletinsTable.weekNumber,
    year: weeklyBulletinsTable.year,
    weekSlug: weeklyBulletinsTable.weekSlug,
    headline: weeklyBulletinsTable.headline,
    introText: weeklyBulletinsTable.introText,
    threatRadar: weeklyBulletinsTable.threatRadar,
    turkeyData: weeklyBulletinsTable.turkeyData,
    regulationSection: weeklyBulletinsTable.regulationSection,
    weeklyTip: weeklyBulletinsTable.weeklyTip,
    toolResource: weeklyBulletinsTable.toolResource,
    sentAt: weeklyBulletinsTable.sentAt,
    status: weeklyBulletinsTable.status,
  }).from(weeklyBulletinsTable).where(
    and(eq(weeklyBulletinsTable.weekSlug, slug), eq(weeklyBulletinsTable.status, "sent"))
  );
  if (!row) { res.status(404).json({ error: "Bulten bulunamadi" }); return; }
  res.json(row);
});

export default router;
