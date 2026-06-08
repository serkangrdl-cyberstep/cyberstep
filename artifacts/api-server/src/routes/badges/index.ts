import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { achievementBadgesTable, customerAchievementsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../admin-panel/middleware";
import { requireCustomer } from "../../middleware/auth";
import { logger } from "../../lib/logger";

const router = Router();

// Public: GET /api/public/badges — tüm rozetleri listele
router.get("/public/badges", async (_req, res: Response) => {
  try {
    const rows = await db.select().from(achievementBadgesTable);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Failed to get badges");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// Customer: GET /api/portal/badges/my — benim rozetlerim
router.get("/portal/badges/my", requireCustomer, async (req: Request, res: Response) => {
  const customerId = (req.session as unknown as Record<string, unknown>)["customerId"] as number;
  try {
    const rows = await db
      .select({
        earnedAt: customerAchievementsTable.earnedAt,
        sharedAt: customerAchievementsTable.sharedAt,
        badge: achievementBadgesTable,
      })
      .from(customerAchievementsTable)
      .innerJoin(achievementBadgesTable, eq(customerAchievementsTable.badgeId, achievementBadgesTable.id))
      .where(eq(customerAchievementsTable.customerId, customerId))
      .orderBy(desc(customerAchievementsTable.earnedAt));
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Failed to get my badges");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// Admin: GET /api/admin/badges — tüm kazanımlar (leaderboard)
router.get("/admin/badges", requireAdmin, async (_req, res: Response) => {
  try {
    const rows = await db
      .select({
        achievement: customerAchievementsTable,
        badge: achievementBadgesTable,
      })
      .from(customerAchievementsTable)
      .innerJoin(achievementBadgesTable, eq(customerAchievementsTable.badgeId, achievementBadgesTable.id))
      .orderBy(desc(customerAchievementsTable.earnedAt))
      .limit(200);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Failed to get admin badges");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
