import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { domainScanPurchasesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../../lib/logger";

const router = Router();

// POST /api/domain-scan/purchase — create purchase record (called from frontend)
router.post("/domain-scan/purchase", async (req: Request, res: Response) => {
  const rawEmail = req.body?.email;
  const rawDomain = req.body?.domain;
  const rawScanId = req.body?.scanId;

  if (!rawEmail || typeof rawEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail.trim())) {
    res.status(400).json({ error: "Geçerli bir e-posta adresi gereklidir" });
    return;
  }

  const email = rawEmail.trim().toLowerCase();
  const domain = typeof rawDomain === "string" ? rawDomain.trim() : null;
  const scanId = typeof rawScanId === "number" ? rawScanId : null;

  const [existing] = await db.select()
    .from(domainScanPurchasesTable)
    .where(and(eq(domainScanPurchasesTable.email, email), eq(domainScanPurchasesTable.status, "paid")))
    .limit(1);

  if (existing) {
    res.json({ status: "paid", id: existing.id, alreadyPurchased: true });
    return;
  }

  const [purchase] = await db.insert(domainScanPurchasesTable)
    .values({ email, domain, scanId, status: "pending" })
    .returning();

  logger.info({ purchaseId: purchase?.id, email, domain }, "Domain scan purchase intent created");
  res.json({ status: "pending", id: purchase?.id });
});

// GET /api/domain-scan/purchase/check?email=X — check if email has paid access
router.get("/domain-scan/purchase/check", async (req: Request, res: Response) => {
  const rawEmail = req.query["email"];
  if (typeof rawEmail !== "string" || !rawEmail.trim()) {
    res.status(400).json({ error: "E-posta parametresi gereklidir" });
    return;
  }

  const email = rawEmail.trim().toLowerCase();
  const [purchase] = await db.select()
    .from(domainScanPurchasesTable)
    .where(and(eq(domainScanPurchasesTable.email, email), eq(domainScanPurchasesTable.status, "paid")))
    .limit(1);

  res.json({ hasPaidAccess: !!purchase, scanId: purchase?.scanId ?? null });
});

// POST /api/domain-scan/purchase/:id/mark-paid — admin/webhook endpoint
router.post("/domain-scan/purchase/:id/mark-paid", async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (!id) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const paymentRef = typeof req.body?.paymentRef === "string" ? req.body.paymentRef : null;

  const [updated] = await db.update(domainScanPurchasesTable)
    .set({ status: "paid", paidAt: new Date(), paymentRef })
    .where(eq(domainScanPurchasesTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Satın alma bulunamadı" }); return; }

  logger.info({ purchaseId: id, email: updated.email }, "Domain scan purchase marked paid");
  res.json({ ok: true, purchase: updated });
});

export default router;
