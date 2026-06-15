import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import {
  enterpriseProspectsTable,
  teaserReportsTable,
  enterpriseContractsTable,
  enterpriseContractServicesTable,
  enterpriseInvoicesTable,
  prospectRepliesTable,
  meetingRequestsTable,
} from "@workspace/db";
import { eq, desc, sql, and, count, isNull, inArray } from "drizzle-orm";
import { requireAdmin } from "../admin-panel/middleware";
import { generateTeaserReport, generatePreviewToken } from "../../services/teaserReportService";
import { logger } from "../../lib/logger";
import crypto from "crypto";

const router = Router();

// ─── Prospects ────────────────────────────────────────────────────────────────

router.get("/api/enterprise/prospects", requireAdmin, async (req: Request, res: Response) => {
  const rows = await db.select().from(enterpriseProspectsTable).orderBy(desc(enterpriseProspectsTable.lastActivityAt));
  res.json(rows);
});

router.get("/api/enterprise/prospects/stats", requireAdmin, async (req: Request, res: Response) => {
  const statuses = ["new", "scanned", "teaser_sent", "interested", "won", "lost"];
  const counts = await Promise.all(
    statuses.map(s =>
      db.select({ count: count() }).from(enterpriseProspectsTable)
        .where(eq(enterpriseProspectsTable.status, s))
    )
  );
  const result: Record<string, number> = {};
  statuses.forEach((s, i) => { result[s] = Number(counts[i]![0]?.count ?? 0); });
  res.json(result);
});

router.get("/api/enterprise/prospects/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const [row] = await db.select().from(enterpriseProspectsTable).where(eq(enterpriseProspectsTable.id, id));
  if (!row) return void res.status(404).json({ error: "Bulunamadı" });
  const teasers = await db.select().from(teaserReportsTable)
    .where(eq(teaserReportsTable.prospectId, id))
    .orderBy(desc(teaserReportsTable.createdAt));
  res.json({ ...row, teasers });
});

router.post("/api/enterprise/prospects", requireAdmin, async (req: Request, res: Response) => {
  const { companyName, domain, sector, employeeCount, city, contactName, contactTitle, contactEmail, contactPhone, linkedinUrl, source, assignedTo, notes } = req.body as Record<string, string>;
  if (!companyName || !domain) return void res.status(400).json({ error: "companyName ve domain zorunlu" });
  const [row] = await db.insert(enterpriseProspectsTable).values({
    companyName, domain, sector, employeeCount, city,
    contactName, contactTitle, contactEmail, contactPhone, linkedinUrl,
    source: source ?? "manual",
    assignedTo, notes, status: "new",
  }).returning();
  res.json({ ok: true, id: row?.id });
});

router.patch("/api/enterprise/prospects/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const updates = req.body as Record<string, unknown>;
  delete updates["id"]; delete updates["createdAt"];
  await db.update(enterpriseProspectsTable)
    .set({ ...updates, lastActivityAt: new Date() } as typeof updates)
    .where(eq(enterpriseProspectsTable.id, id));
  res.json({ ok: true });
});

router.delete("/api/enterprise/prospects/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  await db.delete(enterpriseProspectsTable).where(eq(enterpriseProspectsTable.id, id));
  res.json({ ok: true });
});

// ─── Teaser Report Generation ─────────────────────────────────────────────────

router.post("/api/enterprise/prospects/:id/scan", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const [prospect] = await db.select().from(enterpriseProspectsTable).where(eq(enterpriseProspectsTable.id, id));
  if (!prospect) return void res.status(404).json({ error: "Aday bulunamadı" });

  // Update status to scanning
  await db.update(enterpriseProspectsTable)
    .set({ status: "scanning", lastActivityAt: new Date() })
    .where(eq(enterpriseProspectsTable.id, id));

  res.json({ ok: true, message: "Tarama başlatıldı" });

  // Fire and forget
  setImmediate(async () => {
    try {
      const scanData: Record<string, unknown> = {
        domain: prospect.domain,
        company: prospect.companyName,
        sector: prospect.sector ?? "genel",
      };

      const result = await generateTeaserReport({
        domain: prospect.domain,
        companyName: prospect.companyName,
        sector: prospect.sector ?? "genel",
        scanData,
      });

      const token = generatePreviewToken();

      await db.insert(teaserReportsTable).values({
        prospectId: id,
        overallRiskScore: result.teaser.overall_score,
        riskLevel: result.teaser.risk_level,
        teaserHeadline: result.teaser.headline,
        teaserFindings: result.teaser.findings,
        teaserScenarioPreview: result.teaser.attack_scenario_preview,
        lockedSectionsHint: result.teaser.locked_sections_hint,
        urgencyNote: result.teaser.urgency_note,
        attackScenarios: result.full_scenarios,
        previewToken: token,
        status: "draft",
        criticalCount: result.teaser.findings.filter((f: { severity: string; locked: boolean }) => f.severity === "critical" && !f.locked).length,
        highCount: result.teaser.findings.filter((f: { severity: string; locked: boolean }) => f.severity === "high" && !f.locked).length,
      });

      await db.update(enterpriseProspectsTable)
        .set({ status: "scanned", lastActivityAt: new Date() })
        .where(eq(enterpriseProspectsTable.id, id));

      logger.info({ prospectId: id }, "Teaser report generated successfully");
    } catch (err) {
      logger.error({ err, prospectId: id }, "Teaser report generation failed");
      await db.update(enterpriseProspectsTable)
        .set({ status: "new", lastActivityAt: new Date() })
        .where(eq(enterpriseProspectsTable.id, id));
    }
  });
});

// ─── Teaser Reports ──────────────────────────────────────────────────────────

router.get("/api/enterprise/teaser/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const [row] = await db.select().from(teaserReportsTable).where(eq(teaserReportsTable.id, id));
  if (!row) return void res.status(404).json({ error: "Teaser bulunamadı" });
  res.json(row);
});

router.post("/api/enterprise/teaser/:id/approve", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const { approvedBy } = req.body as { approvedBy: string };
  await db.update(teaserReportsTable).set({
    status: "approved",
    approvedBy,
    approvedAt: new Date(),
  }).where(eq(teaserReportsTable.id, id));
  res.json({ ok: true });
});

router.post("/api/enterprise/teaser/:id/send", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const [report] = await db.select({
    report: teaserReportsTable,
    prospect: enterpriseProspectsTable,
  })
    .from(teaserReportsTable)
    .innerJoin(enterpriseProspectsTable, eq(teaserReportsTable.prospectId, enterpriseProspectsTable.id))
    .where(eq(teaserReportsTable.id, id));

  if (!report) return void res.status(404).json({ error: "Teaser bulunamadı" });

  const baseUrl = (() => {
    const domains = process.env["REPLIT_DOMAINS"];
    if (domains) { const f = domains.split(",")[0]?.trim(); if (f) return `https://${f}`; }
    return "http://localhost:80";
  })();

  const previewUrl = `${baseUrl}/preview/${report.report.previewToken}`;
  const contactEmail = report.prospect.contactEmail;

  if (!contactEmail) {
    return void res.status(400).json({ error: "Aday için e-posta adresi tanımlı değil" });
  }

  try {
    const { sendMail } = await import("../../services/email");

    type Finding = { title: string; severity?: string; locked: boolean; preview_text?: string | null };
    const findings = (report.report.teaserFindings as Finding[] ?? []);
    const openFindings = findings.filter(f => !f.locked);
    const lockedCount = findings.filter(f => f.locked).length;
    const riskLevel = report.report.riskLevel ?? "medium";
    const score = report.report.overallRiskScore ?? 0;

    const RISK_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
      critical: { label: "KRİTİK",  color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" },
      high:     { label: "YÜKSEK",  color: "#ea580c", bg: "#fff7ed", border: "#fdba74" },
      medium:   { label: "ORTA",    color: "#ca8a04", bg: "#fefce8", border: "#fde047" },
      low:      { label: "DÜŞÜK",   color: "#16a34a", bg: "#f0fdf4", border: "#86efac" },
    };
    const rm = RISK_META[riskLevel] ?? RISK_META["medium"]!;

    // Severity badge helper
    const sevBadge = (sev?: string) => {
      const m: Record<string, string> = { critical: "#dc2626", high: "#ea580c", medium: "#ca8a04", low: "#16a34a" };
      const c = m[sev ?? "medium"] ?? "#ca8a04";
      const l: Record<string, string> = { critical: "Kritik", high: "Yüksek", medium: "Orta", low: "Düşük" };
      return `<span style="display:inline-block;background:${c};color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:3px;text-transform:uppercase;">${l[sev ?? "medium"] ?? "Orta"}</span>`;
    };

    const findingRows = openFindings.map(f => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#222;">${f.title}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${sevBadge(f.severity)}</td>
      </tr>`).join("");

    // Pricing PDF attachment if configured
    const pricingPdfPath = process.env["ENTERPRISE_PRICING_PDF_PATH"];
    const attachments = pricingPdfPath
      ? [{ filename: "CyberStep-Enterprise-Teklif.pdf", path: pricingPdfPath, contentType: "application/pdf" }]
      : [];

    await sendMail({
      to: contactEmail,
      subject: `${report.prospect.domain} Güvenlik Analizi — CyberStep.io`,
      attachments,
      html: `
<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">

  <!-- Header -->
  <tr>
    <td style="background:#0f172a;padding:24px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <span style="font-size:20px;font-weight:700;color:#ffffff;">CyberStep</span><span style="font-size:20px;color:#10b981;">.io</span>
          </td>
          <td align="right">
            <span style="font-size:11px;color:#94a3b8;">Güvenlik Analiz Raporu</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Body -->
  <tr><td style="padding:32px;">

    <!-- Greeting -->
    <p style="margin:0 0 16px;font-size:15px;color:#222;">Sayın ${report.prospect.contactName ?? "İlgili Kişi"},</p>

    <!-- Intro / identity paragraph -->
    <p style="margin:0 0 16px;font-size:14px;color:#444;line-height:1.7;">
      CyberStep.io, Türkiye'deki şirketlerin siber güvenlik risklerini ölçmek ve yönetmek için geliştirilmiş
      yerli bir platformdur. 500'den fazla Türk şirketine dış saldırı yüzeyi analizi, yapay zeka destekli
      tehdit değerlendirmesi ve KVKK uyum hizmetleri sunmaktayız.
    </p>
    <p style="margin:0 0 28px;font-size:14px;color:#444;line-height:1.7;">
      Rutin güvenlik taramalarımız kapsamında <strong>${report.prospect.domain}</strong> alan adınızı
      inceledik ve kritik önem taşıdığını değerlendirdiğimiz güvenlik açıkları tespit ettik.
      Aşağıda bulgularımızın bir özetini bulabilirsiniz.
    </p>

    <!-- Risk score banner -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${rm.bg};border:1px solid ${rm.border};border-radius:8px;margin-bottom:24px;">
      <tr>
        <td style="padding:20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.5px;">Güvenlik Skoru</p>
                <p style="margin:0;font-size:36px;font-weight:700;color:${rm.color};">${score}<span style="font-size:16px;color:#888;">/100</span></p>
              </td>
              <td align="right" style="vertical-align:top;">
                <span style="display:inline-block;background:${rm.color};color:#fff;font-size:12px;font-weight:700;padding:4px 12px;border-radius:4px;letter-spacing:.5px;">${rm.label}</span>
                <p style="margin:6px 0 0;font-size:11px;color:#666;text-align:right;">${report.prospect.companyName ?? report.prospect.domain}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Findings table -->
    ${openFindings.length > 0 ? `
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#222;text-transform:uppercase;letter-spacing:.4px;">Tespit Edilen Açık Bulgular</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:16px;">
      <tr style="background:#f8f8f8;">
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;font-weight:600;text-transform:uppercase;">Bulgu</th>
        <th style="padding:8px 12px;text-align:right;font-size:11px;color:#888;font-weight:600;text-transform:uppercase;">Önem</th>
      </tr>
      ${findingRows}
    </table>` : ""}

    <!-- Locked hint -->
    ${lockedCount > 0 ? `
    <p style="margin:0 0 24px;font-size:13px;color:#888;background:#f8f8f8;border-radius:6px;padding:10px 14px;">
      🔒 Tam raporda <strong>${lockedCount} ek bulgu</strong> daha yer almaktadır. Erişim için aşağıdaki bağlantıyı kullanın.
    </p>` : ""}

    <!-- Attack scenario preview -->
    ${report.report.teaserScenarioPreview ? `
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#222;text-transform:uppercase;letter-spacing:.4px;">Saldırı Senaryosu Önizlemesi</p>
    <div style="background:#fafafa;border-left:3px solid #e5e7eb;padding:12px 16px;margin-bottom:24px;border-radius:0 6px 6px 0;">
      <p style="margin:0;font-size:13px;color:#555;line-height:1.7;font-style:italic;">${report.report.teaserScenarioPreview}</p>
    </div>` : ""}

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td align="center">
          <a href="${previewUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;font-size:14px;font-weight:700;padding:14px 32px;border-radius:6px;text-decoration:none;letter-spacing:.3px;">
            Tam Raporu Görüntüle →
          </a>
        </td>
      </tr>
    </table>

    <!-- Closing -->
    <p style="margin:0 0 4px;font-size:14px;color:#444;">Saygılarımla,</p>
    <p style="margin:0;font-size:14px;color:#222;font-weight:600;">CyberStep.io Güvenlik Ekibi</p>
    <p style="margin:4px 0 0;font-size:13px;color:#0066cc;"><a href="mailto:security@cyberstep.io" style="color:#0066cc;">security@cyberstep.io</a></p>

  </td></tr>

  <!-- Footer -->
  <tr>
    <td style="background:#f8f8f8;border-top:1px solid #e5e7eb;padding:16px 32px;">
      <p style="margin:0;font-size:11px;color:#aaa;line-height:1.6;">
        Bu e-posta, <strong>${report.prospect.domain}</strong> alan adının kamuya açık güvenlik taramasına dayanmaktadır.
        Herhangi bir sisteminize yetkisiz erişim gerçekleştirilmemiştir. Tüm veriler OSINT ve pasif keşif teknikleriyle elde edilmiştir.
        Artık e-posta almak istemiyorsanız <a href="mailto:security@cyberstep.io?subject=Abonelikten%20Çık%20${encodeURIComponent(report.prospect.domain)}" style="color:#aaa;">abonelikten çıkabilirsiniz</a>.
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`,
    });

    await db.update(teaserReportsTable).set({
      status: "sent",
      emailSentAt: new Date(),
    }).where(eq(teaserReportsTable.id, id));

    await db.update(enterpriseProspectsTable)
      .set({ status: "teaser_sent", lastActivityAt: new Date() })
      .where(eq(enterpriseProspectsTable.id, report.report.prospectId!));

    res.json({ ok: true, previewUrl });
  } catch (err) {
    logger.error({ err }, "Teaser email send failed");
    res.status(500).json({ error: "E-posta gönderilemedi" });
  }
});

// ─── Public Preview (no auth) ─────────────────────────────────────────────────

router.get("/preview/:token", async (req: Request, res: Response) => {
  const { token } = req.params;
  const [row] = await db.select({
    report: teaserReportsTable,
    prospect: enterpriseProspectsTable,
  })
    .from(teaserReportsTable)
    .innerJoin(enterpriseProspectsTable, eq(teaserReportsTable.prospectId, enterpriseProspectsTable.id))
    .where(eq(teaserReportsTable.previewToken, String(token ?? "")));

  if (!row) return void res.status(404).json({ error: "Rapor bulunamadı" });

  // Track first view
  if (!row.report.previewViewedAt) {
    await db.update(teaserReportsTable).set({
      previewViewedAt: new Date(),
      status: "viewed",
    }).where(eq(teaserReportsTable.previewToken, String(token ?? "")));
  }

  const findings = (row.report.teaserFindings as Array<{ title: string; severity: string; locked: boolean; preview_text: string | null }> ?? []);

  res.json({
    domain: row.prospect.domain,
    companyName: row.prospect.companyName,
    overall_score: row.report.overallRiskScore,
    risk_level: row.report.riskLevel,
    teaser_headline: row.report.teaserHeadline,
    teaser_findings: findings,
    attack_scenario_preview: row.report.teaserScenarioPreview,
    locked_sections_hint: row.report.lockedSectionsHint,
    urgency_note: row.report.urgencyNote,
    cta_clicked: !!row.report.ctaClickedAt,
  });
});

router.post("/preview/:token/cta", async (req: Request, res: Response) => {
  const { token } = req.params;
  const { name, email, phone, message } = req.body as Record<string, string>;

  await db.update(teaserReportsTable).set({
    ctaClickedAt: new Date(),
    ctaContactName: name,
    ctaContactEmail: email,
    ctaContactPhone: phone,
    ctaMessage: message,
    status: "cta_clicked",
  }).where(eq(teaserReportsTable.previewToken, String(token ?? "")));

  res.json({ ok: true });
});

// ─── Görüşme Talebi ───────────────────────────────────────────────────────────

router.post("/preview/:token/meeting-request", async (req: Request, res: Response) => {
  const { token } = req.params;
  const { name, email, phone, message } = req.body as Record<string, string>;
  if (!email) return void res.status(400).json({ error: "E-posta zorunlu" });

  const [row] = await db.select({
    report: teaserReportsTable,
    prospect: enterpriseProspectsTable,
  })
    .from(teaserReportsTable)
    .innerJoin(enterpriseProspectsTable, eq(teaserReportsTable.prospectId, enterpriseProspectsTable.id))
    .where(eq(teaserReportsTable.previewToken, String(token ?? "")));

  if (!row) return void res.status(404).json({ error: "Geçersiz token" });

  await db.insert(meetingRequestsTable).values({
    prospectId: row.prospect.id,
    teaserReportId: row.report.id,
    name: name || "",
    email: email || "",
    phone: phone || "",
    message: message || "",
    status: "pending",
  });

  await db.update(enterpriseProspectsTable)
    .set({
      status: "interested",
      contactEmail: email || row.prospect.contactEmail,
      contactName: name || row.prospect.contactName,
      lastActivityAt: new Date(),
    })
    .where(eq(enterpriseProspectsTable.id, row.prospect.id));

  // ISR ekibine e-posta
  setImmediate(async () => {
    try {
      const { sendMail } = await import("../../services/email");
      const appUrl = process.env["REPLIT_DOMAINS"]
        ? `https://${process.env["REPLIT_DOMAINS"].split(",")[0]?.trim()}`
        : "http://localhost:80";
      await sendMail({
        to: process.env["ISR_TEAM_EMAIL"] || "isr@cyberstep.io",
        subject: `Görüşme Talebi: ${row.prospect.domain} (${row.report.overallRiskScore ?? "?"}/100)`,
        html: `
<div style="font-family:Arial;background:#060D1A;padding:32px;max-width:560px;border-radius:12px">
  <h2 style="color:#00C8FF;margin:0 0 16px">Yeni Görüşme Talebi</h2>
  <div style="background:#0A1828;border-radius:8px;padding:16px;margin-bottom:16px">
    <div style="color:#8896A8;font-size:12px;margin-bottom:4px">DOMAIN</div>
    <div style="color:#E8EDF5;font-size:18px;font-weight:700">${row.prospect.domain}</div>
    <div style="color:#F5A623;font-size:15px;margin-top:4px">Skor: ${row.report.overallRiskScore ?? "?"}/100</div>
  </div>
  <div style="background:#0A1828;border-radius:8px;padding:16px;margin-bottom:16px">
    <div style="color:#8896A8;font-size:12px;margin-bottom:8px">İLETİŞİM</div>
    <div style="color:#E8EDF5">İsim: ${name || "Belirtilmedi"}</div>
    <div style="color:#E8EDF5">E-posta: ${email}</div>
    <div style="color:#E8EDF5">Telefon: ${phone || "Belirtilmedi"}</div>
    ${message ? `<div style="color:#8896A8;margin-top:8px">Not: ${message}</div>` : ""}
  </div>
  <a href="${appUrl}/panel/isr/meeting-requests"
     style="display:block;background:#00C8FF;color:#060D1A;text-align:center;padding:12px;border-radius:8px;font-weight:900;text-decoration:none">
    Görüşme Taleplerini Gör →
  </a>
</div>`,
      });
      // Müşteriye onay maili
      await sendMail({
        to: email,
        subject: "Görüşme Talebiniz Alındı — CyberStep",
        html: `
<div style="font-family:Arial;background:#060D1A;padding:32px;max-width:560px;border-radius:12px">
  <h2 style="color:#2ECC71;margin:0 0 16px">Talebiniz Alındı</h2>
  <p style="color:#E8EDF5">Merhaba${name ? " " + name : ""},</p>
  <p style="color:#8896A8;line-height:1.6">
    <strong style="color:#E8EDF5">${row.prospect.domain}</strong> için güvenlik görüşme talebinizi aldık.
    Uzmanımız en geç <strong style="color:#2ECC71">24 saat</strong> içinde sizinle iletişime geçecek.
  </p>
  <div style="background:#0A1828;border-radius:8px;padding:16px;margin:20px 0">
    <div style="color:#8896A8;font-size:13px">Bu süreçte yapabilecekleriniz:</div>
    <div style="color:#E8EDF5;margin-top:8px">
      SSL sertifikanızın yenileme tarihini kontrol edin<br>
      E-posta güvenliğiniz için DMARC kaydı ekleyin<br>
      IT ekibinizi görüşmeye dahil edin
    </div>
  </div>
  <p style="color:#4A6080;font-size:12px">CyberStep · cyberstep.io · info@cyberstep.io</p>
</div>`,
      });
    } catch (err) {
      logger.warn({ err }, "Meeting request email send failed");
    }
  });

  res.json({ success: true });
});

// ─── Checkout Preview ─────────────────────────────────────────────────────────

router.get("/api/public/teaser/:token/checkout-preview", async (req: Request, res: Response) => {
  const { token } = req.params;
  const [row] = await db.select({
    report: teaserReportsTable,
    prospect: enterpriseProspectsTable,
  })
    .from(teaserReportsTable)
    .innerJoin(enterpriseProspectsTable, eq(teaserReportsTable.prospectId, enterpriseProspectsTable.id))
    .where(eq(teaserReportsTable.previewToken, String(token ?? "")));

  if (!row) return void res.status(404).json({ error: "Geçersiz token" });

  const score = row.report.overallRiskScore ?? 50;
  const recommendedPlan = score < 40
    ? { name: "Zırh", price: 5990, description: "Gelişmiş koruma" }
    : { name: "Kalkan", price: 2990, description: "Temel koruma ve izleme" };

  res.json({
    domain: row.prospect.domain,
    score,
    grade: score >= 90 ? "A" : score >= 70 ? "B" : score >= 50 ? "C" : score >= 30 ? "D" : "F",
    criticalCount: row.report.criticalCount ?? 0,
    highCount: row.report.highCount ?? 0,
    plan: recommendedPlan,
  });
});

// ─── ISR Meeting Requests (admin) ─────────────────────────────────────────────

router.get("/api/enterprise/isr/meeting-requests", requireAdmin, async (req: Request, res: Response) => {
  const { status } = req.query as Record<string, string>;
  const rows = await db.select({
    request: meetingRequestsTable,
    prospect: {
      id: enterpriseProspectsTable.id,
      domain: enterpriseProspectsTable.domain,
      companyName: enterpriseProspectsTable.companyName,
      sector: enterpriseProspectsTable.sector,
    },
    reportScore: teaserReportsTable.overallRiskScore,
    reportLevel: teaserReportsTable.riskLevel,
  })
    .from(meetingRequestsTable)
    .leftJoin(enterpriseProspectsTable, eq(meetingRequestsTable.prospectId, enterpriseProspectsTable.id))
    .leftJoin(teaserReportsTable, eq(meetingRequestsTable.teaserReportId, teaserReportsTable.id))
    .where(status && status !== "all" ? eq(meetingRequestsTable.status, status) : sql`1=1`)
    .orderBy(desc(meetingRequestsTable.requestedAt))
    .limit(200);
  res.json(rows);
});

router.patch("/api/enterprise/isr/meeting-requests/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const { status } = req.body as { status: string };
  const now = new Date();
  await db.update(meetingRequestsTable).set({
    status,
    ...(status === "contacted" ? { contactedAt: now } : {}),
    ...(status === "scheduled" ? { scheduledAt: now } : {}),
  }).where(eq(meetingRequestsTable.id, id));
  res.json({ ok: true });
});

// ─── Contracts ────────────────────────────────────────────────────────────────

router.get("/api/enterprise/contracts", requireAdmin, async (req: Request, res: Response) => {
  const rows = await db.select().from(enterpriseContractsTable).orderBy(desc(enterpriseContractsTable.createdAt));
  res.json(rows);
});

router.get("/api/enterprise/contracts/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const [contract] = await db.select().from(enterpriseContractsTable).where(eq(enterpriseContractsTable.id, id));
  if (!contract) return void res.status(404).json({ error: "Sözleşme bulunamadı" });
  const services = await db.select().from(enterpriseContractServicesTable)
    .where(eq(enterpriseContractServicesTable.contractId, id));
  const invoices = await db.select().from(enterpriseInvoicesTable)
    .where(eq(enterpriseInvoicesTable.contractId, id))
    .orderBy(desc(enterpriseInvoicesTable.createdAt));
  res.json({ ...contract, services, invoices });
});

function generateContractNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const seq = Math.floor(Math.random() * 9000) + 1000;
  return `CS-${year}-${seq}`;
}

router.post("/api/enterprise/contracts", requireAdmin, async (req: Request, res: Response) => {
  const body = req.body as {
    prospectId?: number;
    companyName: string;
    companyTaxId?: string;
    companyTaxOffice?: string;
    companyAddress?: string;
    billingContactName?: string;
    billingContactEmail?: string;
    contractType?: string;
    billingCycle?: string;
    paymentMethod?: string;
    paymentTerms?: number;
    startDate: string;
    endDate?: string;
    discountPct?: number;
    discountReason?: string;
    internalNotes?: string;
    createdBy?: string;
    services?: Array<{ serviceSlug: string; serviceName: string; unitPriceTl: string; quantity: number; lineTotalTl: string }>;
  };

  const contractNumber = generateContractNumber();
  const [contract] = await db.insert(enterpriseContractsTable).values({
    prospectId: body.prospectId,
    contractNumber,
    companyName: body.companyName,
    companyTaxId: body.companyTaxId,
    companyTaxOffice: body.companyTaxOffice,
    companyAddress: body.companyAddress,
    billingContactName: body.billingContactName,
    billingContactEmail: body.billingContactEmail,
    contractType: body.contractType ?? "annual",
    billingCycle: body.billingCycle ?? "annual",
    paymentMethod: body.paymentMethod ?? "bank_transfer",
    paymentTerms: body.paymentTerms ?? 30,
    startDate: body.startDate,
    endDate: body.endDate,
    discountPct: body.discountPct ?? 0,
    discountReason: body.discountReason,
    internalNotes: body.internalNotes,
    createdBy: body.createdBy,
    status: "draft",
  }).returning();

  if (body.services?.length && contract) {
    await db.insert(enterpriseContractServicesTable).values(
      body.services.map(s => ({
        contractId: contract.id,
        serviceSlug: s.serviceSlug,
        serviceName: s.serviceName,
        unitPriceTl: s.unitPriceTl,
        quantity: s.quantity,
        lineTotalTl: s.lineTotalTl,
        isActive: false,
      }))
    );
  }

  res.json({ ok: true, id: contract?.id, contractNumber });
});

router.patch("/api/enterprise/contracts/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const updates = req.body as Record<string, unknown>;
  delete updates["id"]; delete updates["createdAt"]; delete updates["services"]; delete updates["invoices"];
  await db.update(enterpriseContractsTable)
    .set({ ...updates, updatedAt: new Date() } as typeof updates)
    .where(eq(enterpriseContractsTable.id, id));
  res.json({ ok: true });
});

router.post("/api/enterprise/contracts/:id/activate", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const { activatedBy, serviceIds } = req.body as { activatedBy: string; serviceIds?: number[] };

  await db.update(enterpriseContractsTable).set({
    status: "active",
    activatedAt: new Date(),
    activatedBy,
    updatedAt: new Date(),
  }).where(eq(enterpriseContractsTable.id, id));

  if (serviceIds?.length) {
    for (const sId of serviceIds) {
      await db.update(enterpriseContractServicesTable).set({
        isActive: true,
        activatedAt: new Date(),
      }).where(eq(enterpriseContractServicesTable.id, sId));
    }
  } else {
    await db.update(enterpriseContractServicesTable).set({
      isActive: true,
      activatedAt: new Date(),
    }).where(eq(enterpriseContractServicesTable.contractId, id));
  }

  res.json({ ok: true });
});

// ─── Invoices ────────────────────────────────────────────────────────────────

router.get("/api/enterprise/invoices", requireAdmin, async (req: Request, res: Response) => {
  const rows = await db.select().from(enterpriseInvoicesTable).orderBy(desc(enterpriseInvoicesTable.createdAt));
  res.json(rows);
});

function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const seq = Math.floor(Math.random() * 9000) + 1000;
  return `INV-${year}${month}-${seq}`;
}

router.post("/api/enterprise/invoices", requireAdmin, async (req: Request, res: Response) => {
  const body = req.body as {
    contractId: number;
    customerId?: number;
    periodStart?: string;
    periodEnd?: string;
    subtotalTl: string;
    vatRate?: number;
    vatAmountTl: string;
    totalTl: string;
    dueDate?: string;
  };

  const invoiceNumber = generateInvoiceNumber();
  const [invoice] = await db.insert(enterpriseInvoicesTable).values({
    ...body,
    invoiceNumber,
    status: "pending",
  }).returning();

  res.json({ ok: true, id: invoice?.id, invoiceNumber });
});

router.patch("/api/enterprise/invoices/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const updates = req.body as Record<string, unknown>;
  delete updates["id"]; delete updates["createdAt"];
  await db.update(enterpriseInvoicesTable).set(updates as typeof updates).where(eq(enterpriseInvoicesTable.id, id));
  res.json({ ok: true });
});

// ─── Customer-facing: my prospect ─────────────────────────────────────────────

router.get("/api/enterprise/my-prospect", async (req: Request, res: Response) => {
  const session = (req as unknown as { session?: { customerId?: number; customer?: { email?: string } } }).session;
  if (!session?.customerId) return void res.status(401).json({ error: "Yetkisiz" });

  // Look up prospect by customer's email domain
  const customer = session.customer as { email?: string } | undefined;
  if (!customer?.email) return void res.status(404).json({ error: "Bulunamadı" });

  const emailDomain = customer.email.split("@")[1] ?? "";
  if (!emailDomain) return void res.status(404).json({ error: "Bulunamadı" });

  const [prospect] = await db
    .select({
      id: enterpriseProspectsTable.id,
      domain: enterpriseProspectsTable.domain,
      companyName: enterpriseProspectsTable.companyName,
      status: enterpriseProspectsTable.status,
      lastActivityAt: enterpriseProspectsTable.lastActivityAt,
      createdAt: enterpriseProspectsTable.createdAt,
    })
    .from(enterpriseProspectsTable)
    .where(eq(enterpriseProspectsTable.domain, emailDomain))
    .limit(1);

  if (!prospect) return void res.status(404).json({ error: "Bulunamadı" });

  // Fetch the latest teaser report for this prospect
  const [report] = await db
    .select({
      overallRiskScore: teaserReportsTable.overallRiskScore,
      riskLevel: teaserReportsTable.riskLevel,
      teaserHeadline: teaserReportsTable.teaserHeadline,
      previewToken: teaserReportsTable.previewToken,
      criticalCount: teaserReportsTable.criticalCount,
      highCount: teaserReportsTable.highCount,
    })
    .from(teaserReportsTable)
    .where(eq(teaserReportsTable.prospectId, prospect.id))
    .orderBy(desc(teaserReportsTable.createdAt))
    .limit(1);

  res.json({ ...prospect, ...(report ?? {}) });
});

// ─── ISR Sabah Dashboard ──────────────────────────────────────────────────────

router.get("/api/enterprise/isr/dashboard", requireAdmin, async (req: Request, res: Response) => {
  const qualifiedStatuses = ["scanned", "scanning", "teaser_sent", "interested"];
  const prospects = await db
    .select()
    .from(enterpriseProspectsTable)
    .where(sql`${enterpriseProspectsTable.status} = ANY(ARRAY[${sql.join(qualifiedStatuses.map(s => sql`${s}`), sql`, `)}])`)
    .orderBy(desc(enterpriseProspectsTable.lastActivityAt))
    .limit(200);

  const prospectIds = prospects.map((p) => p.id);

  // En son teaser raporu her prospect için
  const teasers = prospectIds.length > 0
    ? await db.execute(sql`
        SELECT DISTINCT ON (prospect_id) *
        FROM teaser_reports
        WHERE prospect_id = ANY(ARRAY[${sql.raw(prospectIds.join(","))}]::int[])
        ORDER BY prospect_id, created_at DESC
      `)
    : { rows: [] };

  const teaserMap = new Map<number, Record<string, unknown>>();
  for (const row of teasers.rows as Array<Record<string, unknown>>) {
    const pid = Number(row["prospect_id"]);
    teaserMap.set(pid, row);
  }

  const result = prospects.map((p) => {
    const teaser = teaserMap.get(p.id) ?? null;
    return {
      ...p,
      teaser,
      contactComplete: !!(p.contactEmail && p.contactName),
      followup1Sent: !!(teaser?.["followup_1_sent_at"]),
      followup2Sent: !!(teaser?.["followup_2_sent_at"]),
    };
  });

  res.json(result);
});

// ─── Prospect Replies ─────────────────────────────────────────────────────────

router.get("/api/enterprise/isr/replies", requireAdmin, async (req: Request, res: Response) => {
  const { handled } = req.query as Record<string, string>;
  const rows = await db
    .select({
      reply: prospectRepliesTable,
      prospect: {
        id: enterpriseProspectsTable.id,
        companyName: enterpriseProspectsTable.companyName,
        domain: enterpriseProspectsTable.domain,
        status: enterpriseProspectsTable.status,
      },
    })
    .from(prospectRepliesTable)
    .leftJoin(enterpriseProspectsTable, eq(prospectRepliesTable.prospectId, enterpriseProspectsTable.id))
    .where(handled === "true" ? sql`${prospectRepliesTable.isHandled} = true` : sql`${prospectRepliesTable.isHandled} = false`)
    .orderBy(desc(prospectRepliesTable.receivedAt))
    .limit(100);
  res.json(rows);
});

router.patch("/api/enterprise/isr/replies/:id/handle", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const { handledBy, handlerNotes } = req.body as { handledBy?: string; handlerNotes?: string };
  await db.update(prospectRepliesTable).set({
    isHandled: true,
    handledAt: new Date(),
    handledBy: handledBy ?? "admin",
    handlerNotes,
  }).where(eq(prospectRepliesTable.id, id));
  res.json({ ok: true });
});

// ─── Prospect contact-only update ─────────────────────────────────────────────
router.patch("/api/enterprise/prospects/:id/contact", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params["id"] ?? "0"));
  const { contactName, contactTitle, contactEmail, contactPhone, linkedinUrl } = req.body as Record<string, string>;
  await db.update(enterpriseProspectsTable)
    .set({ contactName, contactTitle, contactEmail, contactPhone, linkedinUrl, lastActivityAt: new Date() })
    .where(eq(enterpriseProspectsTable.id, id));
  res.json({ ok: true });
});

// ─── Customer portal ──────────────────────────────────────────────────────────

router.post("/api/enterprise/my-prospect/contact", async (req: Request, res: Response) => {
  const session = (req as unknown as { session?: { customerId?: number; customer?: { email?: string } } }).session;
  if (!session?.customerId) return void res.status(401).json({ error: "Yetkisiz" });

  const { name, phone, message } = req.body as Record<string, string>;
  const customer = session.customer as { email?: string } | undefined;
  const emailDomain = customer?.email?.split("@")[1] ?? "";

  const [prospect] = await db
    .select({ id: enterpriseProspectsTable.id })
    .from(enterpriseProspectsTable)
    .where(eq(enterpriseProspectsTable.domain, emailDomain))
    .limit(1);

  if (prospect) {
    // Update teaser report CTA with contact info
    await db.update(teaserReportsTable)
      .set({
        ctaClickedAt: new Date(),
        ctaContactName: name,
        ctaContactPhone: phone,
        ctaMessage: message,
        ctaContactEmail: customer?.email ?? "",
        status: "cta_clicked",
      })
      .where(eq(teaserReportsTable.prospectId, prospect.id));

    await db.update(enterpriseProspectsTable)
      .set({ status: "interested", lastActivityAt: new Date() })
      .where(eq(enterpriseProspectsTable.id, prospect.id));
  }

  logger.info({ emailDomain, name, phone }, "Customer enterprise contact request");
  res.json({ ok: true });
});

export default router;
