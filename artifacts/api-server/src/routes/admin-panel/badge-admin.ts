import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { customersTable } from "@workspace/db";
import { desc, isNotNull } from "drizzle-orm";
import { requireAdmin } from "./middleware";

const router = Router();

router.get("/admin-panel/badge-stats", requireAdmin, async (_req: Request, res: Response) => {
  const rows = await db.select({
    id: customersTable.id,
    companyName: customersTable.companyName,
    email: customersTable.email,
    subscriptionPlan: customersTable.subscriptionPlan,
    subscriptionStatus: customersTable.subscriptionStatus,
    badgeToken: customersTable.badgeToken,
    badgeEnabled: customersTable.badgeEnabled,
    badgeImpressionCount: customersTable.badgeImpressionCount,
  }).from(customersTable)
    .where(isNotNull(customersTable.badgeToken))
    .orderBy(desc(customersTable.badgeImpressionCount));
  res.json(rows);
});

export default router;
