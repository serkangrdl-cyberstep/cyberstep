/**
 * Tier geçiş bildirimleri — Dönüşüm akışı Aşama 4
 *
 * Tier 2'deki bir domain yeniden tarandığında sonuç değişmişse tetiklenir:
 *
 * - notifyFindingFixed()    : Bulgu düzeltilmişse pozitif takip (ilişki kurma, satış baskısı yok)
 * - notifyNewFinding()      : Yeni/ağırlaşan bulgu → yeni teaser tetikler
 *
 * Entegrasyon: qualifyPendingCandidates() içinde, domain önceden scan_status='scanned'
 * durumundayken yeniden işlendiğinde çağrılır.
 *
 * Kullanım örneği:
 *   const prev = candidate.overallScore ?? 100;
 *   if (newScore > prev + 10) {
 *     await notifyFindingFixed(candidate, prev, newScore, fixedFinding);
 *   } else if (newFindingDetected) {
 *     await notifyNewFinding(candidate, newFinding, scanResult);
 *   }
 */
import { db } from "@workspace/db";
import { leadCandidatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendMail } from "./email";
import { generateLeadTeaserEmail } from "./leadTeaserEmail";
import { logger } from "../lib/logger";

interface LeadCandidate {
  id: number;
  domain: string;
  companyName: string | null;
  contactEmail: string | null;
  contactName: string | null;
}

interface ScanResult {
  overallScore: number;
  findings: Array<{ severity: string; title: string }>;
}

function getBaseUrl(): string {
  const domains = process.env["REPLIT_DOMAINS"];
  if (domains) return `https://${domains.split(",")[0]?.trim()}`;
  return "https://cyberstep.io";
}

function buildFixedFindingEmail(params: {
  domain: string;
  companyLabel: string;
  fixedFinding: string;
  oldScore: number;
  newScore: number;
}): { subject: string; html: string } {
  const baseUrl = getBaseUrl();
  const subject = `${params.companyLabel} — ${params.fixedFinding.toLowerCase().replace(/\.$/, "")} düzeltilmiş görünüyor`;

  const html = `
<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#060D1A;color:#E8EDF5;padding:32px;border-radius:12px">
  <div style="margin-bottom:24px">
    <span style="color:#E8EDF5;font-weight:bold;font-size:22px">Cyber</span><span style="color:#00C8FF;font-weight:bold;font-size:22px">Step</span><span style="color:#7B8FAF;font-size:14px">.io</span>
  </div>

  <div style="background:rgba(0,224,150,0.08);border:1px solid rgba(0,224,150,0.25);border-radius:10px;padding:20px;margin-bottom:24px">
    <div style="color:#00E096;font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px">Güvenlik Geliştirmesi Tespit Edildi</div>
    <div style="color:#E8EDF5;font-size:14px;font-weight:600;margin-bottom:8px">${params.fixedFinding}</div>
    <div style="color:#A8B8D0;font-size:13px;line-height:1.6">
      Daha önce <strong style="color:#FF4560">${params.oldScore}/100</strong> olan güvenlik skorunuz yeniden taramamızda
      <strong style="color:#00E096">${params.newScore}/100</strong> seviyesine yükseldi.
    </div>
  </div>

  <p style="color:#A8B8D0;font-size:14px;line-height:1.7;margin:0 0 24px">
    ${params.domain} alan adınızdaki bu güvenlik iyileştirmeyi kayıtlarımızda tespit ettik.
    Tebrikler — bu adım, sisteminizin saldırı yüzeyini anlamlı ölçüde küçülttü.
  </p>

  <a href="${baseUrl}/tarama?domain=${encodeURIComponent(params.domain)}" style="display:block;background:#00C8FF;color:#060D1A;text-align:center;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;margin-bottom:24px">
    Güncel Raporu Görüntüle &rarr;
  </a>

  <p style="font-size:12px;color:#5A6A80;margin:0;line-height:1.6;text-align:center">
    CyberStep.io — Türkiye merkezli siber güvenlik risk analizi platformu<br>
    Bu e-posta, ${params.domain} alan adına ait halka açık kayıtların periyodik analizi sonucunda gönderilmiştir.
  </p>
</div>`.trim();

  return { subject, html };
}

/**
 * Bulgu düzeltildiğinde pozitif takip e-postası gönderir.
 * contactEmail olmayan candidateler sessizce atlanır.
 */
export async function notifyFindingFixed(
  candidate: LeadCandidate,
  oldScore: number,
  newScore: number,
  fixedFinding: string,
): Promise<void> {
  if (!candidate.contactEmail) return;

  const companyLabel = candidate.companyName ?? candidate.domain;

  try {
    const { subject, html } = buildFixedFindingEmail({
      domain: candidate.domain,
      companyLabel,
      fixedFinding,
      oldScore,
      newScore,
    });

    await sendMail({ to: candidate.contactEmail, subject, html });

    logger.info(
      { candidateId: candidate.id, domain: candidate.domain, oldScore, newScore },
      "tierTransitionNotifier: düzeltme bildirimi gönderildi",
    );
  } catch (err) {
    logger.warn(
      { candidateId: candidate.id, domain: candidate.domain, err: String(err) },
      "tierTransitionNotifier: düzeltme bildirimi gönderilemedi",
    );
  }
}

/**
 * Yeni veya ağırlaşan bulgu tespit edildiğinde yeni teaser üretir ve
 * lead_candidates.teaser_generated_at'ı sıfırlar — drip sistemi bunu yeni
 * bir teaser olarak değerlendirip gönderir.
 */
export async function notifyNewFinding(
  candidate: LeadCandidate,
  scanResult: ScanResult,
): Promise<void> {
  try {
    await db
      .update(leadCandidatesTable)
      .set({ teaserGeneratedAt: null, updatedAt: new Date() })
      .where(eq(leadCandidatesTable.id, candidate.id));

    await generateLeadTeaserEmail(candidate.id, scanResult);

    logger.info(
      { candidateId: candidate.id, domain: candidate.domain, score: scanResult.overallScore },
      "tierTransitionNotifier: yeni bulgu — teaser yeniden üretildi",
    );
  } catch (err) {
    logger.warn(
      { candidateId: candidate.id, domain: candidate.domain, err: String(err) },
      "tierTransitionNotifier: yeni bulgu teaser üretimi başarısız",
    );
  }
}
