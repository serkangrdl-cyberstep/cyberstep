import { db, domainScansTable } from "@workspace/db";
import { isNull, and, isNotNull, lt, gte, sql } from "drizzle-orm";
import { sendMail } from "./email";
import { logger } from "../lib/logger";

function getBaseUrl(): string {
  const domains = process.env["REPLIT_DOMAINS"];
  if (domains) return `https://${domains.split(",")[0]?.trim()}`;
  return "https://cyberstep.io";
}

interface TopFinding {
  title: string;
  detail: string;
  severity: "critical" | "high" | "medium" | "low";
}

function pickTopFinding(params: {
  criticalCveCount: number;
  hibpBreachCount: number;
  blacklisted: boolean;
  spfPass: boolean;
  dmarcPass: boolean;
  openPortsCount: number;
}): TopFinding {
  if (params.criticalCveCount > 0) {
    return {
      severity: "critical",
      title: `${params.criticalCveCount} kritik güvenlik açığı (CVSS 9+) tespit edildi`,
      detail: "Bu açıklar, saldırganların sisteminize uzaktan erişim sağlamasına veya veri çalmasına olanak tanıyabilir.",
    };
  }
  if (params.hibpBreachCount > 0) {
    return {
      severity: "high",
      title: `${params.hibpBreachCount} veri ihlali kaydına rastlandı`,
      detail: "Alan adınıza ait e-posta adresleri daha önce yaşanan veri sızıntılarında yer alıyor — kimlik bilgisi saldırılarına açık olabilirsiniz.",
    };
  }
  if (params.blacklisted) {
    return {
      severity: "critical",
      title: "Alan adı kara listede görünüyor",
      detail: "E-postalarınız spam filtrelerinde engelleniyor olabilir; bu durum iş iletişimini ve itibarı doğrudan etkiler.",
    };
  }
  if (!params.dmarcPass) {
    return {
      severity: "high",
      title: "DMARC kaydı eksik — e-posta sahteciliğine açık",
      detail: "Saldırganlar alan adınız adına sahte e-posta gönderebilir; fatura dolandırıcılığı ve CEO sahtekarlığı saldırılarında yaygın kullanılan bir yöntemdir.",
    };
  }
  if (!params.spfPass) {
    return {
      severity: "medium",
      title: "SPF kaydı eksik — e-posta kimlik doğrulama zayıf",
      detail: "E-postalarınızın meşruiyetini kanıtlayan temel güvenlik kaydı mevcut değil; bu phishing riskini artırır.",
    };
  }
  if (params.openPortsCount > 5) {
    return {
      severity: "medium",
      title: `${params.openPortsCount} açık port — saldırı yüzeyi geniş`,
      detail: "İnternet'e gereksiz yere açık portlar, saldırganlara sisteminizi keşfetme ve hedefleme fırsatı verir.",
    };
  }
  return {
    severity: "low",
    title: "Temel kontrollerde kritik bulgu tespit edilmedi",
    detail: "Temel güvenlik yapılandırmanız yerinde görünüyor. Detaylı analiz için tam raporu inceleyin.",
  };
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
}): { subject: string; html: string } {
  const baseUrl = getBaseUrl();
  const topFinding = pickTopFinding(params);

  const scoreColor =
    params.score >= 80 ? "#00E096" : params.score >= 50 ? "#FFB020" : "#FF4560";
  const scoreLabel =
    params.score >= 80 ? "Düşük Risk" : params.score >= 50 ? "Orta Risk" : "Yüksek Risk";

  const findingColor =
    topFinding.severity === "critical" || topFinding.severity === "high"
      ? "#FF4560"
      : topFinding.severity === "medium"
        ? "#FFB020"
        : "#00E096";

  const subject =
    topFinding.severity === "low"
      ? `${params.domain} güvenlik raporunuz — ${params.score}/100`
      : `${params.domain} — Tespit ettiğimiz ${topFinding.severity === "critical" ? "kritik" : topFinding.severity === "high" ? "yüksek" : "orta önem dereceli"} bulgu hâlâ açık`;

  const html = `
<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#060D1A;color:#E8EDF5;padding:32px;border-radius:12px">
  <div style="margin-bottom:24px">
    <span style="color:#E8EDF5;font-weight:bold;font-size:22px">Cyber</span><span style="color:#00C8FF;font-weight:bold;font-size:22px">Step</span><span style="color:#7B8FAF;font-size:14px">.io</span>
  </div>

  <h2 style="color:#E8EDF5;margin:0 0 8px;font-size:20px">${params.domain} — Güvenlik Tarama Özeti</h2>
  <p style="color:#A8B8D0;margin:0 0 24px;font-size:14px;line-height:1.6">Gerçekleştirdiğiniz ücretsiz güvenlik taramasında öne çıkan bulguyu paylaşmak istedik.</p>

  <div style="background:rgba(0,200,255,0.05);border:1px solid rgba(0,200,255,0.2);border-radius:10px;padding:20px;margin-bottom:20px;display:flex;align-items:center;gap:20px">
    <div style="text-align:center;min-width:70px">
      <div style="font-size:34px;font-weight:bold;color:${scoreColor}">${params.score}</div>
      <div style="font-size:11px;color:${scoreColor};font-weight:600">${scoreLabel}</div>
      <div style="font-size:10px;color:#5A6A80;margin-top:2px">/ 100</div>
    </div>
    <div style="flex:1;color:#A8B8D0;font-size:13px;line-height:1.6">
      Genel risk skorunuz, halka açık DNS, sertifika ve ağ kayıtları üzerinden hesaplandı.
    </div>
  </div>

  <div style="background:rgba(255,255,255,0.03);border-left:3px solid ${findingColor};border-radius:0 8px 8px 0;padding:16px;margin-bottom:24px">
    <div style="color:#7B8FAF;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px">Öne Çıkan Bulgu</div>
    <div style="color:#E8EDF5;font-size:14px;font-weight:600;margin-bottom:8px">${topFinding.title}</div>
    <div style="color:#A8B8D0;font-size:13px;line-height:1.6">${topFinding.detail}</div>
  </div>

  <div style="background:rgba(0,200,255,0.05);border:1px solid rgba(0,200,255,0.15);border-radius:8px;padding:16px;margin-bottom:24px">
    <div style="color:#A8B8D0;font-size:13px;line-height:1.7">
      Tam rapor, AI destekli aksiyon planı ve sürekli izleme için ücretsiz hesap oluşturun —
      <strong style="color:#E8EDF5">kayıt gerektirmez, raporunuz hazır</strong>.
    </div>
  </div>

  <a href="${baseUrl}/kayit" style="display:block;background:#00C8FF;color:#060D1A;text-align:center;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;margin-bottom:12px">
    Ücretsiz Hesap Oluştur
  </a>
  <a href="${baseUrl}/tarama?domain=${encodeURIComponent(params.domain)}" style="display:block;background:transparent;color:#00C8FF;border:1px solid rgba(0,200,255,0.3);text-align:center;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:13px">
    Raporu Tekrar Görüntüle
  </a>

  <p style="font-size:11px;color:#5A6A80;margin-top:24px;line-height:1.6;text-align:center">
    Bu e-posta ${params.domain} için ücretsiz tarama yaptığınız için gönderildi.<br>
    Artık almak istemiyorsanız lütfen <a href="mailto:privacy@cyberstep.io" style="color:#5A6A80;text-decoration:underline">privacy@cyberstep.io</a> adresine yazın.
  </p>
</div>`.trim();

  return { subject, html };
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
      const { subject, html } = buildFollowUpEmail({
        domain: scan.domain,
        score: scan.overallScore,
        criticalCveCount: scan.criticalCveCount,
        hibpBreachCount: scan.hibpBreachCount,
        blacklisted: scan.blacklisted,
        spfPass: scan.spfPass,
        dmarcPass: scan.dmarcPass,
        openPortsCount: scan.openPortsCount,
      });

      await sendMail({ to: scan.email, subject, html });

      await db
        .update(domainScansTable)
        .set({ notifiedAt: new Date() })
        .where(sql`id = ${scan.id}`);

      sent++;
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      logger.warn(
        { err, domain: scan.domain },
        "free_scan_followup: e-posta gönderilemedi",
      );
    }
  }

  logger.info({ sent }, "free_scan_followup: tamamlandı");
  return sent;
}
