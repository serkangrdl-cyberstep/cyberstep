import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import {
  isrVendorsTable, isrDistributorsTable, isrDealsTable, isrRfqsTable,
  isrRfqResponsesTable, isrQuoteLinesTable, isrQuotesTable, isrMarginRulesTable,
  isrEmailInboxTable, isrCustomersTable, isrVendorsTable as vt,
} from "@workspace/db";
import { eq, desc, sql, and, count, ilike, or, inArray } from "drizzle-orm";
import { requireAdmin } from "./middleware";
import { getTenantId } from "../../middleware/auth";
import { sendRfqsForDeal, sendApprovedQuote, processInbox } from "../../services/isr-imap";

const router = Router();

function requireTenantId(req: Request, res: Response): number | null {
  const tid = (req.session as unknown as Record<string, unknown>)["tenantId"] as number | undefined;
  if (!tid) { res.status(403).json({ error: "Workspace seçilmedi", code: "NO_TENANT" }); return null; }
  return tid;
}

// ─── Dashboard overview ───────────────────────────────────────────────────────
router.get("/admin-panel/isr/stats", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;

  const [totalDeals, openDeals, pendingApproval, totalRfqs, vendors, revisionRequests] = await Promise.all([
    db.select({ count: count() }).from(isrDealsTable).where(eq(isrDealsTable.tenantId, tenantId)),
    db.select({ count: count() }).from(isrDealsTable)
      .where(and(eq(isrDealsTable.tenantId, tenantId), sql`${isrDealsTable.status} NOT IN ('won', 'lost', 'cancelled')`)),
    db.select({ count: count() }).from(isrQuotesTable)
      .innerJoin(isrDealsTable, eq(isrQuotesTable.dealId, isrDealsTable.id))
      .where(and(eq(isrDealsTable.tenantId, tenantId), eq(isrQuotesTable.status, "pending_approval"))),
    db.select({ count: count() }).from(isrRfqsTable)
      .innerJoin(isrDealsTable, eq(isrRfqsTable.dealId, isrDealsTable.id))
      .where(eq(isrDealsTable.tenantId, tenantId)),
    db.select({ count: count() }).from(isrVendorsTable)
      .where(and(eq(isrVendorsTable.tenantId, tenantId), eq(isrVendorsTable.isActive, true))),
    db.select({ count: count() }).from(isrDealsTable)
      .where(and(eq(isrDealsTable.tenantId, tenantId), eq(isrDealsTable.status, "revision_requested"))),
  ]);

  res.json({
    totalDeals: Number(totalDeals[0].count),
    openDeals: Number(openDeals[0].count),
    pendingApproval: Number(pendingApproval[0].count),
    totalRfqs: Number(totalRfqs[0].count),
    activeVendors: Number(vendors[0].count),
    revisionRequests: Number(revisionRequests[0].count),
  });
});

// ─── Customers ────────────────────────────────────────────────────────────────
router.get("/admin-panel/isr/customers", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const { q } = req.query as Record<string, string>;
  const where = q
    ? and(eq(isrCustomersTable.tenantId, tenantId), eq(isrCustomersTable.isActive, true),
        or(ilike(isrCustomersTable.companyName, `%${q}%`), ilike(isrCustomersTable.contactName, `%${q}%`)))
    : and(eq(isrCustomersTable.tenantId, tenantId), eq(isrCustomersTable.isActive, true));
  const customers = await db.select().from(isrCustomersTable).where(where).orderBy(isrCustomersTable.companyName);
  res.json(customers);
});

router.post("/admin-panel/isr/customers", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const { companyName, contactName, email, phone, sector, notes } = req.body as Record<string, string>;
  const [c] = await db.insert(isrCustomersTable)
    .values({ tenantId, companyName, contactName, email, phone, sector, notes })
    .returning({ id: isrCustomersTable.id });
  res.json({ ok: true, id: c?.id });
});

router.patch("/admin-panel/isr/customers/:id", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const id = parseInt(String(req.params.id));
  const { companyName, contactName, email, phone, sector, notes, isActive } = req.body as Record<string, string> & { isActive?: boolean };
  await db.update(isrCustomersTable)
    .set({ companyName, contactName, email, phone, sector, notes, isActive, updatedAt: new Date() })
    .where(and(eq(isrCustomersTable.id, id), eq(isrCustomersTable.tenantId, tenantId)));
  res.json({ ok: true });
});

router.delete("/admin-panel/isr/customers/:id", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const id = parseInt(String(req.params.id));
  await db.update(isrCustomersTable).set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(isrCustomersTable.id, id), eq(isrCustomersTable.tenantId, tenantId)));
  res.json({ ok: true });
});

// ─── Deals ────────────────────────────────────────────────────────────────────
router.get("/admin-panel/isr/deals", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const { status, limit = "50", offset = "0" } = req.query as Record<string, string>;

  const where = status
    ? and(eq(isrDealsTable.tenantId, tenantId), eq(isrDealsTable.status, status))
    : eq(isrDealsTable.tenantId, tenantId);

  const deals = await db.select().from(isrDealsTable).where(where)
    .orderBy(desc(isrDealsTable.createdAt)).limit(parseInt(limit)).offset(parseInt(offset));
  const [total] = await db.select({ count: count() }).from(isrDealsTable).where(where);

  const withCounts = await Promise.all(deals.map(async (d) => {
    const [quotes] = await db.select({ count: count() }).from(isrQuotesTable).where(eq(isrQuotesTable.dealId, d.id));
    const [rfqs] = await db.select({ count: count() }).from(isrRfqsTable).where(eq(isrRfqsTable.dealId, d.id));
    return { ...d, quoteCount: Number(quotes.count), rfqCount: Number(rfqs.count) };
  }));

  res.json({ deals: withCounts, total: Number(total.count) });
});

// ─── Paste & parse distributor reply ─────────────────────────────────────────
router.post("/admin-panel/isr/deals/:id/paste-response", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const dealId = parseInt(String(req.params.id));
  const { emailText, fromEmail = "manuel", fromName = "Manuel Giriş" } = req.body as {
    emailText: string; fromEmail?: string; fromName?: string;
  };
  if (!emailText?.trim()) { res.status(400).json({ error: "emailText gerekli" }); return; }

  const { parseRfqResponseEmail } = await import("../../services/isr-ai");

  const [deal] = await db.select({ id: isrDealsTable.id, tenantId: isrDealsTable.tenantId })
    .from(isrDealsTable).where(and(eq(isrDealsTable.id, dealId), eq(isrDealsTable.tenantId, tenantId)));
  if (!deal) { res.status(404).json({ error: "Deal bulunamadı" }); return; }

  // Find most recent RFQ for this deal (to link response)
  const [latestRfq] = await db.select({ id: isrRfqsTable.id })
    .from(isrRfqsTable).where(eq(isrRfqsTable.dealId, dealId))
    .orderBy(desc(isrRfqsTable.id)).limit(1);

  const parsed = await parseRfqResponseEmail({ subject: `Paste — Deal #${dealId}`, bodyText: emailText });

  const [response] = await db.insert(isrRfqResponsesTable).values({
    rfqId: latestRfq?.id ?? 0,
    dealId,
    fromEmail,
    subject: `Manuel Yapıştırma — Deal #${dealId}`,
    body: emailText.slice(0, 5000),
    aiParsed: parsed as unknown as Record<string, unknown>,
    currency: parsed.currency,
    validUntil: parsed.validUntil ?? null,
    notes: parsed.notes ?? null,
    receivedAt: new Date(),
  }).returning({ id: isrRfqResponsesTable.id });

  let lines: unknown[] = [];
  if (response && parsed.lines.length > 0) {
    const [marginRule] = await db.select()
      .from(isrMarginRulesTable)
      .where(and(eq(isrMarginRulesTable.isDefault, true), eq(isrMarginRulesTable.tenantId, tenantId)))
      .limit(1);
    const targetMargin = parseFloat(String(marginRule?.targetMarginPct ?? "25")) / 100;

    for (let i = 0; i < parsed.lines.length; i++) {
      const line = parsed.lines[i];
      const unitCost = line.unitCost;
      const unitPrice = unitCost > 0 ? unitCost / (1 - targetMargin) : 0;
      const [inserted] = await db.insert(isrQuoteLinesTable).values({
        rfqResponseId: response.id,
        sku: line.sku ?? null,
        description: line.description,
        quantity: line.quantity,
        unitCost: String(unitCost),
        unitPrice: String(Math.round(unitPrice * 100) / 100),
        lineTotal: String(Math.round(unitPrice * line.quantity * 100) / 100),
        currency: parsed.currency,
        sortOrder: i,
      }).returning();
      lines.push(inserted);
    }

    if (latestRfq) {
      await db.update(isrRfqsTable)
        .set({ status: "responded", respondedAt: new Date() })
        .where(eq(isrRfqsTable.id, latestRfq.id));
    }
    await db.update(isrDealsTable)
      .set({ status: "quoted", updatedAt: new Date() })
      .where(eq(isrDealsTable.id, dealId));
  }

  req.log.info({ dealId, lineCount: parsed.lines.length }, "ISR paste-response processed");
  res.json({ ok: true, responseId: response?.id, parsed, lineCount: parsed.lines.length, lines });
});

// ─── Parse deal request with AI ──────────────────────────────────────────────
router.post("/admin-panel/isr/deals/parse", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const { requestText } = req.body as { requestText: string };
  if (!requestText?.trim()) { res.status(400).json({ error: "requestText gerekli" }); return; }

  const { parseDealRequest } = await import("../../services/isr-ai");

  const [vendors, customers] = await Promise.all([
    db.select({ name: isrVendorsTable.name, displayName: isrVendorsTable.displayName })
      .from(isrVendorsTable).where(and(eq(isrVendorsTable.tenantId, tenantId), eq(isrVendorsTable.isActive, true))),
    db.select({ companyName: isrCustomersTable.companyName, contactName: isrCustomersTable.contactName })
      .from(isrCustomersTable).where(and(eq(isrCustomersTable.tenantId, tenantId), eq(isrCustomersTable.isActive, true))),
  ]);

  const result = await parseDealRequest({
    requestText,
    vendorNames: vendors.map(v => v.displayName),
    existingCustomers: customers,
  });

  res.json(result);
});

// ─── Create deal manually ─────────────────────────────────────────────────────
router.post("/admin-panel/isr/deals", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const {
    customerId, customerCompany, contactName, contactEmail, contactPhone,
    vendorId, vendorName, productKeywords, requestText,
    priority = "normal", intakeChannel = "manual",
    aiSummary, aiPriorityReason,
  } = req.body as Record<string, string | number | undefined>;

  const adminEmail = (req.session as unknown as Record<string, unknown>)["adminEmail"] as string ?? undefined;

  // Resolve vendor display name if only id given
  let resolvedVendorName = vendorName as string | undefined;
  if (vendorId && !resolvedVendorName) {
    const [v] = await db.select({ displayName: isrVendorsTable.displayName }).from(isrVendorsTable).where(eq(isrVendorsTable.id, Number(vendorId)));
    resolvedVendorName = v?.displayName;
  }

  // Auto-create or update customer if companyName provided
  let resolvedCustomerId = customerId ? Number(customerId) : undefined;
  if (!resolvedCustomerId && customerCompany) {
    const [existing] = await db.select({ id: isrCustomersTable.id })
      .from(isrCustomersTable)
      .where(and(eq(isrCustomersTable.tenantId, tenantId), ilike(isrCustomersTable.companyName, String(customerCompany))));
    if (existing) {
      resolvedCustomerId = existing.id;
      await db.update(isrCustomersTable).set({
        contactName: contactName as string ?? undefined,
        email: contactEmail as string ?? undefined,
        phone: contactPhone as string ?? undefined,
        updatedAt: new Date(),
      }).where(eq(isrCustomersTable.id, existing.id));
    } else {
      const [newCust] = await db.insert(isrCustomersTable).values({
        tenantId,
        companyName: String(customerCompany),
        contactName: contactName as string ?? undefined,
        email: contactEmail as string ?? undefined,
        phone: contactPhone as string ?? undefined,
      }).returning({ id: isrCustomersTable.id });
      resolvedCustomerId = newCust?.id;
    }
  }

  const [deal] = await db.insert(isrDealsTable).values({
    tenantId,
    customerId: resolvedCustomerId ?? null,
    customerName: contactName as string ?? undefined,
    customerEmail: contactEmail as string ?? "",
    customerCompany: customerCompany as string ?? undefined,
    customerPhone: contactPhone as string ?? undefined,
    vendorId: vendorId ? Number(vendorId) : null,
    vendorName: resolvedVendorName,
    productKeywords: productKeywords as string ?? undefined,
    requestText: requestText as string ?? undefined,
    aiSummary: aiSummary as string ?? undefined,
    aiPriorityReason: aiPriorityReason as string ?? undefined,
    priority: priority as string,
    intakeChannel: intakeChannel as string,
    assignedRepEmail: adminEmail,
    status: "new",
  }).returning({ id: isrDealsTable.id });

  req.log.info({ tenantId, dealId: deal?.id }, "ISR deal created manually");
  res.json({ ok: true, id: deal?.id });
});

router.get("/admin-panel/isr/deals/:id", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const id = parseInt(String(req.params.id));
  const [deal] = await db.select().from(isrDealsTable)
    .where(and(eq(isrDealsTable.id, id), eq(isrDealsTable.tenantId, tenantId)));
  if (!deal) { res.status(404).json({ error: "Deal not found" }); return; }

  const rfqs = await db.select().from(isrRfqsTable).where(eq(isrRfqsTable.dealId, id)).orderBy(desc(isrRfqsTable.sentAt));
  const responses = await db.select().from(isrRfqResponsesTable).where(eq(isrRfqResponsesTable.dealId, id)).orderBy(desc(isrRfqResponsesTable.receivedAt));
  const responseIds = responses.map((r) => r.id);
  const lines = responseIds.length > 0
    ? await db.select().from(isrQuoteLinesTable)
        .where(inArray(isrQuoteLinesTable.rfqResponseId, responseIds))
        .orderBy(isrQuoteLinesTable.sortOrder)
    : [];
  const quotes = await db.select().from(isrQuotesTable).where(eq(isrQuotesTable.dealId, id)).orderBy(desc(isrQuotesTable.createdAt));
  const quoteIds = quotes.map((q) => q.id);
  const quoteLines = quoteIds.length > 0
    ? await db.select().from(isrQuoteLinesTable)
        .where(inArray(isrQuoteLinesTable.quoteId, quoteIds))
        .orderBy(isrQuoteLinesTable.sortOrder)
    : [];

  res.json({ deal, rfqs, responses, lines, quotes, quoteLines });
});

router.patch("/admin-panel/isr/deals/:id", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const id = parseInt(String(req.params.id));
  const { status, notes, assignedRepEmail, priority } = req.body as Record<string, string>;
  await db.update(isrDealsTable)
    .set({ status, notes, assignedRepEmail, priority, updatedAt: new Date() })
    .where(and(eq(isrDealsTable.id, id), eq(isrDealsTable.tenantId, tenantId)));
  res.json({ ok: true });
});

// Manually trigger RFQ sending
router.post("/admin-panel/isr/deals/:id/send-rfq", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const id = parseInt(String(req.params.id));
  const { vendorId, distributorIds } = req.body as { vendorId?: number; distributorIds?: number[] };
  const [deal] = await db.select().from(isrDealsTable)
    .where(and(eq(isrDealsTable.id, id), eq(isrDealsTable.tenantId, tenantId)));
  if (!deal) { res.status(404).json({ error: "Deal not found" }); return; }
  const vid = vendorId ?? deal.vendorId;
  if (!vid) { res.status(400).json({ error: "Vendor seçilmedi" }); return; }
  if (vendorId && vendorId !== deal.vendorId) {
    const [vendor] = await db.select({ displayName: vt.displayName }).from(vt).where(eq(vt.id, vendorId));
    await db.update(isrDealsTable).set({ vendorId, vendorName: vendor?.displayName ?? null, updatedAt: new Date() })
      .where(and(eq(isrDealsTable.id, id), eq(isrDealsTable.tenantId, tenantId)));
  }
  await sendRfqsForDeal(id, vid, deal.productKeywords ?? deal.originalSubject ?? "", deal.originalBody ?? "", distributorIds, tenantId);
  res.json({ ok: true });
});

// ─── Quotes ───────────────────────────────────────────────────────────────────
router.post("/admin-panel/isr/deals/:id/quotes", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const dealId = parseInt(String(req.params.id));
  const [deal] = await db.select().from(isrDealsTable)
    .where(and(eq(isrDealsTable.id, dealId), eq(isrDealsTable.tenantId, tenantId)));
  if (!deal) { res.status(404).json({ error: "Deal not found" }); return; }

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
        quoteId: quote.id, sku: l.sku ?? null, description: l.description,
        quantity: l.quantity, unitCost: l.unitCost != null ? String(l.unitCost) : null,
        unitPrice: String(l.unitPrice), lineTotal: String(lineTotal),
        currency: l.currency ?? currency, isCustom: true, sortOrder: i,
      });
    }
    await db.update(isrDealsTable)
      .set({ status: "quoted", updatedAt: new Date() })
      .where(and(eq(isrDealsTable.id, dealId), eq(isrDealsTable.tenantId, tenantId)));
  }

  res.json({ ok: true, quoteId: quote?.id });
});

router.post("/admin-panel/isr/quotes/:id/approve", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  const adminEmail = (req.session as unknown as Record<string, unknown>)["adminEmail"] as string ?? "admin";
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
router.get("/admin-panel/isr/vendors", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const vendors = await db.select().from(isrVendorsTable)
    .where(eq(isrVendorsTable.tenantId, tenantId)).orderBy(isrVendorsTable.name);
  const withDists = await Promise.all(vendors.map(async (v) => {
    const distributors = await db.select().from(isrDistributorsTable)
      .where(and(eq(isrDistributorsTable.vendorId, v.id), eq(isrDistributorsTable.tenantId, tenantId)))
      .orderBy(isrDistributorsTable.name);
    return { ...v, distributors };
  }));
  res.json(withDists);
});

router.post("/admin-panel/isr/vendors", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const { name, displayName, salesRepName, salesRepEmail, dealRegUrl, notes } = req.body as IsrVendorBody;
  const [v] = await db.insert(isrVendorsTable).values({ tenantId, name, displayName, salesRepName, salesRepEmail, dealRegUrl, notes }).returning({ id: isrVendorsTable.id });
  res.json({ ok: true, id: v?.id });
});

router.patch("/admin-panel/isr/vendors/:id", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const id = parseInt(String(req.params.id));
  const { name, displayName, salesRepName, salesRepEmail, dealRegUrl, notes, isActive } = req.body as IsrVendorBody & { isActive?: boolean };
  await db.update(isrVendorsTable)
    .set({ name, displayName, salesRepName, salesRepEmail, dealRegUrl, notes, isActive, updatedAt: new Date() })
    .where(and(eq(isrVendorsTable.id, id), eq(isrVendorsTable.tenantId, tenantId)));
  res.json({ ok: true });
});

router.delete("/admin-panel/isr/vendors/:id", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const id = parseInt(String(req.params.id));
  await db.update(isrVendorsTable).set({ isActive: false })
    .where(and(eq(isrVendorsTable.id, id), eq(isrVendorsTable.tenantId, tenantId)));
  res.json({ ok: true });
});

// ─── Distributors ─────────────────────────────────────────────────────────────
router.post("/admin-panel/isr/distributors", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const { vendorId, name, contactName, contactEmail, phone, notes, additionalContacts } = req.body as IsrDistributorBody;
  const [d] = await db.insert(isrDistributorsTable)
    .values({ tenantId, vendorId: parseInt(String(vendorId)), name, contactName, contactEmail, phone, notes, additionalContacts: additionalContacts ?? [] })
    .returning({ id: isrDistributorsTable.id });
  res.json({ ok: true, id: d?.id });
});

router.patch("/admin-panel/isr/distributors/:id", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const id = parseInt(String(req.params.id));
  const { name, contactName, contactEmail, phone, notes, additionalContacts, isActive } = req.body as IsrDistributorBody & { isActive?: boolean };
  await db.update(isrDistributorsTable)
    .set({ name, contactName, contactEmail, phone, notes, additionalContacts: additionalContacts ?? [], isActive, updatedAt: new Date() })
    .where(and(eq(isrDistributorsTable.id, id), eq(isrDistributorsTable.tenantId, tenantId)));
  res.json({ ok: true });
});

router.delete("/admin-panel/isr/distributors/:id", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const id = parseInt(String(req.params.id));
  await db.update(isrDistributorsTable).set({ isActive: false })
    .where(and(eq(isrDistributorsTable.id, id), eq(isrDistributorsTable.tenantId, tenantId)));
  res.json({ ok: true });
});

// ─── IMAP Test Trigger ────────────────────────────────────────────────────────
router.post("/admin-panel/isr/trigger-imap", requireAdmin, async (_req: Request, res: Response) => {
  try {
    await processInbox();
    res.json({ ok: true, message: "IMAP polling tamamlandı" });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ─── Margin Rules ─────────────────────────────────────────────────────────────
router.get("/admin-panel/isr/margin-rules", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const rules = await db.select().from(isrMarginRulesTable)
    .where(eq(isrMarginRulesTable.tenantId, tenantId)).orderBy(isrMarginRulesTable.name);
  res.json(rules);
});

router.post("/admin-panel/isr/margin-rules", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const { vendorId, name, minMarginPct, targetMarginPct, maxDiscountPct, autoApproveBelow, requireApprovalAbove, isDefault } = req.body as MarginRuleBody;
  if (isDefault) {
    await db.update(isrMarginRulesTable).set({ isDefault: false }).where(eq(isrMarginRulesTable.tenantId, tenantId));
  }
  const [r] = await db.insert(isrMarginRulesTable).values({
    tenantId, vendorId: vendorId ? parseInt(String(vendorId)) : null,
    name, isDefault: !!isDefault, isActive: true,
    minMarginPct: String(minMarginPct), targetMarginPct: String(targetMarginPct),
    maxDiscountPct: String(maxDiscountPct),
    autoApproveBelow: autoApproveBelow ? String(autoApproveBelow) : null,
    requireApprovalAbove: requireApprovalAbove ? String(requireApprovalAbove) : null,
  }).returning({ id: isrMarginRulesTable.id });
  res.json({ ok: true, id: r?.id });
});

router.patch("/admin-panel/isr/margin-rules/:id", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const id = parseInt(String(req.params.id));
  const { name, minMarginPct, targetMarginPct, maxDiscountPct, autoApproveBelow, requireApprovalAbove, isDefault, isActive } = req.body as MarginRuleBody & { isActive?: boolean };
  if (isDefault) {
    await db.update(isrMarginRulesTable).set({ isDefault: false }).where(eq(isrMarginRulesTable.tenantId, tenantId));
  }
  await db.update(isrMarginRulesTable).set({
    name, isDefault: !!isDefault, isActive,
    minMarginPct: minMarginPct != null ? String(minMarginPct) : undefined,
    targetMarginPct: targetMarginPct != null ? String(targetMarginPct) : undefined,
    maxDiscountPct: maxDiscountPct != null ? String(maxDiscountPct) : undefined,
    autoApproveBelow: autoApproveBelow ? String(autoApproveBelow) : null,
    requireApprovalAbove: requireApprovalAbove ? String(requireApprovalAbove) : null,
    updatedAt: new Date(),
  }).where(and(eq(isrMarginRulesTable.id, id), eq(isrMarginRulesTable.tenantId, tenantId)));
  res.json({ ok: true });
});

router.delete("/admin-panel/isr/margin-rules/:id", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const id = parseInt(String(req.params.id));
  await db.delete(isrMarginRulesTable)
    .where(and(eq(isrMarginRulesTable.id, id), eq(isrMarginRulesTable.tenantId, tenantId)));
  res.json({ ok: true });
});

// ─── Inbox log ────────────────────────────────────────────────────────────────
router.get("/admin-panel/isr/inbox", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const inbox = await db.select().from(isrEmailInboxTable)
    .where(eq(isrEmailInboxTable.tenantId, tenantId))
    .orderBy(desc(isrEmailInboxTable.receivedAt)).limit(100);
  res.json(inbox);
});

router.post("/admin-panel/isr/inbox/check", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const { processInboxForTenant } = await import("../../services/isr-imap");
  try {
    await processInboxForTenant(tenantId);
    res.json({ ok: true, message: "Gelen kutusu kontrol edildi" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err, tenantId }, "ISR inbox check failed");
    res.status(502).json({ ok: false, message: `IMAP bağlantı hatası: ${msg}` });
  }
});

// ─── Types (local) ────────────────────────────────────────────────────────────
interface IsrVendorBody {
  name: string; displayName: string; salesRepName?: string;
  salesRepEmail?: string; dealRegUrl?: string; notes?: string;
}
interface AdditionalContact {
  name?: string; email: string; phone?: string; role?: string;
}
interface IsrDistributorBody {
  vendorId: number | string; name: string; contactName?: string;
  contactEmail: string; phone?: string; notes?: string;
  additionalContacts?: AdditionalContact[];
}
interface MarginRuleBody {
  vendorId?: number | string; name: string; minMarginPct: number;
  targetMarginPct: number; maxDiscountPct: number;
  autoApproveBelow?: number; requireApprovalAbove?: number; isDefault?: boolean;
}

// Suppress unused import warning
void getTenantId;

export default router;
