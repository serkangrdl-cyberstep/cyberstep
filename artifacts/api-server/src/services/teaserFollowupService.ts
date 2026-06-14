import { db } from "@workspace/db";
import { teaserReportsTable, enterpriseProspectsTable } from "@workspace/db";
import { eq, isNull, and, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { sendMail } from "./email";

function buildFollowUpHtml(params: {
  contactName: string | null;
  domain: string;
  companyName: string;
  previewUrl: string;
  overallRiskScore: number | null;
  riskLevel: string | null;
  isSecond: boolean;
}) {
  const { contactName, domain, companyName, previewUrl, overallRiskScore, riskLevel, isSecond } = params;
  const score = overallRiskScore ?? 0;

  const RISK_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
    critical: { label: "KRİTİK",  color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" },
    high:     { label: "YÜKSEK",  color: "#ea580c", bg: "#fff7ed", border: "#fdba74" },
    medium:   { label: "ORTA",    color: "#ca8a04", bg: "#fefce8", border: "#fde047" },
    low:      { label: "DÜŞÜK",   color: "#16a34a", bg: "#f0fdf4", border: "#86efac" },
  };
  const rm = RISK_META[riskLevel ?? "medium"] ?? RISK_META["medium"]!;

  const intro = isSecond
    ? `Bu, <strong>${domain}</strong> alan adınız için hazırladığımız güvenlik analizine ilişkin son hatırlatmamızdır. Herhangi bir sorunuz veya görüşmek istediğiniz bir konu varsa doğrudan bu e-postayı yanıtlayabilirsiniz.`
    : `Geçen hafta <strong>${domain}</strong> alan adınız için hazırladığımız güvenlik analizi raporunu paylaşmıştık. Raporu inceleme fırsatı buldunuz mu? Herhangi bir sorunuz varsa yardımcı olmaktan memnuniyet duyarız.`;

  return `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
  <tr>
    <td style="background:#0f172a;padding:24px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td><span style="font-size:20px;font-weight:700;color:#ffffff;">CyberStep</span><span style="font-size:20px;color:#10b981;">.io</span></td>
          <td align="right"><span style="font-size:11px;color:#94a3b8;">${isSecond ? "Son Hatırlatma" : "Takip Mesajı"}</span></td>
        </tr>
      </table>
    </td>
  </tr>
  <tr><td style="padding:32px;">
    <p style="margin:0 0 16px;font-size:15px;color:#222;">Sayın ${contactName ?? "İlgili Kişi"},</p>
    <p style="margin:0 0 24px;font-size:14px;color:#444;line-height:1.7;">${intro}</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:${rm.bg};border:1px solid ${rm.border};border-radius:8px;margin-bottom:28px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.5px;">Güvenlik Skoru — ${companyName}</p>
          <p style="margin:0;font-size:36px;font-weight:700;color:${rm.color};">${score}<span style="font-size:16px;color:#888;">/100</span>
          <span style="display:inline-block;background:${rm.color};color:#fff;font-size:12px;font-weight:700;padding:4px 10px;border-radius:4px;margin-left:12px;">${rm.label}</span></p>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td align="center">
          <a href="${previewUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;font-size:14px;font-weight:700;padding:14px 32px;border-radius:6px;text-decoration:none;letter-spacing:.3px;">
            Güvenlik Raporunu Görüntüle →
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 4px;font-size:14px;color:#444;">Saygılarımla,</p>
    <p style="margin:0;font-size:14px;color:#222;font-weight:600;">CyberStep.io Güvenlik Ekibi</p>
    <p style="margin:4px 0 0;font-size:13px;color:#0066cc;"><a href="mailto:security@cyberstep.io" style="color:#0066cc;">security@cyberstep.io</a></p>
  </td></tr>
  <tr>
    <td style="background:#f8f8f8;border-top:1px solid #e5e7eb;padding:16px 32px;">
      <p style="margin:0;font-size:11px;color:#aaa;line-height:1.6;">
        Bu e-posta, <strong>${domain}</strong> alan adının güvenlik analizi hakkında bilgi vermek amacıyla gönderilmiştir.
        Artık e-posta almak istemiyorsanız <a href="mailto:security@cyberstep.io?subject=Abonelikten%20Çık%20${encodeURIComponent(domain)}" style="color:#aaa;">abonelikten çıkabilirsiniz</a>.
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function getBaseUrl(): string {
  const domains = process.env["REPLIT_DOMAINS"];
  if (domains) { const f = domains.split(",")[0]?.trim(); if (f) return `https://${f}`; }
  return "http://localhost:80";
}

export async function runFollowUpCron(): Promise<void> {
  const baseUrl = getBaseUrl();

  // D+3: emailSentAt >= 3 gün önce AND followup1SentAt IS NULL AND status = sent/viewed
  const d3Cutoff = new Date(Date.now() - 3 * 86400_000);
  const d3Candidates = await db
    .select({ report: teaserReportsTable, prospect: enterpriseProspectsTable })
    .from(teaserReportsTable)
    .innerJoin(enterpriseProspectsTable, eq(teaserReportsTable.prospectId, enterpriseProspectsTable.id))
    .where(
      and(
        isNull(teaserReportsTable.followup1SentAt),
        sql`${teaserReportsTable.emailSentAt} IS NOT NULL`,
        sql`${teaserReportsTable.emailSentAt} <= ${d3Cutoff.toISOString()}`,
        sql`${teaserReportsTable.status} IN ('sent', 'viewed')`,
      )
    );

  for (const { report, prospect } of d3Candidates) {
    if (!prospect.contactEmail) continue;
    const previewUrl = `${baseUrl}/preview/${report.previewToken}`;
    try {
      await sendMail({
        to: prospect.contactEmail,
        subject: `[Takip] ${prospect.domain} Güvenlik Analizi — CyberStep.io`,
        html: buildFollowUpHtml({
          contactName: prospect.contactName,
          domain: prospect.domain,
          companyName: prospect.companyName,
          previewUrl,
          overallRiskScore: report.overallRiskScore,
          riskLevel: report.riskLevel,
          isSecond: false,
        }),
      });
      await db.update(teaserReportsTable)
        .set({ followup1SentAt: new Date() })
        .where(eq(teaserReportsTable.id, report.id));
      logger.info({ reportId: report.id, domain: prospect.domain }, "Teaser D+3 follow-up sent");
    } catch (err) {
      logger.error({ err, reportId: report.id }, "Teaser D+3 follow-up failed");
    }
  }

  // D+7: followup1SentAt >= 4 gün önce AND followup2SentAt IS NULL AND status = sent/viewed
  const d7Cutoff = new Date(Date.now() - 4 * 86400_000);
  const d7Candidates = await db
    .select({ report: teaserReportsTable, prospect: enterpriseProspectsTable })
    .from(teaserReportsTable)
    .innerJoin(enterpriseProspectsTable, eq(teaserReportsTable.prospectId, enterpriseProspectsTable.id))
    .where(
      and(
        sql`${teaserReportsTable.followup1SentAt} IS NOT NULL`,
        sql`${teaserReportsTable.followup1SentAt} <= ${d7Cutoff.toISOString()}`,
        isNull(teaserReportsTable.followup2SentAt),
        sql`${teaserReportsTable.status} IN ('sent', 'viewed')`,
      )
    );

  for (const { report, prospect } of d7Candidates) {
    if (!prospect.contactEmail) continue;
    const previewUrl = `${baseUrl}/preview/${report.previewToken}`;
    try {
      await sendMail({
        to: prospect.contactEmail,
        subject: `[Son Hatırlatma] ${prospect.domain} Güvenlik Analizi — CyberStep.io`,
        html: buildFollowUpHtml({
          contactName: prospect.contactName,
          domain: prospect.domain,
          companyName: prospect.companyName,
          previewUrl,
          overallRiskScore: report.overallRiskScore,
          riskLevel: report.riskLevel,
          isSecond: true,
        }),
      });
      await db.update(teaserReportsTable)
        .set({ followup2SentAt: new Date() })
        .where(eq(teaserReportsTable.id, report.id));
      logger.info({ reportId: report.id, domain: prospect.domain }, "Teaser D+7 follow-up sent");
    } catch (err) {
      logger.error({ err, reportId: report.id }, "Teaser D+7 follow-up failed");
    }
  }
}
