import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import PDFDocument from "pdfkit";
import crypto from "crypto";

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  lineTotal: number;
}

export interface InvoiceData {
  invoiceType?: "invoice" | "proforma" | "credit_note";
  customerId?: number;
  contractId?: number;
  customerName: string;
  customerEmail?: string;
  customerTaxId?: string;
  customerTaxOffice?: string;
  customerAddress?: string;
  billingEmail?: string;
  lineItems: LineItem[];
  discountAmountTl?: number;
  vatRate?: number;
  dueDate?: string;
  notes?: string;
  currency?: string;
}

export function fmtMoney(n: number): string {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "-";
  const dt = typeof d === "string" ? new Date(d) : d;
  return isNaN(dt.getTime()) ? "-" : dt.toLocaleDateString("tr-TR");
}

export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function generateInvoiceNumber(
  prefix: "CS-INV" | "CS-PRO" = "CS-INV"
): Promise<{ series: string; sequenceNumber: number; fullNumber: string }> {
  const year = new Date().getFullYear();
  const seqResult = await db.transaction(async (tx) => {
    await tx.execute(sql`
      INSERT INTO invoice_sequences (prefix, year, last_number)
      VALUES (${prefix}, ${year}, 1)
      ON CONFLICT (prefix, year)
      DO UPDATE SET last_number = invoice_sequences.last_number + 1
    `);
    const rows = await tx.execute(sql`
      SELECT last_number FROM invoice_sequences WHERE prefix = ${prefix} AND year = ${year}
    `);
    return Number((rows as { rows: Record<string, unknown>[] }).rows[0]?.["last_number"] ?? 1);
  });
  const padded = String(seqResult).padStart(4, "0");
  return { series: prefix, sequenceNumber: seqResult, fullNumber: `${prefix}-${year}-${padded}` };
}

export async function generateInvoicePDF(invoice: Record<string, unknown>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const buffers: Buffer[] = [];
    doc.on("data", (c: Buffer) => buffers.push(c));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const lineItems: LineItem[] = Array.isArray(invoice["line_items"] ?? invoice["lineItems"])
      ? ((invoice["line_items"] ?? invoice["lineItems"]) as LineItem[])
      : [];
    const subtotal = Number(invoice["subtotal_tl"] ?? 0);
    const discount = Number(invoice["discount_amount_tl"] ?? 0);
    const vatRate = Number(invoice["vat_rate"] ?? 20);
    const vatAmount = Number(invoice["vat_amount_tl"] ?? 0);
    const total = Number(invoice["total_tl"] ?? 0);
    const isPro = invoice["invoice_type"] === "proforma";
    const invNum = String(invoice["full_invoice_number"] ?? invoice["invoice_number"] ?? "");
    const custName = String(invoice["customer_name"] ?? "-");
    const custTaxId = invoice["customer_tax_id"];
    const custTaxOffice = invoice["customer_tax_office"];
    const custAddress = invoice["customer_address"];
    const dueDate = invoice["due_date"];
    const createdAt = invoice["created_at"] ?? new Date();
    const status = String(invoice["status"] ?? "pending");
    const notes = invoice["notes"];

    doc.fontSize(22).fillColor("#060D1A").font("Helvetica-Bold").text("CyberStep.io", 50, 50);
    doc.fontSize(10).fillColor("#7B8FAF").font("Helvetica").text("cyberstep.io  |  security@cyberstep.io", 50, 76);
    doc.fontSize(18).fillColor("#060D1A").font("Helvetica-Bold")
      .text(isPro ? "PROFORMA FATURA" : "FATURA", 350, 50, { align: "right", width: 195 });
    doc.fontSize(13).fillColor("#00A8CC").font("Helvetica-Bold")
      .text(invNum, 350, 73, { align: "right", width: 195 });
    doc.fontSize(9).fillColor("#7B8FAF").font("Helvetica")
      .text(`Düzenleme: ${fmtDate(String(createdAt))}`, 350, 94, { align: "right", width: 195 })
      .text(`Vade: ${fmtDate(dueDate ? String(dueDate) : null)}`, 350, 106, { align: "right", width: 195 });

    const statusColors: Record<string, [string, string]> = {
      paid: ["#276749", "#C6F6D5"], pending: ["#744210", "#FEFCBF"],
      overdue: ["#822727", "#FED7D7"], cancelled: ["#4A5568", "#E2E8F0"],
    };
    const [sfg, sbg] = statusColors[status] ?? ["#744210", "#FEFCBF"];
    const sLabel: Record<string, string> = { paid: "ÖDENDİ", pending: "BEKLEMEDE", overdue: "VADESİ GEÇTİ", cancelled: "İPTAL" };
    doc.roundedRect(400, 122, 145, 16, 6).fill(sbg);
    doc.fontSize(8).fillColor(sfg).font("Helvetica-Bold").text(sLabel[status] ?? "BEKLEMEDE", 405, 126, { align: "center", width: 135 });
    doc.moveTo(50, 148).lineTo(545, 148).strokeColor("#060D1A").lineWidth(1.5).stroke();

    doc.rect(50, 158, 235, 85).fill("#F8FAFF");
    doc.rect(310, 158, 235, 85).fill("#F8FAFF");
    doc.fontSize(8).fillColor("#7B8FAF").font("Helvetica-Bold").text("FATURA EDEN", 60, 166);
    doc.fontSize(11).fillColor("#060D1A").font("Helvetica-Bold").text("CyberStep.io", 60, 177);
    doc.fontSize(9).fillColor("#4A5568").font("Helvetica")
      .text("Siber Güvenlik Platformu", 60, 191).text("security@cyberstep.io", 60, 203).text("cyberstep.io", 60, 215);
    doc.fontSize(8).fillColor("#7B8FAF").font("Helvetica-Bold").text("FATURA EDİLEN", 320, 166);
    doc.fontSize(11).fillColor("#060D1A").font("Helvetica-Bold").text(custName, 320, 177, { width: 215 });
    doc.fontSize(9).fillColor("#4A5568").font("Helvetica");
    let cy = 191;
    if (custTaxId) { doc.text(`Vergi No: ${custTaxId}`, 320, cy, { width: 215 }); cy += 12; }
    if (custTaxOffice) { doc.text(`Vergi Dairesi: ${custTaxOffice}`, 320, cy, { width: 215 }); cy += 12; }
    if (custAddress) doc.text(String(custAddress).replace(/\n/g, ", "), 320, cy, { width: 215 });

    const tableTop = 258;
    doc.rect(50, tableTop, 495, 20).fill("#060D1A");
    doc.fontSize(9).fillColor("white").font("Helvetica-Bold")
      .text("Hizmet / Ürün", 56, tableTop + 6, { width: 210 })
      .text("Adet", 270, tableTop + 6, { width: 40, align: "center" })
      .text("Birim Fiyat", 315, tableTop + 6, { width: 85, align: "right" })
      .text("KDV", 405, tableTop + 6, { width: 35, align: "center" })
      .text("Tutar", 445, tableTop + 6, { width: 95, align: "right" });
    let rowY = tableTop + 20;
    lineItems.forEach((item, i) => {
      if (i % 2 === 0) doc.rect(50, rowY, 495, 18).fill("#F8FAFF");
      doc.fontSize(9).fillColor("#1a1a2e").font("Helvetica")
        .text(item.description, 56, rowY + 4, { width: 210 })
        .text(String(item.quantity), 270, rowY + 4, { width: 40, align: "center" })
        .text(`₺${fmtMoney(Number(item.unitPrice))}`, 315, rowY + 4, { width: 85, align: "right" })
        .text(`%${item.vatRate}`, 405, rowY + 4, { width: 35, align: "center" })
        .text(`₺${fmtMoney(Number(item.lineTotal))}`, 445, rowY + 4, { width: 95, align: "right" });
      rowY += 18;
    });
    if (lineItems.length === 0) { doc.fontSize(9).fillColor("#7B8FAF").font("Helvetica").text("(Kalem yok)", 56, rowY + 4); rowY += 18; }

    const tY = rowY + 12;
    const drawRow = (label: string, amt: string, y: number, bold = false, color = "#1a1a2e") => {
      doc.moveTo(350, y).lineTo(545, y).strokeColor("#E8EDF5").lineWidth(0.5).stroke();
      doc.fontSize(bold ? 11 : 9).fillColor(color).font(bold ? "Helvetica-Bold" : "Helvetica")
        .text(label, 355, y + 3).text(amt, 355, y + 3, { width: 185, align: "right" });
    };
    drawRow("Ara Toplam", `₺${fmtMoney(subtotal)}`, tY);
    let ty2 = tY + 18;
    if (discount > 0) { drawRow("İndirim", `-₺${fmtMoney(discount)}`, ty2, false, "#E53E3E"); ty2 += 18; }
    drawRow(`KDV (%${vatRate})`, `₺${fmtMoney(vatAmount)}`, ty2); ty2 += 22;
    doc.moveTo(350, ty2).lineTo(545, ty2).strokeColor("#060D1A").lineWidth(1.5).stroke();
    doc.fontSize(13).fillColor("#060D1A").font("Helvetica-Bold").text("GENEL TOPLAM", 355, ty2 + 4);
    doc.fontSize(13).fillColor("#00A8CC").font("Helvetica-Bold").text(`₺${fmtMoney(total)}`, 355, ty2 + 4, { width: 185, align: "right" });

    const pY = ty2 + 40;
    doc.rect(50, pY, 495, 52).fill("#F0F7FF");
    doc.moveTo(50, pY).lineTo(50, pY + 52).strokeColor("#00A8CC").lineWidth(3).stroke();
    doc.fontSize(8).fillColor("#7B8FAF").font("Helvetica-Bold").text("ÖDEME BİLGİLERİ", 62, pY + 8);
    doc.fontSize(9).fillColor("#1a1a2e").font("Helvetica")
      .text(`Ödeme Yöntemi: Banka Havalesi    Vade: ${fmtDate(dueDate ? String(dueDate) : null)}    Açıklama: ${invNum}`, 62, pY + 20, { width: 470 });
    const iban = process.env["BANK_IBAN"];
    if (iban) doc.text(`IBAN: ${iban}`, 62, pY + 34);
    if (notes) doc.fontSize(9).fillColor("#4A5568").font("Helvetica").text(`Not: ${notes}`, 50, pY + 62, { width: 495 });

    doc.moveTo(50, 768).lineTo(545, 768).strokeColor("#E8EDF5").lineWidth(0.5).stroke();
    doc.fontSize(8).fillColor("#A0AEC0").font("Helvetica")
      .text("CyberStep.io — Türkiye'nin Siber Güvenlik Risk Platformu", 50, 776)
      .text(`${invNum}  ·  ${fmtDate(String(createdAt))}`, 50, 776, { align: "right", width: 495 });
    doc.end();
  });
}

export async function createInvoice(data: InvoiceData): Promise<Record<string, unknown>> {
  const prefix = data.invoiceType === "proforma" ? "CS-PRO" : "CS-INV";
  const { series, sequenceNumber, fullNumber } = await generateInvoiceNumber(prefix as "CS-INV" | "CS-PRO");
  const subtotal = data.lineItems.reduce((s, i) => s + Number(i.lineTotal), 0);
  const discount = data.discountAmountTl ?? 0;
  const vatRate = data.vatRate ?? 20;
  const vatAmount = ((subtotal - discount) * vatRate) / 100;
  const total = subtotal - discount + vatAmount;

  const result = await db.execute(sql`
    INSERT INTO enterprise_invoices (
      invoice_number, full_invoice_number, series, sequence_number, invoice_type,
      customer_id, contract_id,
      customer_name, customer_email, customer_tax_id, customer_tax_office, customer_address, billing_email,
      line_items, subtotal_tl, discount_amount_tl, vat_rate, vat_amount_tl, total_tl,
      due_date, notes, currency, status, payment_token
    ) VALUES (
      ${fullNumber}, ${fullNumber}, ${series}, ${sequenceNumber}, ${data.invoiceType ?? "invoice"},
      ${data.customerId ?? null}, ${data.contractId ?? null},
      ${data.customerName}, ${data.customerEmail ?? null}, ${data.customerTaxId ?? null},
      ${data.customerTaxOffice ?? null}, ${data.customerAddress ?? null},
      ${data.billingEmail ?? data.customerEmail ?? null},
      ${JSON.stringify(data.lineItems)}::jsonb,
      ${String(subtotal)}, ${String(discount)}, ${vatRate}, ${String(vatAmount)}, ${String(total)},
      ${data.dueDate ?? null}, ${data.notes ?? null}, ${data.currency ?? "TRY"}, 'pending',
      ${generateSecureToken()}
    ) RETURNING *
  `);
  const inv = (result as { rows: Record<string, unknown>[] }).rows[0]!;
  logger.info({ invoiceId: inv["id"], fullNumber }, "Invoice created");
  return inv;
}

export async function syncInvoiceToAccounting(invoiceId: number): Promise<void> {
  try {
    const sr = await db.execute(sql`SELECT * FROM accounting_settings WHERE id = 1`);
    const s = (sr as { rows: Record<string, unknown>[] }).rows[0];
    if (!s || s["provider"] === "none" || !s["webhook_url"]) return;
    const ir = await db.execute(sql`SELECT * FROM enterprise_invoices WHERE id = ${invoiceId}`);
    const inv = (ir as { rows: Record<string, unknown>[] }).rows[0];
    if (!inv) return;
    await fetch(String(s["webhook_url"]), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${s["webhook_secret"] ?? ""}` },
      body: JSON.stringify({
        event: "invoice.created",
        invoice: {
          number: inv["full_invoice_number"], date: inv["created_at"], due_date: inv["due_date"],
          customer_name: inv["customer_name"], customer_tax_id: inv["customer_tax_id"],
          subtotal: inv["subtotal_tl"], vat_amount: inv["vat_amount_tl"], total: inv["total_tl"],
          line_items: inv["line_items"], status: inv["status"],
        },
      }),
    });
    await db.execute(sql`UPDATE accounting_settings SET last_sync_at = now() WHERE id = 1`);
  } catch (err) {
    logger.warn({ err, invoiceId }, "Accounting sync failed");
    await db.execute(sql`UPDATE accounting_settings SET error_count = error_count + 1 WHERE id = 1`);
  }
}

export async function runCollectionReminderCron(sendMail: (p: { to: string; subject: string; html: string }) => Promise<void>): Promise<void> {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0]!;

  const overdue = await db.execute(sql`
    SELECT * FROM enterprise_invoices
    WHERE status IN ('pending','overdue') AND due_date IS NOT NULL
      AND due_date < ${todayStr} AND customer_id IS NOT NULL
  `);

  for (const inv of (overdue as { rows: Record<string, unknown>[] }).rows) {
    try {
      await db.execute(sql`UPDATE enterprise_invoices SET status='overdue' WHERE id=${inv["id"]} AND status='pending'`);

      const dueDate = new Date(String(inv["due_date"]));
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / 86400000);
      const to = String(inv["billing_email"] ?? inv["customer_email"] ?? "");
      if (!to) continue;

      const num = String(inv["full_invoice_number"] ?? inv["invoice_number"]);
      const total = Number(inv["total_tl"] ?? 0);

      if (daysOverdue >= 1 && !inv["reminder_1_sent_at"]) {
        await sendMail({ to, subject: `Hatırlatma: ${num} — Ödeme bekleniyor`, html: reminderHtml(String(inv["customer_name"]), num, total, String(inv["due_date"]), 1) });
        await db.execute(sql`UPDATE enterprise_invoices SET reminder_1_sent_at=now(), status='overdue' WHERE id=${inv["id"]}`);
        logger.info({ invoiceId: inv["id"], daysOverdue }, "Reminder 1 sent");
      } else if (daysOverdue >= 5 && !inv["reminder_2_sent_at"]) {
        await sendMail({ to, subject: `Acil Hatırlatma: ${num} — 5 gün gecikti`, html: reminderHtml(String(inv["customer_name"]), num, total, String(inv["due_date"]), 2) });
        await db.execute(sql`UPDATE enterprise_invoices SET reminder_2_sent_at=now() WHERE id=${inv["id"]}`);
        logger.info({ invoiceId: inv["id"], daysOverdue }, "Reminder 2 sent");
      } else if (daysOverdue >= 15 && !inv["reminder_3_sent_at"]) {
        await sendMail({ to, subject: `Son Uyarı: ${num} — Servis askıya alınacak`, html: reminderHtml(String(inv["customer_name"]), num, total, String(inv["due_date"]), 3) });
        await db.execute(sql`UPDATE enterprise_invoices SET reminder_3_sent_at=now() WHERE id=${inv["id"]}`);
        logger.info({ invoiceId: inv["id"], daysOverdue }, "Reminder 3 sent");
      }
    } catch (err) {
      logger.warn({ err, invoiceId: inv["id"] }, "Collection reminder failed for invoice");
    }
  }
}

function reminderHtml(name: string, num: string, total: number, dueDate: string, n: number): string {
  const tones = ["", "Ödemenizin vadesi geçti. Gözden kaçmış olabilir.", "Ödemeniz 5 gün gecikmiş durumda. Lütfen işlem yapın.", "Son uyarıdır. 48 saat içinde servisiniz askıya alınacaktır."];
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
<h2 style="color:#060D1A;">Ödeme Hatırlatması</h2>
<p>Sayın ${name},</p><p>${tones[n] ?? ""}</p>
<div style="background:#FFF8F0;border-radius:8px;padding:16px;border-left:4px solid #FC8181;margin:20px 0;">
<p style="margin:4px 0;"><strong>Fatura No:</strong> ${num}</p>
<p style="margin:4px 0;"><strong>Tutar:</strong> ₺${total.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</p>
<p style="margin:4px 0;"><strong>Vade:</strong> ${new Date(dueDate).toLocaleDateString("tr-TR")}</p>
</div>
<hr style="border:none;border-top:1px solid #E8EDF5;"><p style="color:#A0AEC0;font-size:11px;">CyberStep.io</p>
</div>`;
}
