import { Router } from "express";
import type { Request, Response } from "express";
import { db, partnerLeadsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireAdmin } from "./middleware";

const router = Router();

router.get("/admin-panel/partner-leads", requireAdmin, async (req: Request, res: Response) => {
  const { leadType } = req.query as { leadType?: string };
  const rows = leadType
    ? await db.select().from(partnerLeadsTable).where(eq(partnerLeadsTable.leadType, leadType)).orderBy(desc(partnerLeadsTable.createdAt))
    : await db.select().from(partnerLeadsTable).orderBy(desc(partnerLeadsTable.createdAt));
  res.json(rows);
});

export default router;
