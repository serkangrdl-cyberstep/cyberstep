import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { partnersTable, workPackagesTable } from "@workspace/db";
import { eq, desc, count, ilike, or, sql } from "drizzle-orm";
import { requireAdmin } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import bcrypt from "bcryptjs";

const router = Router();

// GET /api/admin-panel/partners
router.get("/admin-panel/partners", requireAdmin, async (req: Request, res: Response) => {
  const { q, status, tier, page: pageStr } = req.query as Record<string, string>;
  const page = Math.max(1, Number(pageStr ?? 1));
  const limit = 30;
  const offset = (page - 1) * limit;

  const [{ total }] = await db.select({ total: count() }).from(partnersTable);

  let query = db.select().from(partnersTable).orderBy(desc(partnersTable.createdAt)).limit(limit).offset(offset);

  const rows = await query;

  res.json({ rows, total: Number(total), page, limit });
});

// GET /api/admin-panel/partners/stats
router.get("/admin-panel/partners/stats", requireAdmin, async (req: Request, res: Response) => {
  const [{ total }] = await db.select({ total: count() }).from(partnersTable);
  const [{ pending }] = await db.select({ pending: count() }).from(partnersTable).where(eq(partnersTable.status, "pending"));
  const [{ active }] = await db.select({ active: count() }).from(partnersTable).where(eq(partnersTable.status, "active"));
  const [{ gold }] = await db.select({ gold: count() }).from(partnersTable).where(eq(partnersTable.tier, "gold"));

  res.json({
    total: Number(total),
    pending: Number(pending),
    active: Number(active),
    gold: Number(gold),
  });
});

// GET /api/admin-panel/partners/:id
router.get("/admin-panel/partners/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.id, id));
  if (!partner) { res.status(404).json({ error: "Partner bulunamadı" }); return; }

  const workPackages = await db.select().from(workPackagesTable)
    .where(eq(workPackagesTable.partnerId, id))
    .orderBy(desc(workPackagesTable.createdAt))
    .limit(20);

  const { passwordHash: _, ...safe } = partner;
  res.json({ ...safe, workPackages });
});

// POST /api/admin-panel/partners (admin creates partner account)
router.post("/admin-panel/partners", requireAdmin, async (req: Request, res: Response) => {
  const { email, password, companyName, contactName, phone, website, categories, description, tier, monthlyFee } = req.body as {
    email?: string; password?: string; companyName?: string; contactName?: string;
    phone?: string; website?: string; categories?: string[]; description?: string;
    tier?: string; monthlyFee?: number;
  };

  if (!email || !password || !companyName || !contactName) {
    res.status(400).json({ error: "E-posta, şifre, firma adı ve yetkili adı zorunludur" });
    return;
  }

  const [existing] = await db.select({ id: partnersTable.id })
    .from(partnersTable).where(eq(partnersTable.email, email.toLowerCase()));
  if (existing) {
    res.status(409).json({ error: "Bu e-posta zaten kayıtlı" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [partner] = await db.insert(partnersTable).values({
    email: email.toLowerCase(),
    passwordHash,
    companyName,
    contactName,
    phone: phone ?? null,
    website: website ?? null,
    categories: categories ?? [],
    description: description ?? null,
    tier: (tier as "silver" | "gold") ?? "silver",
    monthlyFee: monthlyFee ?? 0,
    status: "active",
    subscriptionStatus: "active",
    approvedAt: new Date(),
  }).returning();

  logger.info({ partnerId: partner.id }, "Partner created by admin");
  const { passwordHash: _, ...safe } = partner;
  res.status(201).json(safe);
});

// PUT /api/admin-panel/partners/:id/approve
router.put("/admin-panel/partners/:id/approve", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  const { tier } = req.body as { tier?: string };

  const [updated] = await db.update(partnersTable).set({
    status: "active",
    tier: (tier as "silver" | "gold") ?? "silver",
    approvedAt: new Date(),
    subscriptionStatus: "active",
  }).where(eq(partnersTable.id, id)).returning();

  if (!updated) { res.status(404).json({ error: "Partner bulunamadı" }); return; }
  logger.info({ partnerId: id }, "Partner approved");

  const { passwordHash: _, ...safe } = updated;
  res.json(safe);
});

// PUT /api/admin-panel/partners/:id/tier
router.put("/admin-panel/partners/:id/tier", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  const { tier, monthlyFee } = req.body as { tier?: string; monthlyFee?: number };

  if (!tier || !["silver", "gold"].includes(tier)) {
    res.status(400).json({ error: "Geçersiz tier (silver veya gold)" });
    return;
  }

  const [updated] = await db.update(partnersTable).set({
    tier: tier as "silver" | "gold",
    ...(monthlyFee !== undefined && { monthlyFee }),
  }).where(eq(partnersTable.id, id)).returning();

  if (!updated) { res.status(404).json({ error: "Partner bulunamadı" }); return; }

  const { passwordHash: _, ...safe } = updated;
  res.json(safe);
});

// PUT /api/admin-panel/partners/:id/suspend
router.put("/admin-panel/partners/:id/suspend", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  const [updated] = await db.update(partnersTable).set({ status: "suspended" })
    .where(eq(partnersTable.id, id)).returning();

  if (!updated) { res.status(404).json({ error: "Partner bulunamadı" }); return; }
  logger.info({ partnerId: id }, "Partner suspended");

  const { passwordHash: _, ...safe } = updated;
  res.json(safe);
});

// DELETE /api/admin-panel/partners/:id
router.delete("/admin-panel/partners/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  await db.delete(partnersTable).where(eq(partnersTable.id, id));
  res.json({ success: true });
});

export default router;
