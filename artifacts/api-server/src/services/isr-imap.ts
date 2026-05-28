import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { logger } from "../lib/logger";
import { db } from "@workspace/db";
import {
  isrEmailInboxTable, isrDealsTable, isrVendorsTable, isrDistributorsTable,
  isrRfqsTable, isrRfqResponsesTable, isrQuoteLinesTable, isrMarginRulesTable, isrQuotesTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { classifyEmail, parseRfqResponseEmail, generateRfqEmailBody } from "./isr-ai";
import nodemailer from "nodemailer";

interface TenantMailConfig {
  imapHost?: string | null;
  imapUser?: string | null;
  imapPass?: string | null;
  smtpHost?: string | null;
  smtpUser?: string | null;
  smtpPass?: string | null;
  smtpPort?: number | null;
}

function getImapConfig(tenant?: TenantMailConfig) {
  const host = tenant?.imapHost ?? process.env["ISR_IMAP_HOST"] ?? "imap.gmail.com";
  const user = tenant?.imapUser ?? process.env["ISR_IMAP_USER"] ?? process.env["SMTP_USER"];
  const pass = tenant?.imapPass ?? process.env["ISR_IMAP_PASS"] ?? process.env["SMTP_PASS"];
  if (!user || !pass) return null;
  return { host, port: 993, secure: true, auth: { user, pass } };
}

function getSmtpTransport(tenant?: TenantMailConfig) {
  const user = tenant?.smtpUser ?? process.env["SMTP_USER"];
  const pass = tenant?.smtpPass ?? process.env["SMTP_PASS"];
  const host = tenant?.smtpHost ?? "smtp.gmail.com";
  const port = tenant?.smtpPort ?? 587;
  if (!user || !pass) return null;
  return nodemailer.createTransport({ host, port, secure: false, auth: { user, pass } });
}

function getSenderEmail(tenant?: TenantMailConfig) {
  return tenant?.smtpUser ?? process.env["SMTP_USER"] ?? "sales@cyberstep.io";
}

async function runImapForTenant(tenantId: number, tenantConfig: TenantMailConfig): Promise<void> {
  const imapConfig = getImapConfig(tenantConfig);
  if (!imapConfig) return;

  const client = new ImapFlow({ ...imapConfig, logger: false });

  try {
    await client.connect();
    await client.mailboxOpen("INBOX");

    const messages = [];
    for await (const msg of client.fetch("1:*", { envelope: true, source: true }, { uid: true })) {
      messages.push(msg);
    }

    for (const msg of messages) {
      if (!msg.source) continue;
      let parsed;
      try { parsed = await simpleParser(msg.source); } catch { continue; }

      const messageId = parsed.messageId ?? `uid-${msg.uid}`;
      const fromEmail = (parsed.from?.value?.[0]?.address ?? "").toLowerCase();
      const fromName = parsed.from?.value?.[0]?.name ?? "";
      const subject = parsed.subject ?? "";
      const bodyText = parsed.text ?? (parsed.html ? parsed.html.replace(/<[^>]+>/g, " ") : "") ?? "";
      const receivedAt = parsed.date ?? new Date();

      const existing = await db.select({ id: isrEmailInboxTable.id })
        .from(isrEmailInboxTable).where(eq(isrEmailInboxTable.messageId, messageId)).limit(1);
      if (existing.length > 0) continue;

      const ourEmail = getSenderEmail(tenantConfig).toLowerCase();
      if (fromEmail === ourEmail) {
        await db.insert(isrEmailInboxTable).values({
          tenantId, messageId, fromEmail, fromName, subject,
          bodyText: bodyText.slice(0, 5000), processedAs: "ignored", receivedAt,
        });
        continue;
      }

      const vendors = await db.select({ name: isrVendorsTable.name })
        .from(isrVendorsTable).where(and(eq(isrVendorsTable.isActive, true), eq(isrVendorsTable.tenantId, tenantId)));
      const vendorNames = vendors.map((v) => v.name);

      const classification = await classifyEmail({ fromEmail, fromName, subject, bodyText: bodyText.slice(0, 3000), vendorNames });
      logger.info({ tenantId, messageId, fromEmail, subject, type: classification.type }, "ISR email classified");

      if (classification.type === "new_deal") {
        await handleNewDeal({ tenantId, messageId, fromEmail, fromName, subject, bodyText, receivedAt, classification });
      } else if (classification.type === "rfq_response") {
        await handleRfqResponse({ tenantId, messageId, fromEmail, fromName, subject, bodyText, receivedAt, classification });
      } else {
        await db.insert(isrEmailInboxTable).values({
          tenantId, messageId, fromEmail, fromName, subject,
          bodyText: bodyText.slice(0, 5000), processedAs: "ignored", receivedAt,
        });
      }
    }

    await client.logout();
  } catch (err) {
    logger.error({ err, tenantId }, "ISR IMAP processing error");
    try { await client.logout(); } catch { /* ignore */ }
  }
}

export async function processInboxForTenant(tenantId: number): Promise<void> {
  const { tenantsTable } = await import("@workspace/db");
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  if (!tenant || !tenant.isrEnabled) return;
  await runImapForTenant(tenantId, tenant);
}

// Legacy: process for all ISR-enabled tenants (used by cron)
export async function processInbox(): Promise<void> {
  const { tenantsTable } = await import("@workspace/db");
  const tenants = await db.select().from(tenantsTable)
    .where(and(eq(tenantsTable.isActive, true), eq(tenantsTable.isrEnabled, true)));

  if (tenants.length === 0) {
    // Fallback to env-based config for backward compatibility (no tenants yet)
    const fallbackConfig = getImapConfig();
    if (!fallbackConfig) {
      logger.warn("ISR IMAP credentials not configured — skipping inbox check");
      return;
    }
    await runImapForTenant(1, {});
    return;
  }

  for (const tenant of tenants) {
    await runImapForTenant(tenant.id, tenant);
  }
}

async function handleNewDeal(params: {
  tenantId: number;
  messageId: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  bodyText: string;
  receivedAt: Date;
  classification: Awaited<ReturnType<typeof classifyEmail>>;
}) {
  const { classification, tenantId } = params;

  let vendorId: number | null = null;
  if (classification.vendorName) {
    const [vendor] = await db.select({ id: isrVendorsTable.id })
      .from(isrVendorsTable)
      .where(and(
        eq(isrVendorsTable.tenantId, tenantId),
        sql`lower(${isrVendorsTable.name}) like ${`%${classification.vendorName.toLowerCase()}%`}`,
      ))
      .limit(1);
    if (vendor) vendorId = vendor.id;
  }

  const adminEmail = process.env["SMTP_USER"] ?? undefined;

  const [deal] = await db.insert(isrDealsTable).values({
    tenantId,
    customerEmail: params.fromEmail,
    customerName: classification.customerName ?? params.fromName,
    customerCompany: classification.customerCompany,
    vendorId,
    vendorName: classification.vendorName,
    productKeywords: classification.productKeywords,
    originalSubject: params.subject,
    originalBody: params.bodyText.slice(0, 5000),
    aiSummary: classification.summary,
    status: "new",
    priority: classification.priority ?? "normal",
    assignedRepEmail: adminEmail,
    emailMessageId: params.messageId,
  }).returning({ id: isrDealsTable.id });

  if (!deal) return;

  await db.insert(isrEmailInboxTable).values({
    tenantId,
    messageId: params.messageId,
    fromEmail: params.fromEmail,
    fromName: params.fromName,
    subject: params.subject,
    bodyText: params.bodyText.slice(0, 5000),
    processedAs: "new_deal",
    dealId: deal.id,
    receivedAt: params.receivedAt,
  });

  logger.info({ tenantId, dealId: deal.id, fromEmail: params.fromEmail }, "New ISR deal created from email");

  if (vendorId) {
    await sendRfqsForDeal(deal.id, vendorId, classification.productKeywords ?? params.subject, params.bodyText, undefined, tenantId);
  }
}

async function handleRfqResponse(params: {
  tenantId: number;
  messageId: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  bodyText: string;
  receivedAt: Date;
  classification: Awaited<ReturnType<typeof classifyEmail>>;
}) {
  const { classification, tenantId } = params;

  const refMatch = params.subject.match(/\[ISR-REF:DEAL-(\d+)\]/i);
  const dealRefId = refMatch ? parseInt(refMatch[1]) : classification.dealRefId;

  if (!dealRefId) {
    await db.insert(isrEmailInboxTable).values({
      tenantId, messageId: params.messageId, fromEmail: params.fromEmail, fromName: params.fromName,
      subject: params.subject, bodyText: params.bodyText.slice(0, 5000),
      processedAs: "ignored", receivedAt: params.receivedAt,
    });
    return;
  }

  const [rfq] = await db.select({ id: isrRfqsTable.id })
    .from(isrRfqsTable)
    .where(and(
      eq(isrRfqsTable.dealId, dealRefId),
      sql`lower(${isrRfqsTable.sentToEmail}) = ${params.fromEmail.toLowerCase()}`,
    ))
    .limit(1);

  const rfqId = rfq?.id;
  const parsed = await parseRfqResponseEmail({ subject: params.subject, bodyText: params.bodyText });

  const [response] = await db.insert(isrRfqResponsesTable).values({
    rfqId: rfqId ?? 0,
    dealId: dealRefId,
    fromEmail: params.fromEmail,
    subject: params.subject,
    body: params.bodyText.slice(0, 5000),
    aiParsed: parsed as unknown as Record<string, unknown>,
    currency: parsed.currency,
    validUntil: parsed.validUntil,
    notes: parsed.notes,
    receivedAt: params.receivedAt,
  }).returning({ id: isrRfqResponsesTable.id });

  if (rfqId) {
    await db.update(isrRfqsTable)
      .set({ status: "responded", respondedAt: new Date() })
      .where(eq(isrRfqsTable.id, rfqId));
  }

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
      await db.insert(isrQuoteLinesTable).values({
        rfqResponseId: response.id,
        sku: line.sku ?? null,
        description: line.description,
        quantity: line.quantity,
        unitCost: String(unitCost),
        unitPrice: String(Math.round(unitPrice * 100) / 100),
        lineTotal: String(Math.round(unitPrice * line.quantity * 100) / 100),
        currency: parsed.currency,
        sortOrder: i,
      });
    }

    await db.update(isrDealsTable)
      .set({ status: "quoted", updatedAt: new Date() })
      .where(and(eq(isrDealsTable.id, dealRefId), eq(isrDealsTable.tenantId, tenantId)));
  }

  await db.insert(isrEmailInboxTable).values({
    tenantId, messageId: params.messageId, fromEmail: params.fromEmail, fromName: params.fromName,
    subject: params.subject, bodyText: params.bodyText.slice(0, 5000),
    processedAs: "rfq_response", dealId: dealRefId, rfqId: rfqId ?? null,
    receivedAt: params.receivedAt,
  });

  logger.info({ dealId: dealRefId, rfqId }, "ISR RFQ response processed");
}

export async function sendRfqsForDeal(
  dealId: number,
  vendorId: number,
  productKeywords: string,
  originalRequest: string,
  distributorIds?: number[],
  tenantId?: number,
): Promise<void> {
  // Load tenant config for SMTP if tenantId provided
  let tenantConfig: TenantMailConfig = {};
  if (tenantId) {
    const { tenantsTable } = await import("@workspace/db");
    const [t] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
    if (t) tenantConfig = t;
  }

  const transport = getSmtpTransport(tenantConfig);
  if (!transport) {
    logger.warn("SMTP not configured — skipping RFQ sending");
    return;
  }

  const [vendor] = await db.select().from(isrVendorsTable).where(eq(isrVendorsTable.id, vendorId));
  if (!vendor) return;

  const allDistributors = await db.select()
    .from(isrDistributorsTable)
    .where(and(eq(isrDistributorsTable.vendorId, vendorId), eq(isrDistributorsTable.isActive, true)));

  const distributors = distributorIds && distributorIds.length > 0
    ? allDistributors.filter((d) => distributorIds.includes(d.id))
    : allDistributors;

  const [deal] = await db.select({ customerCompany: isrDealsTable.customerCompany })
    .from(isrDealsTable).where(eq(isrDealsTable.id, dealId));

  const targets: Array<{ email: string; name: string; distributorId?: number }> = distributors.map((d) => ({
    email: d.contactEmail, name: d.name, distributorId: d.id,
  }));

  if (vendor.salesRepEmail && !distributorIds) {
    targets.push({ email: vendor.salesRepEmail, name: vendor.salesRepName ?? vendor.displayName });
  }

  const senderEmail = getSenderEmail(tenantConfig);

  for (const target of targets) {
    const body = await generateRfqEmailBody({
      dealId, vendorName: vendor.displayName,
      customerCompany: deal?.customerCompany ?? "Müşterimiz",
      productKeywords, originalRequest, distributorName: target.name,
    });
    const subject = `[ISR-REF:DEAL-${dealId}] Teklif Talebi — ${vendor.displayName} — ${productKeywords.slice(0, 40)}`;

    try {
      const info = await transport.sendMail({
        from: `"CyberStep.io Satış" <${senderEmail}>`,
        to: target.email,
        subject,
        text: body,
      });

      await db.insert(isrRfqsTable).values({
        dealId,
        distributorId: target.distributorId ?? null,
        sentToEmail: target.email,
        sentToName: target.name,
        subject,
        body,
        status: "sent",
        emailMessageId: info.messageId,
      });

      logger.info({ dealId, to: target.email }, "RFQ sent");
    } catch (err) {
      logger.error({ err, dealId, to: target.email }, "Failed to send RFQ");
    }
  }

  await db.update(isrDealsTable)
    .set({ status: "rfq_sent", updatedAt: new Date() })
    .where(eq(isrDealsTable.id, dealId));
}

export async function sendApprovedQuote(quoteId: number): Promise<void> {
  const transport = getSmtpTransport();
  if (!transport) return;

  const [quote] = await db.select().from(isrQuotesTable).where(eq(isrQuotesTable.id, quoteId));
  if (!quote) return;

  const [deal] = await db.select().from(isrDealsTable).where(eq(isrDealsTable.id, quote.dealId));
  if (!deal) return;

  const lines = await db.select().from(isrQuoteLinesTable).where(eq(isrQuoteLinesTable.quoteId, quoteId));

  const linesHtml = lines.map((l) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #f0f0f0;font-size:13px">${l.sku ?? ""}</td>
      <td style="padding:8px;border-bottom:1px solid #f0f0f0;font-size:13px">${l.description}</td>
      <td style="padding:8px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:center">${l.quantity}</td>
      <td style="padding:8px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:right">${Number(l.unitPrice).toLocaleString("tr-TR")} ${l.currency}</td>
      <td style="padding:8px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:right;font-weight:600">${Number(l.lineTotal).toLocaleString("tr-TR")} ${l.currency}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="tr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
<div style="max-width:680px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
  <div style="background:#0f172a;padding:24px 32px">
    <span style="font-size:22px;font-weight:700;color:#fff">CyberStep.io</span>
    <span style="background:#10b981;color:#fff;font-size:12px;padding:4px 10px;border-radius:20px;margin-left:12px">Fiyat Teklifi</span>
  </div>
  <div style="padding:32px">
    <h2 style="margin:0 0 4px;font-size:20px;color:#0f172a">Sayın ${deal.customerName ?? deal.customerEmail},</h2>
    <p style="margin:0 0 6px;color:#64748b;font-size:14px">Teklif No: <strong>${quote.quoteNumber}</strong></p>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px">${deal.customerCompany ? `${deal.customerCompany} firması için` : ""} talebinize istinaden hazırlanan fiyat teklifimizi aşağıda bulabilirsiniz.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <thead>
        <tr style="background:#f8fafc">
          <th style="padding:10px 8px;text-align:left;font-size:12px;color:#64748b;border-bottom:2px solid #e2e8f0">SKU</th>
          <th style="padding:10px 8px;text-align:left;font-size:12px;color:#64748b;border-bottom:2px solid #e2e8f0">Ürün</th>
          <th style="padding:10px 8px;text-align:center;font-size:12px;color:#64748b;border-bottom:2px solid #e2e8f0">Adet</th>
          <th style="padding:10px 8px;text-align:right;font-size:12px;color:#64748b;border-bottom:2px solid #e2e8f0">Birim Fiyat</th>
          <th style="padding:10px 8px;text-align:right;font-size:12px;color:#64748b;border-bottom:2px solid #e2e8f0">Toplam</th>
        </tr>
      </thead>
      <tbody>${linesHtml}</tbody>
    </table>
    <div style="text-align:right;margin-bottom:24px">
      <div style="font-size:13px;color:#64748b;margin-bottom:4px">Ara Toplam: ${Number(quote.subtotal).toLocaleString("tr-TR")} ${quote.currency}</div>
      <div style="font-size:13px;color:#64748b;margin-bottom:4px">KDV (%${Number(quote.kdvRate)}): ${Number(quote.kdvAmount).toLocaleString("tr-TR")} ${quote.currency}</div>
      <div style="font-size:18px;font-weight:700;color:#0f172a">TOPLAM: ${Number(quote.total).toLocaleString("tr-TR")} ${quote.currency}</div>
    </div>
    ${quote.notes ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:24px;font-size:13px;color:#334155">${quote.notes}</div>` : ""}
    <p style="margin:0;font-size:13px;color:#94a3b8">Bu teklif ${quote.validDays} gün geçerlidir. Sorularınız için lütfen bizimle iletişime geçin.</p>
  </div>
  <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0">
    <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center">CyberStep.io · Teklif #${quote.quoteNumber}</p>
  </div>
</div></body></html>`;

  await transport.sendMail({
    from: `"CyberStep.io Satış" <${getSenderEmail()}>`,
    to: deal.customerEmail,
    subject: `Fiyat Teklifiniz Hazır — ${quote.quoteNumber} — ${deal.vendorName ?? ""}`,
    html,
  });

  await db.update(isrQuotesTable)
    .set({ status: "sent", sentAt: new Date() })
    .where(eq(isrQuotesTable.id, quoteId));
  await db.update(isrDealsTable)
    .set({ status: "sent", updatedAt: new Date() })
    .where(eq(isrDealsTable.id, quote.dealId));

  logger.info({ quoteId, dealId: quote.dealId }, "Approved quote sent to customer");
}
