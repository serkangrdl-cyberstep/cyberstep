import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { serviceCatalogTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAdmin } from "./middleware";
import { logger } from "../../lib/logger";

const router = Router();

// GET /api/admin-panel/service-catalog
router.get("/admin-panel/service-catalog", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(serviceCatalogTable)
      .orderBy(asc(serviceCatalogTable.sortOrder), asc(serviceCatalogTable.id));
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Failed to fetch service catalog");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /api/admin-panel/service-catalog — yeni servis ekle
router.post("/admin-panel/service-catalog", requireAdmin, async (req: Request, res: Response) => {
  const {
    slug, label, shortDescription, longDescription, features, howItWorks, faq,
    monthlyPriceTl, setupFeeTl, category, icon, isActive, sortOrder,
  } = req.body as {
    slug: string;
    label: string;
    shortDescription?: string;
    longDescription?: string;
    features?: string[];
    howItWorks?: { step: string; desc: string }[];
    faq?: { q: string; a: string }[];
    monthlyPriceTl: string;
    setupFeeTl?: string;
    category?: string;
    icon?: string;
    isActive?: boolean;
    sortOrder?: number;
  };

  if (!slug || !label || !monthlyPriceTl) {
    res.status(400).json({ error: "slug, label ve monthlyPriceTl zorunludur" });
    return;
  }

  try {
    const [created] = await db
      .insert(serviceCatalogTable)
      .values({
        slug,
        label,
        shortDescription: shortDescription ?? "",
        longDescription: longDescription ?? "",
        features: features ?? [],
        howItWorks: howItWorks ?? [],
        faq: faq ?? [],
        monthlyPriceTl,
        setupFeeTl: setupFeeTl ?? "0",
        category: category ?? "monitoring",
        icon: icon ?? "Shield",
        isActive: isActive ?? true,
        sortOrder: sortOrder ?? 0,
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    logger.error({ err }, "Failed to create service catalog entry");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// PUT /api/admin-panel/service-catalog/:slug
router.put("/admin-panel/service-catalog/:slug", requireAdmin, async (req: Request, res: Response) => {
  const slug = req.params["slug"] as string;
  const { label, shortDescription, longDescription, monthlyPriceTl, setupFeeTl, isActive, sortOrder } = req.body as {
    label?: string;
    shortDescription?: string;
    longDescription?: string;
    monthlyPriceTl?: string;
    setupFeeTl?: string;
    isActive?: boolean;
    sortOrder?: number;
  };

  try {
    const updateData: Partial<typeof serviceCatalogTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (label !== undefined) updateData.label = label;
    if (shortDescription !== undefined) updateData.shortDescription = shortDescription;
    if (longDescription !== undefined) updateData.longDescription = longDescription;
    if (monthlyPriceTl !== undefined) updateData.monthlyPriceTl = monthlyPriceTl;
    if (setupFeeTl !== undefined) updateData.setupFeeTl = setupFeeTl;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    const [updated] = await db
      .update(serviceCatalogTable)
      .set(updateData)
      .where(eq(serviceCatalogTable.slug, slug))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Servis bulunamadı" });
      return;
    }
    res.json(updated);
  } catch (err) {
    logger.error({ err, slug }, "Failed to update service catalog entry");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
