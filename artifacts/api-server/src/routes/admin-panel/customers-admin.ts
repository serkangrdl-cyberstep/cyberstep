import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { customersTable, assessmentsTable, paymentsTable, customerServicesTable, serviceCatalogTable } from "@workspace/db";
import { count, eq, sql, desc } from "drizzle-orm";
import { requireAdmin } from "./middleware";
import { logger } from "../../lib/logger";
import bcrypt from "bcryptjs";

const router = Router();

// GET /api/admin-panel/customers
router.get("/admin-panel/customers", requireAdmin, async (_req: Request, res: Response) => {
  const customers = await db
    .select({
      id: customersTable.id,
      email: customersTable.email,
      fullName: customersTable.fullName,
      companyName: customersTable.companyName,
      totpEnabled: customersTable.totpEnabled,
      subscriptionPlan: customersTable.subscriptionPlan,
      subscriptionStatus: customersTable.subscriptionStatus,
      createdAt: customersTable.createdAt,
      updatedAt: customersTable.updatedAt,
    })
    .from(customersTable)
    .orderBy(desc(customersTable.createdAt));

  // Attach assessment count per customer email
  const assessmentCounts = await db
    .select({ email: assessmentsTable.email, cnt: count() })
    .from(assessmentsTable)
    .groupBy(assessmentsTable.email);

  const assessmentMap = new Map(assessmentCounts.map(r => [r.email, Number(r.cnt)]));

  const result = customers.map(c => ({
    ...c,
    assessmentCount: assessmentMap.get(c.email) ?? 0,
  }));

  res.json(result);
});

// GET /api/admin-panel/customers/stats
router.get("/admin-panel/customers/stats", requireAdmin, async (_req: Request, res: Response) => {
  const [total] = await db.select({ count: count() }).from(customersTable);
  const [active] = await db.select({ count: count() }).from(customersTable)
    .where(sql`${customersTable.subscriptionStatus} = 'active'`);
  const [trial] = await db.select({ count: count() }).from(customersTable)
    .where(sql`${customersTable.subscriptionStatus} = 'trial'`);
  const [totpEnabled] = await db.select({ count: count() }).from(customersTable)
    .where(eq(customersTable.totpEnabled, true));

  res.json({
    total: Number(total.count),
    active: Number(active.count),
    trial: Number(trial.count),
    totpEnabled: Number(totpEnabled.count),
  });
});

// PATCH /api/admin-panel/customers/:id
router.patch("/admin-panel/customers/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const { subscriptionPlan, subscriptionStatus } = req.body as {
    subscriptionPlan?: string | null;
    subscriptionStatus?: string;
  };

  const updates: Partial<typeof customersTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (subscriptionPlan !== undefined) updates.subscriptionPlan = subscriptionPlan;
  if (subscriptionStatus !== undefined) updates.subscriptionStatus = subscriptionStatus;

  const [updated] = await db.update(customersTable)
    .set(updates)
    .where(eq(customersTable.id, id))
    .returning({ id: customersTable.id, subscriptionPlan: customersTable.subscriptionPlan, subscriptionStatus: customersTable.subscriptionStatus });

  if (!updated) { res.status(404).json({ error: "Müşteri bulunamadı" }); return; }
  logger.info({ customerId: id, updates }, "Customer subscription updated by admin");
  res.json({ success: true, customer: updated });
});

// PATCH /api/admin-panel/customers/:id/reset-password
router.patch("/admin-panel/customers/:id/reset-password", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const { newPassword } = req.body as { newPassword?: string };
  if (!newPassword || newPassword.length < 6) {
    res.status(400).json({ error: "Şifre en az 6 karakter olmalı" }); return;
  }

  const hash = await bcrypt.hash(newPassword, 12);
  const [updated] = await db.update(customersTable)
    .set({ passwordHash: hash, updatedAt: new Date() })
    .where(eq(customersTable.id, id))
    .returning({ id: customersTable.id, email: customersTable.email });

  if (!updated) { res.status(404).json({ error: "Müşteri bulunamadı" }); return; }
  logger.info({ customerId: id, email: updated.email }, "Customer password reset by admin");
  res.json({ success: true });
});

// POST /api/admin-panel/customers/:id/test-mode-activate
// Tüm aktif servis kataloğunu müşteriye bulk olarak atar (test amacıyla)
router.post("/admin-panel/customers/:id/test-mode-activate", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (isNaN(id) || id <= 0) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const [customer] = await db.select({ id: customersTable.id, email: customersTable.email })
    .from(customersTable).where(eq(customersTable.id, id)).limit(1);
  if (!customer) { res.status(404).json({ error: "Müşteri bulunamadı" }); return; }

  const allServices = await db.select({ id: serviceCatalogTable.id, slug: serviceCatalogTable.slug })
    .from(serviceCatalogTable)
    .where(eq(serviceCatalogTable.isActive, true));

  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  let activated = 0;
  for (const svc of allServices) {
    try {
      await db.insert(customerServicesTable).values({
        customerId: id,
        serviceCatalogId: svc.id,
        status: "active",
        activatedAt: new Date(),
        expiresAt,
        activatedBy: "admin-test-mode",
        notes: "Test modu — admin tarafından etkinleştirildi",
      }).onConflictDoNothing();
      activated++;
    } catch {
      // Çakışmayı atla
    }
  }

  logger.info({ customerId: id, activated, total: allServices.length }, "Test mode: all services activated");
  res.json({ success: true, activated, total: allServices.length });
});

// ONE-TIME SETUP: production test user fix — DELETE AFTER USE
// GET /api/admin-panel/fix-test-user-q8w3r5
router.get("/admin-panel/fix-test-user-q8w3r5", async (_req: Request, res: Response) => {
  const hash = await bcrypt.hash("Serkan2025!", 12);
  const [updated] = await db.update(customersTable)
    .set({ email: "serkangrdl@yahoo.com", fullName: "Serkan Gürdal", passwordHash: hash, updatedAt: new Date() })
    .where(eq(customersTable.id, 2))
    .returning({ id: customersTable.id, email: customersTable.email, fullName: customersTable.fullName });
  logger.info({ updated }, "One-time test user fix applied");
  res.json({ success: true, updated });
});

export default router;
