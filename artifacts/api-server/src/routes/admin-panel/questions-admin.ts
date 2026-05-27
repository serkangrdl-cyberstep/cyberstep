import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { questionsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAdmin } from "./middleware";
import { logger } from "../../lib/logger";

const router = Router();

// GET /api/admin-panel/questions?type=mini|full
router.get("/admin-panel/questions", requireAdmin, async (req: Request, res: Response) => {
  const type = (req.query.type as string) || "mini";
  const rows = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.type, type))
    .orderBy(asc(questionsTable.sortOrder), asc(questionsTable.number));
  res.json(rows);
});

// POST /api/admin-panel/questions
router.post("/admin-panel/questions", requireAdmin, async (req: Request, res: Response) => {
  const { number, type, domain, text, weight, isRedAlarm, isActive, sortOrder } = req.body as {
    number: number; type?: string; domain: string; text: string;
    weight?: number; isRedAlarm?: boolean; isActive?: boolean; sortOrder?: number;
  };

  if (!number || !domain || !text) {
    res.status(400).json({ error: "number, domain ve text zorunludur" });
    return;
  }

  const [row] = await db
    .insert(questionsTable)
    .values({
      number,
      type: type ?? "mini",
      domain,
      text,
      weight: weight ?? 1,
      isRedAlarm: isRedAlarm ?? false,
      isActive: isActive ?? true,
      sortOrder: sortOrder ?? number,
    })
    .returning();

  logger.info({ id: row.id, number: row.number }, "Question created");
  res.status(201).json(row);
});

// PUT /api/admin-panel/questions/:id
router.put("/admin-panel/questions/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { domain, text, weight, isRedAlarm, isActive, sortOrder } = req.body as {
    domain?: string; text?: string; weight?: number; isRedAlarm?: boolean;
    isActive?: boolean; sortOrder?: number;
  };

  const [updated] = await db
    .update(questionsTable)
    .set({
      ...(domain !== undefined && { domain }),
      ...(text !== undefined && { text }),
      ...(weight !== undefined && { weight }),
      ...(isRedAlarm !== undefined && { isRedAlarm }),
      ...(isActive !== undefined && { isActive }),
      ...(sortOrder !== undefined && { sortOrder }),
      updatedAt: new Date(),
    })
    .where(eq(questionsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Soru bulunamadı" });
    return;
  }

  logger.info({ id }, "Question updated");
  res.json(updated);
});

// DELETE /api/admin-panel/questions/:id
router.delete("/admin-panel/questions/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await db.delete(questionsTable).where(eq(questionsTable.id, id));
  logger.info({ id }, "Question deleted");
  res.json({ success: true });
});

// GET /api/public/questions?type=mini|full  (no auth — for assessment runner)
router.get("/public/questions", async (req: Request, res: Response) => {
  const type = (req.query.type as string) || "mini";
  const rows = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.type, type))
    .orderBy(asc(questionsTable.sortOrder), asc(questionsTable.number));
  res.json(rows.filter(q => q.isActive));
});

export default router;
