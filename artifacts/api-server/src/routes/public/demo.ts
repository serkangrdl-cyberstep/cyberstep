import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { demoReportsTable, demoLeadsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { sendMail } from "../../services/email";
import fs from "fs";

const router = Router();

function getBaseUrl(): string {
  const domains = process.env["REPLIT_DOMAINS"];
  return domains ? `https://${domains.split(",")[0]?.trim()}` : "http://localhost:80";
}

const REPORT_LABELS: Record<string, string> = {
  easm: "EASM Degerlendirme Raporu",
  email_security: "E-posta Guvenligi Denetimi",
  board_report: "Yonetim Kurulu Guvenlik Raporu",
  cve_alert: "CVE Alarm Raporu",
  tprm: "Tedarikci Risk Tarama Raporu",
  threat_intel: "Tehdit Istihbarat Haftalik Raporu",
};

// GET /api/public/demo/reports — liste (PDF URL yok, lead capture gerektirir)
router.get("/reports", async (_req: Request, res: Response) => {
  try {
    const reports = await db.select({
      reportType: demoReportsTable.reportType,
      demoSector: demoReportsTable.demoSector,
      displayScore: demoReportsTable.displayScore,
      downloadCount: demoReportsTable.downloadCount,
      generatedAt: demoReportsTable.generatedAt,
    })
      .from(demoReportsTable)
      .where(eq(demoReportsTable.isActive, true))
      .orderBy(demoReportsTable.id);

    const enriched = reports.map((r) => ({
      ...r,
      label: REPORT_LABELS[r.reportType] ?? r.reportType,
    }));

    res.json({ reports: enriched });
  } catch (err) {
    logger.error({ err }, "Demo rapor listesi hatasi");
    res.status(500).json({ error: "Sunucu hatasi" });
  }
});

// POST /api/public/demo/download — lead kaydet, PDF URL dön
router.post("/download", async (req: Request, res: Response) => {
  const { reportType, email, name, company, phone } = req.body as Record<string, string>;

  if (!email || !reportType) {
    res.status(400).json({ error: "Email ve rapor tipi zorunludur" });
    return;
  }

  try {
    const [report] = await db.select()
      .from(demoReportsTable)
      .where(
        and(
          eq(demoReportsTable.reportType, reportType),
          eq(demoReportsTable.isActive, true),
        ),
      )
      .limit(1);

    if (!report) {
      res.status(404).json({ error: "Rapor bulunamadi — demo henuz olusturulmamis olabilir" });
      return;
    }

    // Lead kaydet (duplicate ignore)
    await db.insert(demoLeadsTable).values({
      reportType,
      reportId: report.id,
      email,
      name: name || null,
      company: company || null,
      phone: phone || null,
      source: "demo_page",
    }).onConflictDoNothing();

    // download_count artır
    await db.update(demoReportsTable)
      .set({ downloadCount: sql`download_count + 1` })
      .where(eq(demoReportsTable.reportType, reportType));

    const pdfUrl = report.pdfUrl ?? `${getBaseUrl()}/api/public/demo/reports/${report.pdfPath?.split("/").pop() ?? ""}`;

    // Email ve ISR fire-and-forget
    setImmediate(() => {
      const baseUrl = getBaseUrl();
      const firstName = name ? name.split(" ")[0] : null;
      void sendMail({
        to: email,
        subject: `Demo raporunuz hazir — CyberStep.io`,
        html: `
          <p>Merhaba${firstName ? ` ${firstName}` : ""},</p>
          <p><strong>${REPORT_LABELS[reportType] ?? reportType}</strong> demo raporunuzu indirmek icin asagidaki baglantiya tiklayin:</p>
          <p><a href="${pdfUrl}" style="background:#0F3460;color:white;padding:10px 20px;border-radius:4px;text-decoration:none;">Raporu Indir</a></p>
          <p>Kendi domain'inizi ucretsiz taramak icin:<br>
          <a href="${baseUrl}/araclar/domain-guvenlik-taramasi">${baseUrl}/araclar/domain-guvenlik-taramasi</a></p>
          <p style="color:#999;font-size:12px;">CyberStep.io — Bu DEMO rapordur. Gercek veriler icin degerlendirme baslatın.</p>
        `,
      }).catch((err: unknown) => logger.warn({ err }, "Demo download email gonderilemedi"));
    });

    res.json({ success: true, pdfUrl });
  } catch (err) {
    logger.error({ err }, "Demo download hatasi");
    res.status(500).json({ error: "Sunucu hatasi" });
  }
});

// GET /api/public/demo/reports/:filename — PDF dosya servis
router.get("/reports/:filename", async (req: Request, res: Response) => {
  const filename = String(req.params["filename"] ?? "");

  if (!filename.startsWith("demo-") || !filename.endsWith(".pdf")) {
    res.status(404).end();
    return;
  }

  const { serveDemoPDF } = await import("../../services/demoReportGenerator");
  const filePath = await serveDemoPDF(filename);

  if (!filePath) {
    res.status(404).json({ error: "Rapor bulunamadi" });
    return;
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "public, max-age=86400");
  fs.createReadStream(filePath).pipe(res);
});

export default router;
