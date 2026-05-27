import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { customersTable, assessmentsTable, paymentsTable } from "@workspace/db";
import { count, eq, sql, desc } from "drizzle-orm";
import { requireAdmin } from "./middleware";
import { logger } from "../../lib/logger";

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

export default router;
