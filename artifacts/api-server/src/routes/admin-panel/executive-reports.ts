import { Router } from "express";
import fs from "fs";
import path from "path";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../../middleware/auth";
import { logger } from "../../lib/logger";

const router = Router();

// ─── GET /api/admin-panel/executive-reports/list ──────────────────────────────
router.get("/admin-panel/executive-reports/list", requireAdmin, async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        er.id,
        er.customer_id,
        er.report_month,
        er.risk_score_current,
        er.risk_score_previous,
        er.risk_score_change,
        er.critical_cve_count,
        er.brand_suspicious_count,
        er.ssl_expiring_count,
        er.generated_at,
        er.pdf_path,
        c.email         AS customer_email,
        c.company_name  AS customer_name
      FROM executive_reports er
      LEFT JOIN customers c ON c.id = er.customer_id
      ORDER BY er.generated_at DESC
      LIMIT 50
    `);
    res.json(rows.rows);
  } catch (err) {
    logger.error({ err }, "executive-reports list failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── GET /api/admin-panel/executive-reports/:customerId/history ───────────────
router.get("/admin-panel/executive-reports/:customerId/history", requireAdmin, async (req, res) => {
  const customerId = Number(req.params["customerId"]);
  if (isNaN(customerId)) { res.status(400).json({ error: "Geçersiz müşteri ID" }); return; }
  try {
    const rows = await db.execute(sql`
      SELECT
        er.report_month,
        er.risk_score_current,
        er.risk_score_change,
        er.critical_cve_count,
        er.brand_suspicious_count,
        er.generated_at,
        er.pdf_path
      FROM executive_reports er
      WHERE er.customer_id = ${customerId}
      ORDER BY er.report_month ASC
      LIMIT 6
    `);
    res.json(rows.rows);
  } catch (err) {
    logger.error({ err, customerId }, "executive-reports history failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── POST /api/admin-panel/executive-reports/generate-now ────────────────────
// Body: { customer_id?: number, force?: boolean }
// When customer_id is provided manually (single customer), force=true by default
// so it regenerates even if a report already exists this month.
router.post("/admin-panel/executive-reports/generate-now", requireAdmin, async (req, res) => {
  const body = req.body as { customer_id?: number; force?: boolean };
  const customerId = body.customer_id != null ? Number(body.customer_id) : undefined;
  // Single-customer trigger is always forced (manual re-gen intent)
  const force = body.force === true || customerId != null;
  try {
    res.json({ message: "started", force });
    // fire-and-forget
    setImmediate(async () => {
      try {
        const { generateMonthlyReports } = await import("../../services/executive/executiveReportOrchestrator");
        const result = await generateMonthlyReports(customerId, force);
        logger.info(result, "executive-reports generate-now completed");
      } catch (err) {
        logger.error({ err }, "executive-reports generate-now failed");
      }
    });
  } catch (err) {
    logger.error({ err }, "executive-reports generate-now init failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ─── GET /api/admin-panel/executive-reports/:id/download ─────────────────────
router.get("/admin-panel/executive-reports/:id/download", requireAdmin, async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  try {
    const rows = await db.execute(sql`
      SELECT pdf_path, report_month, customer_id FROM executive_reports WHERE id = ${id} LIMIT 1
    `);
    const row = rows.rows[0] as { pdf_path: string | null; report_month: string; customer_id: number } | undefined;
    if (!row) { res.status(404).json({ error: "Rapor bulunamadı" }); return; }
    if (!row.pdf_path) { res.status(404).json({ error: "PDF henüz oluşturulmadı" }); return; }

    const filePath = path.join(process.cwd(), "public", row.pdf_path);
    if (!fs.existsSync(filePath)) { res.status(404).json({ error: "PDF dosyası bulunamadı" }); return; }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="CyberStep_Executive_${row.customer_id}_${row.report_month}.pdf"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    logger.error({ err, id }, "executive-reports download failed");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
