import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { couponsTable } from "@workspace/db";
import { eq, and, lte, gte, or, isNull, sql } from "drizzle-orm";
import { requireAdmin } from "../../middleware/auth";
import { logger } from "../../lib/logger";

const router = Router();

// POST /api/coupons/validate — herkes kullanabilir
router.post("/coupons/validate", async (req: Request, res: Response) => {
  const { code, serviceSlug } = req.body as { code?: string; serviceSlug?: string };

  if (!code) {
    res.status(400).json({ valid: false, error: "Kupon kodu gerekli" });
    return;
  }

  const [coupon] = await db
    .select()
    .from(couponsTable)
    .where(eq(couponsTable.code, code.toUpperCase().trim()));

  if (!coupon || !coupon.isActive) {
    res.status(404).json({ valid: false, error: "Geçersiz kupon kodu" });
    return;
  }

  const now = new Date();

  if (coupon.validFrom && coupon.validFrom > now) {
    res.status(400).json({ valid: false, error: "Kupon henüz geçerli değil" });
    return;
  }
  if (coupon.validUntil && coupon.validUntil < now) {
    res.status(400).json({ valid: false, error: "Kupon süresi dolmuş" });
    return;
  }
  if (coupon.maxUses !== null && coupon.maxUses !== undefined && (coupon.usedCount ?? 0) >= coupon.maxUses) {
    res.status(400).json({ valid: false, error: "Kupon kullanım limiti dolmuş" });
    return;
  }
  if (serviceSlug && coupon.applicableServices && coupon.applicableServices.length > 0) {
    if (!coupon.applicableServices.includes(serviceSlug)) {
      res.status(400).json({ valid: false, error: "Bu kupon bu servis için geçerli değil" });
      return;
    }
  }

  res.json({
    valid: true,
    discountType: coupon.discountType,
    discountValue: Number(coupon.discountValue),
    code: coupon.code,
  });
});

// GET /api/coupons — admin
router.get("/coupons", requireAdmin, async (_req: Request, res: Response) => {
  const coupons = await db.select().from(couponsTable).orderBy(couponsTable.createdAt);
  res.json(coupons);
});

// POST /api/coupons — admin
router.post("/coupons", requireAdmin, async (req: Request, res: Response) => {
  const { code, discountType, discountValue, maxUses, validFrom, validUntil, applicableServices } = req.body;

  if (!code || !discountType || discountValue === undefined) {
    res.status(400).json({ error: "code, discountType ve discountValue gerekli" });
    return;
  }
  if (!["percent", "fixed_tl"].includes(discountType)) {
    res.status(400).json({ error: "discountType 'percent' veya 'fixed_tl' olmalı" });
    return;
  }

  const session = req.session as unknown as Record<string, unknown>;

  const [coupon] = await db.insert(couponsTable).values({
    code: String(code).toUpperCase().trim(),
    discountType,
    discountValue: String(discountValue),
    maxUses: maxUses ? Number(maxUses) : null,
    validFrom: validFrom ? new Date(validFrom) : null,
    validUntil: validUntil ? new Date(validUntil) : null,
    applicableServices: applicableServices ?? null,
    createdBy: String(session["adminEmail"] ?? "admin"),
    isActive: true,
  }).returning();

  logger.info({ code: coupon.code }, "Coupon created");
  res.status(201).json(coupon);
});

// PATCH /api/coupons/:id — admin
router.patch("/coupons/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  const { isActive, maxUses, validUntil } = req.body;

  const [updated] = await db.update(couponsTable)
    .set({
      ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      ...(maxUses !== undefined && { maxUses: Number(maxUses) }),
      ...(validUntil !== undefined && { validUntil: new Date(validUntil) }),
    })
    .where(eq(couponsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Kupon bulunamadı" });
    return;
  }

  res.json(updated);
});

// DELETE /api/coupons/:id — admin
router.delete("/coupons/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  await db.update(couponsTable).set({ isActive: false }).where(eq(couponsTable.id, id));
  res.json({ success: true });
});

export default router;
