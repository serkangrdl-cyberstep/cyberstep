import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import {
  isrVendorsTable, isrDistributorsTable, isrDealsTable, isrRfqsTable,
  isrRfqResponsesTable, isrQuoteLinesTable, isrQuotesTable, isrMarginRulesTable,
  isrEmailInboxTable,
} from "@workspace/db";
import { eq, desc, sql, and, count } from "drizzle-orm";
import { requireAdmin } from "./middleware";
import { sendRfqsForDeal, sendApprovedQuote } from "../../services/isr-imap";

const router = Router();

// ─── Dashboard overview ───────────────────────────────────────────────────────
router.get("/admin-panel/isr/stats", requireAdmin, async (_req: Request, res: Response) => {
  const [totalDeals] = await db.select({ count: count() }).from(isrDealsTable);
  const [openDeals] = await db.select({ count: count() }).from(isrDealsTable)
    .where(sql`${isrDealsTable.status} NOT IN ('won', 'lost', 'cancelled')`);
  const [pendingApproval] = await db.select({ count: count() }).from(isrQuotesTable)
    .where(eq(isrQuotesTable.status, "pending_approval"));
  const [totalRfqs] = await db.select({ count: count() }).from(isrRfqsTable);
  const [vendors] = await db.select({ count: count() }).from(isrVendorsTable).where(eq(isrVendorsTable.isActive, true));

  res.json({
    totalDeals: Number(totalDeals.count),
    openDeals: Number(openDeals.count),
    pendingApproval: Number(pendingApproval.count),
    totalRfqs: Number(totalRfqs.count),
    activeVendors: Number(vendors.count),
  });
});

// ─── Deals ────────────────────────────────────────────────────────────────────
router.get("/admin-panel/isr/deals", requireAdmin, async (req: Request, res: Response) => {
  const { status, limit = "50", offset = "0" } = req.query as Record<string, string>;
  let q = db.select().from(isrDealsTable).orderBy(desc(isrDealsTable.createdAt))
    .limit(parseInt(limit)).offset(parseInt(offset));
  if (status) {
    // Filter not directly chainable in this form; fetch all then filter client-side for simplicity
  }
  const deals = await q;
  const [total] = await db.select({ count: count() }).from(isrDealsTable);

  // Attach quote count per deal
  const withCounts = await Promise.all(deals.map(async (d) => {
    const [quotes] = await db.select({ count: count() }).from(isrQuotesTable).where(eq(isrQuotesTable.dealId, d.id));
    const [rfqs] = await db.select({ count: count() }).from(isrRfqsTable).where(eq(isrRfqsTable.dealId, d.id));
    return { ...d, quoteCount: Number(quotes.count), rfqCount: Number(rfqs.count) };
  }));

  res.json({ deals: withCounts, total: Number(total.count) });
});

router.get("/admin-panel/isr/deals/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  const [deal] = await db.select().from(isrDealsTable).where(eq(isrDealsTable.id, id));
  if (!deal) { res.status(404).json({ error: "Deal not found" }); return; }

  const rfqs = await db.select().from(isrRfqsTable).where(eq(isrRfqsTable.dealId, id)).orderBy(desc(isrRfqsTable.sentAt));
  const responses = await db.select().from(isrRfqResponsesTable).where(eq(isrRfqResponsesTable.dealId, id)).orderBy(desc(isrRfqResponsesTable.receivedAt));
  const responseIds = responses.map((r) => r.id);
  const lines = responseIds.length > 0
    ? await db.select().from(isrQuoteLinesTable)
        .where(sql`${isrQuoteLinesTable.rfqResponseId} = ANY(${responseIds}::int[])`)
        .orderBy(isrQuoteLinesTable.sortOrder)
    : [];
  const quotes = await db.select().from(isrQuotesTable).where(eq(isrQuotesTable.dealId, id)).orderBy(desc(isrQuotesTable.createdAt));
  const quoteIds = quotes.map((q) => q.id);
  const quoteLines = quoteIds.length > 0
    ? await db.select().from(isrQuoteLinesTable)
        .where(sql`${isrQuoteLinesTable.quoteId} = ANY(${quoteIds}::int[])`)
        .orderBy(isrQuoteLinesTable.sortOrder)
    : [];

  res.json({ deal, rfqs, responses, lines, quotes, quoteLines });
});

router.patch("/admin-panel/isr/deals/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  const { status, notes, assignedRepEmail, priority } = req.body as Record<string, string>;
  await db.update(isrDealsTable)
    .set({ status, notes, assignedRepEmail, priority, updatedAt: new Date() })
    .where(eq(isrDealsTable.id, id));
  res.json({ ok: true });
});

// Manually trigger RFQ sending
router.post("/admin-panel/isr/deals/:id/send-rfq", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  const { vendorId } = req.body as { vendorId: number };
  const [deal] = await db.select().from(isrDealsTable).where(eq(isrDealsTable.id, id));
  if (!deal) { res.status(404).json({ error: "Deal not found" }); return; }
  const vid = vendorId ?? deal.vendorId;
  if (!vid) { res.status(400).json({ error: "No vendor selected for this deal" }); return; }
  await sendRfqsForDeal(id, vid, deal.productKeywords ?? deal.originalSubject ?? "", deal.originalBody ?? "");
  res.json({ ok: true });
});

// ─── Quotes ───────────────────────────────────────────────────────────────────
router.post("/admin-panel/isr/deals/:id/quotes", requireAdmin, async (req: Request, res: Response) => {
  const dealId = parseInt(String(req.params.id));
  const { lines, notes, terms, validDays = 30, kdvRate = 20, currency = "TRY" } = req.body as {
    lines: Array<{ sku?: string; description: string; quantity: number; unitPrice: number; unitCost?: number; currency?: string }>;
    notes?: string; terms?: string; validDays?: number; kdvRate?: number; currency?: string;
  };

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const kdvAmount = subtotal * (kdvRate / 100);
  const total = subtotal + kdvAmount;

  const quoteNumber = `ISR-${dealId}-${Date.now().toString(36).toUpperCase()}`;

  const [quote] = await db.insert(isrQuotesTable).values({
    dealId, quoteNumber, currency,
    subtotal: String(subtotal), kdvRate: String(kdvRate),
    kdvAmount: String(kdvAmount), total: String(total),
    validDays, notes, terms, status: "pending_approval",
  }).returning({ id: isrQuotesTable.id });

  if (quote) {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const lineTotal = l.unitPrice * l.quantity;
      await db.insert(isrQuoteLinesTable).values({
        quoteId: quote.id,
        sku: l.sku ?? null,
        description: l.description,
        quantity: l.quantity,
        unitCost: l.unitCost != null ? String(l.unitCost) : null,
        unitPrice: String(l.unitPrice),
        lineTotal: String(lineTotal),
        currency: l.currency ?? currency,
        isCustom: true,
        sortOrder: i,
      });
    }
    await db.update(isrDealsTable)
      .set({ status: "quoted", updatedAt: new Date() })
      .where(eq(isrDealsTable.id, dealId));
  }

  res.json({ ok: true, quoteId: quote?.id });
});

router.post("/admin-panel/isr/quotes/:id/approve", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  const adminEmail = (req as Request & { admin?: { email: string } }).admin?.email ?? "admin";
  await db.update(isrQuotesTable)
    .set({ status: "approved", approvedByEmail: adminEmail, approvedAt: new Date() })
    .where(eq(isrQuotesTable.id, id));
  await sendApprovedQuote(id);
  res.json({ ok: true });
});

router.post("/admin-panel/isr/quotes/:id/reject", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  await db.update(isrQuotesTable).set({ status: "rejected" }).where(eq(isrQuotesTable.id, id));
  res.json({ ok: true });
});

// ─── Vendors ──────────────────────────────────────────────────────────────────
router.get("/admin-panel/isr/vendors", requireAdmin, async (_req: Request, res: Response) => {
  const vendors = await db.select().from(isrVendorsTable).orderBy(isrVendorsTable.name);
  const withDists = await Promise.all(vendors.map(async (v) => {
    const distributors = await db.select().from(isrDistributorsTable)
      .where(eq(isrDistributorsTable.vendorId, v.id)).orderBy(isrDistributorsTable.name);
    return { ...v, distributors };
  }));
  res.json(withDists);
});

router.post("/admin-panel/isr/vendors", requireAdmin, async (req: Request, res: Response) => {
  const { name, displayName, salesRepName, salesRepEmail, dealRegUrl, notes } = req.body as IsrVendorBody;
  const [v] = await db.insert(isrVendorsTable).values({ name, displayName, salesRepName, salesRepEmail, dealRegUrl, notes }).returning({ id: isrVendorsTable.id });
  res.json({ ok: true, id: v?.id });
});

router.patch("/admin-panel/isr/vendors/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  const { name, displayName, salesRepName, salesRepEmail, dealRegUrl, notes, isActive } = req.body as IsrVendorBody & { isActive?: boolean };
  await db.update(isrVendorsTable).set({ name, displayName, salesRepName, salesRepEmail, dealRegUrl, notes, isActive, updatedAt: new Date() }).where(eq(isrVendorsTable.id, id));
  res.json({ ok: true });
});

router.delete("/admin-panel/isr/vendors/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  await db.update(isrVendorsTable).set({ isActive: false }).where(eq(isrVendorsTable.id, id));
  res.json({ ok: true });
});

// ─── Distributors ─────────────────────────────────────────────────────────────
router.post("/admin-panel/isr/distributors", requireAdmin, async (req: Request, res: Response) => {
  const { vendorId, name, contactName, contactEmail, phone, notes } = req.body as IsrDistributorBody;
  const [d] = await db.insert(isrDistributorsTable).values({ vendorId: parseInt(String(vendorId)), name, contactName, contactEmail, phone, notes }).returning({ id: isrDistributorsTable.id });
  res.json({ ok: true, id: d?.id });
});

router.patch("/admin-panel/isr/distributors/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  const { name, contactName, contactEmail, phone, notes, isActive } = req.body as IsrDistributorBody & { isActive?: boolean };
  await db.update(isrDistributorsTable).set({ name, contactName, contactEmail, phone, notes, isActive, updatedAt: new Date() }).where(eq(isrDistributorsTable.id, id));
  res.json({ ok: true });
});

router.delete("/admin-panel/isr/distributors/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  await db.update(isrDistributorsTable).set({ isActive: false }).where(eq(isrDistributorsTable.id, id));
  res.json({ ok: true });
});

// ─── Margin Rules ─────────────────────────────────────────────────────────────
router.get("/admin-panel/isr/margin-rules", requireAdmin, async (_req: Request, res: Response) => {
  const rules = await db.select().from(isrMarginRulesTable).orderBy(isrMarginRulesTable.name);
  res.json(rules);
});

router.post("/admin-panel/isr/margin-rules", requireAdmin, async (req: Request, res: Response) => {
  const { vendorId, name, minMarginPct, targetMarginPct, maxDiscountPct, autoApproveBelow, requireApprovalAbove, isDefault } = req.body as MarginRuleBody;
  if (isDefault) {
    await db.update(isrMarginRulesTable).set({ isDefault: false });
  }
  const [r] = await db.insert(isrMarginRulesTable).values({
    vendorId: vendorId ? parseInt(String(vendorId)) : null,
    name, isDefault: !!isDefault, isActive: true,
    minMarginPct: String(minMarginPct), targetMarginPct: String(targetMarginPct),
    maxDiscountPct: String(maxDiscountPct),
    autoApproveBelow: autoApproveBelow ? String(autoApproveBelow) : null,
    requireApprovalAbove: requireApprovalAbove ? String(requireApprovalAbove) : null,
  }).returning({ id: isrMarginRulesTable.id });
  res.json({ ok: true, id: r?.id });
});

router.patch("/admin-panel/isr/margin-rules/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  const { name, minMarginPct, targetMarginPct, maxDiscountPct, autoApproveBelow, requireApprovalAbove, isDefault, isActive } = req.body as MarginRuleBody & { isActive?: boolean };
  if (isDefault) {
    await db.update(isrMarginRulesTable).set({ isDefault: false });
  }
  await db.update(isrMarginRulesTable).set({
    name, isDefault: !!isDefault, isActive,
    minMarginPct: minMarginPct != null ? String(minMarginPct) : undefined,
    targetMarginPct: targetMarginPct != null ? String(targetMarginPct) : undefined,
    maxDiscountPct: maxDiscountPct != null ? String(maxDiscountPct) : undefined,
    autoApproveBelow: autoApproveBelow ? String(autoApproveBelow) : null,
    requireApprovalAbove: requireApprovalAbove ? String(requireApprovalAbove) : null,
    updatedAt: new Date(),
  }).where(eq(isrMarginRulesTable.id, id));
  res.json({ ok: true });
});

router.delete("/admin-panel/isr/margin-rules/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  await db.delete(isrMarginRulesTable).where(eq(isrMarginRulesTable.id, id));
  res.json({ ok: true });
});

// ─── Inbox log ────────────────────────────────────────────────────────────────
router.get("/admin-panel/isr/inbox", requireAdmin, async (_req: Request, res: Response) => {
  const inbox = await db.select().from(isrEmailInboxTable).orderBy(desc(isrEmailInboxTable.receivedAt)).limit(100);
  res.json(inbox);
});

// Manually trigger inbox check
router.post("/admin-panel/isr/inbox/check", requireAdmin, async (_req: Request, res: Response) => {
  const { processInbox } = await import("../../services/isr-imap");
  processInbox().catch((err: unknown) => console.error("ISR inbox error", err));
  res.json({ ok: true, message: "Gelen kutusu kontrolü başlatıldı" });
});

// ─── Types (local) ────────────────────────────────────────────────────────────
interface IsrVendorBody {
  name: string; displayName: string; salesRepName?: string;
  salesRepEmail?: string; dealRegUrl?: string; notes?: string;
}
interface IsrDistributorBody {
  vendorId: number | string; name: string; contactName?: string;
  contactEmail: string; phone?: string; notes?: string;
}
interface MarginRuleBody {
  vendorId?: number | string; name: string; minMarginPct: number;
  targetMarginPct: number; maxDiscountPct: number;
  autoApproveBelow?: number; requireApprovalAbove?: number; isDefault?: boolean;
}

export default router;
