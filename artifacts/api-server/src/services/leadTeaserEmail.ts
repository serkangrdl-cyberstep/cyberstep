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
import { leadCandidatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
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
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });
    const text =
      msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
    return (
      text ||
      `Bu bulgu, ${domain} için doğrudan iş sürekliliğini ve itibarı etkileyen bir güvenlik riskine işaret etmektedir.`
    );
  } catch {
    return `Bu bulgu, ${domain} için doğrudan iş sürekliliğini ve itibarı etkileyen bir güvenlik riskine işaret etmektedir.`;
  }
}

function buildHtmlEmail(params: {
  salutation: string;
  domain: string;
  score: number;
  findingTitle: string;
  findingSeverity: string;
  impactExplanation: string;
  reportUrl: string;
}): string {
  const { label: scoreText, color: scoreColor } = scoreStyle(params.score);
  const scanDate = new Date().toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
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
        <div style="color:#7B8FAF;font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:3px">Genel Risk Skoru</div>
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

  const topFinding = pickTopFinding(scanResult.findings);
  if (!topFinding) {
    logger.warn(
      { candidateId, domain: candidate.domain },
      "Teaser: bulgu listesi boş, atlanıyor",
    );
    return;
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
