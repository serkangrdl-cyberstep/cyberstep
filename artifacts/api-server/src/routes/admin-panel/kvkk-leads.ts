import { Router } from "express";
import type { Request, Response } from "express";
import { db, kvkkBreachNoticesTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireAdmin } from "./middleware";
import { logger } from "../../lib/logger";

const router = Router();
const STATUSES = ["new", "contacted", "interested", "closed", "not_fit"] as const;

// Lead'ler (tedarikçi bağlantılı) ve isteğe bağlı olarak tüm duyurular
router.get("/admin-panel/kvkk-leads", requireAdmin, async (req: Request, res: Response) => {
  const all = req.query["all"] === "1";
  const rows = await db.select().from(kvkkBreachNoticesTable).orderBy(desc(kvkkBreachNoticesTable.publishedAt), desc(kvkkBreachNoticesTable.id));
  res.json(all ? rows : rows.filter(r => r.isLead));
});

router.patch("/admin-panel/kvkk-leads/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  const { status, notes } = req.body as { status?: string; notes?: string | null };
  const u: Record<string, unknown> = { updatedAt: new Date() };
  if (status !== undefined) {
    if (!(STATUSES as readonly string[]).includes(status)) { res.status(400).json({ error: "Geçersiz durum" }); return; }
    u.status = status;
    if (status === "contacted") u.contactedAt = new Date();
  }
  if (notes !== undefined) u.notes = typeof notes === "string" && notes.trim() ? notes.trim().slice(0, 2000) : null;
  const upd = await db.update(kvkkBreachNoticesTable).set(u).where(eq(kvkkBreachNoticesTable.id, id)).returning({ id: kvkkBreachNoticesTable.id });
  if (!upd.length) { res.status(404).json({ error: "Bulunamadı" }); return; }
  res.json({ ok: true });
});

router.post("/admin-panel/kvkk-leads/:id/regenerate-script", requireAdmin, async (req: Request, res: Response) => {
  const { generateSalesScript } = await import("../../services/kvkkLeads");
  const ok = await generateSalesScript(Number(req.params["id"]));
  res.status(ok ? 200 : 500).json({ ok });
});

router.post("/admin-panel/kvkk-leads/run-now", requireAdmin, async (_req: Request, res: Response) => {
  res.json({ success: true, message: "KVKK duyuru taraması arka planda başlatıldı" });
  void (async () => {
    const { runKvkkLeadWatch } = await import("../../services/kvkkLeads");
    await runKvkkLeadWatch(3);
  })().catch(err => logger.error({ err }, "KVKK lead manuel tarama hatası"));
});

export default router;
