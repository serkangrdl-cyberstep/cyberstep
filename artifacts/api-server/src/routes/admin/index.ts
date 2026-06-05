import { Router } from "express";
import { db } from "@workspace/db";
import { assessmentsTable, reportsTable, serviceCatalogTable, demoReportsTable, demoLeadsTable } from "@workspace/db";
import { eq, and, desc, sql, asc } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { sendCustomerReportEmail } from "../../services/email";
import { recoverReportFields } from "../../lib/report-json";
import { requireAdmin } from "../../middleware/auth";

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

  res.json({ report: recoverReportFields(report), assessment });
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

  // Heal any raw-JSON blob stored in aiAnalysis before merging admin edits / sending.
  const healed = recoverReportFields(report);

  // Merge frontend edits into DB before sending
  const finalAnalysis      = aiAnalysis      ?? healed.aiAnalysis;
  const finalRecommendations = recommendations ?? healed.recommendations;
  const finalAdminNotes    = adminNotes      ?? healed.adminNotes ?? null;

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

// ── Pasif Servis Yönetimi ──────────────────────────────────────────────────────

// GET /api/admin/services/passive
router.get("/admin/services/passive", requireAdmin, async (_req, res) => {
  try {
    const list = await db.select()
      .from(serviceCatalogTable)
      .where(eq(serviceCatalogTable.visibility, "passive"))
      .orderBy(asc(serviceCatalogTable.roadmapQuarter));
    res.json({ services: list });
  } catch (err) {
    logger.error({ err }, "Passive services fetch error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/admin/services/active
router.get("/admin/services/active", requireAdmin, async (_req, res) => {
  try {
    const list = await db.select()
      .from(serviceCatalogTable)
      .where(and(eq(serviceCatalogTable.isActive, true), eq(serviceCatalogTable.visibility, "public")))
      .orderBy(asc(serviceCatalogTable.sortOrder));
    res.json({ services: list });
  } catch (err) {
    logger.error({ err }, "Active services fetch error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /api/admin/services/:slug/activate
router.post("/admin/services/:slug/activate", requireAdmin, async (req, res) => {
  const slug = String(req.params["slug"] ?? "");
  try {
    await db.update(serviceCatalogTable).set({
      isActive: true,
      visibility: "public",
      passiveReason: null,
    }).where(eq(serviceCatalogTable.slug, slug));
    logger.info({ slug }, "Service activated");
    res.json({ success: true });
  } catch (err) {
    logger.error({ err, slug }, "Service activate error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /api/admin/services/:slug/deactivate
router.post("/admin/services/:slug/deactivate", requireAdmin, async (req, res) => {
  const slug = String(req.params["slug"] ?? "");
  const { reason, roadmapQuarter } = req.body as { reason?: string; roadmapQuarter?: string };
  try {
    await db.update(serviceCatalogTable).set({
      isActive: false,
      visibility: "passive",
      passiveReason: reason ?? null,
      passiveSince: new Date(),
      roadmapQuarter: roadmapQuarter ?? null,
    }).where(eq(serviceCatalogTable.slug, slug));
    logger.info({ slug }, "Service deactivated");
    res.json({ success: true });
  } catch (err) {
    logger.error({ err, slug }, "Service deactivate error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ── Demo Rapor Admin ───────────────────────────────────────────────────────────

// GET /api/admin/demo-reports
router.get("/admin/demo-reports", requireAdmin, async (_req, res) => {
  try {
    const reports = await db.select().from(demoReportsTable).orderBy(desc(demoReportsTable.generatedAt));
    res.json({ reports });
  } catch (err) {
    logger.error({ err }, "Demo reports admin fetch error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/admin/demo-leads
router.get("/admin/demo-leads", requireAdmin, async (_req, res) => {
  try {
    const leads = await db.select().from(demoLeadsTable).orderBy(desc(demoLeadsTable.createdAt)).limit(500);
    const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(demoLeadsTable);
    const [{ withCompany }] = await db.select({ withCompany: sql<number>`count(*)::int` }).from(demoLeadsTable).where(sql`company IS NOT NULL AND company != ''`);
    res.json({ leads, total, withCompany });
  } catch (err) {
    logger.error({ err }, "Demo leads admin fetch error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST /api/admin/demo-reports/refresh — tüm demo raporları yenile
router.post("/admin/demo-reports/refresh", requireAdmin, async (_req, res) => {
  res.json({ success: true, message: "Demo rapor üretimi arka planda başlatıldı" });
  setImmediate(async () => {
    try {
      const { generateAllDemoReports } = await import("../../services/demoReportGenerator");
      await generateAllDemoReports();
      logger.info("Admin triggered demo report refresh — done");
    } catch (err) {
      logger.error({ err }, "Admin demo report refresh failed");
    }
  });
});

// POST /api/admin/demo-reports/:type/refresh — tek raporu yenile
router.post("/admin/demo-reports/:type/refresh", requireAdmin, async (req, res) => {
  res.json({ success: true, message: "Rapor üretimi başlatıldı" });
  const type = String(req.params["type"] ?? "");
  setImmediate(async () => {
    try {
      const { generateAllDemoReports } = await import("../../services/demoReportGenerator");
      await generateAllDemoReports();
      logger.info({ type }, "Admin triggered single demo report refresh");
    } catch (err) {
      logger.error({ err, type }, "Single demo report refresh failed");
    }
  });
});

// POST /api/admin/demo-reports/:type/toggle — aktif/pasif
router.post("/admin/demo-reports/:type/toggle", requireAdmin, async (req, res) => {
  const type = String(req.params["type"] ?? "");
  const { isActive } = req.body as { isActive: boolean };
  try {
    await db.update(demoReportsTable).set({ isActive }).where(eq(demoReportsTable.reportType, type));
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Demo report toggle error");
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;
