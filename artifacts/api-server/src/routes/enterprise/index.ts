import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import {
  enterpriseProspectsTable,
  enterpriseContractsTable,
  enterpriseContractServicesTable,
  enterpriseInvoicesTable,
} from "@workspace/db";
import { eq, desc, sql, and, count, isNull, inArray } from "drizzle-orm";
import { requireAdmin } from "../admin-panel/middleware";
import { logger } from "../../lib/logger";

const router = Router();

// ─── Prospects ────────────────────────────────────────────────────────────────

router.get("/enterprise/prospects", requireAdmin, async (req: Request, res: Response) => {
  const rows = await db.select().from(enterpriseProspectsTable).orderBy(desc(enterpriseProspectsTable.lastActivityAt));
  res.json(rows);
});

router.get("/enterprise/prospects/stats", requireAdmin, async (req: Request, res: Response) => {
  const statuses = ["new", "contacted", "pilot", "proposal", "contract", "won", "lost"];
  const counts = await Promise.all(
    statuses.map(s =>
      db.select({ count: count() }).from(enterpriseProspectsTable)
        .where(eq(enterpriseProspectsTable.status, s))
    )
  );
  const result: Record<string, number> = {};
  statuses.forEach((s, i) => { result[s] = Number(counts[i]![0]?.count ?? 0); });
  res.json(result);
});

router.get("/enterprise/prospects/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const [row] = await db.select().from(enterpriseProspectsTable).where(eq(enterpriseProspectsTable.id, id));
  if (!row) return void res.status(404).json({ error: "Bulunamadı" });
  res.json(row);
});

router.post("/enterprise/prospects", requireAdmin, async (req: Request, res: Response) => {
  const { companyName, domain, sector, employeeCount, city, contactName, contactTitle, contactEmail, contactPhone, linkedinUrl, source, assignedTo, notes } = req.body as Record<string, string>;
  const supplierCount = Number((req.body as Record<string, unknown>)["supplierCount"]) || null;
  if (!companyName) return void res.status(400).json({ error: "companyName zorunlu" });
  const [row] = await db.insert(enterpriseProspectsTable).values({
    companyName, domain: domain ?? "", sector, employeeCount, city, supplierCount,
    contactName, contactTitle, contactEmail, contactPhone, linkedinUrl,
    source: source ?? "manual",
    assignedTo, notes, status: "new",
  }).returning();
  res.json({ ok: true, id: row?.id });
});

router.patch("/enterprise/prospects/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const updates = req.body as Record<string, unknown>;
  delete updates["id"]; delete updates["createdAt"];
  await db.update(enterpriseProspectsTable)
    .set({ ...updates, lastActivityAt: new Date() } as typeof updates)
    .where(eq(enterpriseProspectsTable.id, id));
  res.json({ ok: true });
});

router.delete("/enterprise/prospects/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  await db.delete(enterpriseProspectsTable).where(eq(enterpriseProspectsTable.id, id));
  res.json({ ok: true });
});

// ─── Contracts ────────────────────────────────────────────────────────────────

router.get("/enterprise/contracts", requireAdmin, async (req: Request, res: Response) => {
  const rows = await db.select().from(enterpriseContractsTable).orderBy(desc(enterpriseContractsTable.createdAt));
  res.json(rows);
});

router.get("/enterprise/contracts/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const [contract] = await db.select().from(enterpriseContractsTable).where(eq(enterpriseContractsTable.id, id));
  if (!contract) return void res.status(404).json({ error: "Sözleşme bulunamadı" });
  const services = await db.select().from(enterpriseContractServicesTable)
    .where(eq(enterpriseContractServicesTable.contractId, id));
  const invoices = await db.select().from(enterpriseInvoicesTable)
    .where(eq(enterpriseInvoicesTable.contractId, id))
    .orderBy(desc(enterpriseInvoicesTable.createdAt));
  res.json({ ...contract, services, invoices });
});

function generateContractNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const seq = Math.floor(Math.random() * 9000) + 1000;
  return `CS-${year}-${seq}`;
}

router.post("/enterprise/contracts", requireAdmin, async (req: Request, res: Response) => {
  const body = req.body as {
    prospectId?: number;
    companyName: string;
    companyTaxId?: string;
    companyTaxOffice?: string;
    companyAddress?: string;
    billingContactName?: string;
    billingContactEmail?: string;
    contractType?: string;
    billingCycle?: string;
    paymentMethod?: string;
    paymentTerms?: number;
    startDate: string;
    endDate?: string;
    discountPct?: number;
    discountReason?: string;
    internalNotes?: string;
    createdBy?: string;
    services?: Array<{ serviceSlug: string; serviceName: string; unitPriceTl: string; quantity: number; lineTotalTl: string }>;
  };

  const contractNumber = generateContractNumber();
  const [contract] = await db.insert(enterpriseContractsTable).values({
    prospectId: body.prospectId,
    contractNumber,
    companyName: body.companyName,
    companyTaxId: body.companyTaxId,
    companyTaxOffice: body.companyTaxOffice,
    companyAddress: body.companyAddress,
    billingContactName: body.billingContactName,
    billingContactEmail: body.billingContactEmail,
    contractType: body.contractType ?? "annual",
    billingCycle: body.billingCycle ?? "annual",
    paymentMethod: body.paymentMethod ?? "bank_transfer",
    paymentTerms: body.paymentTerms ?? 30,
    startDate: body.startDate,
    endDate: body.endDate,
    discountPct: body.discountPct ?? 0,
    discountReason: body.discountReason,
    internalNotes: body.internalNotes,
    createdBy: body.createdBy,
    status: "draft",
  }).returning();

  if (body.services?.length && contract) {
    await db.insert(enterpriseContractServicesTable).values(
      body.services.map(s => ({
        contractId: contract.id,
        serviceSlug: s.serviceSlug,
        serviceName: s.serviceName,
        unitPriceTl: s.unitPriceTl,
        quantity: s.quantity,
        lineTotalTl: s.lineTotalTl,
        isActive: false,
      }))
    );
  }

  res.json({ ok: true, id: contract?.id, contractNumber });
});

router.patch("/enterprise/contracts/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const updates = req.body as Record<string, unknown>;
  delete updates["id"]; delete updates["createdAt"]; delete updates["services"]; delete updates["invoices"];
  await db.update(enterpriseContractsTable)
    .set({ ...updates, updatedAt: new Date() } as typeof updates)
    .where(eq(enterpriseContractsTable.id, id));
  res.json({ ok: true });
});

router.post("/enterprise/contracts/:id/activate", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const { activatedBy, serviceIds } = req.body as { activatedBy: string; serviceIds?: number[] };

  await db.update(enterpriseContractsTable).set({
    status: "active",
    activatedAt: new Date(),
    activatedBy,
    updatedAt: new Date(),
  }).where(eq(enterpriseContractsTable.id, id));

  if (serviceIds?.length) {
    for (const sId of serviceIds) {
      await db.update(enterpriseContractServicesTable).set({
        isActive: true,
        activatedAt: new Date(),
      }).where(eq(enterpriseContractServicesTable.id, sId));
    }
  } else {
    await db.update(enterpriseContractServicesTable).set({
      isActive: true,
      activatedAt: new Date(),
    }).where(eq(enterpriseContractServicesTable.contractId, id));
  }

  res.json({ ok: true });
});

// ─── Invoices ────────────────────────────────────────────────────────────────

router.get("/enterprise/invoices", requireAdmin, async (req: Request, res: Response) => {
  const rows = await db.select().from(enterpriseInvoicesTable).orderBy(desc(enterpriseInvoicesTable.createdAt));
  res.json(rows);
});

function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const seq = Math.floor(Math.random() * 9000) + 1000;
  return `INV-${year}${month}-${seq}`;
}

router.post("/enterprise/invoices", requireAdmin, async (req: Request, res: Response) => {
  const body = req.body as {
    contractId: number;
    customerId?: number;
    periodStart?: string;
    periodEnd?: string;
    subtotalTl: string;
    vatRate?: number;
    vatAmountTl: string;
    totalTl: string;
    dueDate?: string;
  };

  const invoiceNumber = generateInvoiceNumber();
  const [invoice] = await db.insert(enterpriseInvoicesTable).values({
    ...body,
    invoiceNumber,
    status: "pending",
  }).returning();

  res.json({ ok: true, id: invoice?.id, invoiceNumber });
});

router.patch("/enterprise/invoices/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const updates = req.body as Record<string, unknown>;
  delete updates["id"]; delete updates["createdAt"];
  await db.update(enterpriseInvoicesTable).set(updates as typeof updates).where(eq(enterpriseInvoicesTable.id, id));
  res.json({ ok: true });
});

// ─── Prospect contact-only update ─────────────────────────────────────────────
router.patch("/enterprise/prospects/:id/contact", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const { contactName, contactTitle, contactEmail, contactPhone, linkedinUrl } = req.body as Record<string, string>;
  await db.update(enterpriseProspectsTable)
    .set({ contactName, contactTitle, contactEmail, contactPhone, linkedinUrl, lastActivityAt: new Date() })
    .where(eq(enterpriseProspectsTable.id, id));
  res.json({ ok: true });
});


export default router;
