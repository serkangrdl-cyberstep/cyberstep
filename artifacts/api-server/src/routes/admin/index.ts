import { Router } from "express";
import { db } from "@workspace/db";
import { assessmentsTable, reportsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { sendCustomerReportEmail } from "../../services/email";

const router = Router();

// GET /api/admin/review/:token
router.get("/admin/review/:token", async (req, res) => {
  const { token } = req.params;

  const [report] = await db
    .select()
    .from(reportsTable)
    .where(eq(reportsTable.reviewToken, token));

  if (!report) {
    res.status(404).json({ error: "Geçersiz veya süresi dolmuş inceleme linki" });
    return;
  }

  const [assessment] = await db
    .select()
    .from(assessmentsTable)
    .where(eq(assessmentsTable.id, report.assessmentId));

  if (!assessment) {
    res.status(404).json({ error: "Değerlendirme bulunamadı" });
    return;
  }

  res.json({ report, assessment });
});

// PUT /api/admin/review/:token
router.put("/admin/review/:token", async (req, res) => {
  const { token } = req.params;
  const { aiAnalysis, recommendations, adminNotes } = req.body as {
    aiAnalysis?: string;
    recommendations?: string[];
    adminNotes?: string;
  };

  const [report] = await db
    .select()
    .from(reportsTable)
    .where(eq(reportsTable.reviewToken, token));

  if (!report) {
    res.status(404).json({ error: "Geçersiz token" });
    return;
  }

  if (report.reviewStatus === "emailed") {
    res.status(400).json({ error: "Bu rapor zaten müşteriye gönderildi" });
    return;
  }

  const updates: Partial<typeof reportsTable.$inferInsert> = {};
  if (aiAnalysis !== undefined) updates.aiAnalysis = aiAnalysis;
  if (recommendations !== undefined) updates.recommendations = recommendations;
  if (adminNotes !== undefined) updates.adminNotes = adminNotes;

  const [updated] = await db
    .update(reportsTable)
    .set(updates)
    .where(eq(reportsTable.reviewToken, token))
    .returning();

  logger.info({ assessmentId: report.assessmentId }, "Admin saved report draft");
  res.json(updated);
});

// POST /api/admin/review/:token/approve
router.post("/admin/review/:token/approve", async (req, res) => {
  const { token } = req.params;

  const [report] = await db
    .select()
    .from(reportsTable)
    .where(eq(reportsTable.reviewToken, token));

  if (!report) {
    res.status(404).json({ error: "Geçersiz token" });
    return;
  }

  if (report.reviewStatus === "emailed") {
    res.status(400).json({ error: "Bu rapor zaten müşteriye gönderildi" });
    return;
  }

  const [assessment] = await db
    .select()
    .from(assessmentsTable)
    .where(eq(assessmentsTable.id, report.assessmentId));

  if (!assessment) {
    res.status(404).json({ error: "Değerlendirme bulunamadı" });
    return;
  }

  // Mark as approved first
  await db
    .update(reportsTable)
    .set({ reviewStatus: "approved", reviewedAt: new Date() })
    .where(eq(reportsTable.reviewToken, token));

  // Send customer email
  await sendCustomerReportEmail({
    assessmentId: assessment.id,
    companyName: assessment.companyName,
    contactName: assessment.contactName,
    customerEmail: assessment.email,
    riskLevel: report.riskLevel,
    scorePercent: report.scorePercent,
    redAlarmCount: report.redAlarmCount,
    aiAnalysis: report.aiAnalysis,
    recommendations: report.recommendations,
    adminNotes: report.adminNotes ?? null,
  });

  // Mark as emailed
  const [final] = await db
    .update(reportsTable)
    .set({ reviewStatus: "emailed" })
    .where(eq(reportsTable.reviewToken, token))
    .returning();

  logger.info({ assessmentId: assessment.id }, "Report approved and customer email sent");
  res.json({ success: true, report: final });
});

export default router;
