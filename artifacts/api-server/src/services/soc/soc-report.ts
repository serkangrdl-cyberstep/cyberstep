/**
 * Weekly SOC report — Claude executive summary + PDF + email.
 * Mirrors the fabric weekly report pattern but scoped to SOC cases.
 */

import PDFDocument from "pdfkit";
import path from "path";
import { db, customersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { sendMail } from "../email";
import { callClaudeWithCost, SOC_MODEL_DEEP } from "./soc-claude";
import { getCasesSince, summarizeCases, getCustomerEmail } from "./soc-cases";

const FONT_DIR = "/usr/share/fonts/truetype/dejavu";
const FONT_REGULAR = path.join(FONT_DIR, "DejaVuSans.ttf");
const FONT_BOLD = path.join(FONT_DIR, "DejaVuSans-Bold.ttf");

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`{1,3}(.*?)`{1,3}/gs, "$1")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface WeeklyReportData {
  companyName: string;
  weekLabel: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  resolved: number;
  slaBreached: number;
  summary: string;
}

function buildPDF(data: WeeklyReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("reg", FONT_REGULAR);
    doc.registerFont("bold", FONT_BOLD);

    doc.font("bold").fontSize(20).fillColor("#0f172a").text("CyberStep SOC — Haftalık Rapor");
    doc.moveDown(0.3);
    doc.font("reg").fontSize(11).fillColor("#64748b").text(`${data.companyName} · ${data.weekLabel}`);
    doc.moveDown(1);

    doc.font("bold").fontSize(13).fillColor("#0f172a").text("Özet Göstergeler");
    doc.moveDown(0.4);
    const rows: Array<[string, string]> = [
      ["Toplam vaka", String(data.total)],
      ["Kritik", String(data.critical)],
      ["Yüksek", String(data.high)],
      ["Orta", String(data.medium)],
      ["Düşük", String(data.low)],
      ["Çözülen", String(data.resolved)],
      ["SLA aşımı", String(data.slaBreached)],
    ];
    doc.font("reg").fontSize(11).fillColor("#0f172a");
    for (const [k, v] of rows) {
      doc.text(`${k}: `, { continued: true }).font("bold").text(v).font("reg");
    }
    doc.moveDown(1);

    doc.font("bold").fontSize(13).fillColor("#0f172a").text("Yönetici Değerlendirmesi");
    doc.moveDown(0.4);
    doc.font("reg").fontSize(11).fillColor("#1e293b").text(stripMarkdown(data.summary), { align: "left", lineGap: 2 });

    doc.end();
  });
}

export async function generateWeeklySOCReport(customerId: number): Promise<boolean> {
  try {
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, customerId));
    if (!customer) return false;

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const cases = await getCasesSince(customerId, since);
    const stats = summarizeCases(cases);
    const weekLabel = `${since.toLocaleDateString("tr-TR")} – ${new Date().toLocaleDateString("tr-TR")}`;

    const caseLines = cases.slice(0, 40)
      .map((c) => `- [${c.severity}] ${c.title} (durum: ${c.status}${c.slaBreached ? ", SLA aşıldı" : ""})`)
      .join("\n") || "Bu hafta vaka oluşmadı.";

    const prompt = `Sen bir SOC yöneticisisin. Aşağıdaki haftalık SOC verisinden, KOBİ patronunun anlayacağı sade Türkçe ile 3-5 paragraflık yönetici özeti yaz. Teknik jargondan kaçın, iş riskine odaklan.

ŞİRKET: ${customer.companyName ?? "Müşteri"}
DÖNEM: ${weekLabel}
TOPLAM VAKA: ${stats.total} (kritik: ${stats.critical}, yüksek: ${stats.high})
ÇÖZÜLEN: ${stats.resolved} · SLA AŞIMI: ${stats.slaBreached}

VAKALAR:
${caseLines}`;

    let summary = "Bu hafta için otomatik değerlendirme oluşturulamadı.";
    try {
      const [text] = await callClaudeWithCost(prompt, SOC_MODEL_DEEP, { customerId, useCase: "weekly_report" });
      if (text.trim()) summary = text.trim();
    } catch (err) {
      logger.warn({ err, customerId }, "Weekly SOC report AI summary failed");
    }

    const pdf = await buildPDF({
      companyName: customer.companyName ?? "Müşteri",
      weekLabel,
      total: stats.total,
      critical: stats.critical,
      high: stats.high,
      medium: cases.filter((c) => c.severity === "medium").length,
      low: cases.filter((c) => c.severity === "low").length,
      resolved: stats.resolved,
      slaBreached: stats.slaBreached,
      summary,
    });

    const to = await getCustomerEmail(customerId);
    if (!to) {
      logger.warn({ customerId }, "Weekly SOC report: no recipient email");
      return false;
    }

    await sendMail({
      to,
      subject: `CyberStep SOC — Haftalık Rapor (${weekLabel})`,
      html: `<p>Merhaba,</p><p>Bu haftaki SOC güvenlik özetiniz ekte yer almaktadır. Toplam ${stats.total} vaka işlendi, ${stats.resolved} tanesi çözüldü.</p><p>CyberStep SOC Ekibi</p>`,
      attachments: [{ filename: `soc-haftalik-rapor.pdf`, content: pdf }],
    });
    logger.info({ customerId, total: stats.total }, "Weekly SOC report sent");
    return true;
  } catch (err) {
    logger.warn({ err, customerId }, "Weekly SOC report failed");
    return false;
  }
}

export async function runWeeklySOCReports(): Promise<void> {
  const customers = await db.select({ id: customersTable.id })
    .from(customersTable).where(eq(customersTable.socEnabled, true));
  for (const c of customers) {
    await generateWeeklySOCReport(c.id);
  }
}
