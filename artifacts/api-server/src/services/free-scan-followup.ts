import { db, domainScansTable } from "@workspace/db";
import { isNull, and, isNotNull, lt, gte, sql } from "drizzle-orm";
import { sendMail } from "./email";
import { logger } from "../lib/logger";

function getBaseUrl(): string {
  const domains = process.env["REPLIT_DOMAINS"];
  if (domains) return `https://${domains.split(",")[0]?.trim()}`;
  return "https://cyberstep.io";
}

function buildFollowUpEmail(params: {
  domain: string;
  score: number;
  criticalCveCount: number;
  hibpBreachCount: number;
  blacklisted: boolean;
  spfPass: boolean;
  dmarcPass: boolean;
  openPortsCount: number;
}): string {
  const baseUrl = getBaseUrl();

  const scoreColor = params.score >= 80 ? "#00E096" : params.score >= 50 ? "#FFB020" : "#FF4560";
  const scoreLabel = params.score >= 80 ? "Düşük Risk" : params.score >= 50 ? "Orta Risk" : "Yüksek Risk";

  const findings: string[] = [];
  if (params.criticalCveCount > 0)
    findings.push(`<li style="margin-bottom:8px;color:#FF4560"><strong>${params.criticalCveCount} kritik güvenlik açığı (CVSS 9+)</strong> tespit edildi</li>`);
  if (params.hibpBreachCount > 0)
    findings.push(`<li style="margin-bottom:8px;color:#FFB020"><strong>${params.hibpBreachCount} veri ihlali</strong> kaydına rastlandı</li>`);
  if (params.blacklisted)
    findings.push(`<li style="margin-bottom:8px;color:#FF4560"><strong>Alan adı kara listede</strong> görünüyor</li>`);
  if (!params.spfPass)
    findings.push(`<li style="margin-bottom:8px;color:#A8B8D0">SPF kaydı eksik — e-posta sahteciliğine açık</li>`);
  if (!params.dmarcPass)
    findings.push(`<li style="margin-bottom:8px;color:#A8B8D0">DMARC kaydı eksik — phishing koruması yok</li>`);
  if (params.openPortsCount > 5)
    findings.push(`<li style="margin-bottom:8px;color:#A8B8D0"><strong>${params.openPortsCount} açık port</strong> — saldırı yüzeyi geniş</li>`);

  const findingsHtml = findings.length > 0
    ? `<ul style="list-style:none;padding:0;margin:16px 0">${findings.join("")}</ul>`
    : `<p style="color:#00E096">Temel kontrollerde kritik bir bulgu tespit edilmedi.</p>`;

  return `
<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#060D1A;color:#E8EDF5;padding:32px;border-radius:12px">
  <div style="margin-bottom:24px">
    <span style="color:#E8EDF5;font-weight:bold;font-size:22px">Cyber</span><span style="color:#00C8FF;font-weight:bold;font-size:22px">Step</span><span style="color:#7B8FAF;font-size:14px">.io</span>
  </div>

  <h2 style="color:#E8EDF5;margin:0 0 8px;font-size:20px">${params.domain} tarama sonuçlarınız hazır</h2>
  <p style="color:#A8B8D0;margin:0 0 24px">Dün gerçekleştirdiğiniz ücretsiz güvenlik taramasının önemli bulgularını paylaşmak istedik.</p>

  <div style="background:rgba(0,200,255,0.05);border:1px solid rgba(0,200,255,0.2);border-radius:10px;padding:20px;margin-bottom:24px;display:flex;align-items:center;gap:20px">
    <div style="text-align:center;min-width:80px">
      <div style="font-size:36px;font-weight:bold;color:${scoreColor}">${params.score}</div>
      <div style="font-size:12px;color:${scoreColor};font-weight:600">${scoreLabel}</div>
      <div style="font-size:11px;color:#5A6A80;margin-top:2px">/ 100</div>
    </div>
    <div style="flex:1">
      <div style="color:#A8B8D0;font-size:14px;line-height:1.6">
        Güvenlik skorunuz sektör ortalamasıyla karşılaştırıldığında
        ${params.score >= 70 ? "iyi bir konumda, ancak iyileştirme alanları mevcut." : "dikkat gerektiriyor. Aşağıdaki bulguları inceleyin."}
      </div>
    </div>
  </div>

  <div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:16px;margin-bottom:24px">
    <div style="color:#7B8FAF;font-size:12px;font-weight:600;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px">Öne Çıkan Bulgular</div>
    ${findingsHtml}
  </div>

  <div style="background:rgba(0,200,255,0.05);border:1px solid rgba(0,200,255,0.15);border-radius:8px;padding:16px;margin-bottom:24px">
    <div style="color:#A8B8D0;font-size:14px;line-height:1.7">
      Tam rapor, AI destekli aksiyon planı ve sürekli izleme için hesap oluşturun.
      <strong style="color:#E8EDF5">İlk 30 gün ücretsiz.</strong>
    </div>
  </div>

  <a href="${baseUrl}/kayit" style="display:block;background:#00C8FF;color:#060D1A;text-align:center;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;margin-bottom:16px">
    Ücretsiz Hesap Oluştur
  </a>
  <a href="${baseUrl}/tarama?domain=${encodeURIComponent(params.domain)}" style="display:block;background:transparent;color:#00C8FF;border:1px solid rgba(0,200,255,0.3);text-align:center;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px">
    Tam Raporu Gör
  </a>

  <p style="font-size:12px;color:#5A6A80;margin-top:24px;line-height:1.6;text-align:center">
    Bu e-posta ${params.domain} için ücretsiz tarama yaptığınız için gönderildi.<br>
    Artık almak istemiyorsanız lütfen security@cyberstep.io adresine yazın.
  </p>
</div>`.trim();
}

export async function runFreeScanFollowup(): Promise<number> {
  logger.info("free_scan_followup: ücretsiz tarama takip e-postası başladı");

  const now = new Date();
  const window24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const window72h = new Date(now.getTime() - 72 * 60 * 60 * 1000);

  const scans = await db
    .select()
    .from(domainScansTable)
    .where(
      and(
        isNull(domainScansTable.tenantId),
        isNotNull(domainScansTable.email),
        isNull(domainScansTable.notifiedAt),
        lt(domainScansTable.createdAt, window24h),
        gte(domainScansTable.createdAt, window72h),
      ),
    )
    .limit(50);

  if (scans.length === 0) {
    logger.info("free_scan_followup: takip edilecek tarama bulunamadı");
    return 0;
  }

  logger.info({ count: scans.length }, "free_scan_followup: taramalar bulundu");

  let sent = 0;
  for (const scan of scans) {
    if (!scan.email) continue;
    try {
      const html = buildFollowUpEmail({
        domain:          scan.domain,
        score:           scan.overallScore,
        criticalCveCount: scan.criticalCveCount,
        hibpBreachCount:  scan.hibpBreachCount,
        blacklisted:      scan.blacklisted,
        spfPass:          scan.spfPass,
        dmarcPass:        scan.dmarcPass,
        openPortsCount:   scan.openPortsCount,
      });

      await sendMail({
        to: scan.email,
        subject: `${scan.domain} güvenlik raporunuz — ${scan.overallScore}/100`,
        html,
      });

      await db
        .update(domainScansTable)
        .set({ notifiedAt: new Date() })
        .where(sql`id = ${scan.id}`);

      sent++;
      await new Promise(r => setTimeout(r, 400));
    } catch (err) {
      logger.warn({ err, domain: scan.domain }, "free_scan_followup: e-posta gönderilemedi");
    }
  }

  logger.info({ sent }, "free_scan_followup: tamamlandı");
  return sent;
}
