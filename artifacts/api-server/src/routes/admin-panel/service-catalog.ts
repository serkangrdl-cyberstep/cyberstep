import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { serviceCatalogTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAdmin } from "./middleware";
import { logger } from "../../lib/logger";
import { z } from "zod/v4";

const postServiceCatalogSchema = z.object({
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/, "Slug yalnızca küçük harf, rakam ve tire içerebilir"),
  label: z.string().min(1).max(120),
  shortDescription: z.string().max(400).optional().default(""),
  longDescription: z.string().max(5000).optional().default(""),
  features: z.array(z.string().max(200)).optional().default([]),
  howItWorks: z.array(z.object({ step: z.string(), desc: z.string() })).optional().default([]),
  faq: z.array(z.object({ q: z.string(), a: z.string() })).optional().default([]),
  monthlyPriceTl: z.string().min(1).max(20),
  setupFeeTl: z.string().max(20).optional().default("0"),
  category: z.string().max(50).optional().default("monitoring"),
  icon: z.string().max(50).optional().default("Shield"),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).max(9999).optional().default(99),
});

const putServiceCatalogSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  shortDescription: z.string().max(400).optional(),
  longDescription: z.string().max(5000).optional(),
  features: z.array(z.string().max(200)).optional(),
  monthlyPriceTl: z.string().max(20).optional(),
  setupFeeTl: z.string().max(20).optional(),
  category: z.string().max(50).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

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

// GET /api/admin-panel/service-catalog/:slug — tek servis detayı
router.get("/admin-panel/service-catalog/:slug", requireAdmin, async (req: Request, res: Response) => {
  const slug = req.params["slug"] as string;
  try {
    const [row] = await db
      .select()
      .from(serviceCatalogTable)
      .where(eq(serviceCatalogTable.slug, slug))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Servis bulunamadı" });
      return;
    }
    res.json(row);
  } catch (err) {
    logger.error({ err, slug }, "Failed to fetch service catalog entry");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /api/admin-panel/service-catalog — yeni servis ekle
router.post("/admin-panel/service-catalog", requireAdmin, async (req: Request, res: Response) => {
  const parsed = postServiceCatalogSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: z.prettifyError(parsed.error) });
    return;
  }
  const { slug, label, shortDescription, longDescription, features, howItWorks, faq, monthlyPriceTl, setupFeeTl, category, icon, isActive, sortOrder } = parsed.data;

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
  const parsed = putServiceCatalogSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: z.prettifyError(parsed.error) });
    return;
  }
  const { label, shortDescription, longDescription, monthlyPriceTl, setupFeeTl, isActive, sortOrder } = parsed.data;

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
