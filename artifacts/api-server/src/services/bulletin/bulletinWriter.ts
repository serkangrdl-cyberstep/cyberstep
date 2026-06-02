import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logger } from "../../lib/logger";
import type { WeeklyData } from "./weeklyDataCollector";

const SYSTEM_PROMPT = `Sen CyberStep.io'nun baş analistisi ve bülten editörüsün.
Her hafta Türkiye'nin CISO'larına, CTO'larına ve IT direktörlerine haftalık siber güvenlik istihbarat bülteni yazıyorsun.
Stil: Her bölüm maksimum 3-4 cümle. Veri varsa rakam kullan. Jargon yok. Acil ama panikletme. Türkçe, akıcı, doğal.`;

async function callClaude(userPrompt: string, maxTokens = 200): Promise<string> {
  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    const block = msg.content[0];
    return block?.type === "text" ? block.text.trim() : "";
  } catch (err) {
    logger.warn({ err }, "Claude bulletin çağrısı başarısız");
    return "";
  }
}

export interface BulletinContent {
  headline: string;
  introText: string;
  threatRadar: string;
  turkeyData: string;
  regulationSection: string;
  weeklyTip: string;
  toolResource: string;
  emailSubject: string;
  emailPreview: string;
  emailHtml: string;
  linkedinMiniPost: string;
}

function findingLabel(type: string): string {
  const map: Record<string, string> = {
    no_dmarc: "DMARC eksikliği",
    no_spf: "SPF yapılandırma hatası",
    ssl_issue: "SSL sertifika sorunu",
    ssl_expiring: "Süresi dolmak üzere SSL",
    data_breach: "Veri ihlali kaydı",
    blacklisted: "Kara liste girişi",
  };
  return map[type] ?? type;
}

function getBaseUrl(): string {
  const domains = process.env["REPLIT_DOMAINS"];
  if (domains) return `https://${domains.split(",")[0]?.trim()}`;
  return "https://cyberstep.io";
}

function buildBulletinHTML(params: {
  weekNumber: number; year: number;
  headline: string; introText: string;
  threatRadar: string; turkeyData: string;
  regulationSection: string; weeklyTip: string;
  toolResource: string; data: WeeklyData;
}): string {
  const { weekNumber, year, headline, introText, data } = params;
  const base = getBaseUrl();

  const sections = [
    { emoji: "🚨", title: "Tehdit Radarında", content: params.threatRadar, color: "#FF4560",
      cta: data.topCVE ? { text: `${data.topCVE.cveId} detayları`, url: `${base}/cve/${data.topCVE.cveId}` } : null },
    { emoji: "📊", title: "Türkiye Verisi", content: params.turkeyData, color: "#00C8FF",
      cta: { text: "Aylık raporu indirin", url: `${base}/rapor` } },
    { emoji: "⚖️", title: "Mevzuat", content: params.regulationSection, color: "#FFB020", cta: null },
    { emoji: "✅", title: "Bu Hafta Yapın", content: params.weeklyTip, color: "#00E096",
      cta: { text: "Ücretsiz tarama", url: base } },
    { emoji: "🔧", title: "Araç / Kaynak", content: params.toolResource, color: "#A78BFA", cta: null },
  ];

  return `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CyberStep Haftalık Bülten — Hafta ${weekNumber}</title></head>
<body style="margin:0;padding:0;background:#0A1020;font-family:'Segoe UI',Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:20px">

<div style="background:#060D1A;border-radius:12px 12px 0 0;padding:32px;border-bottom:2px solid #00C8FF;margin-bottom:2px">
  <div style="margin-bottom:16px">
    <span style="font-size:24px;font-weight:900;color:#E8EDF5">Cyber</span>
    <span style="font-size:24px;font-weight:900;color:#00C8FF">Step</span>
    <span style="font-size:14px;color:#7B8FAF">.io</span>
    <span style="font-size:13px;color:#5A6A80;float:right;line-height:2">Haftalık İstihbarat | Hafta ${weekNumber}/${year}</span>
  </div>
  <div style="font-size:22px;font-weight:700;color:#E8EDF5;line-height:1.3;margin-bottom:16px">${headline}</div>
  <div style="font-size:15px;color:#A8B8D0;line-height:1.7;border-left:3px solid #00C8FF;padding-left:16px">${introText}</div>
</div>

${sections.map(s => `
<div style="background:#060D1A;margin-bottom:2px;padding:24px 32px">
  <div style="display:flex;align-items:center;margin-bottom:12px">
    <span style="font-size:20px;margin-right:10px">${s.emoji}</span>
    <span style="font-size:13px;font-weight:700;color:${s.color};text-transform:uppercase;letter-spacing:2px">${s.title}</span>
  </div>
  <div style="font-size:15px;color:#A8B8D0;line-height:1.7;margin-bottom:${s.cta ? "16px" : "0"}">${s.content}</div>
  ${s.cta ? `<a href="${s.cta.url}" style="color:${s.color};font-size:14px;font-weight:600;text-decoration:none">${s.cta.text} →</a>` : ""}
</div>`).join("")}

<div style="background:#060D1A;border-radius:0 0 12px 12px;padding:24px 32px;text-align:center;border-top:1px solid #111F35">
  <div style="font-size:16px;color:#A8B8D0;margin-bottom:16px">Şirketinizin risk skorunu öğrenin</div>
  <a href="${base}" style="display:inline-block;background:#00C8FF;color:#060D1A;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">Ücretsiz Domain Tarama →</a>
  <div style="margin-top:20px;font-size:12px;color:#5A6A80">
    CyberStep.io · Türkiye'nin Bağımsız Siber Güvenlik Platformu<br>
    <a href="{UNSUBSCRIBE_URL}" style="color:#5A6A80">Aboneliği iptal et</a> ·
    <a href="${base}/bulten/arsiv" style="color:#5A6A80">Arşiv</a>
  </div>
</div>

</div></body></html>`;
}

export async function generateBulletinContent(
  data: WeeklyData,
  weekNumber: number,
  year: number,
): Promise<BulletinContent> {
  const riskTrend = data.weeklyRiskChange > 0 ? "kötüleşiyor" : "iyileşiyor";
  const topFindingLabel = findingLabel(data.topFindingType);

  const headlinePrompt = `Bu haftanın en çarpıcı bulgusunu tek cümlede anlat. Maksimum 80 karakter. Rakam içermeli.
CVE: ${data.topCVE?.cveId ?? "yok"} (${data.topCVE?.trAffectedDomains ?? 0} TR domain)
En yaygın bulgu: ${topFindingLabel} (${data.topFindingCount} domain)
Risk trendi: ${riskTrend}
En riskli sektör: ${data.topSector ?? "bilinmiyor"}
Sadece başlığı yaz, açıklama yok.`;

  const introPrompt = `Bu haftanın bültenine kısa giriş yaz. Maksimum 3 cümle. Okuyucu devam etmek istesin.
${data.totalScans} domain taradık. Ortalama risk skoru: ${data.avgRiskScore.toFixed(0)}/100
Geçen haftaya göre: ${data.weeklyRiskChange > 0 ? "+" : ""}${data.weeklyRiskChange.toFixed(1)} değişim.
${data.newCriticalCVEs.length > 0 ? `Bu hafta ${data.newCriticalCVEs.length} kritik CVE yayınlandı.` : ""}`;

  const threatPrompt = data.topCVE
    ? `Bu haftanın en önemli güvenlik açığını anlat. Maksimum 4 cümle. Teknik değil, iş riski açısından.
CVE: ${data.topCVE.cveId} | CVSS: ${data.topCVE.cvssScore}
Etkilenen: ${data.topCVE.trAffectedDomains} Türk domain
Yama: ${data.topCVE.patchAvailable ? "Mevcut" : "Henüz yok"}
CISA KEV: ${data.topCVE.cisaKev ? "Evet — aktif istismar ediliyor" : "Hayır"}`
    : `Bu hafta kritik CVE yok. Genel tehdit trendini anlat.
${topFindingLabel} bu hafta en yaygın bulgu (${data.topFindingCount} domain etkilendi).
Türkiye'deki durumu kısaca değerlendir. Maksimum 3 cümle.`;

  const turkeyDataPrompt = `Bu haftanın Türkiye güvenlik verisini anlat. Maksimum 3 cümle + 1-2 madde.
Taranan domain: ${data.totalScans}
Ortalama skor: ${data.avgRiskScore.toFixed(0)}/100
Geçen haftaya fark: ${data.weeklyRiskChange.toFixed(1)}
En riskli sektör: ${data.topSector ?? "bilinmiyor"} (ort. ${data.topSectorAvgScore?.toFixed(0) ?? "?"}/100)
En yaygın açık: ${topFindingLabel}
Çarpıcı yaz. Soyut değil, somut.`;

  const regulationPrompt = `7545 Sayılı Siber Güvenlik Kanunu kapsamında bu hafta dikkat edilmesi gereken bir hatırlatma yaz.
Maksimum 2 cümle. Spesifik bir yükümlülüğü hatırlat. Okuyucuya "ne yapmalıyım" sorusunu yanıtla.`;

  const tipType = data.topFindingType === "no_dmarc" ? "DMARC yapılandırması"
    : data.topFindingType === "ssl_expiring" ? "SSL sertifika yenileme"
    : data.topCVE ? `${data.topCVE.cveId} yaması`
    : "genel güvenlik kontrol";

  const tipPrompt = `Bu hafta okuyucunun yapabileceği tek pratik güvenlik önlemini anlat.
Konu: ${tipType}
Format: "Yapılacak — Neden önemli / Süre: X dakika / Nasıl: 1-2 adım"
Maksimum 4 cümle toplam.`;

  const toolPrompt = `Güvenlik profesyoneline bu hafta işine yarayacak ücretsiz bir araç veya kaynak öner.
${data.topFindingType === "no_dmarc" ? "Tercih: MXToolbox (DNS/DMARC kontrolü)" : data.topCVE ? "Tercih: NVD veya CISA KEV listesi" : "Tercih: SSL Labs veya Have I Been Pwned"}
Maksimum 2 cümle. Araç adı + ne işe yarar + link.`;

  logger.info({ weekNumber, year }, "Bülten içeriği üretiliyor");

  const [headline, introText, threatRadar, turkeyData, regulationSection, weeklyTip, toolResource] =
    await Promise.all([
      callClaude(headlinePrompt, 100),
      callClaude(introPrompt, 150),
      callClaude(threatPrompt, 200),
      callClaude(turkeyDataPrompt, 200),
      callClaude(regulationPrompt, 150),
      callClaude(tipPrompt, 200),
      callClaude(toolPrompt, 100),
    ]);

  const base = getBaseUrl();
  const emailSubject = `CyberStep | Hafta ${weekNumber} — ${headline.slice(0, 60)}`;
  const emailPreview = introText.slice(0, 88);

  const emailHtml = buildBulletinHTML({
    weekNumber, year, headline, introText, threatRadar, turkeyData,
    regulationSection, weeklyTip, toolResource, data,
  });

  const linkedinMiniPost = `CyberStep Haftalık Bülten — Hafta ${weekNumber}

${introText}

${data.topCVE
  ? `Bu haftanın öne çıkanı: ${data.topCVE.cveId} — Türkiye'de ${data.topCVE.trAffectedDomains} şirket etkileniyor.`
  : `Bu haftanın öne çıkanı: ${topFindingLabel} Türkiye'de en yaygın açık olmaya devam ediyor.`
}

Haftalık bültene abone olun → ${base}/bulten

#SiberGüvenlik #CISO #Türkiye #Güvenlik`;

  logger.info({ weekNumber }, "Bülten içeriği üretildi");

  return {
    headline,
    introText,
    threatRadar,
    turkeyData,
    regulationSection,
    weeklyTip,
    toolResource,
    emailSubject,
    emailPreview,
    emailHtml,
    linkedinMiniPost,
  };
}
