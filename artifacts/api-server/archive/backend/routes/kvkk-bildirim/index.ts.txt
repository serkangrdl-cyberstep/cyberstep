import { Router } from "express";
import { pool } from "@workspace/db";
import { requireCustomer, getCustomerId } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { generateKvkkLetterPdf } from "../../services/kvkkAssessor";

const router = Router();

// ─── Portal: Müşterinin kendi KVKK bildirimleri ───────────────────────────────

// GET /api/portal/kvkk/notifications
router.get("/portal/kvkk/notifications", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  try {
    const { rows } = await pool.query(
      `SELECT kn.id, kn.soc_case_id AS "socCaseId",
              sc.case_number AS "caseNumber", sc.title AS "caseTitle",
              ka.requires_notification AS "requiresNotification",
              ka.ai_reasoning AS "aiReasoning",
              ka.severity_category AS "severityCategory",
              ka.affected_data_types AS "affectedDataTypes",
              ka.urgency, ka.status AS "assessmentStatus",
              kn.status, kn.btk_reference_no AS "btkReferenceNo",
              kn.sent_at AS "sentAt", kn.deadline_72h AS "deadline72h",
              kn.created_at AS "createdAt", kn.updated_at AS "updatedAt"
       FROM kvkk_notifications kn
       JOIN kvkk_assessments ka ON ka.id = kn.assessment_id
       JOIN soc_cases sc ON sc.id = kn.soc_case_id
       WHERE kn.customer_id = $1
       ORDER BY kn.deadline_72h ASC`,
      [customerId]
    );
    res.json({ notifications: rows });
  } catch (err) {
    req.log.error({ err }, "GET /api/portal/kvkk/notifications error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/portal/kvkk/assessment/:caseId — SOC case'e ait KVKK değerlendirmesi
router.get("/portal/kvkk/assessment/:caseId", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  const socCaseId = Number(req.params["caseId"]);
  try {
    const { rows } = await pool.query(
      `SELECT ka.id, ka.soc_case_id AS "socCaseId",
              ka.requires_notification AS "requiresNotification",
              ka.ai_reasoning AS "aiReasoning",
              ka.severity_category AS "severityCategory",
              ka.affected_data_types AS "affectedDataTypes",
              ka.urgency, ka.status,
              ka.assessed_at AS "assessedAt",
              kn.id AS "notificationId",
              kn.status AS "notificationStatus",
              kn.btk_reference_no AS "btkReferenceNo",
              kn.deadline_72h AS "deadline72h",
              kn.sent_at AS "sentAt"
       FROM kvkk_assessments ka
       LEFT JOIN kvkk_notifications kn ON kn.assessment_id = ka.id
       WHERE ka.soc_case_id = $1 AND ka.customer_id = $2
       ORDER BY ka.created_at DESC
       LIMIT 1`,
      [socCaseId, customerId]
    );
    res.json({ assessment: rows[0] ?? null });
  } catch (err) {
    req.log.error({ err }, "GET /api/portal/kvkk/assessment/:caseId error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// PATCH /api/portal/kvkk/notifications/:id — Durum güncelle + BTK ref no
router.patch("/portal/kvkk/notifications/:id", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  const id = Number(req.params["id"]);
  const { status, btkReferenceNo } = req.body as { status?: string; btkReferenceNo?: string };

  const validStatuses = ["draft", "sent", "tracking", "closed"];
  if (status && !validStatuses.includes(status)) {
    res.status(400).json({ error: "Geçersiz durum" });
    return;
  }

  try {
    const { rows } = await pool.query(
      `UPDATE kvkk_notifications
       SET status = COALESCE($1, status),
           btk_reference_no = COALESCE($2, btk_reference_no),
           sent_at = CASE WHEN $1 = 'sent' AND sent_at IS NULL THEN NOW() ELSE sent_at END,
           updated_at = NOW()
       WHERE id = $3 AND customer_id = $4
       RETURNING id, status, btk_reference_no AS "btkReferenceNo", updated_at AS "updatedAt"`,
      [status ?? null, btkReferenceNo ?? null, id, customerId]
    );
    if (!rows[0]) { res.status(404).json({ error: "Bildirim bulunamadı" }); return; }
    res.json({ notification: rows[0] });
  } catch (err) {
    req.log.error({ err }, "PATCH /api/portal/kvkk/notifications/:id error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/portal/kvkk/notifications/:id/pdf — Mektup PDF indir
router.get("/portal/kvkk/notifications/:id/pdf", requireCustomer, async (req, res) => {
  const customerId = getCustomerId(req);
  if (!customerId) { res.status(401).json({ error: "Oturum gerekli" }); return; }

  const id = Number(req.params["id"]);
  try {
    const { rows } = await pool.query<{
      letter_content: string | null; company_name: string | null; case_number: string;
    }>(
      `SELECT kn.letter_content, c.company_name, sc.case_number
       FROM kvkk_notifications kn
       JOIN customers c ON c.id = kn.customer_id
       JOIN soc_cases sc ON sc.id = kn.soc_case_id
       WHERE kn.id = $1 AND kn.customer_id = $2
       LIMIT 1`,
      [id, customerId]
    );
    const row = rows[0];
    if (!row) { res.status(404).json({ error: "Bildirim bulunamadı" }); return; }
    if (!row.letter_content) { res.status(400).json({ error: "Mektup taslağı henüz oluşturulmadı" }); return; }

    const pdf = await generateKvkkLetterPdf(
      row.letter_content,
      row.company_name ?? "Kuruluş",
      row.case_number,
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="kvkk-bildirim-${row.case_number}.pdf"`);
    res.send(pdf);
  } catch (err) {
    req.log.error({ err }, "GET /api/portal/kvkk/notifications/:id/pdf error");
    res.status(500).json({ error: "PDF oluşturulamadı" });
  }
});

export default router;
