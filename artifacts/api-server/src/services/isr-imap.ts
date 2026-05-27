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

function getImapConfig() {
  const host = process.env["ISR_IMAP_HOST"] ?? "imap.gmail.com";
  const user = process.env["ISR_IMAP_USER"] ?? process.env["SMTP_USER"];
  const pass = process.env["ISR_IMAP_PASS"] ?? process.env["SMTP_PASS"];
  if (!user || !pass) return null;
  return { host, port: 993, secure: true, auth: { user, pass } };
}

function getSmtpTransport() {
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: "smtp.gmail.com", port: 587, secure: false, auth: { user, pass },
  });
}

function getSenderEmail() {
  return process.env["SMTP_USER"] ?? "sales@cyberstep.io";
}

export async function processInbox(): Promise<void> {
  const imapConfig = getImapConfig();
  if (!imapConfig) {
    logger.warn("ISR IMAP credentials not configured — skipping inbox check");
    return;
  }

  const client = new ImapFlow({ ...imapConfig, logger: false });

  try {
    await client.connect();
    await client.mailboxOpen("INBOX");

    // Fetch unseen messages
    const messages = [];
    for await (const msg of client.fetch("1:*", { envelope: true, source: true }, { uid: true })) {
      messages.push(msg);
    }

    // Filter unseen (we track by message-id in DB)
    for (const msg of messages) {
      if (!msg.source) continue;

      let parsed;
      try {
        parsed = await simpleParser(msg.source);
      } catch {
        continue;
      }

      const messageId = parsed.messageId ?? `uid-${msg.uid}`;
      const fromEmail = (parsed.from?.value?.[0]?.address ?? "").toLowerCase();
      const fromName = parsed.from?.value?.[0]?.name ?? "";
      const subject = parsed.subject ?? "";
      const bodyText = parsed.text ?? (parsed.html ? parsed.html.replace(/<[^>]+>/g, " ") : "") ?? "";
      const receivedAt = parsed.date ?? new Date();

      // Skip if already processed
      const existing = await db.select({ id: isrEmailInboxTable.id })
        .from(isrEmailInboxTable)
        .where(eq(isrEmailInboxTable.messageId, messageId))
        .limit(1);
      if (existing.length > 0) continue;

      // Skip our own outgoing emails
      const ourEmail = getSenderEmail().toLowerCase();
      if (fromEmail === ourEmail) {
        await db.insert(isrEmailInboxTable).values({
          messageId, fromEmail, fromName, subject,
          bodyText: bodyText.slice(0, 5000),
          processedAs: "ignored",
          receivedAt,
        });
        continue;
      }

      // Get active vendors for classification context
      const vendors = await db.select({ name: isrVendorsTable.name })
        .from(isrVendorsTable)
        .where(eq(isrVendorsTable.isActive, true));
      const vendorNames = vendors.map((v) => v.name);

      // Classify the email
      const classification = await classifyEmail({
        fromEmail, fromName, subject,
        bodyText: bodyText.slice(0, 3000),
        vendorNames,
      });

      logger.info({ messageId, fromEmail, subject, type: classification.type }, "ISR email classified");

      if (classification.type === "new_deal") {
        await handleNewDeal({ messageId, fromEmail, fromName, subject, bodyText, receivedAt, classification });
      } else if (classification.type === "rfq_response") {
        await handleRfqResponse({ messageId, fromEmail, fromName, subject, bodyText, receivedAt, classification });
      } else {
        await db.insert(isrEmailInboxTable).values({
          messageId, fromEmail, fromName, subject,
          bodyText: bodyText.slice(0, 5000),
          processedAs: "ignored",
          receivedAt,
        });
      }
    }

    await client.logout();
  } catch (err) {
    logger.error({ err }, "ISR IMAP processing error");
    try { await client.logout(); } catch { /* ignore */ }
  }
}

async function handleNewDeal(params: {
  messageId: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  bodyText: string;
  receivedAt: Date;
  classification: Awaited<ReturnType<typeof classifyEmail>>;
}) {
  const { classification } = params;

  // Find matching vendor
  let vendorId: number | null = null;
  if (classification.vendorName) {
    const [vendor] = await db.select({ id: isrVendorsTable.id })
      .from(isrVendorsTable)
      .where(sql`lower(${isrVendorsTable.name}) like ${`%${classification.vendorName.toLowerCase()}%`}`)
      .limit(1);
    if (vendor) vendorId = vendor.id;
  }

  // Get assigned rep (first admin email for now)
  const adminEmail = process.env["SMTP_USER"] ?? undefined;

  // Create deal
  const [deal] = await db.insert(isrDealsTable).values({
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

  // Log inbox
  await db.insert(isrEmailInboxTable).values({
    messageId: params.messageId,
    fromEmail: params.fromEmail,
    fromName: params.fromName,
    subject: params.subject,
    bodyText: params.bodyText.slice(0, 5000),
    processedAs: "new_deal",
    dealId: deal.id,
    receivedAt: params.receivedAt,
  });

  logger.info({ dealId: deal.id, fromEmail: params.fromEmail }, "New ISR deal created from email");

  // Auto-send RFQ to distributors if vendor found
  if (vendorId) {
    await sendRfqsForDeal(deal.id, vendorId, classification.productKeywords ?? params.subject, params.bodyText);
  }
}

async function handleRfqResponse(params: {
  messageId: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  bodyText: string;
  receivedAt: Date;
  classification: Awaited<ReturnType<typeof classifyEmail>>;
}) {
  const { classification } = params;

  // Extract deal ID from subject [ISR-REF:DEAL-X]
  const refMatch = params.subject.match(/\[ISR-REF:DEAL-(\d+)\]/i);
  const dealRefId = refMatch ? parseInt(refMatch[1]) : classification.dealRefId;

  if (!dealRefId) {
    await db.insert(isrEmailInboxTable).values({
      messageId: params.messageId, fromEmail: params.fromEmail, fromName: params.fromName,
      subject: params.subject, bodyText: params.bodyText.slice(0, 5000),
      processedAs: "ignored", receivedAt: params.receivedAt,
    });
    return;
  }

  // Find the open RFQ for this deal from this sender
  const [rfq] = await db.select({ id: isrRfqsTable.id })
    .from(isrRfqsTable)
    .where(and(
      eq(isrRfqsTable.dealId, dealRefId),
      sql`lower(${isrRfqsTable.sentToEmail}) = ${params.fromEmail.toLowerCase()}`,
    ))
    .limit(1);

  const rfqId = rfq?.id;

  // Parse pricing from email
  const parsed = await parseRfqResponseEmail({
    subject: params.subject,
    bodyText: params.bodyText,
  });

  // Store RFQ response
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

  // Update RFQ status
  if (rfqId) {
    await db.update(isrRfqsTable)
      .set({ status: "responded", respondedAt: new Date() })
      .where(eq(isrRfqsTable.id, rfqId));
  }

  // Insert quote lines
  if (response && parsed.lines.length > 0) {
    const [marginRule] = await db.select()
      .from(isrMarginRulesTable)
      .where(eq(isrMarginRulesTable.isDefault, true))
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

    // Update deal status
    await db.update(isrDealsTable)
      .set({ status: "quoted", updatedAt: new Date() })
      .where(eq(isrDealsTable.id, dealRefId));
  }

  // Log inbox
  await db.insert(isrEmailInboxTable).values({
    messageId: params.messageId, fromEmail: params.fromEmail, fromName: params.fromName,
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
): Promise<void> {
  const transport = getSmtpTransport();
  if (!transport) {
    logger.warn("SMTP not configured — skipping RFQ sending");
    return;
  }

  const [vendor] = await db.select().from(isrVendorsTable).where(eq(isrVendorsTable.id, vendorId));
  if (!vendor) return;

  const distributors = await db.select()
    .from(isrDistributorsTable)
    .where(and(eq(isrDistributorsTable.vendorId, vendorId), eq(isrDistributorsTable.isActive, true)));

  const [deal] = await db.select({ customerCompany: isrDealsTable.customerCompany })
    .from(isrDealsTable).where(eq(isrDealsTable.id, dealId));

  const targets: Array<{ email: string; name: string; distributorId?: number }> = distributors.map((d) => ({
    email: d.contactEmail, name: d.name, distributorId: d.id,
  }));

  if (vendor.salesRepEmail) {
    targets.push({ email: vendor.salesRepEmail, name: vendor.salesRepName ?? vendor.displayName });
  }

  for (const target of targets) {
    const body = await generateRfqEmailBody({
      dealId, vendorName: vendor.displayName,
      customerCompany: deal?.customerCompany ?? "Müşterimiz",
      productKeywords, originalRequest, distributorName: target.name,
    });
    const subject = `[ISR-REF:DEAL-${dealId}] Teklif Talebi — ${vendor.displayName} — ${productKeywords.slice(0, 40)}`;

    try {
      const info = await transport.sendMail({
        from: `"CyberStep.io Satış" <${getSenderEmail()}>`,
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
