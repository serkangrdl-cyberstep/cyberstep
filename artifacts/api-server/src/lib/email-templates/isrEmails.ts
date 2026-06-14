// ISR outbound e-posta şablonları
// Renkler: bg #060D1A, accent #00C8FF, buton #F5A623

// ─── 1. Teaser e-posta (adaya) ───────────────────────────────────────────────
export function buildTeaserEmailHtml(params: {
  companyName: string;
  contactName: string | null;
  domain: string;
  teaserBody: string;
  riskScore: number | null;
  criticalFindings: number;
}): string {
  const { companyName, contactName, domain, teaserBody, riskScore, criticalFindings } = params;
  const scoreColor = riskScore != null && riskScore >= 70 ? "#ef4444"
    : riskScore != null && riskScore >= 40 ? "#f97316"
    : "#eab308";

  const bodyHtml = teaserBody
    .replace(/\n\n/g, "</p><p style='margin:10px 0;font-size:14px;color:#94a3b8;line-height:1.7;'>")
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.*?)\*\*/g, "<strong style='color:#e2e8f0;'>$1</strong>");

  return `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#060D1A;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#060D1A;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:10px;overflow:hidden;border:1px solid #1e293b;">
  <!-- Header -->
  <tr>
    <td style="background:#060D1A;padding:24px 32px;border-bottom:1px solid #1e293b;">
      <span style="font-size:22px;font-weight:700;color:#fff;">Cyber</span><span style="font-size:22px;font-weight:700;color:#00C8FF;">Step</span><span style="font-size:22px;font-weight:700;color:#fff;">.io</span>
      <span style="float:right;font-size:11px;color:#475569;padding-top:6px;">Siber Güvenlik Analizi</span>
    </td>
  </tr>
  <!-- Score banner -->
  ${riskScore != null ? `
  <tr>
    <td style="background:#0c1628;padding:20px 32px;border-bottom:1px solid #1e293b;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Risk Skoru — ${domain}</span><br>
            <span style="font-size:40px;font-weight:800;color:${scoreColor};">${riskScore}</span>
            <span style="font-size:16px;color:#475569;">/100</span>
            ${criticalFindings > 0 ? `<span style="display:inline-block;background:#7f1d1d;color:#fca5a5;font-size:12px;font-weight:700;padding:4px 10px;border-radius:4px;margin-left:12px;">${criticalFindings} Kritik Bulgu</span>` : ""}
          </td>
        </tr>
      </table>
    </td>
  </tr>` : ""}
  <!-- Body -->
  <tr>
    <td style="padding:32px;">
      <p style="margin:0 0 16px;font-size:15px;color:#e2e8f0;">Sayın ${contactName ?? "Yetkili"},</p>
      <p style="margin:10px 0;font-size:14px;color:#94a3b8;line-height:1.7;">${bodyHtml}</p>
      <!-- CTA -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0 24px;">
        <tr>
          <td align="center">
            <a href="mailto:${process.env["SMTP_USER"] ?? "info@cyberstep.io"}?subject=CyberStep Güvenlik Raporu — ${encodeURIComponent(companyName)}"
               style="display:inline-block;background:#F5A623;color:#060D1A;font-size:14px;font-weight:700;padding:14px 36px;border-radius:6px;text-decoration:none;letter-spacing:.3px;">
              Raporumu Goruntule →
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:13px;color:#475569;">Bu analiz 7 gün geçerlidir.</p>
    </td>
  </tr>
  <!-- Footer -->
  <tr>
    <td style="background:#060D1A;padding:16px 32px;border-top:1px solid #1e293b;">
      <p style="margin:0;font-size:11px;color:#334155;text-align:center;">
        CyberStep.io · KOBİ'ler için Siber Güvenlik Risk Analizi ·
        <a href="mailto:${process.env["SMTP_USER"] ?? "info@cyberstep.io"}?subject=Abonelikten%20Çık%20${encodeURIComponent(domain)}" style="color:#334155;">Abonelikten çık</a>
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// ─── 2. Yeni deal bildirimi (ISR temsilcisine) ───────────────────────────────
export function buildDealNotificationHtml(params: {
  companyName: string;
  domain: string;
  contactName: string | null;
  contactEmail: string | null;
  riskScore: number | null;
  criticalFindings: number;
  dealId: number;
  dealUrl: string;
}): string {
  const { companyName, domain, contactName, contactEmail, riskScore, criticalFindings, dealUrl } = params;
  const scoreColor = riskScore != null && riskScore >= 70 ? "#ef4444"
    : riskScore != null && riskScore >= 40 ? "#f97316"
    : "#eab308";

  return `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
  <div style="background:#0f172a;padding:20px 24px;">
    <span style="font-size:18px;font-weight:700;color:#fff;">CyberStep.io</span>
    <span style="float:right;background:#10b981;color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;">YENİ DEAL</span>
  </div>
  <div style="padding:24px;">
    <h2 style="margin:0 0 16px;font-size:17px;color:#0f172a;">Yeni ISR Deal Açıldı</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr><td style="padding:7px 0;font-size:13px;color:#64748b;width:130px;">Firma</td><td style="padding:7px 0;font-size:13px;font-weight:600;color:#0f172a;">${companyName}</td></tr>
      <tr><td style="padding:7px 0;font-size:13px;color:#64748b;">Domain</td><td style="padding:7px 0;font-size:13px;color:#0f172a;">${domain}</td></tr>
      ${contactName ? `<tr><td style="padding:7px 0;font-size:13px;color:#64748b;">İletişim</td><td style="padding:7px 0;font-size:13px;color:#0f172a;">${contactName}</td></tr>` : ""}
      ${contactEmail ? `<tr><td style="padding:7px 0;font-size:13px;color:#64748b;">E-posta</td><td style="padding:7px 0;font-size:13px;color:#0066cc;"><a href="mailto:${contactEmail}" style="color:#0066cc;">${contactEmail}</a></td></tr>` : ""}
      ${riskScore != null ? `<tr><td style="padding:7px 0;font-size:13px;color:#64748b;">Risk Skoru</td><td style="padding:7px 0;font-size:13px;font-weight:700;color:${scoreColor};">${riskScore}/100${criticalFindings > 0 ? ` · ${criticalFindings} kritik bulgu` : ""}</td></tr>` : ""}
    </table>
    <a href="${dealUrl}" style="display:block;background:#0f172a;color:#fff;text-align:center;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:700;text-decoration:none;margin-bottom:12px;">
      Deal'i Görüntüle →
    </a>
  </div>
  <div style="background:#f8fafc;padding:12px 24px;border-top:1px solid #e2e8f0;">
    <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">CyberStep.io ISR · Otomatik bildirim</p>
  </div>
</div>
</body>
</html>`;
}

// ─── 3. D+3 hatırlatma (ISR temsilcisine) ───────────────────────────────────
export function buildFollowupReminderHtml(params: {
  leadName: string;
  contactName: string | null;
  contactEmail: string | null;
  daysSinceSent: number;
  riskScore: number | null;
  leadUrl: string;
  action: string;
}): string {
  const { leadName, contactName, contactEmail, daysSinceSent, riskScore, leadUrl, action } = params;

  return `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
  <div style="background:#0f172a;padding:20px 24px;">
    <span style="font-size:18px;font-weight:700;color:#fff;">CyberStep.io</span>
    <span style="float:right;background:#f97316;color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;">D+${daysSinceSent} TAKİP</span>
  </div>
  <div style="padding:24px;">
    <h2 style="margin:0 0 8px;font-size:17px;color:#0f172a;">Takip Gerekli: ${leadName}</h2>
    <p style="margin:0 0 20px;font-size:13px;color:#64748b;">${leadName} firmasına ${daysSinceSent} gün önce teaser gönderildi — henüz müşteri olmadı.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      ${contactName ? `<tr><td style="padding:6px 0;font-size:13px;color:#64748b;width:130px;">İletişim</td><td style="padding:6px 0;font-size:13px;color:#0f172a;">${contactName}</td></tr>` : ""}
      ${contactEmail ? `<tr><td style="padding:6px 0;font-size:13px;color:#64748b;">E-posta</td><td style="padding:6px 0;font-size:13px;"><a href="mailto:${contactEmail}" style="color:#0066cc;">${contactEmail}</a></td></tr>` : ""}
      ${riskScore != null ? `<tr><td style="padding:6px 0;font-size:13px;color:#64748b;">Risk Skoru</td><td style="padding:6px 0;font-size:13px;font-weight:700;color:#f97316;">${riskScore}/100</td></tr>` : ""}
    </table>
    <div style="background:#fffbeb;border-left:3px solid #f59e0b;padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:#92400e;font-weight:600;">Önerilen Aksiyon</p>
      <p style="margin:4px 0 0;font-size:13px;color:#78350f;">${action}</p>
    </div>
    <a href="${leadUrl}" style="display:block;background:#0f172a;color:#fff;text-align:center;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:700;text-decoration:none;">
      Lead'i Görüntüle →
    </a>
  </div>
  <div style="background:#f8fafc;padding:12px 24px;border-top:1px solid #e2e8f0;">
    <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">CyberStep.io ISR · Otomatik takip bildirimi</p>
  </div>
</div>
</body>
</html>`;
}

// ─── 4. D+7 follow-up (adaya) ───────────────────────────────────────────────
export function buildD7FollowupHtml(params: {
  companyName: string;
  contactName: string | null;
  domain: string;
  riskScore: number | null;
  urgencyNote: string;
}): string {
  const { companyName, contactName, domain, riskScore, urgencyNote } = params;
  const scoreColor = riskScore != null && riskScore >= 70 ? "#ef4444"
    : riskScore != null && riskScore >= 40 ? "#f97316"
    : "#eab308";

  return `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#060D1A;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#060D1A;padding:32px 0;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:10px;overflow:hidden;border:1px solid #1e293b;">
  <tr>
    <td style="background:#060D1A;padding:20px 28px;border-bottom:1px solid #1e293b;">
      <span style="font-size:20px;font-weight:700;color:#fff;">Cyber</span><span style="font-size:20px;font-weight:700;color:#00C8FF;">Step</span><span style="font-size:20px;font-weight:700;color:#fff;">.io</span>
    </td>
  </tr>
  <tr>
    <td style="padding:28px;">
      <p style="margin:0 0 16px;font-size:15px;color:#e2e8f0;">Sayın ${contactName ?? "Yetkili"},</p>
      <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;line-height:1.7;">
        Bir hafta önce <strong style="color:#e2e8f0;">${domain}</strong> alan adınız için hazırladığımız güvenlik raporunu paylaşmıştık.
        Raporu inceleme fırsatı buldunuz mu?
      </p>
      ${riskScore != null ? `
      <div style="background:#0c1628;border:1px solid #1e293b;border-radius:8px;padding:16px 20px;margin-bottom:24px;text-align:center;">
        <span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">${companyName} — Güvenlik Skoru</span><br>
        <span style="font-size:38px;font-weight:800;color:${scoreColor};">${riskScore}</span>
        <span style="font-size:15px;color:#475569;">/100</span>
      </div>` : ""}
      <div style="background:#1c1228;border-left:3px solid #F5A623;padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#fcd34d;">${urgencyNote}</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
        <tr>
          <td align="center">
            <a href="mailto:${process.env["SMTP_USER"] ?? "info@cyberstep.io"}?subject=CyberStep Güvenlik Raporu — ${encodeURIComponent(companyName)}"
               style="display:inline-block;background:#F5A623;color:#060D1A;font-size:14px;font-weight:700;padding:13px 32px;border-radius:6px;text-decoration:none;">
              Güvenlik Uzmanıyla Görüş →
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:12px;color:#334155;text-align:center;">Bu son hatırlatmamızdır. İsterseniz doğrudan bu e-postayı yanıtlayabilirsiniz.</p>
    </td>
  </tr>
  <tr>
    <td style="background:#060D1A;padding:14px 28px;border-top:1px solid #1e293b;">
      <p style="margin:0;font-size:11px;color:#334155;text-align:center;">
        CyberStep.io ·
        <a href="mailto:${process.env["SMTP_USER"] ?? "info@cyberstep.io"}?subject=Abonelikten%20Çık%20${encodeURIComponent(domain)}" style="color:#334155;">Abonelikten çık</a>
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
