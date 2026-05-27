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
