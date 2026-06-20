/**
 * Yıllık Rapor İstihbarat Takvimi
 *
 * WEF, CrowdStrike, IBM, Verizon, ENISA, VulnCheck raporlarını takip eder.
 * Claude ile Türkiye özelinde analiz yapar ve aylık endeks raporuna entegre eder.
 */

import { db } from "@workspace/db";
import { annualIntelReportsTable, intelFeedItemsTable, vulncheckKevTable } from "@workspace/db";
import { eq, desc, and, gte, count } from "drizzle-orm";
import { getClaudeAiFn } from "../ai-client";
import { sendMail } from "../email";
import { logger } from "../../lib/logger";

export const ANNUAL_REPORTS_CALENDAR = [
  {
    key: "wef_global_cybersecurity_outlook",
    title: "WEF Global Cybersecurity Outlook",
    publisher: "World Economic Forum",
    expectedMonth: 1,
    keywords: ["weforum.org", "cybersecurity-outlook"],
  },
  {
    key: "crowdstrike_global_threat_report",
    title: "CrowdStrike Global Threat Report",
    publisher: "CrowdStrike",
    expectedMonth: 2,
    keywords: ["crowdstrike.com", "global-threat-report"],
  },
  {
    key: "ibm_xforce_threat_intelligence",
    title: "IBM X-Force Threat Intelligence Index",
    publisher: "IBM Security",
    expectedMonth: 2,
    keywords: ["ibm.com", "x-force"],
  },
  {
    key: "verizon_dbir",
    title: "Verizon Data Breach Investigations Report",
    publisher: "Verizon",
    expectedMonth: 5,
    keywords: ["verizon.com", "dbir"],
  },
  {
    key: "vulncheck_state_of_exploitation",
    title: "VulnCheck State of Exploitation",
    publisher: "VulnCheck",
    expectedMonth: 1,
    keywords: ["vulncheck.com", "state-of-exploitation"],
  },
  {
    key: "enisa_threat_landscape",
    title: "ENISA Threat Landscape",
    publisher: "ENISA",
    expectedMonth: 10,
    keywords: ["enisa.europa.eu", "threat-landscape"],
  },
  {
    key: "mandiant_m_trends",
    title: "Mandiant M-Trends",
    publisher: "Mandiant / Google Cloud",
    expectedMonth: 4,
    keywords: ["mandiant.com", "m-trends"],
  },
  {
    key: "anthropic_frontier_red_team",
    title: "Anthropic Frontier Red Team Blog",
    publisher: "Anthropic",
    expectedMonth: null,
    keywords: ["red.anthropic.com"],
  },
];

export interface AnnualReportAnalysis {
  key_findings: Array<{
    finding: string;
    data: string;
    relevance_to_turkey: string;
    cyberstep_action: string;
  }>;
  turkey_impact_summary: string;
  top_threats_for_turkey: string[];
  cyberstep_messaging: string[];
  monthly_report_section: string;
}

export async function analyzeAnnualReport(params: {
  reportKey: string;
  title: string;
  publisher: string;
  content: string;
  reportYear: number;
}): Promise<void> {
  const ai = getClaudeAiFn();

  const prompt = `Sen CyberStep.io'nun tehdit istihbarat analistisın.
Türkiye'nin siber güvenlik ekosistemini çok iyi biliyorsun.
işletme müşterileri için günlük tehdit analizi yapıyorsun.

Aşağıdaki raporu analiz et:
Rapor: ${params.title} (${params.publisher}, ${params.reportYear})

Rapor içeriği:
${params.content.slice(0, 8000)}

Şunu üret (JSON formatında):

{
  "key_findings": [
    {
      "finding": "Ana bulgu 1-2 cümlede",
      "data": "Destekleyen rakam veya veri",
      "relevance_to_turkey": "Türkiye için ne anlama geliyor",
      "cyberstep_action": "CyberStep'in bu konuda yapabileceği/söyleyebileceği"
    }
  ],
  "turkey_impact_summary": "Türkiye özeline 2-3 paragraf özet",
  "top_threats_for_turkey": ["Bu rapordan Türk şirketleri için en kritik 5 tehdit"],
  "cyberstep_messaging": ["Bu rapordan CyberStep'in satış/içerik mesajlarına eklenebilecek 3 güçlü cümle"],
  "monthly_report_section": "Aylık Türkiye Siber Güvenlik Endeksi için Küresel Bağlam bölümü taslağı (150-200 kelime)"
}

Sadece JSON döndür. Markdown veya açıklama ekleme.`;

  const response = await ai(prompt);
  let analysis: AnnualReportAnalysis;

  try {
    const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    analysis = JSON.parse(cleaned) as AnnualReportAnalysis;
  } catch {
    logger.warn({ reportKey: params.reportKey }, "Rapor analizi JSON parse hatası");
    throw new Error("Rapor analizi JSON olarak parse edilemedi");
  }

  await db.insert(annualIntelReportsTable).values({
    reportKey: params.reportKey,
    title: params.title,
    publisher: params.publisher,
    reportYear: params.reportYear,
    rawContent: params.content.slice(0, 50_000),
    keyFindings: analysis.key_findings,
    turkeyImpactSummary: analysis.turkey_impact_summary,
    cyberstepRecommendations: analysis.cyberstep_messaging,
    status: "analyzed",
  }).onConflictDoUpdate({
    target: annualIntelReportsTable.reportKey,
    set: {
      keyFindings: analysis.key_findings,
      turkeyImpactSummary: analysis.turkey_impact_summary,
      cyberstepRecommendations: analysis.cyberstep_messaging,
      rawContent: params.content.slice(0, 50_000),
      status: "analyzed",
      updatedAt: new Date(),
    },
  });

  const adminEmail = process.env["SOC_ADMIN_EMAIL"] ?? process.env["SMTP_USER"];
  if (adminEmail) {
    await sendMail({
      to: adminEmail,
      subject: `Yeni Rapor Analizi Hazir: ${params.title}`,
      html: `
        <h3>${params.title}</h3>
        <p><strong>${params.publisher}</strong> | ${params.reportYear}</p>
        <h4>Turkiye Ozet:</h4>
        <p>${analysis.turkey_impact_summary}</p>
        <h4>CyberStep Mesajlari:</h4>
        <ul>${(analysis.cyberstep_messaging ?? []).map((m: string) => `<li>${m}</li>`).join("")}</ul>
        <h4>Kritik Tehditler:</h4>
        <ul>${(analysis.top_threats_for_turkey ?? []).map((t: string) => `<li>${t}</li>`).join("")}</ul>
        <p><a href="/panel/cti-istihbarat/reports/${params.reportKey}">Admin Panelde Goruntule</a></p>
      `,
    }).catch((err) => logger.warn({ err }, "Rapor analiz emaili gonderimi basarisiz"));
  }

  logger.info({ reportKey: params.reportKey }, "Yillik rapor analizi tamamlandi");
}

export async function sendMonthlyReportReminder(): Promise<void> {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const expectedReports = ANNUAL_REPORTS_CALENDAR.filter(
    (r) => r.expectedMonth === currentMonth,
  );
  if (expectedReports.length === 0) return;

  const adminEmail = process.env["SOC_ADMIN_EMAIL"] ?? process.env["SMTP_USER"];
  if (!adminEmail) return;

  await sendMail({
    to: adminEmail,
    subject: `Bu ay beklenen raporlar (${currentMonth}/${currentYear})`,
    html: `
      <p>Bu ay cıkması beklenen yıllık raporlar:</p>
      <ul>
        ${expectedReports.map((r) => `<li><strong>${r.title}</strong> (${r.publisher})</li>`).join("")}
      </ul>
      <p>Rapor yayınlandığında admin panelden "Rapor Analizi Başlat" butonunu kullan:</p>
      <a href="/panel/cti-istihbarat">CTI İstihbarat Paneli →</a>
    `,
  }).catch((err) => logger.warn({ err }, "Yıllık rapor hatırlatma emaili gönderilemedi"));

  logger.info({ expectedReports: expectedReports.map((r) => r.key), month: currentMonth }, "Yıllık rapor hatırlatması gönderildi");
}

export async function getGlobalContextForMonthlyReport(month: string): Promise<string> {
  const reports = await db.select()
    .from(annualIntelReportsTable)
    .where(eq(annualIntelReportsTable.status, "analyzed"))
    .orderBy(desc(annualIntelReportsTable.updatedAt))
    .limit(3);

  const since30d = new Date(Date.now() - 30 * 86_400_000);
  const topFeedItems = await db.select()
    .from(intelFeedItemsTable)
    .where(
      and(
        eq(intelFeedItemsTable.isRelevant, true),
        gte(intelFeedItemsTable.createdAt, since30d),
      ),
    )
    .orderBy(desc(intelFeedItemsTable.relevanceScore))
    .limit(5);

  const [edgeCVERow] = await db.select({ count: count() })
    .from(vulncheckKevTable)
    .where(gte(vulncheckKevTable.dateAdded, since30d.toISOString().slice(0, 10)));
  const edgeCVECount = edgeCVERow?.count ?? 0;

  const ai = getClaudeAiFn();

  const context = await ai(`Türkiye Siber Güvenlik Endeksi ${month} için "Küresel Bağlam" bölümü yaz.

Küresel raporlardan öne çıkanlar:
${reports.map((r) => `- ${r.title}: ${(r.turkeyImpactSummary ?? "").slice(0, 200)}`).join("\n")}

Son 30 günde önemli gelişmeler:
${topFeedItems.map((i) => `- ${i.title} (${i.sourceKey})`).join("\n")}

Son 30 günde yeni VulnCheck KEV: ${edgeCVECount} istismar

200-250 kelime, Türkçe, profesyonel.
CyberStep'in Türkiye verisiyle küresel trendi karşılaştır.`);

  return context;
}
