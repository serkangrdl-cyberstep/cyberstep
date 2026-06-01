import nodemailer from "nodemailer";
import { logger } from "../lib/logger";
import { generateReportPDF } from "./pdf";

const ADMIN_EMAIL = "serkangrdl@gmail.com";

function getTransport() {
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];

  if (!user || !pass) {
    logger.warn("SMTP_USER or SMTP_PASS not set — emails will not be sent");
    return null;
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user, pass },
  });
}

export async function sendMail(params: {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; path?: string; content?: Buffer; contentType?: string }>;
}): Promise<void> {
  const transport = getTransport();
  if (!transport) return;
  const user = process.env["SMTP_USER"]!;
  await transport.sendMail({
    from: `CyberStep <${user}>`,
    to: params.to,
    subject: params.subject,
    html: params.html,
    ...(params.attachments?.length ? { attachments: params.attachments } : {}),
  });
}

function getBaseUrl(): string {
  const domains = process.env["REPLIT_DOMAINS"];
  if (domains) {
    const first = domains.split(",")[0]?.trim();
    if (first) return `https://${first}`;
  }
  return "http://localhost:80";
}

const ANSWER_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  evet:        { label: "Evet",        color: "#166534", bg: "#dcfce7" },
  kismen:      { label: "Kısmen",      color: "#854d0e", bg: "#fef9c3" },
  bilmiyorum:  { label: "Bilmiyorum",  color: "#1e40af", bg: "#dbeafe" },
  hayir:       { label: "Hayır",       color: "#991b1b", bg: "#fee2e2" },
};

export async function sendAdminNotificationEmail(params: {
  assessmentId: number;
  companyName: string;
  contactName: string;
  customerEmail: string;
  sector: string;
  employeeCount: string;
  riskLevel: string;
  scorePercent: number;
  redAlarmCount: number;
  reviewToken: string;
  aiAnalysis: string;
  answers: Array<{ questionNumber: number; answer: string; text: string; domain: string; isRedAlarm: boolean }>;
}): Promise<void> {
  const transport = getTransport();
  if (!transport) return;

  const reviewUrl = `${getBaseUrl()}/admin/review/${params.reviewToken}`;
  const riskColor = params.riskLevel === "Kritik" ? "#dc2626" : params.riskLevel === "Yüksek" ? "#ea580c" : params.riskLevel === "Orta" ? "#d97706" : "#16a34a";

  // Group answers by domain
  const domainGroups: Record<string, typeof params.answers> = {};
  for (const a of params.answers) {
    if (!domainGroups[a.domain]) domainGroups[a.domain] = [];
    domainGroups[a.domain].push(a);
  }

  const answersHtml = Object.entries(domainGroups).map(([domain, qs]) => {
    const rows = qs.map((q) => {
      const badge = ANSWER_LABELS[q.answer] ?? { label: q.answer, color: "#334155", bg: "#f1f5f9" };
      const alarmBadge = q.isRedAlarm && q.answer === "hayir"
        ? `<span style="background:#fee2e2;color:#991b1b;font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px;margin-left:6px">ALARM</span>`
        : "";
      return `<tr>
        <td style="padding:7px 8px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#334155;width:28px;text-align:center;font-weight:600;color:#94a3b8">${q.questionNumber}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#334155">${q.text}${alarmBadge}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #f1f5f9;white-space:nowrap;text-align:right">
          <span style="background:${badge.bg};color:${badge.color};font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px">${badge.label}</span>
        </td>
      </tr>`;
    }).join("");
    return `
      <div style="margin-bottom:16px">
        <div style="background:#e2e8f0;padding:5px 10px;font-size:11px;font-weight:700;color:#475569;border-radius:4px;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">${domain}</div>
        <table style="width:100%;border-collapse:collapse">${rows}</table>
      </div>`;
  }).join("");

  const cleanAiAnalysis = params.aiAnalysis
    .replace(/^#{1,6}\s+/gm, "").replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1").trim();

  const html = `
<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <div style="max-width:680px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
    <div style="background:#0f172a;padding:24px 32px">
      <span style="font-size:22px;font-weight:700;color:#fff">CyberStep.io</span>
      <span style="background:#1e293b;color:#94a3b8;font-size:12px;padding:4px 10px;border-radius:20px;margin-left:12px">Admin Bildirimi</span>
    </div>
    <div style="padding:32px">
      <h2 style="margin:0 0 4px;font-size:20px;color:#0f172a">Yeni Değerlendirme Raporu Hazır</h2>
      <p style="margin:0 0 24px;color:#64748b;font-size:14px">AI analizi tamamlandı. Raporu inceleyip onaylamanız bekleniyor.</p>

      <!-- Firma Bilgileri -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:140px">Firma</td><td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600">${params.companyName}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;font-size:13px">İletişim</td><td style="padding:6px 0;color:#0f172a;font-size:13px">${params.contactName}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;font-size:13px">E-posta</td><td style="padding:6px 0;color:#0f172a;font-size:13px">${params.customerEmail}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Sektör</td><td style="padding:6px 0;color:#0f172a;font-size:13px">${params.sector} · ${params.employeeCount} çalışan</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Risk Seviyesi</td><td style="padding:6px 0"><span style="background:${riskColor}20;color:${riskColor};font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px">${params.riskLevel}</span></td></tr>
          <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Skor</td><td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600">%${params.scorePercent} · ${params.redAlarmCount} kırmızı alarm</td></tr>
        </table>
      </div>

      <!-- Anket Cevapları -->
      <h3 style="margin:0 0 12px;font-size:15px;color:#0f172a;border-bottom:2px solid #10b981;padding-bottom:8px">Anket Cevapları</h3>
      ${answersHtml}

      <!-- AI Analizi -->
      <h3 style="margin:24px 0 12px;font-size:15px;color:#0f172a;border-bottom:2px solid #10b981;padding-bottom:8px">AI Analizi</h3>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:24px;font-size:13px;color:#334155;line-height:1.7">
        ${cleanAiAnalysis.replace(/\n\n/g, "</p><p style='margin:8px 0 0;font-size:13px;color:#334155;line-height:1.7'>").replace(/\n/g, "<br>")}
      </div>

      <a href="${reviewUrl}" style="display:block;background:#10b981;color:#fff;text-align:center;padding:14px 24px;border-radius:8px;font-size:15px;font-weight:700;text-decoration:none;margin-bottom:16px">Raporu İncele ve Onayla</a>
      <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center">Veya bu linki kopyalayın: <span style="color:#64748b">${reviewUrl}</span></p>
    </div>
    <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center">CyberStep.io · Değerlendirme #${params.assessmentId}</p>
    </div>
  </div>
</body>
</html>`;

  try {
    await transport.sendMail({
      from: `"CyberStep.io" <${process.env["SMTP_USER"]}>`,
      to: ADMIN_EMAIL,
      subject: `[CyberStep] Yeni Rapor: ${params.companyName} — ${params.riskLevel} Risk`,
      html,
    });
    logger.info({ assessmentId: params.assessmentId }, "Admin notification email sent");
  } catch (err) {
    logger.error({ err, assessmentId: params.assessmentId }, "Failed to send admin notification email");
  }
}

export async function sendCustomerConfirmationEmail(params: {
  assessmentId: number;
  tenantId?: number;
  companyName: string;
  contactName: string;
  customerEmail: string;
  riskLevel: string;
  scorePercent: number;
  totalScore: number;
  maxScore: number;
  redAlarmCount: number;
}): Promise<void> {
  const transport = getTransport();
  if (!transport) return;

  // Try tenant-specific assessment template first
  if (params.tenantId) {
    try {
      const { db } = await import("@workspace/db");
      const { emailTemplatesTable, emailSendsTable, tenantsTable } = await import("@workspace/db");
      const { renderTemplate } = await import("./email-template-renderer");
      const { eq, and } = await import("drizzle-orm");

      const [tpl] = await db.select().from(emailTemplatesTable)
        .where(and(
          eq(emailTemplatesTable.tenantId, params.tenantId),
          eq(emailTemplatesTable.category, "assessment"),
          eq(emailTemplatesTable.isActive, true),
        ))
        .limit(1);

      if (tpl) {
        const [tenant] = await db.select({ name: tenantsTable.name, smtpUser: tenantsTable.smtpUser })
          .from(tenantsTable).where(eq(tenantsTable.id, params.tenantId));

        const vars: Record<string, string> = {
          companyName: params.companyName,
          contactName: params.contactName,
          assessmentId: String(params.assessmentId),
          riskLevel: params.riskLevel,
          scorePercent: String(params.scorePercent),
          tenantName: tenant?.name ?? "CyberStep.io",
          senderName: tenant?.name ?? "CyberStep.io",
          senderEmail: tenant?.smtpUser ?? process.env["SMTP_USER"] ?? "",
          baseUrl: getBaseUrl(),
          date: new Date().toLocaleDateString("tr-TR"),
        };

        const subject = renderTemplate(tpl.subject, vars);
        const bodyHtml = renderTemplate(tpl.bodyHtml, vars);

        await transport.sendMail({
          from: `"CyberStep.io" <${process.env["SMTP_USER"]}>`,
          to: params.customerEmail,
          subject,
          html: bodyHtml,
        });

        await db.insert(emailSendsTable).values({
          tenantId: params.tenantId,
          templateId: tpl.id,
          toEmail: params.customerEmail,
          toName: params.contactName,
          subject,
          bodyHtml,
          status: "sent",
          relatedType: "assessment",
          relatedId: params.assessmentId,
          sentAt: new Date(),
        });

        logger.info({ assessmentId: params.assessmentId, tenantId: params.tenantId, templateId: tpl.id }, "Assessment confirmation sent via tenant template");
        return;
      }
    } catch (err) {
      logger.warn({ err }, "Tenant template lookup failed, falling back to default email");
    }
  }

  const riskColor = params.riskLevel === "Kritik" ? "#dc2626" : params.riskLevel === "Yüksek" ? "#ea580c" : params.riskLevel === "Orta" ? "#d97706" : "#16a34a";

  const html = `
<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
    <div style="background:#0f172a;padding:24px 32px">
      <span style="font-size:22px;font-weight:700;color:#fff">CyberStep.io</span>
    </div>
    <div style="padding:32px">
      <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a">Sayın ${params.contactName},</h2>
      <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.6">${params.companyName} için siber güvenlik değerlendirmeniz başarıyla tamamlandı. Risk skorunuz hesaplandı.</p>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px;text-align:center">
        <div style="font-size:48px;font-weight:800;color:${riskColor};margin-bottom:4px">${params.totalScore}<span style="font-size:20px;font-weight:400;color:#94a3b8">/${params.maxScore}</span></div>
        <div style="font-size:12px;color:#64748b;margin-bottom:12px">Güvenlik Puanınız</div>
        <span style="background:${riskColor}20;color:${riskColor};font-size:13px;font-weight:700;padding:5px 16px;border-radius:20px">${params.riskLevel} Risk</span>
        <p style="margin:12px 0 0;font-size:13px;color:#64748b">${params.redAlarmCount} kritik güvenlik açığı tespit edildi.</p>
      </div>

      <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:24px">
        <p style="margin:0;font-size:13px;color:#1e40af;line-height:1.6">
          Uzman ekibimiz yapay zeka ön analizini inceleyerek şirketinize özel detaylı değerlendirmeyi
          <strong>24-48 saat içinde</strong> bu e-posta adresine iletecektir. PDF raporunuz da e-postaya ekli olarak gönderilecektir.
        </p>
      </div>

      <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6">
        Sorularınız için <a href="mailto:${process.env["SMTP_USER"]}" style="color:#10b981">${process.env["SMTP_USER"]}</a> adresine yazabilirsiniz.
      </p>
    </div>
    <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center">CyberStep.io · Değerlendirme #${params.assessmentId}</p>
    </div>
  </div>
</body>
</html>`;

  try {
    await transport.sendMail({
      from: `"CyberStep.io" <${process.env["SMTP_USER"]}>`,
      to: params.customerEmail,
      subject: `Siber Güvenlik Değerlendirmeniz Tamamlandı — ${params.companyName}`,
      html,
    });
    logger.info({ assessmentId: params.assessmentId }, "Customer confirmation email sent");
  } catch (err) {
    logger.error({ err, assessmentId: params.assessmentId }, "Failed to send customer confirmation email");
  }
}

export async function sendCustomerReportEmail(params: {
  assessmentId: number;
  companyName: string;
  contactName: string;
  customerEmail: string;
  sector: string;
  employeeCount: string;
  riskLevel: string;
  scorePercent: number;
  totalScore: number;
  maxScore: number;
  redAlarmCount: number;
  aiAnalysis: string;
  recommendations: string[];
  domainScores: Array<{ domain: string; score: number; maxScore: number; percent: number }>;
  adminNotes: string | null;
  createdAt?: string;
}): Promise<void> {
  const transport = getTransport();
  if (!transport) return;

  const riskColor = params.riskLevel === "Kritik" ? "#dc2626" : params.riskLevel === "Yüksek" ? "#ea580c" : params.riskLevel === "Orta" ? "#d97706" : "#16a34a";

  const cleanText = (t: string) =>
    t.replace(/^#{1,6}\s+/gm, "").replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1").replace(/^\s*[-*+]\s+/gm, "• ").trim();

  const recList = params.recommendations
    .map((r, i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155;vertical-align:top"><span style="color:#10b981;font-weight:700;margin-right:8px">${i + 1}.</span>${cleanText(r)}</td></tr>`)
    .join("");

  const adminNotesSection = params.adminNotes?.trim()
    ? `<div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:16px 20px;margin:24px 0;border-radius:0 8px 8px 0">
        <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1d4ed8">Uzman Notu</p>
        <p style="margin:0;font-size:13px;color:#1e40af;line-height:1.6">${cleanText(params.adminNotes).replace(/\n/g, "<br>")}</p>
       </div>`
    : "";

  const html = `
<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <div style="max-width:640px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
    <div style="background:#0f172a;padding:28px 32px">
      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#fff">CyberStep.io</p>
      <p style="margin:0;color:#94a3b8;font-size:14px">Siber Güvenlik Risk Değerlendirme Raporu</p>
    </div>
    <div style="padding:32px">
      <h2 style="margin:0 0 4px;font-size:20px;color:#0f172a">Sayın ${params.contactName},</h2>
      <p style="margin:0 0 24px;color:#64748b;font-size:14px">${params.companyName} firması için siber güvenlik değerlendirme raporunuz hazır ve uzman tarafından incelenerek onaylanmıştır. Raporunuzun PDF'i bu e-postaya eklenmiştir.</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px;display:flex;align-items:center;gap:20px">
        <div style="text-align:center;min-width:100px">
          <div style="font-size:40px;font-weight:800;color:${riskColor}">%${params.scorePercent}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">Güvenlik Skoru</div>
        </div>
        <div>
          <span style="background:${riskColor}20;color:${riskColor};font-size:13px;font-weight:700;padding:4px 12px;border-radius:20px">${params.riskLevel} Risk</span>
          <p style="margin:8px 0 0;font-size:13px;color:#64748b">${params.redAlarmCount} kritik güvenlik açığı tespit edildi.</p>
        </div>
      </div>
      <h3 style="font-size:16px;color:#0f172a;margin:0 0 12px">Uzman Analizi</h3>
      <p style="margin:0 0 24px;font-size:13px;color:#334155;line-height:1.7">${cleanText(params.aiAnalysis).replace(/\n\n/g, "</p><p style='margin:8px 0 0;font-size:13px;color:#334155;line-height:1.7'>").replace(/\n/g, "<br>")}</p>
      ${adminNotesSection}
      ${params.recommendations.length > 0 ? `<h3 style="font-size:16px;color:#0f172a;margin:0 0 12px">Öncelikli Aksiyon Planı</h3><table style="width:100%;border-collapse:collapse;margin-bottom:24px">${recList}</table>` : ""}
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px">
        <p style="margin:0;font-size:13px;color:#166534">Sorularınız için <a href="mailto:${process.env["SMTP_USER"]}" style="color:#16a34a">${process.env["SMTP_USER"]}</a> adresine e-posta gönderebilirsiniz.</p>
      </div>
    </div>
    <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center">CyberStep.io · Bu rapor uzman incelemesinden geçmiştir · Değerlendirme #${params.assessmentId}</p>
    </div>
  </div>
</body>
</html>`;

  // Generate PDF
  let pdfBuffer: Buffer | null = null;
  try {
    pdfBuffer = await generateReportPDF({
      assessmentId: params.assessmentId,
      companyName: params.companyName,
      contactName: params.contactName,
      sector: params.sector,
      employeeCount: params.employeeCount,
      riskLevel: params.riskLevel,
      scorePercent: params.scorePercent,
      totalScore: params.totalScore,
      maxScore: params.maxScore,
      redAlarmCount: params.redAlarmCount,
      aiAnalysis: params.aiAnalysis,
      recommendations: params.recommendations,
      domainScores: params.domainScores,
      adminNotes: params.adminNotes,
      createdAt: params.createdAt,
    });
  } catch (err) {
    logger.error({ err, assessmentId: params.assessmentId }, "PDF generation failed, sending without attachment");
  }

  const safeCompanyName = params.companyName.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s]/g, "").replace(/\s+/g, "_");

  try {
    await transport.sendMail({
      from: `"CyberStep.io" <${process.env["SMTP_USER"]}>`,
      to: params.customerEmail,
      bcc: ADMIN_EMAIL,
      subject: `Siber Güvenlik Değerlendirme Raporunuz Hazır — ${params.companyName}`,
      html,
      attachments: pdfBuffer
        ? [{ filename: `CyberStep_Rapor_${safeCompanyName}.pdf`, content: pdfBuffer, contentType: "application/pdf" }]
        : [],
    });
    logger.info({ assessmentId: params.assessmentId }, "Customer report email sent with PDF");
  } catch (err) {
    logger.error({ err, assessmentId: params.assessmentId }, "Failed to send customer report email");
  }
}

export async function sendReminderEmail(params: {
  assessmentId: number;
  companyName: string;
  contactName: string;
  customerEmail: string;
  riskLevel: string;
  scorePercent: number;
  assessmentUrl: string;
}): Promise<void> {
  const transport = getTransport();
  if (!transport) return;

  const riskColor = params.riskLevel === "Kritik" ? "#dc2626" : params.riskLevel === "Yüksek" ? "#ea580c" : params.riskLevel === "Orta" ? "#d97706" : "#16a34a";
  const base = getBaseUrl();

  const html = `
<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
    <div style="background:#0f172a;padding:24px 32px">
      <span style="font-size:22px;font-weight:700;color:#fff">CyberStep.io</span>
    </div>
    <div style="padding:32px">
      <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a">Sayın ${params.contactName},</h2>
      <p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.6">
        ${params.companyName} için son siber güvenlik değerlendirmenizin üzerinden <strong>30 gün</strong> geçti.
        Siber tehditler sürekli değişiyor — güvenlik durumunuzu güncel tutmak için yeni bir değerlendirme yapmanızı öneriyoruz.
      </p>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px;text-align:center">
        <div style="font-size:12px;color:#64748b;margin-bottom:6px">30 Gün Önceki Skorunuz</div>
        <div style="font-size:42px;font-weight:800;color:${riskColor}">%${params.scorePercent}</div>
        <span style="background:${riskColor}20;color:${riskColor};font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px">${params.riskLevel} Risk</span>
        <p style="margin:12px 0 0;font-size:13px;color:#64748b;line-height:1.5">
          Yeni değerlendirme ile iyileştirmelerinizin etkisini ölçün ve güncel risk durumunuzu öğrenin.
        </p>
      </div>

      <a href="${base}/assessment/start" style="display:block;background:#10b981;color:#fff;text-align:center;padding:14px 24px;border-radius:8px;font-size:15px;font-weight:700;text-decoration:none;margin-bottom:16px">
        Yeni Değerlendirme Başlat (Ücretsiz)
      </a>
      <a href="${params.assessmentUrl}" style="display:block;border:1px solid #e2e8f0;color:#475569;text-align:center;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;margin-bottom:24px">
        Önceki Raporu Görüntüle
      </a>

      <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:14px 18px;border-radius:0 8px 8px 0">
        <p style="margin:0;font-size:13px;color:#1e40af;line-height:1.5">
          <strong>Hatırlatıcı:</strong> Siber güvenlik sadece bir rapor değil, sürekli bir süreçtir.
          Düzenli değerlendirmeler riskleri erkenden tespit etmenizi sağlar.
        </p>
      </div>
    </div>
    <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center">
        CyberStep.io · Bu e-postayı almak istemiyorsanız <a href="mailto:${process.env["SMTP_USER"]}" style="color:#64748b">buraya yazın</a>.
      </p>
    </div>
  </div>
</body>
</html>`;

  try {
    await transport.sendMail({
      from: `"CyberStep.io" <${process.env["SMTP_USER"]}>`,
      to: params.customerEmail,
      subject: `30 Gün Geçti — Siber Güvenlik Durumunuzu Güncelleyin | ${params.companyName}`,
      html,
    });
    logger.info({ assessmentId: params.assessmentId }, "Reminder email sent");
  } catch (err) {
    logger.error({ err, assessmentId: params.assessmentId }, "Failed to send reminder email");
  }
}

export async function sendSpecialDayEmail(params: {
  message: {
    id: number;
    title: string;
    messageTr: string;
    messageEn: string | null;
    imageBase64: string | null;
    bgColor: string;
    textColor: string;
  };
  subscribers: Array<{ email: string; unsubscribeToken: string }>;
}): Promise<void> {
  const transport = getTransport();
  if (!transport) return;
  const base = getBaseUrl();

  const { message } = params;
  const hasTurkish = !!message.messageTr;
  const hasEnglish = !!message.messageEn;

  const imgHtml = message.imageBase64
    ? `<div style="text-align:center;margin-bottom:24px"><img src="${message.imageBase64}" alt="${message.title}" style="max-height:120px;max-width:200px;object-fit:contain;border-radius:8px"/></div>`
    : "";

  for (const sub of params.subscribers) {
    const unsubUrl = `${base}/api/public/newsletter/unsubscribe/${sub.unsubscribeToken}`;
    const html = `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
    <div style="background:${message.bgColor};padding:28px 32px;text-align:center">
      <span style="font-size:22px;font-weight:700;color:${message.textColor}">CyberStep.io</span>
      <span style="background:rgba(255,255,255,0.15);color:${message.textColor};font-size:12px;padding:4px 10px;border-radius:20px;margin-left:12px;opacity:.9">Ozel Gun</span>
    </div>
    <div style="padding:32px;text-align:center">
      ${imgHtml}
      <h2 style="margin:0 0 16px;font-size:26px;color:#0f172a;line-height:1.3">${message.title}</h2>
      ${hasTurkish ? `<p style="margin:0 0 12px;font-size:16px;color:#334155;line-height:1.7">${message.messageTr}</p>` : ""}
      ${hasEnglish ? `<p style="margin:0;font-size:14px;color:#64748b;line-height:1.7;padding-top:12px;border-top:1px solid #e2e8f0">${message.messageEn}</p>` : ""}
    </div>
    <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center">
        CyberStep.io bültenine abonesiniz · You are subscribed to CyberStep.io newsletter.<br>
        <a href="${unsubUrl}" style="color:#64748b">Abonelikten çık / Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`;
    try {
      await transport.sendMail({
        from: `"CyberStep.io" <${process.env["SMTP_USER"]}>`,
        to: sub.email,
        subject: message.title,
        html,
      });
    } catch (err) {
      logger.error({ err, email: sub.email }, "Special day email send failed");
    }
  }
}

export async function sendNewsletterEmail(params: {
  post: {
    id: number;
    title: string;
    titleEn?: string | null;
    slug: string;
    excerpt: string;
    excerptEn?: string | null;
    authorName: string;
    publishedAt: Date | null;
  };
  subscribers: Array<{ email: string; unsubscribeToken: string }>;
}): Promise<void> {
  const transport = getTransport();
  if (!transport) return;

  const base = getBaseUrl();
  const postUrl = `${base}/blog/${params.post.slug}`;

  const dateStrTR = params.post.publishedAt
    ? new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(params.post.publishedAt))
    : "";
  const dateStrEN = params.post.publishedAt
    ? new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric" }).format(new Date(params.post.publishedAt))
    : "";

  const hasTitleEn = !!params.post.titleEn;
  const titleEn = params.post.titleEn ?? params.post.title;
  const excerptEn = params.post.excerptEn ?? params.post.excerpt;

  const enSection = `
    <div style="margin-top:32px;padding-top:28px;border-top:2px dashed #e2e8f0">
      <p style="margin:0 0 8px;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px">New Blog Post</p>
      <h2 style="margin:0 0 16px;font-size:22px;color:#0f172a;line-height:1.3">${titleEn}</h2>
      ${dateStrEN ? `<p style="margin:0 0 16px;font-size:12px;color:#94a3b8">${dateStrEN} · ${params.post.authorName}</p>` : ""}
      <p style="margin:0 0 28px;font-size:14px;color:#475569;line-height:1.7">${excerptEn}</p>
      <a href="${postUrl}" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">Read More</a>
    </div>`;

  for (const sub of params.subscribers) {
    const unsubUrl = `${base}/api/public/newsletter/unsubscribe/${sub.unsubscribeToken}`;
    const html = `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
    <div style="background:#0f172a;padding:24px 32px">
      <span style="font-size:22px;font-weight:700;color:#fff">CyberStep.io</span>
      <span style="background:#1e293b;color:#94a3b8;font-size:12px;padding:4px 10px;border-radius:20px;margin-left:12px">Blog</span>
    </div>
    <div style="padding:32px">
      <!-- TÜRKÇE -->
      <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px">Yeni Blog Yazısı</p>
      <h2 style="margin:0 0 16px;font-size:24px;color:#0f172a;line-height:1.3">${params.post.title}</h2>
      ${dateStrTR ? `<p style="margin:0 0 16px;font-size:12px;color:#94a3b8">${dateStrTR} · ${params.post.authorName}</p>` : ""}
      <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.7">${params.post.excerpt}</p>
      <a href="${postUrl}" style="display:inline-block;background:#10b981;color:#fff;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:700;text-decoration:none">Devamını Oku</a>

      <!-- ENGLISH -->
      ${hasTitleEn ? enSection : `
      <div style="margin-top:32px;padding-top:28px;border-top:2px dashed #e2e8f0">
        ${enSection}
      </div>`}
    </div>
    <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center">
        CyberStep.io bültenine abonesiniz · You are subscribed to CyberStep.io newsletter.<br>
        <a href="${unsubUrl}" style="color:#64748b">Abonelikten çık / Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`;

    try {
      await transport.sendMail({
        from: `"CyberStep.io" <${process.env["SMTP_USER"]}>`,
        to: sub.email,
        subject: `[CyberStep Blog] ${params.post.title}${hasTitleEn ? ` / ${titleEn}` : ""}`,
        html,
      });
    } catch (err) {
      logger.error({ err, email: sub.email }, "Newsletter email send failed");
    }
  }
  logger.info({ postId: params.post.id, count: params.subscribers.length }, "Newsletter batch sent");
}

export async function sendDigestWeeklyEmail(params: {
  digest: {
    weekNumber: number;
    weekYear: number;
    contentSummary: string | null;
    contentLinkedin: string | null;
  };
  subscribers: Array<{ email: string; unsubscribeToken: string }>;
}): Promise<void> {
  const transport = getTransport();
  if (!transport) return;
  const base = getBaseUrl();

  const { digest } = params;
  const weekLabel = `${digest.weekYear} / ${digest.weekNumber}. Hafta`;

  for (const sub of params.subscribers) {
    const unsubUrl = `${base}/api/public/newsletter/unsubscribe/${sub.unsubscribeToken}/digest`;
    const html = `<!DOCTYPE html><html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
    <div style="background:#0f172a;padding:24px 32px;display:flex;align-items:center;gap:12px">
      <span style="font-size:22px;font-weight:700;color:#fff">CyberStep.io</span>
      <span style="background:#0891b2;color:#fff;font-size:12px;padding:4px 10px;border-radius:20px;margin-left:8px">Haftalık Siber Olaylar</span>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px">Haftalık Bülten</p>
      <h2 style="margin:0 0 20px;font-size:22px;color:#0f172a">${weekLabel} Siber Güvenlik Özeti</h2>
      <div style="font-size:15px;color:#334155;line-height:1.8;white-space:pre-wrap">${digest.contentSummary ?? "Bu hafta içerik üretildi."}</div>
      <div style="margin-top:28px;padding-top:24px;border-top:1px solid #e2e8f0">
        <a href="${base}/blog" style="display:inline-block;background:#0891b2;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">Blog'u Ziyaret Et</a>
      </div>
    </div>
    <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center">
        CyberStep.io Haftalık Siber Olaylar bültenine abonesiniz.<br>
        <a href="${unsubUrl}" style="color:#64748b">Yalnızca bu bültenin aboneliğinden çık</a> ·
        <a href="${base}/api/public/newsletter/unsubscribe/${sub.unsubscribeToken}" style="color:#64748b">Tüm aboneliklerden çık</a>
      </p>
    </div>
  </div>
</body></html>`;
    try {
      await transport.sendMail({
        from: `"CyberStep.io" <${process.env["SMTP_USER"]}>`,
        to: sub.email,
        subject: `[CyberStep] ${weekLabel} Haftalık Siber Güvenlik Bülteni`,
        html,
      });
    } catch (err) {
      logger.error({ err, email: sub.email }, "Digest weekly email send failed");
    }
  }
  logger.info({ weekNumber: digest.weekNumber, count: params.subscribers.length }, "Digest weekly batch sent");
}

export async function sendDomainRescanEmail(params: {
  email: string;
  domain: string;
  oldScore: number;
  newScore: number;
  spfPass: boolean;
  dmarcPass: boolean;
  dkimPass: boolean;
  mxPass: boolean;
  sslPass: boolean;
}): Promise<void> {
  const transport = getTransport();
  if (!transport) return;

  const { email, domain, oldScore, newScore, spfPass, dmarcPass, dkimPass, mxPass, sslPass } = params;
  const scoreDiff = newScore - oldScore;
  const improved = scoreDiff > 0;
  const declined = scoreDiff < 0;
  const unchanged = scoreDiff === 0;

  const scoreColor = newScore >= 80 ? "#166534" : newScore >= 50 ? "#854d0e" : "#991b1b";
  const scoreBg = newScore >= 80 ? "#dcfce7" : newScore >= 50 ? "#fef9c3" : "#fee2e2";
  const scoreLabel = newScore >= 80 ? "Düşük Risk" : newScore >= 50 ? "Orta Risk" : "Yüksek Risk";

  const changeText = improved
    ? `+${scoreDiff} puan iyileşme`
    : declined
    ? `${scoreDiff} puan düşüş`
    : "Puan değişmedi";
  const changeColor = improved ? "#166534" : declined ? "#991b1b" : "#475569";

  function checkRow(label: string, pass: boolean) {
    return `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155">${label}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right">
          <span style="background:${pass ? "#dcfce7" : "#fee2e2"};color:${pass ? "#166534" : "#991b1b"};padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600">
            ${pass ? "Geçti" : "Başarısız"}
          </span>
        </td>
      </tr>`;
  }

  const html = `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:32px;text-align:center">
      <div style="font-size:22px;font-weight:700;color:#38bdf8;letter-spacing:-0.5px">CyberStep.io</div>
      <div style="color:#94a3b8;font-size:13px;margin-top:4px">Alan Adı Güvenlik Raporu</div>
    </div>

    <div style="padding:32px">
      <h2 style="margin:0 0 4px;font-size:18px;color:#0f172a">${domain}</h2>
      <p style="margin:0 0 24px;color:#64748b;font-size:14px">30 günlük periyodik güvenlik taramanız tamamlandı.</p>

      <div style="display:flex;gap:12px;margin-bottom:24px">
        <div style="flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:16px;text-align:center">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin-bottom:4px">Önceki Skor</div>
          <div style="font-size:28px;font-weight:700;color:#64748b">${oldScore}</div>
        </div>
        <div style="flex:1;border:2px solid ${scoreColor};border-radius:8px;padding:16px;text-align:center;background:${scoreBg}">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:${scoreColor};margin-bottom:4px">Güncel Skor</div>
          <div style="font-size:28px;font-weight:700;color:${scoreColor}">${newScore}</div>
          <div style="font-size:11px;color:${scoreColor};font-weight:600">${scoreLabel}</div>
        </div>
      </div>

      <div style="background:#f8fafc;border-radius:8px;padding:12px 16px;margin-bottom:24px;text-align:center;font-size:14px;color:${changeColor};font-weight:600">
        ${unchanged ? "Puan değişmedi" : `${improved ? "▲" : "▼"} ${changeText}`}
      </div>

      <h3 style="font-size:14px;font-weight:600;color:#0f172a;margin:0 0 12px">Kontrol Detayları</h3>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        ${checkRow("SPF Kaydı", spfPass)}
        ${checkRow("DMARC Politikası", dmarcPass)}
        ${checkRow("DKIM İmzası", dkimPass)}
        ${checkRow("MX Kaydı", mxPass)}
        ${checkRow("SSL Sertifikası", sslPass)}
      </table>

      ${(!spfPass || !dmarcPass || !dkimPass || !mxPass || !sslPass) ? `
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin-top:20px">
        <div style="font-size:13px;font-weight:600;color:#9a3412;margin-bottom:6px">Dikkat Gerektiren Kontroller</div>
        <ul style="margin:0;padding-left:18px;color:#7c2d12;font-size:13px">
          ${!spfPass ? "<li>SPF kaydı eksik veya hatalı — e-posta sahteciliğine karşı koruma sağlayın</li>" : ""}
          ${!dmarcPass ? "<li>DMARC politikası yapılandırılmamış — e-posta kimlik doğrulamasını güçlendirin</li>" : ""}
          ${!dkimPass ? "<li>DKIM imzası bulunamadı — e-posta bütünlüğü doğrulaması eksik</li>" : ""}
          ${!mxPass ? "<li>MX kaydı hatalı veya eksik — e-posta alımı etkilenebilir</li>" : ""}
          ${!sslPass ? "<li>SSL sertifikası geçersiz veya süresi dolmak üzere — acil yenileme gerekiyor</li>" : ""}
        </ul>
      </div>` : `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-top:20px;text-align:center">
        <div style="font-size:13px;font-weight:600;color:#166534">Tüm güvenlik kontrolleri başarıyla geçildi!</div>
      </div>`}

      <div style="margin-top:28px;text-align:center">
        <a href="${getBaseUrl()}/alan-tarama" style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600">
          Yeni Tarama Başlat
        </a>
      </div>
    </div>

    <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center">
        Bu e-posta ${domain} alan adı için otomatik periyodik tarama sonucu gönderilmiştir.<br>
        CyberStep.io &mdash; KOBİ'ler için Siber Güvenlik
      </p>
    </div>
  </div>
</body>
</html>`;

  try {
    const subjectText = unchanged
      ? `Alan adı taraması tamamlandı: ${domain} — Skor: ${newScore}/100`
      : improved
      ? `Alan adı güvenliği iyileşti: ${domain} — ${oldScore} → ${newScore} puan`
      : `Alan adı güvenlik uyarısı: ${domain} — Skor düştü (${oldScore} → ${newScore})`;

    await transport.sendMail({
      from: `"CyberStep.io" <${process.env["SMTP_USER"]}>`,
      to: email,
      subject: subjectText,
      html,
    });
    logger.info({ domain, email, oldScore, newScore }, "Domain rescan email sent");
  } catch (err) {
    logger.error({ err, domain, email }, "Domain rescan email send failed");
  }
}

export async function sendWeeklyDeltaEmail(params: {
  email: string;
  domain: string;
  oldScore: number;
  newScore: number;
  changes: Array<{ check: string; wasPass: boolean; isPass: boolean }>;
  newIssues: number;
  resolvedIssues: number;
  date: string;
}): Promise<void> {
  const transport = getTransport();
  if (!transport) return;

  const { email, domain, oldScore, newScore, changes, newIssues, resolvedIssues, date } = params;
  const scoreDiff = newScore - oldScore;
  const improved = scoreDiff > 0;
  const scoreColor = newScore >= 80 ? "#166534" : newScore >= 50 ? "#854d0e" : "#991b1b";
  const scoreBg = newScore >= 80 ? "#dcfce7" : newScore >= 50 ? "#fef9c3" : "#fee2e2";
  const scoreLabel = newScore >= 80 ? "Düşük Risk" : newScore >= 50 ? "Orta Risk" : "Yüksek Risk";

  const hasAlerts = newIssues > 0;
  const alertBannerHtml = hasAlerts
    ? `<div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:14px 18px;margin-bottom:24px;display:flex;align-items:center;gap:10px">
        <span style="font-size:20px">&#9888;</span>
        <div>
          <div style="font-weight:700;color:#991b1b;font-size:14px">${newIssues} yeni güvenlik sorunu tespit edildi</div>
          <div style="color:#b91c1c;font-size:13px;margin-top:2px">Hemen incelemeniz önerilir</div>
        </div>
      </div>`
    : resolvedIssues > 0
    ? `<div style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:14px 18px;margin-bottom:24px">
        <div style="font-weight:700;color:#166534;font-size:14px">${resolvedIssues} sorun bu hafta giderildi — tebrikler!</div>
      </div>`
    : "";

  const changeRows = changes.map(c => {
    const wasStatus = c.wasPass
      ? `<span style="background:#dcfce7;color:#166534;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600">Geçti</span>`
      : `<span style="background:#fee2e2;color:#991b1b;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600">Başarısız</span>`;
    const isStatus = c.isPass
      ? `<span style="background:#dcfce7;color:#166534;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600">Geçti</span>`
      : `<span style="background:#fee2e2;color:#991b1b;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600">Başarısız</span>`;
    const arrow = c.isPass ? "&#8593;" : "&#8595;";
    const arrowColor = c.isPass ? "#166534" : "#991b1b";
    return `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:13px">${c.check}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${wasStatus}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;font-weight:700;color:${arrowColor}">${arrow}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${isStatus}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:28px 32px">
      <div style="font-size:20px;font-weight:700;color:#38bdf8;letter-spacing:-0.5px">CyberStep.io</div>
      <div style="color:#94a3b8;font-size:12px;margin-top:2px">Haftalık Alan Adı Güvenlik Raporu</div>
      <div style="color:#64748b;font-size:12px;margin-top:8px">${date} — ${domain}</div>
    </div>

    <div style="padding:28px 32px">
      <h2 style="margin:0 0 20px;font-size:17px;color:#0f172a">Haftalık Güvenlik Durumu: <span style="color:#0ea5e9">${domain}</span></h2>

      ${alertBannerHtml}

      <div style="display:flex;gap:12px;margin-bottom:24px">
        <div style="flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:14px;text-align:center">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin-bottom:4px">Geçen Hafta</div>
          <div style="font-size:26px;font-weight:700;color:#64748b">${oldScore}</div>
        </div>
        <div style="flex:1;border:2px solid ${scoreColor};border-radius:8px;padding:14px;text-align:center;background:${scoreBg}">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:${scoreColor};margin-bottom:4px">Bu Hafta</div>
          <div style="font-size:26px;font-weight:700;color:${scoreColor}">${newScore}</div>
          <div style="font-size:11px;color:${scoreColor};font-weight:600">${scoreLabel}</div>
        </div>
        <div style="flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:14px;text-align:center">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin-bottom:4px">Degisim</div>
          <div style="font-size:26px;font-weight:700;color:${improved ? "#166534" : "#991b1b"}">${improved ? "+" : ""}${scoreDiff}</div>
        </div>
      </div>

      ${changes.length > 0 ? `
      <h3 style="font-size:14px;font-weight:600;color:#0f172a;margin:0 0 10px">Bu Hafta Degisen Kontroller</h3>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:24px">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600">Kontrol</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#64748b;font-weight:600">Onceki</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#64748b;font-weight:600"></th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#64748b;font-weight:600">Simdi</th>
          </tr>
        </thead>
        <tbody>${changeRows}</tbody>
      </table>` : ""}

      <div style="margin-top:20px;text-align:center">
        <a href="${getBaseUrl()}/alan-tarama" style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600">
          Tam Raporu Goruntule
        </a>
      </div>
    </div>

    <div style="background:#f8fafc;padding:14px 32px;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center">
        Bu haftalik otomatik rapor ${domain} icin gonderilmistir.<br>
        CyberStep.io &mdash; KOBIler icin Siber Guvenlik
      </p>
    </div>
  </div>
</body>
</html>`;

  try {
    const subject = hasAlerts
      ? `UYARI: ${domain} — ${newIssues} yeni guvenlik sorunu tespit edildi`
      : `Haftalik Rapor: ${domain} — Skor ${improved ? "yukseldi" : "dustu"} (${oldScore} → ${newScore})`;

    await transport.sendMail({
      from: `"CyberStep.io" <${process.env["SMTP_USER"]}>`,
      to: email,
      subject,
      html,
    });
    logger.info({ domain, email, newIssues, resolvedIssues, scoreDiff }, "Weekly delta email sent");
  } catch (err) {
    logger.error({ err, domain, email }, "Weekly delta email send failed");
  }
}

export async function sendPasswordResetEmail(params: {
  email: string;
  fullName: string;
  resetUrl: string;
}): Promise<void> {
  const transport = getTransport();
  if (!transport) return;

  const html = `
<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%">
        <!-- Header -->
        <tr>
          <td style="background:#0f172a;padding:28px 40px;text-align:center">
            <span style="color:#10b981;font-size:22px;font-weight:bold">CyberStep.io</span>
            <p style="color:#94a3b8;font-size:13px;margin:6px 0 0">Siber Güvenlik Değerlendirme Platformu</p>
          </td>
        </tr>
        <!-- Content -->
        <tr>
          <td style="padding:40px">
            <h2 style="margin:0 0 12px;font-size:20px;color:#0f172a">Şifre Sıfırlama Talebi</h2>
            <p style="margin:0 0 16px;font-size:15px;color:#475569">Merhaba <strong>${params.fullName}</strong>,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#475569">
              CyberStep.io hesabınız için şifre sıfırlama talebinde bulundunuz. Aşağıdaki butona tıklayarak yeni şifrenizi belirleyebilirsiniz.
            </p>
            <div style="text-align:center;margin:32px 0">
              <a href="${params.resetUrl}"
                 style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:14px 32px;border-radius:8px">
                Şifremi Sıfırla
              </a>
            </div>
            <p style="margin:0 0 8px;font-size:13px;color:#94a3b8">
              Bu bağlantı <strong>1 saat</strong> geçerlidir. Eğer bu talebi siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz — hesabınızda herhangi bir değişiklik yapılmamıştır.
            </p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
            <p style="margin:0;font-size:13px;color:#94a3b8">
              Bağlantı çalışmıyorsa şu adresi tarayıcınıza kopyalayın:<br/>
              <span style="color:#64748b;word-break:break-all">${params.resetUrl}</span>
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;text-align:center">
            <p style="margin:0;font-size:12px;color:#94a3b8">
              CyberStep.io · KOBİ'ler için Siber Güvenlik Değerlendirme Platformu
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await transport.sendMail({
      from: `"CyberStep.io" <${process.env["SMTP_USER"]}>`,
      to: params.email,
      subject: "Şifre Sıfırlama — CyberStep.io",
      html,
    });
    logger.info({ email: params.email }, "Password reset email sent");
  } catch (err) {
    logger.error({ err, email: params.email }, "Password reset email send failed");
  }
}

// ─── Scan Lead Drip E-postaları ────────────────────────────────────────────────
// Adım 0: Anlık — özet rapor e-postası
// Adım 1: Gün 2 — eylem rehberi
// Adım 2: Gün 4 — ROI karşılaştırması
// Adım 3: Gün 7 — son çağrı + değerlendirme indirimi

export async function sendScanLeadDripEmail(params: {
  email: string;
  domain: string;
  overallScore: number;
  step: number;  // 0, 1, 2, 3
  unsubToken: string;
}): Promise<boolean> {
  const transport = getTransport();
  if (!transport) return false;

  const base = getBaseUrl();
  const { email, domain, overallScore, step, unsubToken } = params;
  const unsubUrl = `${base}/api/scan-leads/unsubscribe/${unsubToken}`;
  const scanUrl = `${base}/domain-tarama?domain=${encodeURIComponent(domain)}`;
  const roiUrl = `${base}/roi-hesaplayici`;
  const assessUrl = `${base}/assessment/start`;

  const scoreColor = overallScore >= 80 ? "#16a34a" : overallScore >= 60 ? "#d97706" : "#dc2626";
  const scoreLabel = overallScore >= 80 ? "İyi" : overallScore >= 60 ? "Orta" : "Zayıf";

  const STEPS: Array<{ subject: string; html: string }> = [
    {
      // Adım 0 — Anlık
      subject: overallScore < 60
        ? `Dikkat: ${domain} taramasında kritik açıklar tespit edildi (Skor: ${overallScore}/100)`
        : `${domain} alan adı güvenlik taramanız tamamlandı — Skor: ${overallScore}/100`,
      html: `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
    <div style="background:#0f172a;padding:24px 32px"><span style="font-size:22px;font-weight:700;color:#fff">CyberStep.io</span></div>
    <div style="padding:32px">
      <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a">Alan Adı Güvenlik Taramanız Hazır</h2>
      <p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.6"><strong>${domain}</strong> için tamamladığınız tarama sonuçlarınız aşağıdadır.</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px;text-align:center">
        <div style="font-size:52px;font-weight:900;color:${scoreColor}">${overallScore}</div>
        <div style="font-size:13px;color:#64748b;margin-bottom:8px">/ 100 Güvenlik Skoru</div>
        <span style="background:${scoreColor}20;color:${scoreColor};font-size:13px;font-weight:700;padding:5px 16px;border-radius:20px">${scoreLabel}</span>
      </div>
      ${overallScore < 70 ? `
      <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:20px">
        <p style="margin:0;font-size:13px;color:#991b1b;line-height:1.5"><strong>Dikkat:</strong> ${domain} için kritik güvenlik açıkları tespit edildi. SPF, DMARC ve DKIM kayıtlarınızın eksik ya da hatalı olması, e-postalarınızın spam kutusuna düşmesine veya phishing saldırısında kullanılmasına yol açabilir.</p>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between">
        <div><div style="font-size:11px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:.5px">KVKK min. idari ceza</div><div style="font-size:22px;font-weight:900;color:#dc2626">94.000 TL</div></div>
        <div style="font-size:18px;color:#94a3b8">vs.</div>
        <div style="text-align:right"><div style="font-size:11px;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:.5px">Tam Değerlendirme</div><div style="font-size:22px;font-weight:900;color:#10b981">5.990 TL</div></div>
      </div>` : `
      <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:24px">
        <p style="margin:0;font-size:13px;color:#166534;line-height:1.5">Alan adı güvenliğiniz iyi durumda. Kapsamlı bir değerlendirme ile diğer risk alanlarını da kontrol etmenizi öneririz.</p>
      </div>`}
      <a href="${assessUrl}" style="display:block;background:#10b981;color:#fff;text-align:center;padding:14px 24px;border-radius:8px;font-size:15px;font-weight:700;text-decoration:none;margin-bottom:12px">Ücretsiz Güvenlik Değerlendirmesi Başlat</a>
      <a href="${scanUrl}" style="display:block;border:1px solid #e2e8f0;color:#475569;text-align:center;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;margin-bottom:24px">Tarama Sonuçlarını Tekrar Gör</a>
      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">Bu e-postayı almak istemiyorsanız <a href="${unsubUrl}" style="color:#64748b">buraya tıklayın</a>.</p>
    </div>
  </div>
</body></html>`,
    },
    {
      // Adım 1 — Gün 2
      subject: `${domain} için 3 acil güvenlik adımı`,
      html: `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
    <div style="background:#0f172a;padding:24px 32px"><span style="font-size:22px;font-weight:700;color:#fff">CyberStep.io</span></div>
    <div style="padding:32px">
      <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a">2 Gün Önce Taranan: ${domain}</h2>
      <p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.6">Taramanızda skor <strong style="color:${scoreColor}">${overallScore}/100</strong> çıktı. Bu güne kadar düzeltme yapmadıysanız, işte öncelikli 3 adım:</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr><td style="padding:12px;border-bottom:1px solid #f1f5f9;vertical-align:top"><span style="font-size:18px;font-weight:800;color:#10b981;margin-right:10px">1.</span><strong>SPF Kaydı Ekleyin</strong><br><span style="font-size:12px;color:#64748b">DNS yöneticinizde <code style="background:#f1f5f9;padding:1px 4px;border-radius:3px">v=spf1 include:_spf.google.com ~all</code> şeklinde TXT kaydı oluşturun.</span></td></tr>
        <tr><td style="padding:12px;border-bottom:1px solid #f1f5f9;vertical-align:top"><span style="font-size:18px;font-weight:800;color:#10b981;margin-right:10px">2.</span><strong>DMARC Politikası Tanımlayın</strong><br><span style="font-size:12px;color:#64748b"><code style="background:#f1f5f9;padding:1px 4px;border-radius:3px">_dmarc.${domain}</code> için <code style="background:#f1f5f9;padding:1px 4px;border-radius:3px">v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}</code> ekleyin.</span></td></tr>
        <tr><td style="padding:12px;vertical-align:top"><span style="font-size:18px;font-weight:800;color:#10b981;margin-right:10px">3.</span><strong>SSL Sertifikanızı Kontrol Edin</strong><br><span style="font-size:12px;color:#64748b">Let's Encrypt ile ücretsiz, otomatik yenilenen bir SSL sertifikası edinebilirsiniz. Süresi dolmuş SSL, Google sıralamalarını olumsuz etkiler.</span></td></tr>
      </table>
      <a href="${assessUrl}" style="display:block;background:#10b981;color:#fff;text-align:center;padding:14px 24px;border-radius:8px;font-size:15px;font-weight:700;text-decoration:none;margin-bottom:24px">Tüm Riskleri Görmek İçin Değerlendirme Yap</a>
      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">Bu e-postayı almak istemiyorsanız <a href="${unsubUrl}" style="color:#64748b">buraya tıklayın</a>.</p>
    </div>
  </div>
</body></html>`,
    },
    {
      // Adım 2 — Gün 4
      subject: `Şirketinizin siber risk maliyeti ne kadar? (${domain} taraması sonrası)`,
      html: `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
    <div style="background:#0f172a;padding:24px 32px"><span style="font-size:22px;font-weight:700;color:#fff">CyberStep.io</span></div>
    <div style="padding:32px">
      <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a">Siber Saldırı Sizi Kaça Mal Olur?</h2>
      <p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.6">IBM 2024 raporuna göre Türkiye'deki KOBİ'ler için bir siber saldırının ortalama maliyeti <strong>350,000 TL – 1,200,000 TL</strong> arasında değişiyor. KVKK cezaları buna dahil değil.</p>
      <div style="background:#fef2f2;border-radius:8px;padding:20px;margin-bottom:20px;text-align:center">
        <div style="font-size:11px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Orta ölçekli KOBİ tahmini</div>
        <div style="font-size:36px;font-weight:900;color:#dc2626">850.000 TL</div>
        <div style="font-size:12px;color:#9f1239;margin-top:2px">+ olası KVKK cezası 100.000 – 750.000 TL</div>
      </div>
      <div style="background:#f0fdf4;border-radius:8px;padding:20px;margin-bottom:24px;text-align:center">
        <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">CyberStep ile yıllık koruma</div>
        <div style="font-size:36px;font-weight:900;color:#16a34a">5.880 TL</div>
        <div style="font-size:12px;color:#166534;margin-top:2px">Başlangıç planı (490 TL/ay × 12)</div>
      </div>
      <a href="${roiUrl}" style="display:block;background:#f59e0b;color:#fff;text-align:center;padding:14px 24px;border-radius:8px;font-size:15px;font-weight:700;text-decoration:none;margin-bottom:12px">Şirketinize Özel ROI Hesapla</a>
      <a href="${assessUrl}" style="display:block;border:1px solid #e2e8f0;color:#475569;text-align:center;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;margin-bottom:24px">Ücretsiz Değerlendirme Başlat</a>
      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">Bu e-postayı almak istemiyorsanız <a href="${unsubUrl}" style="color:#64748b">buraya tıklayın</a>.</p>
    </div>
  </div>
</body></html>`,
    },
    {
      // Adım 3 — Gün 7
      subject: `Son hatırlatma: ${domain} taramasından 7 gün geçti`,
      html: `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
    <div style="background:#0f172a;padding:24px 32px"><span style="font-size:22px;font-weight:700;color:#fff">CyberStep.io</span></div>
    <div style="padding:32px">
      <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a">7 Gün Önce Taranan: ${domain}</h2>
      <p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.6">Alan adı güvenlik taramanızın üzerinden bir hafta geçti. Güvenlik açıklarınız hâlâ devam ediyorsa her gün ek risk taşıyorsunuz demektir.</p>
      <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:24px">
        <p style="margin:0;font-size:14px;color:#1e40af;font-weight:600;line-height:1.5">Ücretsiz Mini Değerlendirme ile 5 güvenlik alanında 20 kritik soruyu yanıtlayın — AI destekli kişisel risk raporu 3 dakikada hazır.</p>
      </div>
      <a href="${assessUrl}" style="display:block;background:#10b981;color:#fff;text-align:center;padding:16px 24px;border-radius:8px;font-size:16px;font-weight:700;text-decoration:none;margin-bottom:24px">Şimdi Ücretsiz Değerlendirme Yap</a>
      <p style="margin:0 0 24px;font-size:13px;color:#64748b;text-align:center">Bu son hatırlatmamızdır. Bundan sonra e-posta göndermeyeceğiz.</p>
      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">Almak istemiyorsanız <a href="${unsubUrl}" style="color:#64748b">buraya tıklayın</a>.</p>
    </div>
  </div>
</body></html>`,
    },
  ];

  const stepData = STEPS[step];
  if (!stepData) return false;

  try {
    await transport.sendMail({
      from: `"CyberStep.io" <${process.env["SMTP_USER"]}>`,
      to: email,
      subject: stepData.subject,
      html: stepData.html,
    });
    logger.info({ email, domain, step }, "Scan lead drip email sent");
    return true;
  } catch (err) {
    logger.error({ err, email, domain, step }, "Scan lead drip email failed");
    return false;
  }
}

// ─── Onboarding D+3: Assessment hatırlatma ───────────────────────────────────
export async function sendOnboardingD3Email(params: {
  email: string;
  fullName: string;
  companyName?: string;
  assessmentUrl: string;
}): Promise<void> {
  const transport = getTransport();
  if (!transport) return;

  const greeting = params.companyName
    ? `${params.fullName} (${params.companyName})`
    : params.fullName;

  await transport.sendMail({
    from: `"CyberStep.io" <${process.env["SMTP_USER"]}>`,
    to: params.email,
    subject: "Siber güvenlik değerlendirmeniz sizi bekliyor",
    html: `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#0f172a;padding:24px 32px">
      <span style="font-size:22px;font-weight:700;color:#10b981">CyberStep.io</span>
    </div>
    <div style="padding:32px">
      <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a">Merhaba ${greeting},</h2>
      <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6">
        CyberStep.io'ya katıldığınız için teşekkürler. Üç gün önce hesabınızı oluşturdunuz — şimdi şirketinizin siber güvenlik risklerini öğrenme zamanı.
      </p>
      <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:24px">
        <p style="margin:0;font-size:14px;color:#1e40af;font-weight:600">Ücretsiz Mini Değerlendirme</p>
        <p style="margin:6px 0 0;font-size:13px;color:#1e40af;line-height:1.5">
          20 soru, 5 güvenlik alanı, yapay zeka destekli kişisel risk raporu — sadece 10 dakika.
        </p>
      </div>
      <div style="margin-bottom:24px">
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <div style="flex:1;min-width:140px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;text-align:center">
            <p style="margin:0;font-size:22px;font-weight:800;color:#0f172a">20</p>
            <p style="margin:4px 0 0;font-size:12px;color:#64748b">Kritik Soru</p>
          </div>
          <div style="flex:1;min-width:140px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;text-align:center">
            <p style="margin:0;font-size:22px;font-weight:800;color:#10b981">Ucretsiz</p>
            <p style="margin:4px 0 0;font-size:12px;color:#64748b">Tamamen Ücretsiz</p>
          </div>
          <div style="flex:1;min-width:140px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;text-align:center">
            <p style="margin:0;font-size:22px;font-weight:800;color:#0f172a">10dk</p>
            <p style="margin:4px 0 0;font-size:12px;color:#64748b">Tamamlama Süresi</p>
          </div>
        </div>
      </div>
      <a href="${params.assessmentUrl}" style="display:block;background:#10b981;color:#fff;text-align:center;padding:16px 24px;border-radius:8px;font-size:16px;font-weight:700;text-decoration:none;margin-bottom:20px">
        Degerlendirmeyi Baslat
      </a>
      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">CyberStep.io — KOBİler için siber güvenlik platformu</p>
    </div>
  </div>
</body></html>`,
  });
  logger.info({ email: params.email }, "Onboarding D+3 email sent");
}

// ─── Onboarding D+7: Tam Assessment teklifi ──────────────────────────────────
export async function sendOnboardingD7Email(params: {
  email: string;
  fullName: string;
  companyName?: string;
  assessmentUrl: string;
  fullAssessmentUrl: string;
}): Promise<void> {
  const transport = getTransport();
  if (!transport) return;

  const greeting = params.companyName
    ? `${params.fullName} (${params.companyName})`
    : params.fullName;

  await transport.sendMail({
    from: `"CyberStep.io" <${process.env["SMTP_USER"]}>`,
    to: params.email,
    subject: "Şirketinizin siber risk skoru nedir? — 7 günlük hedefiniz",
    html: `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#0f172a;padding:24px 32px">
      <span style="font-size:22px;font-weight:700;color:#10b981">CyberStep.io</span>
    </div>
    <div style="padding:32px">
      <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a">Merhaba ${greeting},</h2>
      <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.6">
        Bir haftadır CyberStep.io'dasınız. KOBİler için siber güvenlik artık bir lüks değil — zorunluluk.
      </p>
      <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:16px 20px;margin-bottom:24px">
        <p style="margin:0;font-size:14px;color:#854d0e;font-weight:700">Türkiye'deki KOBİlerin %67'si siber saldırı sonrası 6 ay içinde kapanıyor.</p>
        <p style="margin:6px 0 0;font-size:13px;color:#92400e">Şirketinizin nerede durduğunu bilmek, ilk adım.</p>
      </div>
      <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6">
        <strong>55 soruluk Tam Değerlendirme</strong> ile 10 güvenlik alanında kapsamlı analiz yapın; PDF rapor, sektörel kıyaslama ve uzman danışmanlık görüşmesi alın.
      </p>
      <div style="display:flex;gap:12px;margin-bottom:20px;flex-direction:column">
        <a href="${params.fullAssessmentUrl}" style="display:block;background:#0f172a;color:#fff;text-align:center;padding:14px 24px;border-radius:8px;font-size:15px;font-weight:700;text-decoration:none">
          Tam Degerlendirme — 5.990 TL
        </a>
        <a href="${params.assessmentUrl}" style="display:block;background:#fff;color:#0f172a;text-align:center;padding:14px 24px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;border:1px solid #e2e8f0">
          Ucretsiz Mini Degerlendirme (20 soru)
        </a>
      </div>
      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">CyberStep.io — KOBİler için siber güvenlik platformu</p>
    </div>
  </div>
</body></html>`,
  });
  logger.info({ email: params.email }, "Onboarding D+7 email sent");
}

// ─── ServiceNow Bağlantı Uyarısı ─────────────────────────────────────────────

export async function sendServiceNowConnectionAlertEmail(params: {
  to: string;
  customerName: string;
  instanceUrl: string;
  errorMessage: string;
}): Promise<void> {
  const baseUrl = getBaseUrl();
  const integrationUrl = `${baseUrl}/hesabim/entegrasyonlar`;

  await sendMail({
    to: params.to,
    subject: "ServiceNow Entegrasyon Baglantisi Kesildi — CyberStep",
    html: `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:#0f172a;padding:28px 32px">
      <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.5px">CyberStep.io</span>
    </div>
    <div style="padding:32px">
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;margin-bottom:24px">
        <p style="margin:0;font-size:14px;font-weight:700;color:#b91c1c">Baglanti Hatasi Tespit Edildi</p>
      </div>
      <p style="margin:0 0 16px;font-size:15px;color:#334155">Sayin <strong>${params.customerName}</strong>,</p>
      <p style="margin:0 0 16px;font-size:15px;color:#475569">
        CyberStep SOC platformunuzun <strong>ServiceNow</strong> entegrasyonu baglantisi kesildi.
        Bu durumda yeni SOC vakalari ServiceNow'a aktarilamayacak ve mevcut ticketlar senkronize edilemeyecektir.
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin-bottom:24px">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Baglanti Bilgisi</p>
        <p style="margin:0 0 4px;font-size:14px;color:#0f172a"><strong>Instance URL:</strong> ${params.instanceUrl}</p>
        <p style="margin:0;font-size:13px;color:#dc2626;word-break:break-all"><strong>Hata:</strong> ${params.errorMessage.slice(0, 300)}</p>
      </div>
      <p style="margin:0 0 8px;font-size:15px;color:#475569">Yapilmasi gerekenler:</p>
      <ul style="margin:0 0 24px;padding-left:20px;color:#475569;font-size:14px;line-height:1.8">
        <li>ServiceNow API kullanici adi ve sifresinin gecerli oldugunu dogrulayin.</li>
        <li>ServiceNow instance URL'sinin dogru ve erisilebilir oldugunu kontrol edin.</li>
        <li>API hesabinin kilitlenmedigini veya sifresi dolmamis oldugunu kontrol edin.</li>
        <li>Entegrasyon ayarlarinizi CyberStep uzerinden guncelleyin.</li>
      </ul>
      <a href="${integrationUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:700;margin-bottom:24px">
        Entegrasyon Ayarlarina Git
      </a>
      <p style="margin:0;font-size:13px;color:#94a3b8">
        Bu bildirim, CyberStep'in gunluk baglanti saglik kontrolu tarafindan otomatik olarak gonderilmistir.
        Sorun giderildikten sonra bir sonraki kontrol gunu bildirim gonderilmeyecektir.
      </p>
    </div>
    <div style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0">
      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">CyberStep.io — KOBİler için siber guvenlik platformu</p>
    </div>
  </div>
</body></html>`,
  });
  logger.info({ to: params.to }, "ServiceNow connection alert email sent");
}
