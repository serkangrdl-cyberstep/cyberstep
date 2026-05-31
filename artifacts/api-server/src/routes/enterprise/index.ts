import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import {
  enterpriseProspectsTable,
  teaserReportsTable,
  enterpriseContractsTable,
  enterpriseContractServicesTable,
  enterpriseInvoicesTable,
} from "@workspace/db";
import { eq, desc, sql, and, count, isNull } from "drizzle-orm";
import { requireAdmin } from "../admin-panel/middleware";
import { generateTeaserReport, generatePreviewToken } from "../../services/teaserReportService";
import { logger } from "../../lib/logger";
import crypto from "crypto";

const router = Router();

// ─── Prospects ────────────────────────────────────────────────────────────────

router.get("/api/enterprise/prospects", requireAdmin, async (req: Request, res: Response) => {
  const rows = await db.select().from(enterpriseProspectsTable).orderBy(desc(enterpriseProspectsTable.lastActivityAt));
  res.json(rows);
});

router.get("/api/enterprise/prospects/stats", requireAdmin, async (req: Request, res: Response) => {
  const statuses = ["new", "scanned", "teaser_sent", "interested", "won", "lost"];
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

router.get("/api/enterprise/prospects/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const [row] = await db.select().from(enterpriseProspectsTable).where(eq(enterpriseProspectsTable.id, id));
  if (!row) return void res.status(404).json({ error: "Bulunamadı" });
  const teasers = await db.select().from(teaserReportsTable)
    .where(eq(teaserReportsTable.prospectId, id))
    .orderBy(desc(teaserReportsTable.createdAt));
  res.json({ ...row, teasers });
});

router.post("/api/enterprise/prospects", requireAdmin, async (req: Request, res: Response) => {
  const { companyName, domain, sector, employeeCount, city, contactName, contactTitle, contactEmail, contactPhone, linkedinUrl, source, assignedTo, notes } = req.body as Record<string, string>;
  if (!companyName || !domain) return void res.status(400).json({ error: "companyName ve domain zorunlu" });
  const [row] = await db.insert(enterpriseProspectsTable).values({
    companyName, domain, sector, employeeCount, city,
    contactName, contactTitle, contactEmail, contactPhone, linkedinUrl,
    source: source ?? "manual",
    assignedTo, notes, status: "new",
  }).returning();
  res.json({ ok: true, id: row?.id });
});

router.patch("/api/enterprise/prospects/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const updates = req.body as Record<string, unknown>;
  delete updates["id"]; delete updates["createdAt"];
  await db.update(enterpriseProspectsTable)
    .set({ ...updates, lastActivityAt: new Date() } as typeof updates)
    .where(eq(enterpriseProspectsTable.id, id));
  res.json({ ok: true });
});

router.delete("/api/enterprise/prospects/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  await db.delete(enterpriseProspectsTable).where(eq(enterpriseProspectsTable.id, id));
  res.json({ ok: true });
});

// ─── Teaser Report Generation ─────────────────────────────────────────────────

router.post("/api/enterprise/prospects/:id/scan", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const [prospect] = await db.select().from(enterpriseProspectsTable).where(eq(enterpriseProspectsTable.id, id));
  if (!prospect) return void res.status(404).json({ error: "Aday bulunamadı" });

  // Update status to scanning
  await db.update(enterpriseProspectsTable)
    .set({ status: "scanning", lastActivityAt: new Date() })
    .where(eq(enterpriseProspectsTable.id, id));

  res.json({ ok: true, message: "Tarama başlatıldı" });

  // Fire and forget
  setImmediate(async () => {
    try {
      const scanData: Record<string, unknown> = {
        domain: prospect.domain,
        company: prospect.companyName,
        sector: prospect.sector ?? "genel",
      };

      const result = await generateTeaserReport({
        domain: prospect.domain,
        companyName: prospect.companyName,
        sector: prospect.sector ?? "genel",
        scanData,
      });

      const token = generatePreviewToken();

      await db.insert(teaserReportsTable).values({
        prospectId: id,
        overallRiskScore: result.teaser.overall_score,
        riskLevel: result.teaser.risk_level,
        teaserHeadline: result.teaser.headline,
        teaserFindings: result.teaser.findings,
        teaserScenarioPreview: result.teaser.attack_scenario_preview,
        lockedSectionsHint: result.teaser.locked_sections_hint,
        urgencyNote: result.teaser.urgency_note,
        attackScenarios: result.full_scenarios,
        previewToken: token,
        status: "draft",
        criticalCount: result.teaser.findings.filter((f: { severity: string; locked: boolean }) => f.severity === "critical" && !f.locked).length,
        highCount: result.teaser.findings.filter((f: { severity: string; locked: boolean }) => f.severity === "high" && !f.locked).length,
      });

      await db.update(enterpriseProspectsTable)
        .set({ status: "scanned", lastActivityAt: new Date() })
        .where(eq(enterpriseProspectsTable.id, id));

      logger.info({ prospectId: id }, "Teaser report generated successfully");
    } catch (err) {
      logger.error({ err, prospectId: id }, "Teaser report generation failed");
      await db.update(enterpriseProspectsTable)
        .set({ status: "new", lastActivityAt: new Date() })
        .where(eq(enterpriseProspectsTable.id, id));
    }
  });
});

// ─── Teaser Reports ──────────────────────────────────────────────────────────

router.get("/api/enterprise/teaser/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const [row] = await db.select().from(teaserReportsTable).where(eq(teaserReportsTable.id, id));
  if (!row) return void res.status(404).json({ error: "Teaser bulunamadı" });
  res.json(row);
});

router.post("/api/enterprise/teaser/:id/approve", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const { approvedBy } = req.body as { approvedBy: string };
  await db.update(teaserReportsTable).set({
    status: "approved",
    approvedBy,
    approvedAt: new Date(),
  }).where(eq(teaserReportsTable.id, id));
  res.json({ ok: true });
});

router.post("/api/enterprise/teaser/:id/send", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const [report] = await db.select({
    report: teaserReportsTable,
    prospect: enterpriseProspectsTable,
  })
    .from(teaserReportsTable)
    .innerJoin(enterpriseProspectsTable, eq(teaserReportsTable.prospectId, enterpriseProspectsTable.id))
    .where(eq(teaserReportsTable.id, id));

  if (!report) return void res.status(404).json({ error: "Teaser bulunamadı" });

  const baseUrl = (() => {
    const domains = process.env["REPLIT_DOMAINS"];
    if (domains) { const f = domains.split(",")[0]?.trim(); if (f) return `https://${f}`; }
    return "http://localhost:80";
  })();

  const previewUrl = `${baseUrl}/preview/${report.report.previewToken}`;
  const contactEmail = report.prospect.contactEmail;

  if (!contactEmail) {
    return void res.status(400).json({ error: "Aday için e-posta adresi tanımlı değil" });
  }

  try {
    const { sendMail } = await import("../../services/email");
    const findings = (report.report.teaserFindings as { title: string; locked: boolean }[] ?? []);
    const unlockedFinding = findings.find(f => !f.locked);
    const lockedCount = findings.filter(f => f.locked).length;

    await sendMail({
      to: contactEmail,
      subject: `${report.prospect.domain} için güvenlik uyarısı — CyberStep.io`,
      html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;">
  <p>Sayın ${report.prospect.contactName ?? "İlgili Kişi"},</p>
  <p><strong>${report.prospect.companyName}</strong> (${report.prospect.domain}) üzerinde gerçekleştirdiğimiz dış güvenlik taramasında dikkat gerektiren bulgular tespit ettik.</p>
  <div style="background:#f8f8f8;border:1px solid #ddd;border-radius:8px;padding:20px;margin:20px 0;">
    <p style="margin:0 0 8px;"><strong>Güvenlik Skoru:</strong> ${report.report.overallRiskScore ?? "—"}/100</p>
    <p style="margin:0 0 8px;"><strong>Risk Seviyesi:</strong> ${report.report.riskLevel ?? "—"}</p>
    ${unlockedFinding ? `<p style="margin:0 0 8px;">● ${unlockedFinding.title}</p>` : ""}
    <p style="margin:0 0 4px;color:#888;">🔒 ${lockedCount} bulgu daha kilitli</p>
    ${report.report.teaserScenarioPreview ? `<p style="margin:12px 0 0;font-style:italic;color:#555;">${report.report.teaserScenarioPreview}...</p>` : ""}
  </div>
  <p>Tam raporu görüntülemek için: <a href="${previewUrl}" style="color:#0066cc;">${previewUrl}</a></p>
  <p>Saygılarımla,<br>CyberStep.io Güvenlik Ekibi<br>security@cyberstep.io</p>
  <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
  <p style="font-size:11px;color:#aaa;">Bu e-posta ${report.prospect.domain} domaininin kamuya açık güvenlik taramasına dayanmaktadır. Herhangi bir sisteminize yetkisiz erişim yapılmamıştır.</p>
</div>`,
    });

    await db.update(teaserReportsTable).set({
      status: "sent",
      emailSentAt: new Date(),
    }).where(eq(teaserReportsTable.id, id));

    await db.update(enterpriseProspectsTable)
      .set({ status: "teaser_sent", lastActivityAt: new Date() })
      .where(eq(enterpriseProspectsTable.id, report.report.prospectId!));

    res.json({ ok: true, previewUrl });
  } catch (err) {
    logger.error({ err }, "Teaser email send failed");
    res.status(500).json({ error: "E-posta gönderilemedi" });
  }
});

// ─── Public Preview (no auth) ─────────────────────────────────────────────────

router.get("/preview/:token", async (req: Request, res: Response) => {
  const { token } = req.params;
  const [row] = await db.select({
    report: teaserReportsTable,
    prospect: enterpriseProspectsTable,
  })
    .from(teaserReportsTable)
    .innerJoin(enterpriseProspectsTable, eq(teaserReportsTable.prospectId, enterpriseProspectsTable.id))
    .where(eq(teaserReportsTable.previewToken, String(token ?? "")));

  if (!row) return void res.status(404).json({ error: "Rapor bulunamadı" });

  // Track first view
  if (!row.report.previewViewedAt) {
    await db.update(teaserReportsTable).set({
      previewViewedAt: new Date(),
      status: "viewed",
    }).where(eq(teaserReportsTable.previewToken, String(token ?? "")));
  }

  const findings = (row.report.teaserFindings as Array<{ title: string; severity: string; locked: boolean; preview_text: string | null }> ?? []);

  res.json({
    domain: row.prospect.domain,
    companyName: row.prospect.companyName,
    overall_score: row.report.overallRiskScore,
    risk_level: row.report.riskLevel,
    teaser_headline: row.report.teaserHeadline,
    teaser_findings: findings,
    attack_scenario_preview: row.report.teaserScenarioPreview,
    locked_sections_hint: row.report.lockedSectionsHint,
    urgency_note: row.report.urgencyNote,
    cta_clicked: !!row.report.ctaClickedAt,
  });
});

router.post("/preview/:token/cta", async (req: Request, res: Response) => {
  const { token } = req.params;
  const { name, email, phone, message } = req.body as Record<string, string>;

  await db.update(teaserReportsTable).set({
    ctaClickedAt: new Date(),
    ctaContactName: name,
    ctaContactEmail: email,
    ctaContactPhone: phone,
    ctaMessage: message,
    status: "cta_clicked",
  }).where(eq(teaserReportsTable.previewToken, String(token ?? "")));

  res.json({ ok: true });
});

// ─── Contracts ────────────────────────────────────────────────────────────────

router.get("/api/enterprise/contracts", requireAdmin, async (req: Request, res: Response) => {
  const rows = await db.select().from(enterpriseContractsTable).orderBy(desc(enterpriseContractsTable.createdAt));
  res.json(rows);
});

router.get("/api/enterprise/contracts/:id", requireAdmin, async (req: Request, res: Response) => {
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

router.post("/api/enterprise/contracts", requireAdmin, async (req: Request, res: Response) => {
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

router.patch("/api/enterprise/contracts/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const updates = req.body as Record<string, unknown>;
  delete updates["id"]; delete updates["createdAt"]; delete updates["services"]; delete updates["invoices"];
  await db.update(enterpriseContractsTable)
    .set({ ...updates, updatedAt: new Date() } as typeof updates)
    .where(eq(enterpriseContractsTable.id, id));
  res.json({ ok: true });
});

router.post("/api/enterprise/contracts/:id/activate", requireAdmin, async (req: Request, res: Response) => {
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

router.get("/api/enterprise/invoices", requireAdmin, async (req: Request, res: Response) => {
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

router.post("/api/enterprise/invoices", requireAdmin, async (req: Request, res: Response) => {
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

router.patch("/api/enterprise/invoices/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const updates = req.body as Record<string, unknown>;
  delete updates["id"]; delete updates["createdAt"];
  await db.update(enterpriseInvoicesTable).set(updates as typeof updates).where(eq(enterpriseInvoicesTable.id, id));
  res.json({ ok: true });
});

// ─── Customer-facing: my prospect ─────────────────────────────────────────────

router.get("/api/enterprise/my-prospect", async (req: Request, res: Response) => {
  const session = (req as unknown as { session?: { customerId?: number; customer?: { email?: string } } }).session;
  if (!session?.customerId) return void res.status(401).json({ error: "Yetkisiz" });

  // Look up prospect by customer's email domain
  const customer = session.customer as { email?: string } | undefined;
  if (!customer?.email) return void res.status(404).json({ error: "Bulunamadı" });

  const emailDomain = customer.email.split("@")[1] ?? "";
  if (!emailDomain) return void res.status(404).json({ error: "Bulunamadı" });

  const [prospect] = await db
    .select({
      id: enterpriseProspectsTable.id,
      domain: enterpriseProspectsTable.domain,
      companyName: enterpriseProspectsTable.companyName,
      status: enterpriseProspectsTable.status,
      lastActivityAt: enterpriseProspectsTable.lastActivityAt,
      createdAt: enterpriseProspectsTable.createdAt,
    })
    .from(enterpriseProspectsTable)
    .where(eq(enterpriseProspectsTable.domain, emailDomain))
    .limit(1);

  if (!prospect) return void res.status(404).json({ error: "Bulunamadı" });

  // Fetch the latest teaser report for this prospect
  const [report] = await db
    .select({
      overallRiskScore: teaserReportsTable.overallRiskScore,
      riskLevel: teaserReportsTable.riskLevel,
      teaserHeadline: teaserReportsTable.teaserHeadline,
      previewToken: teaserReportsTable.previewToken,
      criticalCount: teaserReportsTable.criticalCount,
      highCount: teaserReportsTable.highCount,
    })
    .from(teaserReportsTable)
    .where(eq(teaserReportsTable.prospectId, prospect.id))
    .orderBy(desc(teaserReportsTable.createdAt))
    .limit(1);

  res.json({ ...prospect, ...(report ?? {}) });
});

router.post("/api/enterprise/my-prospect/contact", async (req: Request, res: Response) => {
  const session = (req as unknown as { session?: { customerId?: number; customer?: { email?: string } } }).session;
  if (!session?.customerId) return void res.status(401).json({ error: "Yetkisiz" });

  const { name, phone, message } = req.body as Record<string, string>;
  const customer = session.customer as { email?: string } | undefined;
  const emailDomain = customer?.email?.split("@")[1] ?? "";

  const [prospect] = await db
    .select({ id: enterpriseProspectsTable.id })
    .from(enterpriseProspectsTable)
    .where(eq(enterpriseProspectsTable.domain, emailDomain))
    .limit(1);

  if (prospect) {
    // Update teaser report CTA with contact info
    await db.update(teaserReportsTable)
      .set({
        ctaClickedAt: new Date(),
        ctaContactName: name,
        ctaContactPhone: phone,
        ctaMessage: message,
        ctaContactEmail: customer?.email ?? "",
        status: "cta_clicked",
      })
      .where(eq(teaserReportsTable.prospectId, prospect.id));

    await db.update(enterpriseProspectsTable)
      .set({ status: "interested", lastActivityAt: new Date() })
      .where(eq(enterpriseProspectsTable.id, prospect.id));
  }

  logger.info({ emailDomain, name, phone }, "Customer enterprise contact request");
  res.json({ ok: true });
});

export default router;
