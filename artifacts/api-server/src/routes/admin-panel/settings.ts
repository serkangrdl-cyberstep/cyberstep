import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { siteSettingsTable, pricingPlansTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "./middleware";
import { logger } from "../../lib/logger";

const router = Router();

// GET /api/admin-panel/settings
router.get("/admin-panel/settings", requireAdmin, async (_req: Request, res: Response) => {
  const rows = await db.select().from(siteSettingsTable);
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  res.json(settings);
});

// PUT /api/admin-panel/settings
router.put("/admin-panel/settings", requireAdmin, async (req: Request, res: Response) => {
  const updates = req.body as Record<string, string>;
  for (const [key, value] of Object.entries(updates)) {
    await db.insert(siteSettingsTable)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: siteSettingsTable.key, set: { value, updatedAt: new Date() } });
  }
  logger.info({ keys: Object.keys(updates) }, "Site settings updated");
  res.json({ success: true });
});

// GET /api/admin-panel/pricing
router.get("/admin-panel/pricing", requireAdmin, async (_req: Request, res: Response) => {
  const plans = await db.select().from(pricingPlansTable).orderBy(pricingPlansTable.sortOrder);
  res.json(plans);
});

// PUT /api/admin-panel/pricing/:id
router.put("/admin-panel/pricing/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { name, price, description, features, isActive } = req.body as {
    name?: string; price?: string; description?: string; features?: string[]; isActive?: boolean;
  };

  const [updated] = await db.update(pricingPlansTable)
    .set({ ...(name !== undefined && { name }), ...(price !== undefined && { price }), ...(description !== undefined && { description }), ...(features !== undefined && { features }), ...(isActive !== undefined && { isActive }), updatedAt: new Date() })
    .where(eq(pricingPlansTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Plan bulunamadı" }); return; }
  logger.info({ planId: id }, "Pricing plan updated");
  res.json(updated);
});

// POST /api/admin-panel/pricing — yeni plan oluştur
router.post("/admin-panel/pricing", requireAdmin, async (req: Request, res: Response) => {
  const { slug, name, price, description, features, isActive, sortOrder } = req.body as {
    slug: string; name: string; price?: string; description?: string;
    features?: string[]; isActive?: boolean; sortOrder?: number;
  };
  if (!slug || !name) { res.status(400).json({ error: "slug ve name zorunludur" }); return; }
  const [created] = await db.insert(pricingPlansTable)
    .values({ slug, name, price: price ?? "0", description: description ?? "", features: features ?? [], isActive: isActive ?? true, sortOrder: sortOrder ?? 99 })
    .returning();
  logger.info({ id: created.id, slug }, "Pricing plan created");
  res.status(201).json(created);
});

// GET /api/admin-panel/pricing (public — no auth)
router.get("/public/pricing", async (_req: Request, res: Response) => {
  const plans = await db.select().from(pricingPlansTable)
    .where(eq(pricingPlansTable.isActive, true))
    .orderBy(pricingPlansTable.sortOrder);
  res.json(plans);
});

// GET /api/admin-panel/settings/public (no auth — for footer/about pages)
router.get("/public/settings", async (_req: Request, res: Response) => {
  const rows = await db.select().from(siteSettingsTable);
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  res.json(settings);
});

export default router;
