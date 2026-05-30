import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { apiProductKeysTable, apiProductUsageTable } from "@workspace/db";
import { eq, desc, count, sql, and, gte } from "drizzle-orm";
import { randomBytes } from "crypto";
import { requireAdmin } from "../admin-panel/middleware";
import { logger } from "../../lib/logger";

const router = Router();

const TIER_LIMITS: Record<string, { dailyLimit: number; monthlyLimit: number }> = {
  freemium:   { dailyLimit: 10,    monthlyLimit: 10 },
  standard:   { dailyLimit: 1000,  monthlyLimit: 1000 },
  enterprise: { dailyLimit: 999999, monthlyLimit: 999999 },
};

function generateKey(): string {
  return "csk_" + randomBytes(24).toString("hex");
}

// GET /api/admin-panel/api-keys
router.get("/admin-panel/api-keys", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const keys = await db.select().from(apiProductKeysTable).orderBy(desc(apiProductKeysTable.createdAt));
    res.json(keys);
  } catch (err) {
    logger.error({ err }, "Failed to list API product keys");
    res.status(500).json({ error: "Sunucu hatası." });
  }
});

// GET /api/admin-panel/api-keys/:id/usage
router.get("/admin-panel/api-keys/:id/usage", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID." }); return; }

  try {
    const usage = await db.select({
      endpoint: apiProductUsageTable.endpoint,
      cnt: count(),
      avgMs: sql<number>`round(avg(${apiProductUsageTable.responseMs}))`,
    })
      .from(apiProductUsageTable)
      .where(eq(apiProductUsageTable.apiKeyId, id))
      .groupBy(apiProductUsageTable.endpoint)
      .orderBy(desc(count()));

    const recent = await db.select()
      .from(apiProductUsageTable)
      .where(eq(apiProductUsageTable.apiKeyId, id))
      .orderBy(desc(apiProductUsageTable.createdAt))
      .limit(50);

    res.json({ byEndpoint: usage, recent });
  } catch (err) {
    logger.error({ err, id }, "Failed to get API key usage");
    res.status(500).json({ error: "Sunucu hatası." });
  }
});

// GET /api/admin-panel/api-keys/stats
router.get("/admin-panel/api-keys/stats", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const [totalKeys] = await db.select({ cnt: count() }).from(apiProductKeysTable);
    const [activeKeys] = await db.select({ cnt: count() }).from(apiProductKeysTable)
      .where(eq(apiProductKeysTable.active, true));
    const [callsToday] = await db.select({ cnt: count() }).from(apiProductUsageTable)
      .where(gte(apiProductUsageTable.createdAt, today));

    const byTier = await db.select({
      tier: apiProductKeysTable.tier,
      cnt: count(),
    }).from(apiProductKeysTable).groupBy(apiProductKeysTable.tier);

    res.json({
      totalKeys: totalKeys?.cnt ?? 0,
      activeKeys: activeKeys?.cnt ?? 0,
      callsToday: callsToday?.cnt ?? 0,
      byTier,
    });
  } catch (err) {
    logger.error({ err }, "Failed to get API stats");
    res.status(500).json({ error: "Sunucu hatası." });
  }
});

// POST /api/admin-panel/api-keys — create new API key
router.post("/admin-panel/api-keys", requireAdmin, async (req: Request, res: Response) => {
  const { email, company, tier = "freemium", webhookUrl, notes } = req.body as {
    email?: string; company?: string; tier?: string; webhookUrl?: string; notes?: string;
  };

  if (!email || !company) {
    res.status(400).json({ error: "email ve company zorunludur." });
    return;
  }

  const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.freemium;

  try {
    const [created] = await db.insert(apiProductKeysTable).values({
      key: generateKey(),
      email,
      company,
      tier,
      dailyLimit: limits.dailyLimit,
      monthlyLimit: limits.monthlyLimit,
      webhookUrl: webhookUrl ?? null,
      notes: notes ?? null,
    }).returning();

    logger.info({ id: created?.id, email, tier }, "API product key created");
    res.status(201).json(created);
  } catch (err) {
    logger.error({ err }, "Failed to create API product key");
    res.status(500).json({ error: "Sunucu hatası." });
  }
});

// PATCH /api/admin-panel/api-keys/:id — update tier / active / webhook
router.patch("/admin-panel/api-keys/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID." }); return; }

  const { tier, active, webhookUrl, notes } = req.body as {
    tier?: string; active?: boolean; webhookUrl?: string | null; notes?: string;
  };

  const limits = tier ? (TIER_LIMITS[tier] ?? TIER_LIMITS.freemium) : undefined;

  try {
    const [updated] = await db.update(apiProductKeysTable)
      .set({
        ...(tier !== undefined && { tier, ...(limits ?? {}) }),
        ...(active !== undefined && { active }),
        ...(webhookUrl !== undefined && { webhookUrl }),
        ...(notes !== undefined && { notes }),
      })
      .where(eq(apiProductKeysTable.id, id))
      .returning();

    if (!updated) { res.status(404).json({ error: "API anahtarı bulunamadı." }); return; }
    logger.info({ id, tier, active }, "API product key updated");
    res.json(updated);
  } catch (err) {
    logger.error({ err, id }, "Failed to update API product key");
    res.status(500).json({ error: "Sunucu hatası." });
  }
});

// DELETE /api/admin-panel/api-keys/:id — deactivate (soft delete)
router.delete("/admin-panel/api-keys/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID." }); return; }

  try {
    await db.update(apiProductKeysTable)
      .set({ active: false })
      .where(eq(apiProductKeysTable.id, id));

    logger.info({ id }, "API product key deactivated");
    res.json({ ok: true, message: "API anahtarı devre dışı bırakıldı." });
  } catch (err) {
    logger.error({ err, id }, "Failed to deactivate API product key");
    res.status(500).json({ error: "Sunucu hatası." });
  }
});

export default router;
