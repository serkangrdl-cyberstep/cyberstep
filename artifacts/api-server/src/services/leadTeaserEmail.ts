/**
 * Bulgu-odaklı teaser e-posta üretimi.
 *
 * Tasarım ilkeleri:
 * - Şirket tanıtımıyla değil, spesifik bulguyla açılır
 * - Claude yalnızca tek bulgunun 1-2 cümle iş etkisi açıklaması için kullanılır
 * - Konu: "[Şirket] için güvenlik taramamızda 1 [önem] bulgu tespit edildi"
 * - Tek CTA: "RAPORUMU GÖRÜNTÜLE →" (kayıt gerektirmez)
 * - Pasif tarama şeffaflık notu
 */
import { db } from "@workspace/db";
import { leadCandidatesTable, domainScansTable, domainScanSubdomainsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { callModel } from "@workspace/ai";
import { logger } from "../lib/logger";

function getBaseUrl(): string {
  const domains = process.env["REPLIT_DOMAINS"];
  if (domains) return `https://${domains.split(",")[0]?.trim()}`;
  return "https://cyberstep.io";
}

function scoreStyle(score: number): { label: string; color: string } {
  if (score < 30) return { label: "Kritik Risk", color: "#FF4560" };
  if (score < 50) return { label: "Yüksek Risk", color: "#FF4560" };
  if (score < 70) return { label: "Orta Risk", color: "#FFB020" };
  return { label: "Düşük Risk", color: "#00E096" };
}

function severityLabel(severity: string): string {
  if (severity === "critical") return "kritik";
  if (severity === "high") return "yüksek";
  if (severity === "medium") return "orta";
  return "önemli";
}

function pickTopFinding(
  findings: Array<{ severity: string; title: string }>,
): { severity: string; title: string } | null {
  return (
    findings.find((f) => f.severity === "critical") ??
    findings.find((f) => f.severity === "high") ??
    findings.find((f) => f.severity === "medium") ??
    findings[0] ??
    null
  );
}

async function generateImpactExplanation(
  domain: string,
  findingTitle: string,
  severity: string,
): Promise<string> {
  const prompt = `Bir siber güvenlik uzmanısın. Aşağıdaki güvenlik bulgusunu, teknik jargon kullanmadan, iş sonucu odaklı 1-2 Türkçe cümleyle açıkla.

Alan adı: ${domain}
Bulgu: ${findingTitle}
Önem: ${severityLabel(severity)}

Kurallar:
- Teknik terimlerden kaçın — saldırı senaryosunu iş diliyle anlat
- Somut risk veya zarar türünü belirt (dolandırıcılık, veri kaybı, servis kesintisi vb.)
- Max 55 kelime, 1-2 cümle
- Emoji kullanma
- Yalnızca açıklama metnini yaz`;

  try {
    const text = await callModel({
      task: "lead-teaser",
      messages: [{ role: "user", content: prompt }],
      maxTokens: 150,
    });
    return (
      text ||
      `Bu bulgu, ${domain} için doğrudan iş sürekliliğini ve itibarı etkileyen bir güvenlik riskine işaret etmektedir.`
    );
  } catch {
    return `Bu bulgu, ${domain} için doğrudan iş sürekliliğini ve itibarı etkileyen bir güvenlik riskine işaret etmektedir.`;
  }
}

function buildConfidenceDisclaimer(scan: {
  wafDetected: boolean;
  wafProvider: string | null;
  confidenceScore: number | null;
}): string {
  if (!scan.wafDetected || !scan.confidenceScore || scan.confidenceScore >= 85) return "";

  const providerText = scan.wafProvider
    ? `${scan.wafProvider} altyapısı`
    : "bir güvenlik duvarı/CDN";

  return `
  <div style="margin:0 32px 20px;background:#FFF6E8;border:1px solid #F5A623;border-radius:8px;padding:16px 18px">
    <div style="color:#F5A623;font-weight:700;font-size:12px;margin-bottom:8px;letter-spacing:0.3px">
      TARAMA GÖRÜNÜRLÜĞÜ HAKKINDA
    </div>
    <p style="margin:0 0 8px;color:#1A2B45;font-size:12px;line-height:1.6">
      Bu domain <strong>${providerText}</strong> arkasında çalışıyor. Bu durumda:
    </p>
    <p style="margin:0 0 6px;color:#1A2B45;font-size:12px;line-height:1.6">
      <span style="color:#22863a;font-weight:600">Tam güvenilir:</span> E-posta güvenliği (SPF/DKIM/DMARC) ve SSL sertifika bulguları — bunlar DNS ve sertifika katmanından doğrudan okunur.
    </p>
    <p style="margin:0 0 8px;color:#1A2B45;font-size:12px;line-height:1.6">
      <span style="color:#B45309;font-weight:600">Doğrulama önerilir:</span> Web sunucusu/uygulama katmanına dair bulgular (açık portlar, sürüm bilgileri, CVE eşleşmeleri) ${providerText} tarafından maskelenmiş olabilir.
    </p>
    <p style="margin:0;color:#5A6A80;font-size:11px;line-height:1.5">
      Bu rapor halka açık OSINT verilerine dayalı ön değerlendirmedir. Kesin analiz için iç ağdan yapılan bir tarama önerilir — CyberStep ekibi bu hizmeti de sunmaktadır.
    </p>
  </div>`;
}

function buildHtmlEmail(params: {
  salutation: string;
  domain: string;
  score: number;
  findingTitle: string;
  findingSeverity: string;
  impactExplanation: string;
  reportUrl: string;
  wafDetected?: boolean;
  wafProvider?: string | null;
  confidenceScore?: number | null;
  assetSummaryLine?: string | null;
}): string {
  const { label: scoreText, color: scoreColor } = scoreStyle(params.score);
  const scanDate = new Date().toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const isPartialVisibility = params.wafDetected && params.confidenceScore != null && params.confidenceScore < 85;
  const disclaimer = buildConfidenceDisclaimer({
    wafDetected: params.wafDetected ?? false,
    wafProvider: params.wafProvider ?? null,
    confidenceScore: params.confidenceScore ?? null,
  });

  return `
<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#060D1A;color:#E8EDF5;border-radius:12px;overflow:hidden">

  <div style="padding:28px 32px 20px">
    <span style="color:#E8EDF5;font-weight:bold;font-size:22px">Cyber</span><span style="color:#00C8FF;font-weight:bold;font-size:22px">Step</span><span style="color:#7B8FAF;font-size:14px">.io</span>
  </div>

  <div style="padding:0 32px 20px">
    <p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#E8EDF5">${params.salutation}</p>
    <p style="margin:0;color:#A8B8D0;font-size:14px;line-height:1.7">
      ${scanDate} tarihinde <strong style="color:#E8EDF5">${params.domain}</strong> alan adınız için gerçekleştirdiğimiz pasif güvenlik taramasında dikkat çekici bir bulguya rastladık.
    </p>
  </div>

  <div style="margin:0 32px 20px;background:rgba(255,255,255,0.04);border:1px solid rgba(0,200,255,0.2);border-radius:10px;overflow:hidden">
    <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.07);display:flex;align-items:center;gap:16px">
      <div style="text-align:center;min-width:56px">
        <div style="font-size:30px;font-weight:bold;color:${scoreColor};line-height:1">${params.score}</div>
        <div style="font-size:10px;color:${scoreColor};font-weight:700;margin-top:2px;text-transform:uppercase;letter-spacing:0.3px">${scoreText}</div>
        <div style="font-size:10px;color:#5A6A80;margin-top:1px">/ 100</div>
      </div>
      <div style="width:1px;height:44px;background:rgba(255,255,255,0.1);flex-shrink:0"></div>
      <div style="flex:1">
        <div style="color:#7B8FAF;font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:3px">
          Genel Risk Skoru${isPartialVisibility ? ' <span style="background:#F5A623;color:#1A2B45;font-size:9px;padding:1px 5px;border-radius:3px;margin-left:4px;font-weight:700">Kısmi Görünürlük</span>' : ''}
        </div>
        <div style="color:#A8B8D0;font-size:12px;line-height:1.5">Halka açık DNS, sertifika ve ağ kayıtları analiz edilerek hesaplandı</div>
      </div>
    </div>
    <div style="padding:16px 20px">
      <div style="color:#7B8FAF;font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px">Öne Çıkan Bulgu</div>
      <div style="color:#E8EDF5;font-size:14px;font-weight:600;margin-bottom:8px">${params.findingTitle}</div>
      <div style="color:#A8B8D0;font-size:13px;line-height:1.65">${params.impactExplanation}</div>
    </div>
  </div>

  <div style="padding:0 32px 20px">
    <p style="margin:0;color:#5A6A80;font-size:12px;line-height:1.65;border-left:2px solid rgba(0,200,255,0.25);padding-left:12px">
      Bu tarama, halka açık DNS kayıtları, sertifika şeffaflık logları ve ağ keşif verileri üzerinden tamamen pasif olarak gerçekleştirildi — sisteminize herhangi bir erişim sağlanmadı.
    </p>
  </div>

  ${params.assetSummaryLine ? `
  <div style="margin:0 32px 20px;padding:12px 16px;background:rgba(0,200,255,0.06);border:1px solid rgba(0,200,255,0.15);border-radius:8px">
    <p style="margin:0;color:#A8B8D0;font-size:13px;line-height:1.65">${params.assetSummaryLine}</p>
  </div>` : ""}

  ${disclaimer}

  <div style="padding:0 32px 20px">
    <p style="margin:0 0 16px;color:#A8B8D0;font-size:13px;line-height:1.65">
      Türkiye'deki şirketlerin %65,2'si son 12 ayda en az bir siber saldırıya uğradı <span style="color:#5A6A80">(Fortinet Türkiye / DORinsight 2025)</span>. Sizin için hazırladığımız raporu görüntülemek için aşağıdaki butona tıklayabilirsiniz — kayıt gerektirmez, raporunuz hazır.
    </p>
    <a href="${params.reportUrl}" style="display:block;background:#00C8FF;color:#060D1A;text-align:center;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;letter-spacing:0.2px">
      RAPORUMU G&Ouml;R&Uuml;NTÜLE &rarr;
    </a>
  </div>

  <div style="padding:8px 32px 28px">
    <p style="margin:0;color:#A8B8D0;font-size:13px;line-height:1.6">
      Saygılarımızla,<br>
      <strong style="color:#E8EDF5">CyberStep.io Ekibi</strong><br>
      <span style="color:#5A6A80;font-size:11px">Türkiye merkezli siber güvenlik risk analizi platformu</span>
    </p>
    <p style="margin:12px 0 0;color:#5A6A80;font-size:11px;line-height:1.5;border-top:1px solid rgba(255,255,255,0.05);padding-top:10px">
      Bu rapor, <strong style="color:#00C8FF">Step AI</strong> — CyberStep'in yapay zeka güvenlik analisti — tarafından otomatik olarak hazırlanmış ve uzman ekibimiz tarafından gözden geçirilmiştir.
    </p>
  </div>

  <div style="background:rgba(0,0,0,0.25);padding:14px 32px;border-top:1px solid rgba(255,255,255,0.05)">
    <p style="margin:0;color:#5A6A80;font-size:11px;line-height:1.65;text-align:center">
      Bu e-posta, <strong>${params.domain}</strong> alan adına ait halka açık kayıtların pasif analizi sonucunda gönderilmiştir.<br>
      Tarafımızla iletişime geçmek istemiyorsanız <a href="mailto:privacy@cyberstep.io" style="color:#5A6A80;text-decoration:underline">buradan bildirebilirsiniz</a>.
    </p>
  </div>

</div>`.trim();
}

export async function generateLeadTeaserEmail(
  candidateId: number,
  scanResult: { overallScore: number; findings: Array<{ severity: string; title: string }> },
): Promise<void> {
  const [candidate] = await db
    .select()
    .from(leadCandidatesTable)
    .where(eq(leadCandidatesTable.id, candidateId));
  if (!candidate) return;

  let topFinding = pickTopFinding(scanResult.findings);
  if (!topFinding) {
    const score = scanResult.overallScore;
    if (score < 40) {
      topFinding = { severity: "critical", title: "E-posta güvenlik altyapısında kritik açıklar tespit edildi" };
    } else if (score < 55) {
      topFinding = { severity: "high", title: "Dış saldırı yüzeyinde yüksek riskli güvenlik zafiyeti tespit edildi" };
    } else if (score < 70) {
      topFinding = { severity: "medium", title: "Ağ ve uygulama katmanında orta seviye güvenlik riskleri tespit edildi" };
    } else {
      topFinding = { severity: "medium", title: "Güvenlik iyileştirme fırsatları tespit edildi" };
    }
    logger.info(
      { candidateId, domain: candidate.domain, score, syntheticFinding: topFinding.title },
      "Teaser: bulgu listesi boş — sentetik fallback bulgu kullanıldı",
    );
  }

  // WAF/confidence verisi — candidate.scanId üzerinden domain_scans'tan çekiliyor
  let wafDetected = false;
  let wafProvider: string | null = null;
  let confidenceScore: number | null = null;
  if (candidate.scanId) {
    const [scan] = await db
      .select({
        wafDetected: domainScansTable.wafDetected,
        wafProvider: domainScansTable.wafProvider,
        confidenceScore: domainScansTable.confidenceScore,
      })
      .from(domainScansTable)
      .where(eq(domainScansTable.id, candidate.scanId));
    if (scan) {
      wafDetected = scan.wafDetected ?? false;
      wafProvider = scan.wafProvider ?? null;
      confidenceScore = scan.confidenceScore ?? null;
    }
  }

  // Varlık sınıflandırması özeti — domain_scan_subdomains tablosundan
  let assetSummaryLine: string | null = null;
  if (candidate.scanId) {
    const rows = await db.select({
      classification: domainScanSubdomainsTable.assetClassification,
      cnt: sql<number>`count(*)::int`,
    }).from(domainScanSubdomainsTable)
      .where(eq(domainScanSubdomainsTable.scanId, candidate.scanId))
      .groupBy(domainScanSubdomainsTable.assetClassification);
    const total = rows.reduce((s, r) => s + r.cnt, 0);
    if (total > 1) {
      const webApps = rows.find(r => r.classification === "web_app")?.cnt ?? 0;
      const apis = rows.find(r => r.classification === "api")?.cnt ?? 0;
      const parts = [
        webApps > 0 ? `${webApps} web uygulaması` : null,
        apis > 0 ? `${apis} API` : null,
      ].filter(Boolean).join(", ");
      assetSummaryLine = `Taramamız, ${candidate.domain} altında toplam ${total} dijital varlık tespit etti${parts ? ` (${parts} dahil)` : ""}. Bu varlıkların güvenlik durumunu yönetmek, saldırı yüzeyinizi küçültmenin ilk adımıdır.`;
    }
  }

  const salutation = candidate.contactName
    ? `Sayın ${candidate.contactName},`
    : `Sayın ${candidate.companyName ? candidate.companyName + " Yöneticisi," : "Yetkili,"}`;

  const impactExplanation = await generateImpactExplanation(
    candidate.domain,
    topFinding.title,
    topFinding.severity,
  );

  const baseUrl = getBaseUrl();
  const reportUrl = `${baseUrl}/tarama?domain=${encodeURIComponent(candidate.domain)}`;

  const companyLabel = candidate.companyName ?? candidate.domain;
  const subject = `${companyLabel} için güvenlik taramamızda 1 ${severityLabel(topFinding.severity)} bulgu tespit edildi`;

  const htmlBody = buildHtmlEmail({
    salutation,
    domain: candidate.domain,
    score: scanResult.overallScore,
    findingTitle: topFinding.title,
    findingSeverity: topFinding.severity,
    impactExplanation,
    reportUrl,
    wafDetected,
    wafProvider,
    confidenceScore,
    assetSummaryLine,
  });

  await db
    .update(leadCandidatesTable)
    .set({
      teaserSubject: subject,
      teaserBody: htmlBody,
      teaserGeneratedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(leadCandidatesTable.id, candidateId));

  logger.info(
    {
      candidateId,
      domain: candidate.domain,
      topFinding: topFinding.title,
      severity: topFinding.severity,
    },
    "Teaser üretildi",
  );
}
