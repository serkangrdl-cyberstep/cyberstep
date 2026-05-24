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

  const updates: Record<string, unknown> = {};
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
  // Accept current editor state from frontend so nothing is lost even if not saved
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

  const [assessment] = await db
    .select()
    .from(assessmentsTable)
    .where(eq(assessmentsTable.id, report.assessmentId));

  if (!assessment) {
    res.status(404).json({ error: "Değerlendirme bulunamadı" });
    return;
  }

  // Merge frontend edits into DB before sending
  const finalAnalysis      = aiAnalysis      ?? report.aiAnalysis;
  const finalRecommendations = recommendations ?? report.recommendations;
  const finalAdminNotes    = adminNotes      ?? report.adminNotes ?? null;

  await db
    .update(reportsTable)
    .set({
      aiAnalysis: finalAnalysis,
      recommendations: finalRecommendations,
      adminNotes: finalAdminNotes ?? undefined,
      reviewStatus: "approved",
      reviewedAt: new Date(),
    })
    .where(eq(reportsTable.reviewToken, token));

  // Send customer email + PDF
  await sendCustomerReportEmail({
    assessmentId: assessment.id,
    companyName:  assessment.companyName,
    contactName:  assessment.contactName,
    customerEmail: assessment.email,
    sector:        assessment.sector,
    employeeCount: assessment.employeeCount,
    riskLevel:     report.riskLevel,
    scorePercent:  report.scorePercent,
    totalScore:    report.totalScore,
    maxScore:      report.maxScore,
    redAlarmCount: report.redAlarmCount,
    aiAnalysis:    finalAnalysis,
    recommendations: finalRecommendations,
    domainScores:  report.domainScores,
    adminNotes:    finalAdminNotes,
    createdAt:     report.createdAt.toISOString(),
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
