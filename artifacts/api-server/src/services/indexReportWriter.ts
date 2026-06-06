import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logger } from "../lib/logger";
import type { IndexStats } from "./indexReportCalculator";

export interface IndexContent {
  executiveSummary: string;
  keyFindings: Array<{ finding: string; data: string; severity: string; cyberstep_note: string }>;
  globalContext: string;
}

async function callClaude(prompt: string, model = "claude-haiku-4-5", maxTokens = 600): Promise<string> {
  const msg = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  return msg.content.find(b => b.type === "text")?.text ?? "";
}

export async function generateIndexContent(
  stats: IndexStats,
  reportMonth: string,
  prevStats?: IndexStats | null,
): Promise<IndexContent> {
  const trend = prevStats ? {
    scoreDelta: stats.avgScore - prevStats.avgScore,
    dmarcDelta: stats.email.dmarcMissing - prevStats.email.dmarcMissing,
  } : null;

  const worstSectors = stats.sectorStats
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, 3)
    .map(s => `  ${s.sector}: ortalama ${s.avgScore}/100 (${s.count} domain)`)
    .join("\n");

  const execSummaryRaw = await callClaude(`
Sen Türkiye'nin siber güvenlik veri analistisın.
${reportMonth} dönemi için Türkiye Siber Güvenlik Endeksi yönetici özetini yaz.

Veriler (${stats.totalScanned} TR domain tarandı):
  Ortalama güvenlik skoru: ${stats.avgScore}/100
  ${trend ? `Geçen aya göre: ${trend.scoreDelta > 0 ? "+" : ""}${trend.scoreDelta.toFixed(1)} puan` : "İlk rapor dönemi"}

E-posta güvenliği:
  DMARC kaydı yok: %${stats.email.dmarcMissing}
  DMARC p=none (izleme): %${stats.email.dmarcNone}
  SPF kaydı yok: %${stats.email.spfMissing}

Kritik açık portlar:
  MySQL (3306) açık: %${stats.ports.mysqlExposed}
  FTP (21) açık: %${stats.ports.ftpExposed}
  RDP (3389) açık: %${stats.ports.rdpExposed}

SSL durumu:
  Geçerli: %${stats.ssl.sslValid}
  30 gün içinde doluyor: %${stats.ssl.sslExpiring}

En riskli sektörler:
${worstSectors}

Yönetici özeti kuralları:
  3-4 paragraf, Türkçe, sade dil
  İlk paragraf: genel durum
  İkinci: en kritik 2-3 bulgu
  Üçüncü: sektör/şehir öne çıkanlar
  Dördüncü: öneri ve çağrı
  Sayıları doğrudan kullan
  CyberStep'ten bahset ama satış tonu yok
`, "claude-haiku-4-5", 700);

  const keyFindingsRaw = await callClaude(`
Aşağıdaki verilerden en önemli 5 bulguyu üret.

Ortalama güvenlik skoru: ${stats.avgScore}/100
DMARC eksik: %${stats.email.dmarcMissing}
SPF eksik: %${stats.email.spfMissing}
MySQL açık: %${stats.ports.mysqlExposed}
SSL geçerli: %${stats.ssl.sslValid}
CVE'li domain: %${stats.cve.withCVE}
Kritik CVE: %${stats.cve.withCriticalCVE}
Kara listede: %${stats.blacklisted}
WordPress: %${stats.tech.wordpressUsage}

Her bulgu için JSON döndür:
[
  {
    "finding": "Kısa başlık (max 10 kelime)",
    "data": "Destekleyen rakam",
    "severity": "critical|high|medium",
    "cyberstep_note": "CyberStep bu konuda ne sağlar"
  }
]
Sadece JSON dizisi döndür. 5 madde. Türkçe.
`, "claude-haiku-4-5", 600);

  const globalContextRaw = await callClaude(`
Türkiye Siber Güvenlik Endeksi için küresel bağlam paragrafı yaz (100-150 kelime):

WEF 2026: %94 lider AI'ı en büyük risk olarak görüyor, siber eşitsizlik uçurumu büyüyor, KOBİ'ler geride.
VulnCheck 2026: KEV'lerin %28.96'sı CVE öncesi istismar, network edge cihazlar 1 numara hedef.

Türkiye verisi (${stats.avgScore}/100 ortalama skor, %${stats.email.dmarcMissing} DMARC eksik) ile küresel tabloyu karşılaştır.
Türkçe, profesyonel.
`, "claude-haiku-4-5", 300);

  let keyFindings: IndexContent["keyFindings"] = [];
  try {
    const cleaned = keyFindingsRaw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    keyFindings = Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    logger.warn({ err }, "keyFindings JSON parse hatası");
    keyFindings = [];
  }

  return {
    executiveSummary: execSummaryRaw.trim(),
    keyFindings,
    globalContext: globalContextRaw.trim(),
  };
}
