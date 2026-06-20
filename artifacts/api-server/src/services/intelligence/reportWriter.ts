import { callModel } from "@workspace/ai";
import { db } from "@workspace/db";
import { intelligenceReportsTable, reportSectorDetailsTable, marketConfigsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../../lib/logger";
import type { MonthlyAggregation, SectorStats } from "./dataAggregator";
import type { MarketConfig } from "@workspace/db";

async function callClaude(systemPrompt: string, userPrompt: string, maxTokens = 2000): Promise<string> {
  try {
    return await callModel({ task: "intel-report", system: systemPrompt, messages: [{ role: "user", content: userPrompt }], maxTokens });
  } catch (e) {
    logger.error({ err: e }, "Claude çağrısı başarısız");
    return "";
  }
}

const MONTH_NAMES_TR: Record<number, string> = { 1: "Ocak", 2: "Şubat", 3: "Mart", 4: "Nisan", 5: "Mayıs", 6: "Haziran", 7: "Temmuz", 8: "Ağustos", 9: "Eylül", 10: "Ekim", 11: "Kasım", 12: "Aralık" };
const MONTH_NAMES_AZ: Record<number, string> = { 1: "Yanvar", 2: "Fevral", 3: "Mart", 4: "Aprel", 5: "May", 6: "İyun", 7: "İyul", 8: "Avqust", 9: "Sentyabr", 10: "Oktyabr", 11: "Noyabr", 12: "Dekabr" };

function getMonthName(month: number, langCode: string): string {
  if (langCode === "az") return MONTH_NAMES_AZ[month] || String(month);
  return MONTH_NAMES_TR[month] || String(month);
}

function getTopVendor(dist: Record<string, number>): string {
  const entries = Object.entries(dist).sort(([, a], [, b]) => b - a);
  return entries[0]?.[0] || "bilinmiyor";
}

export async function generateMonthlyReport(countryCode: string, year: number, month: number): Promise<number> {
  const { aggregateMonthlyData, getMarketConfig } = await import("./dataAggregator");
  const config = await getMarketConfig(countryCode);
  const data = await aggregateMonthlyData(countryCode, year, month);

  const reportSlug = `${countryCode.toLowerCase()}-${year}-${String(month).padStart(2, "0")}`;
  const monthName = getMonthName(month, config.languageCode || "tr");
  const sectorLabels = (config.sectorLabels as Record<string, string>) || {};

  const [existing] = await db.select({ id: intelligenceReportsTable.id }).from(intelligenceReportsTable).where(eq(intelligenceReportsTable.reportSlug, reportSlug));
  if (existing) {
    logger.info({ reportSlug }, "Rapor zaten mevcut, güncelleniyor");
  }

  const [reportRow] = await db
    .insert(intelligenceReportsTable)
    .values({
      countryCode,
      reportMonth: month,
      reportYear: year,
      reportSlug,
      status: "generating",
      domainsAnalyzed: data.totalDomains,
      dateRangeStart: data.dateRange.start.toISOString().split("T")[0],
      dateRangeEnd: data.dateRange.end.toISOString().split("T")[0],
      dataSources: ["passive_scan", "dns", "ssl"],
      avgRiskScore: String(data.avgRiskScore),
      pctNoDmarc: String(data.pctNoDmarc),
      pctNoWaf: String(data.pctNoWaf),
      pctOutdatedCms: String(data.pctOutdatedCms),
      pctOpenCriticalPort: String(data.pctOpenCriticalPort),
      pctDarkWebLeak: String(data.pctDarkWebLeak),
      mostUsedWaf: getTopVendor(data.wafDistribution),
      mostUsedMailProvider: getTopVendor(data.mailProviderDistribution),
      worstSector: data.worstSector,
      bestSector: data.bestSector,
      monthOverMonthChange: String(data.momChange),
    })
    .onConflictDoUpdate({
      target: [intelligenceReportsTable.reportSlug],
      set: { status: "generating", domainsAnalyzed: data.totalDomains, updatedAt: new Date() },
    })
    .returning({ id: intelligenceReportsTable.id });

  const reportId = reportRow.id;

  setImmediate(async () => {
    try {
      const systemPrompt = `Sen CyberStep.io'nun baş analistisisin. ${config.countryNameLocal} siber güvenlik pazarında bağımsız teknik araştırmalar yapıyorsun.
Üslup: Otoriter ama erişilebilir. Teknik ama patron da anlasın. Türkçe, doğal ve akıcı. Veri odaklı, somut rakamlar ver.
Asla "Hizmetimizi alın" tonu, aşırı teknik jargon ya da belirsiz genelleme kullanma.`;

      const sectorRanking = Object.entries(data.bySector)
        .sort(([, a], [, b]) => b.avgRiskScore - a.avgRiskScore)
        .map(([sector, stats], i) => ({ sector, rank: i + 1, ...stats }));

      const summaryPrompt = `${config.countryNameLocal} Siber Güvenlik Endeksi — ${monthName} ${year} — Yönetici Özeti

VERİ:
  Analiz edilen domain: ${data.totalDomains}
  Ortalama risk skoru: ${data.avgRiskScore}/100
  Önceki aya göre: ${data.momChange > 0 ? "+" : ""}${data.momChange}%

TEMEL BULGULAR:
  DMARC eksik: %${data.pctNoDmarc}
  WAF yok: %${data.pctNoWaf}
  Kritik açık port: %${data.pctOpenCriticalPort}
  Dark web sızıntısı: %${data.pctDarkWebLeak}

SEKTÖR SIRALAMASI (1=en iyi):
${sectorRanking.slice(0, 5).map((s) => `  ${s.rank}. ${sectorLabels[s.sector] || s.sector}: ${s.avgRiskScore}/100`).join("\n")}

MEVZUAT: ${config.primaryRegulation}

Görev: Bu veriyle yönetici özeti yaz. Maksimum 200 kelime. İlk cümle çarpıcı olsun. Son cümle aksiyon çağrısı olsun.`;

      const linkedinPrompt = `LinkedIn paylaşımı yaz. Maksimum 1200 karakter.
HEDEF KİTLE: CISO, CTO, IT Direktörü

ZORUNLU:
1. Çarpıcı açılış (rakam ile)
2. En önemli 3 bulgu (kısa maddeler)
3. Sektör karşılaştırması
4. ${config.primaryRegulation} hatırlatması
5. Beklenti yaratan kapanış

VERİ:
  ${data.totalDomains} domain tarandı
  %${data.pctNoDmarc} → DMARC eksik
  %${data.pctOpenCriticalPort} → Kritik port açık
  %${data.pctDarkWebLeak} → Dark web sızıntısı
  En riskli sektör: ${sectorLabels[data.worstSector] || data.worstSector}

Tam rapor cyberstep.io'da →
#SiberGüvenlik #${config.countryNameLocal} #KVKK`;

      const pressReleasePrompt = `Basın bülteni yaz. Maksimum 400 kelime. Resmi, üçüncü şahıs.
Başlık: CyberStep.io ${monthName} ${year} ${config.countryNameLocal} Siber Güvenlik Endeksi'ni Yayınladı
VERİ: ${data.totalDomains} domain, %${data.pctNoDmarc} DMARC eksik, %${data.pctNoWaf} WAF yok`;

      const [executiveSummary, linkedinPostShort, pressRelease] = await Promise.all([
        callClaude(systemPrompt, summaryPrompt, 500),
        callClaude(systemPrompt, linkedinPrompt, 400),
        callClaude(systemPrompt, pressReleasePrompt, 600),
      ]);

      const keyFindings = [
        { finding: "DMARC Güvenliği", pct: data.pctNoDmarc, detail: "E-posta kimlik doğrulaması yapılandırılmamış", trend: "stable" },
        { finding: "WAF Koruması Eksik", pct: data.pctNoWaf, detail: "Web uygulama güvenlik duvarı yok", trend: "stable" },
        { finding: "Kritik Port Açık", pct: data.pctOpenCriticalPort, detail: "İnternetten erişilebilir kritik servis portları", trend: "stable" },
        { finding: "Dark Web Sızıntısı", pct: data.pctDarkWebLeak, detail: "Kimlik bilgileri dark web'de sızdırılmış", trend: "stable" },
      ];

      const sectorAnalysis = sectorRanking.map((s) => ({
        sector: s.sector,
        sectorLabel: sectorLabels[s.sector] || s.sector,
        rank: s.rank,
        domainCount: s.domainCount,
        avgRiskScore: s.avgRiskScore,
        pctNoDmarc: parseFloat(s.pctNoDmarc?.toFixed(1) || "0"),
        pctNoWaf: parseFloat(s.pctNoWaf?.toFixed(1) || "0"),
      }));

      const carousel = generateCarouselContent(data, config as any, sectorRanking, keyFindings);

      await db.update(intelligenceReportsTable).set({
        status: "review",
        executiveSummary,
        keyFindings,
        sectorAnalysis,
        linkedinPostShort,
        linkedinCarousel: carousel,
        pressRelease,
        emailSubject: `${config.countryNameLocal} Siber Güvenlik Endeksi — ${monthName} ${year}`,
        emailPreview: `${data.totalDomains} domain analizi: %${data.pctNoDmarc} DMARC eksik`,
        updatedAt: new Date(),
      }).where(eq(intelligenceReportsTable.id, reportId));

      await db.delete(reportSectorDetailsTable).where(eq(reportSectorDetailsTable.reportId, reportId));
      await db.insert(reportSectorDetailsTable).values(
        sectorRanking.map((s) => ({
          reportId,
          countryCode,
          sector: s.sector,
          domainCount: s.domainCount,
          avgRiskScore: String(s.avgRiskScore),
          pctNoDmarc: String(parseFloat(s.pctNoDmarc?.toFixed(1) || "0")),
          pctNoWaf: String(parseFloat(s.pctNoWaf?.toFixed(1) || "0")),
          pctOpenPort: String(parseFloat(s.pctOpenPort?.toFixed(1) || "0")),
          sectorRank: s.rank,
        }))
      );

      logger.info({ reportId, reportSlug }, "İstihbarat raporu üretildi");
    } catch (e) {
      logger.error({ reportId, err: e }, "Rapor üretme hatası");
      await db.update(intelligenceReportsTable).set({ status: "error", updatedAt: new Date() }).where(eq(intelligenceReportsTable.id, reportId));
    }
  });

  return reportId;
}

function generateCarouselContent(
  data: MonthlyAggregation,
  config: { countryNameLocal: string; primaryRegulation: string; sectorLabels: Record<string, string> },
  sectors: Array<{ sector: string; avgRiskScore: number }>,
  findings: Array<{ finding: string; pct: number; detail: string }>
): object[] {
  return [
    { slideNumber: 1, type: "cover", title: `${config.countryNameLocal} Siber Güvenlik Endeksi`, subtitle: `${data.totalDomains.toLocaleString()} Domain Analizi` },
    { slideNumber: 2, type: "big_stat", label: "Ortalama Risk Skoru", value: data.avgRiskScore, suffix: "/100", context: `${data.momChange > 0 ? "+" : ""}${data.momChange}% geçen aya göre` },
    { slideNumber: 3, type: "finding", pct: data.pctNoDmarc, title: "DMARC kaydı yapılandırmamış", detail: "Bu şirketler adına sahte e-posta gönderilebilir.", law: config.primaryRegulation },
    { slideNumber: 4, type: "chart", title: "WAF Kullanım Oranı", noWaf: data.pctNoWaf, wafDistribution: data.wafDistribution },
    { slideNumber: 5, type: "chart", title: "Sektör Risk Sıralaması", sectors: sectors.slice(0, 5).map((s) => ({ label: config.sectorLabels[s.sector] || s.sector, value: s.avgRiskScore })) },
    { slideNumber: 6, type: "spotlight", worstSector: config.sectorLabels[data.worstSector] || data.worstSector, pctOpenPort: data.pctOpenCriticalPort, pctDarkWeb: data.pctDarkWebLeak },
    { slideNumber: 7, type: "regulation", regulation: config.primaryRegulation },
    { slideNumber: 8, type: "trend", mailDistribution: data.mailProviderDistribution, cmsDistribution: data.cmsDistribution, wafDistribution: data.wafDistribution },
    { slideNumber: 9, type: "methodology", totalDomains: data.totalDomains },
    { slideNumber: 10, type: "cta", url: "cyberstep.io", reportUrl: "cyberstep.io/rapor" },
  ];
}
