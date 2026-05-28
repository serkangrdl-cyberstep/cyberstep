import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import {
  emailTemplatesTable,
  emailSendsTable,
  tenantsTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import nodemailer from "nodemailer";
import { requireAdmin } from "./middleware";
import { renderTemplate, extractVariables, STANDARD_VARIABLES } from "../../services/email-template-renderer";
import { logger } from "../../lib/logger";

const router = Router();

function requireTenantId(req: Request, res: Response): number | null {
  const tid = (req.session as unknown as Record<string, unknown>)["tenantId"] as number | undefined;
  if (!tid) { res.status(403).json({ error: "Workspace seçilmedi", code: "NO_TENANT" }); return null; }
  return tid;
}

function getBaseUrl(): string {
  const domains = process.env["REPLIT_DOMAINS"];
  if (domains) {
    const first = domains.split(",")[0]?.trim();
    if (first) return `https://${first}`;
  }
  return "http://localhost:80";
}

// ─── List templates ───────────────────────────────────────────────────────────
router.get("/admin-panel/email-templates", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const { category } = req.query as Record<string, string>;

  const where = category
    ? and(eq(emailTemplatesTable.tenantId, tenantId), eq(emailTemplatesTable.category, category))
    : eq(emailTemplatesTable.tenantId, tenantId);

  const templates = await db.select().from(emailTemplatesTable)
    .where(where)
    .orderBy(desc(emailTemplatesTable.createdAt));

  // Auto-seed defaults for tenants that existed before this feature shipped
  if (templates.length === 0 && !category) {
    const { seedDefaultTemplates } = await import("../../services/email-templates-seed");
    await seedDefaultTemplates(tenantId);
    const seeded = await db.select().from(emailTemplatesTable)
      .where(eq(emailTemplatesTable.tenantId, tenantId))
      .orderBy(desc(emailTemplatesTable.createdAt));
    res.json(seeded);
    return;
  }

  res.json(templates);
});

// ─── Get single template ──────────────────────────────────────────────────────
router.get("/admin-panel/email-templates/:id", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const id = parseInt(String(req.params["id"]));
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const [tpl] = await db.select().from(emailTemplatesTable)
    .where(and(eq(emailTemplatesTable.id, id), eq(emailTemplatesTable.tenantId, tenantId)));

  if (!tpl) { res.status(404).json({ error: "Şablon bulunamadı" }); return; }
  res.json(tpl);
});

// ─── Create template ──────────────────────────────────────────────────────────
router.post("/admin-panel/email-templates", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const { name, description, category, subject, bodyHtml, bodyText } = req.body as Record<string, string>;

  if (!name || !subject || !bodyHtml) {
    res.status(400).json({ error: "name, subject ve bodyHtml zorunludur" }); return;
  }

  const variables = extractVariables(subject + " " + bodyHtml);

  const [tpl] = await db.insert(emailTemplatesTable).values({
    tenantId,
    name: name.trim(),
    description: description?.trim() ?? null,
    category: category ?? "custom",
    subject: subject.trim(),
    bodyHtml,
    bodyText: bodyText ?? null,
    variables,
  }).returning();

  res.status(201).json(tpl);
});

// ─── Update template ──────────────────────────────────────────────────────────
router.put("/admin-panel/email-templates/:id", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const id = parseInt(String(req.params["id"]));
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const { name, description, category, subject, bodyHtml, bodyText, isActive } = req.body as Record<string, unknown>;

  const variables = typeof subject === "string" && typeof bodyHtml === "string"
    ? extractVariables(subject + " " + bodyHtml)
    : undefined;

  const [updated] = await db.update(emailTemplatesTable)
    .set({
      ...(typeof name === "string" && { name }),
      ...(typeof description === "string" && { description }),
      ...(typeof category === "string" && { category }),
      ...(typeof subject === "string" && { subject }),
      ...(typeof bodyHtml === "string" && { bodyHtml }),
      ...(typeof bodyText === "string" && { bodyText }),
      ...(typeof isActive === "boolean" && { isActive }),
      ...(variables && { variables }),
      updatedAt: new Date(),
    })
    .where(and(eq(emailTemplatesTable.id, id), eq(emailTemplatesTable.tenantId, tenantId)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Şablon bulunamadı" }); return; }
  res.json(updated);
});

// ─── Delete template ──────────────────────────────────────────────────────────
router.delete("/admin-panel/email-templates/:id", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const id = parseInt(String(req.params["id"]));
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const [deleted] = await db.delete(emailTemplatesTable)
    .where(and(
      eq(emailTemplatesTable.id, id),
      eq(emailTemplatesTable.tenantId, tenantId),
      eq(emailTemplatesTable.isDefault, false),
    ))
    .returning({ id: emailTemplatesTable.id });

  if (!deleted) { res.status(404).json({ error: "Şablon bulunamadı veya varsayılan şablon silinemez" }); return; }
  res.json({ ok: true });
});

// ─── Preview rendered template ────────────────────────────────────────────────
router.post("/admin-panel/email-templates/:id/preview", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const id = parseInt(String(req.params["id"]));
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const [tpl] = await db.select().from(emailTemplatesTable)
    .where(and(eq(emailTemplatesTable.id, id), eq(emailTemplatesTable.tenantId, tenantId)));
  if (!tpl) { res.status(404).json({ error: "Şablon bulunamadı" }); return; }

  const vars = (req.body as Record<string, string>) ?? {};
  const defaultVars: Record<string, string> = {
    companyName: "Örnek Şirket A.Ş.",
    contactName: "Ahmet Yılmaz",
    tenantName: "CyberStep Demo",
    senderName: "Satış Ekibi",
    senderEmail: process.env["SMTP_USER"] ?? "ornek@firma.com",
    baseUrl: getBaseUrl(),
    date: new Date().toLocaleDateString("tr-TR"),
    dealId: "42",
    assessmentId: "17",
    riskLevel: "Orta",
    scorePercent: "62",
    ...vars,
  };

  res.json({
    subject: renderTemplate(tpl.subject, defaultVars),
    bodyHtml: renderTemplate(tpl.bodyHtml, defaultVars),
    variables: tpl.variables,
    availableVariables: STANDARD_VARIABLES,
  });
});

// ─── Send email (ad-hoc or from template) ────────────────────────────────────
router.post("/admin-panel/emails/send", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;

  const { templateId, toEmail, toName, vars, relatedType, relatedId, subject: adHocSubject, bodyHtml: adHocBody } =
    req.body as {
      templateId?: number;
      toEmail: string;
      toName?: string;
      vars?: Record<string, string>;
      relatedType?: string;
      relatedId?: number;
      subject?: string;
      bodyHtml?: string;
    };

  if (!toEmail) { res.status(400).json({ error: "toEmail zorunludur" }); return; }

  // Resolve subject + body
  let subject = adHocSubject ?? "";
  let bodyHtml = adHocBody ?? "";

  if (templateId) {
    const [tpl] = await db.select().from(emailTemplatesTable)
      .where(and(eq(emailTemplatesTable.id, templateId), eq(emailTemplatesTable.tenantId, tenantId)));
    if (!tpl) { res.status(404).json({ error: "Şablon bulunamadı" }); return; }

    const [tenant] = await db.select({ name: tenantsTable.name, smtpUser: tenantsTable.smtpUser })
      .from(tenantsTable).where(eq(tenantsTable.id, tenantId));

    const mergedVars: Record<string, string> = {
      tenantName: tenant?.name ?? "CyberStep.io",
      senderEmail: tenant?.smtpUser ?? process.env["SMTP_USER"] ?? "",
      baseUrl: getBaseUrl(),
      date: new Date().toLocaleDateString("tr-TR"),
      ...vars,
    };

    subject = renderTemplate(tpl.subject, mergedVars);
    bodyHtml = renderTemplate(tpl.bodyHtml, mergedVars);
  }

  if (!subject || !bodyHtml) {
    res.status(400).json({ error: "subject ve bodyHtml zorunludur" }); return;
  }

  // Send via SMTP
  const smtpUser = process.env["SMTP_USER"];
  const smtpPass = process.env["SMTP_PASS"];

  let status: "sent" | "failed" = "sent";
  let error: string | undefined;

  if (smtpUser && smtpPass) {
    try {
      const transport = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transport.sendMail({
        from: `"CyberStep.io" <${smtpUser}>`,
        to: toName ? `"${toName}" <${toEmail}>` : toEmail,
        subject,
        html: bodyHtml,
      });
    } catch (err) {
      status = "failed";
      error = String(err);
      logger.error({ err, toEmail, tenantId }, "Manual email send failed");
    }
  } else {
    logger.warn({ toEmail, tenantId }, "SMTP not configured — email not sent");
    status = "failed";
    error = "SMTP yapılandırılmamış";
  }

  // Log the send
  const [record] = await db.insert(emailSendsTable).values({
    tenantId,
    templateId: templateId ?? null,
    toEmail,
    toName: toName ?? null,
    subject,
    bodyHtml,
    status,
    relatedType: relatedType ?? null,
    relatedId: relatedId ?? null,
    error: error ?? null,
    sentAt: new Date(),
  }).returning();

  if (status === "failed") {
    res.status(500).json({ error: error ?? "Gönderilemedi", record });
    return;
  }

  res.json({ ok: true, record });
});

// ─── Email send history ───────────────────────────────────────────────────────
router.get("/admin-panel/emails/history", requireAdmin, async (req: Request, res: Response) => {
  const tenantId = requireTenantId(req, res); if (!tenantId) return;
  const limit = Math.min(parseInt(String(req.query["limit"] ?? "50")), 200);
  const offset = parseInt(String(req.query["offset"] ?? "0"));

  const rows = await db.select().from(emailSendsTable)
    .where(eq(emailSendsTable.tenantId, tenantId))
    .orderBy(desc(emailSendsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(rows);
});

// ─── Available variables metadata ─────────────────────────────────────────────
router.get("/admin-panel/email-templates/meta/variables", requireAdmin, async (_req: Request, res: Response) => {
  res.json(STANDARD_VARIABLES);
});

export default router;
