/**
 * CISO Asistan — Aylık Yönetim Kurulu Raporu
 * Claude ile yönetici özeti üretir, board_reports tablosuna kaydeder, email gönderir.
 */

import { callModel } from "@workspace/ai";
import { db } from "@workspace/db";
import {
  boardReportsTable,
  cisoAssistantSubscriptionsTable,
  domainScansTable,
  customersTable,
  boardReportRecipientsTable,
} from "@workspace/db";
import { eq, desc, avg, and, gte, lt } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { sendMail } from "../email";
import { calculateComplianceScore } from "./complianceCalculator";

function formatMonth(d: Date): string {
  return d.toLocaleString("tr-TR", { month: "long", year: "numeric" });
}

async function callClaude(prompt: string): Promise<string> {
  try {
    return await callModel({
      task: "ciso-board-report",
      system: "Türk şirketi için Türkçe siber güvenlik yönetim raporu yaz. Sade, net, iş dili. Teknik kelime kullanma. Veri bazlı, gerçekçi.",
      messages: [{ role: "user", content: prompt }],
      maxTokens: 400,
    });
  } catch (err) {
    logger.warn({ err }, "Board raporu Claude hatası");
    return "";
  }
}

function buildRecommendations(
  scan: { sslDaysUntilExpiry?: number | null; dmarcPass?: boolean | null; cveSummary?: unknown } | null,
  compliance: { score7545: number; scoreKvkk: number }
): Array<{ priority: number; action: string; effort: string }> {
  const recs: Array<{ priority: number; action: string; effort: string }> = [];

  if ((scan?.sslDaysUntilExpiry ?? 999) <= 30) {
    recs.push({ priority: 1, action: "SSL sertifikasını yenileyin", effort: "30 dakika" });
  }
  if (!scan?.dmarcPass) {
    recs.push({ priority: 1, action: "DMARC politikasını güçlendirin (reject)", effort: "1 saat" });
  }

  const criticalCves = Array.isArray(scan?.cveSummary)
    ? scan!.cveSummary.filter((c: { severity?: string }) => c?.severity?.toLowerCase() === "critical").length
    : 0;
  if (criticalCves > 0) {
    recs.push({ priority: 1, action: `${criticalCves} kritik CVE yaması yapın`, effort: "Yazılıma bağlı" });
  }
  if (compliance.score7545 < 70) {
    recs.push({ priority: 2, action: "7545 uyum eksikliklerini tamamlayın", effort: "Politika kütüphanesinden şablonları indirin" });
  }
  if (compliance.scoreKvkk < 70) {
    recs.push({ priority: 2, action: "KVKK uyum adımlarını tamamlayın", effort: "VERBİS kaydı + veri envanteri" });
  }

  return recs.slice(0, 3);
}

export async function generateBoardReport(customerId: number): Promise<void> {
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, customerId))
    .limit(1);

  if (!customer) throw new Error(`Müşteri bulunamadı: ${customerId}`);

  const [sub] = await db
    .select()
    .from(cisoAssistantSubscriptionsTable)
    .where(eq(cisoAssistantSubscriptionsTable.customerId, customerId))
    .limit(1);

  // Domain tarama geçmişi
  const [latestScan] = await db
    .select()
    .from(domainScansTable)
    .where(eq(domainScansTable.email, customer.email))
    .orderBy(desc(domainScansTable.id))
    .limit(1);

  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

  const [prevScan] = await db
    .select()
    .from(domainScansTable)
    .where(
      and(
        eq(domainScansTable.email, customer.email),
        lt(domainScansTable.createdAt, oneMonthAgo),
        gte(domainScansTable.createdAt, twoMonthsAgo)
      )
    )
    .orderBy(desc(domainScansTable.id))
    .limit(1);

  // Uyum skoru
  let compliance = { score7545: 0, scoreKvkk: 0 };
  try {
    compliance = await calculateComplianceScore(customerId);
  } catch {
    // devam et, 0 skorla
  }

  // Sektör ortalaması
  let sectorAvg = 65;
  try {
    const [avgRow] = await db
      .select({ avg: avg(domainScansTable.overallScore) })
      .from(domainScansTable)
      .where(eq(domainScansTable.email, customer.email));
    sectorAvg = Math.round(Number(avgRow?.avg ?? 65));
  } catch {
    // varsayılan
  }

  const currentScore = latestScan?.overallScore ?? 0;
  const prevScore = prevScan?.overallScore ?? null;

  // Finansal risk tahmini (IBM 2024 TR baz)
  const BASE_COST = 8_500_000;
  const riskMultiplier = Math.max(0, (100 - currentScore) / 100);
  const estimatedRiskTl = Math.round(BASE_COST * riskMultiplier * 0.33);

  const recommendations = buildRecommendations(latestScan ?? null, compliance);

  // Yönetici özeti
  const executiveSummary = await callClaude(`
Şirket: ${customer.companyName ?? customer.email}
Sektör: ${(customer as unknown as { sector?: string }).sector ?? sub?.sector ?? "teknoloji"}
Dönem: ${formatMonth(new Date())}

Güvenlik skoru: ${currentScore}/100
Geçen ay: ${prevScore !== null ? prevScore + "/100" : "ilk rapor"}
Sektör ortalaması: ${sectorAvg}/100
Kritik bulgu sayısı: ${latestScan?.shodanVulnCount ?? 0}
7545 uyum skoru: %${compliance.score7545}
KVKK uyum skoru: %${compliance.scoreKvkk}
Tahmini finansal risk: ${estimatedRiskTl.toLocaleString("tr-TR")} TL

CEO ve yönetim kuruluna sunulacak 3 paragraflık Türkçe özet yaz:
  Paragraf 1: Genel güvenlik durumu
  Paragraf 2: Bu ayın en önemli riski
  Paragraf 3: Önerilen 3 aksiyon

Teknik kelime kullanma. Maksimum 150 kelime. Abartma. Veri bazlı, gerçekçi.
`);

  // board_reports tablosuna kaydet
  const now = new Date();
  const reportMonth = now.getMonth() + 1;
  const reportYear = now.getFullYear();

  const riskLevel = currentScore >= 80 ? "low" : currentScore >= 60 ? "medium" : currentScore >= 40 ? "high" : "critical";

  await db
    .insert(boardReportsTable)
    .values({
      customerId,
      reportMonth,
      reportYear,
      status: "draft",
      currentScore,
      previousScore: prevScore ?? undefined,
      scoreChange: prevScore !== null ? currentScore - prevScore : undefined,
      riskLevel,
      criticalFindings: latestScan?.shodanVulnCount ?? 0,
      estimatedRiskTl,
      executiveSummary,
      keyRisks: recommendations as unknown as Record<string, unknown>,
      reportJson: {
        compliance7545: compliance.score7545,
        complianceKvkk: compliance.scoreKvkk,
        sectorAvg,
        generatedBy: "ciso-assistant",
      },
    })
    .onConflictDoNothing();

  // Alıcılara e-posta gönder
  const recipients = await db
    .select()
    .from(boardReportRecipientsTable)
    .where(
      and(
        eq(boardReportRecipientsTable.customerId, customerId),
        eq(boardReportRecipientsTable.isActive, true)
      )
    );

  const sendTo =
    recipients.length > 0
      ? recipients.map((r) => r.email)
      : [sub?.boardReportEmail ?? customer.email];

  const monthLabel = formatMonth(now);

  for (const email of sendTo) {
    try {
      await sendMail({
        to: email,
        subject: `${customer.companyName ?? "Şirketiniz"} — ${monthLabel} Güvenlik Raporu`,
        html: `
          <p>Merhaba,</p>
          <p><strong>${customer.companyName ?? ""}</strong> için <strong>${monthLabel}</strong> siber güvenlik durum raporunuz hazır.</p>
          <hr style="margin:16px 0">
          <p><strong>Güvenlik Skoru:</strong> ${currentScore}/100${prevScore !== null ? ` (geçen ay: ${prevScore})` : ""}</p>
          <p><strong>7545 Uyum:</strong> %${compliance.score7545} &nbsp;|&nbsp; <strong>KVKK Uyum:</strong> %${compliance.scoreKvkk}</p>
          <p><strong>Tahmini Risk:</strong> ${estimatedRiskTl.toLocaleString("tr-TR")} TL</p>
          <hr style="margin:16px 0">
          <p><em>${executiveSummary}</em></p>
          <hr style="margin:16px 0">
          <p>Raporun tamamını portaldan görüntüleyebilirsiniz:</p>
          <a href="${process.env["REPLIT_DOMAINS"] ? `https://${process.env["REPLIT_DOMAINS"].split(",")[0]?.trim()}` : "https://cyberstep.io"}/hesabim/ciso-asistan" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px">Portala Git</a>
          <br><br>
          <small style="color:#888">CyberStep CISO Asistan — <a href="mailto:info@cyberstep.io">info@cyberstep.io</a></small>
        `,
      });
    } catch (err) {
      logger.warn({ err, email, customerId }, "Board raporu email gönderilemedi");
    }
  }

  logger.info({ customerId, reportMonth, reportYear, currentScore }, "Board raporu üretildi");
}
