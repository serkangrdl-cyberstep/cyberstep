import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { assessmentsTable, reportsTable, paymentsTable, customersTable, domainScansTable, badgeAdvantagesTable, leadCandidatesTable, discoveryRunsTable, leadScanQueueTable, weeklyBulletinsTable, intelligenceReportsTable, dailySummariesTable } from "@workspace/db";
import { count, sum, avg, sql, desc, gte, and, eq, asc, isNotNull } from "drizzle-orm";
import { requireAdmin } from "./middleware";

const router = Router();

// GET /api/admin-panel/analytics/overview
router.get("/admin-panel/analytics/overview", requireAdmin, async (_req: Request, res: Response) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [totalAssessments] = await db.select({ count: count() }).from(assessmentsTable);
  const [completedAssessments] = await db.select({ count: count() }).from(assessmentsTable)
    .where(sql`${assessmentsTable.status} = 'report_ready'`);

  const [thisMonthAssessments] = await db.select({ count: count() }).from(assessmentsTable)
    .where(gte(assessmentsTable.createdAt, startOfMonth));

  const [lastMonthAssessments] = await db.select({ count: count() }).from(assessmentsTable)
    .where(and(gte(assessmentsTable.createdAt, startOfLastMonth), sql`${assessmentsTable.createdAt} <= ${endOfLastMonth}`));

  const [totalRevenue] = await db.select({ total: sum(paymentsTable.amount) }).from(paymentsTable)
    .where(sql`${paymentsTable.status} = 'success'`);

  const [monthRevenue] = await db.select({ total: sum(paymentsTable.amount) }).from(paymentsTable)
    .where(and(sql`${paymentsTable.status} = 'success'`, gte(paymentsTable.createdAt, startOfMonth)));

  const [totalKdv] = await db.select({ total: sum(paymentsTable.kdvAmount) }).from(paymentsTable)
    .where(sql`${paymentsTable.status} = 'success'`);

  const [monthKdv] = await db.select({ total: sum(paymentsTable.kdvAmount) }).from(paymentsTable)
    .where(and(sql`${paymentsTable.status} = 'success'`, gte(paymentsTable.createdAt, startOfMonth)));

  const [avgScore] = await db.select({ avg: avg(assessmentsTable.totalScore) }).from(assessmentsTable)
    .where(sql`${assessmentsTable.totalScore} IS NOT NULL`);

  const riskDistResults = await db.select({ riskLevel: assessmentsTable.riskLevel, cnt: count() })
    .from(assessmentsTable)
    .where(sql`${assessmentsTable.riskLevel} IS NOT NULL`)
    .groupBy(assessmentsTable.riskLevel);

  const riskDistribution: Record<string, number> = {};
  for (const r of riskDistResults) {
    if (r.riskLevel) riskDistribution[r.riskLevel] = Number(r.cnt);
  }

  const pendingReviews = await db.select({ count: count() }).from(reportsTable)
    .where(sql`${reportsTable.reviewStatus} = 'pending_review'`);

  const [totalCustomers] = await db.select({ count: count() }).from(customersTable);
  const [activeSubscriptions] = await db.select({ count: count() }).from(customersTable)
    .where(eq(customersTable.subscriptionStatus, "active"));
  const [totalDomainScans] = await db.select({ count: count() }).from(domainScansTable);
  const [avgDomainScore] = await db.select({ avg: avg(domainScansTable.overallScore) }).from(domainScansTable);

  res.json({
    totalAssessments: Number(totalAssessments.count),
    completedAssessments: Number(completedAssessments.count),
    thisMonthAssessments: Number(thisMonthAssessments.count),
    lastMonthAssessments: Number(lastMonthAssessments.count),
    totalRevenue: Number(totalRevenue.total ?? 0),
    monthRevenue: Number(monthRevenue.total ?? 0),
    totalKdv: Number(totalKdv.total ?? 0),
    monthKdv: Number(monthKdv.total ?? 0),
    netRevenue: Number(totalRevenue.total ?? 0) - Number(totalKdv.total ?? 0),
    avgScore: Number(avgScore.avg ?? 0),
    riskDistribution,
    pendingReviews: Number(pendingReviews[0]?.count ?? 0),
    totalCustomers: Number(totalCustomers.count),
    activeSubscriptions: Number(activeSubscriptions.count),
    totalDomainScans: Number(totalDomainScans.count),
    avgDomainScore: Math.round(Number(avgDomainScore.avg ?? 0)),
  });
});

// GET /api/admin-panel/analytics/monthly
router.get("/admin-panel/analytics/monthly", requireAdmin, async (_req: Request, res: Response) => {
  const monthlyData = await db.execute(sql`
    SELECT
      TO_CHAR(created_at, 'YYYY-MM') as month,
      COUNT(*)::int as assessment_count,
      COUNT(CASE WHEN status = 'report_ready' THEN 1 END)::int as completed_count
    FROM assessments
    WHERE created_at >= NOW() - INTERVAL '12 months'
    GROUP BY TO_CHAR(created_at, 'YYYY-MM')
    ORDER BY month ASC
  `);

  const monthlyPayments = await db.execute(sql`
    SELECT
      TO_CHAR(created_at, 'YYYY-MM') as month,
      COALESCE(SUM(amount), 0)::float as revenue,
      COALESCE(SUM(kdv_amount), 0)::float as kdv
    FROM payments
    WHERE status = 'success' AND created_at >= NOW() - INTERVAL '12 months'
    GROUP BY TO_CHAR(created_at, 'YYYY-MM')
    ORDER BY month ASC
  `);

  res.json({ monthly: monthlyData.rows, payments: monthlyPayments.rows });
});

// GET /api/admin-panel/analytics/payments
router.get("/admin-panel/analytics/payments", requireAdmin, async (_req: Request, res: Response) => {
  const payments = await db.select().from(paymentsTable).orderBy(desc(paymentsTable.createdAt)).limit(100);
  res.json(payments);
});

// GET /api/admin-panel/analytics/assessments
router.get("/admin-panel/analytics/assessments", requireAdmin, async (_req: Request, res: Response) => {
  const list = await db
    .select({
      id: assessmentsTable.id,
      companyName: assessmentsTable.companyName,
      contactName: assessmentsTable.contactName,
      email: assessmentsTable.email,
      sector: assessmentsTable.sector,
      employeeCount: assessmentsTable.employeeCount,
      assessmentType: assessmentsTable.assessmentType,
      status: assessmentsTable.status,
      totalScore: reportsTable.totalScore,
      maxScore: reportsTable.maxScore,
      riskLevel: reportsTable.riskLevel,
      redAlarmCount: reportsTable.redAlarmCount,
      createdAt: assessmentsTable.createdAt,
      completedAt: assessmentsTable.completedAt,
      verificationToken: reportsTable.verificationToken,
    })
    .from(assessmentsTable)
    .leftJoin(reportsTable, eq(reportsTable.assessmentId, assessmentsTable.id))
    .orderBy(desc(assessmentsTable.createdAt))
    .limit(100);
  res.json(list);
});

// POST /api/admin-panel/assessments/:id/issue-verification — Rozet ver
router.post("/admin-panel/assessments/:id/issue-verification", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  const durationYears = Number(req.body?.durationYears ?? 1);
  if (durationYears !== 1 && durationYears !== 2) { res.status(400).json({ error: "Geçersiz süre (1 veya 2 yıl)" }); return; }
  const certificationTier = Number(req.body?.certificationTier ?? 1);
  if (![1, 2, 3].includes(certificationTier)) { res.status(400).json({ error: "Geçersiz sertifikasyon katmanı (1, 2 veya 3)" }); return; }
  const token = crypto.randomUUID();
  const verifiedAt = new Date();
  const verificationExpiresAt = new Date(verifiedAt);
  verificationExpiresAt.setFullYear(verificationExpiresAt.getFullYear() + durationYears);
  const [updated] = await db
    .update(reportsTable)
    .set({ verificationToken: token, verifiedAt, verificationExpiresAt, verificationDurationYears: durationYears, certificationTier })
    .where(eq(reportsTable.assessmentId, id))
    .returning({
      verificationToken: reportsTable.verificationToken,
      verifiedAt: reportsTable.verifiedAt,
      verificationExpiresAt: reportsTable.verificationExpiresAt,
      certificationTier: reportsTable.certificationTier,
    });
  if (!updated) { res.status(404).json({ error: "Bu değerlendirmeye ait rapor bulunamadı" }); return; }
  res.json({
    verificationToken: updated.verificationToken,
    verifiedAt: updated.verifiedAt,
    verificationExpiresAt: updated.verificationExpiresAt,
    certificationTier: updated.certificationTier,
  });
});

// DELETE /api/admin-panel/assessments/:id/issue-verification — Rozeti iptal et
router.delete("/admin-panel/assessments/:id/issue-verification", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  const [updated] = await db
    .update(reportsTable)
    .set({ verificationToken: null, verifiedAt: null, verificationExpiresAt: null, verificationDurationYears: null })
    .where(eq(reportsTable.assessmentId, id))
    .returning({ id: reportsTable.id });
  if (!updated) { res.status(404).json({ error: "Bu değerlendirmeye ait rapor bulunamadı" }); return; }
  res.json({ success: true });
});

// GET /api/admin-panel/badge-advantages
router.get("/admin-panel/badge-advantages", requireAdmin, async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(badgeAdvantagesTable)
    .orderBy(asc(badgeAdvantagesTable.sortOrder), asc(badgeAdvantagesTable.id));
  res.json(rows);
});

// POST /api/admin-panel/badge-advantages
router.post("/admin-panel/badge-advantages", requireAdmin, async (req: Request, res: Response) => {
  const { title, partnerName, description, discountPercent, badgeText, logoUrl, sortOrder } = req.body ?? {};
  if (!title || !partnerName || !description) { res.status(400).json({ error: "Başlık, iş ortağı adı ve açıklama zorunludur" }); return; }
  const [row] = await db
    .insert(badgeAdvantagesTable)
    .values({ title, partnerName, description, discountPercent: discountPercent ?? null, badgeText: badgeText ?? null, logoUrl: logoUrl ?? null, sortOrder: sortOrder ?? 0 })
    .returning();
  res.json(row);
});

// PUT /api/admin-panel/badge-advantages/:id
router.put("/admin-panel/badge-advantages/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  const { title, partnerName, description, discountPercent, badgeText, logoUrl, sortOrder, isActive } = req.body ?? {};
  const updateData: Record<string, unknown> = {};
  if (title !== undefined) updateData.title = title;
  if (partnerName !== undefined) updateData.partnerName = partnerName;
  if (description !== undefined) updateData.description = description;
  if (discountPercent !== undefined) updateData.discountPercent = discountPercent;
  if (badgeText !== undefined) updateData.badgeText = badgeText;
  if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
  if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
  if (isActive !== undefined) updateData.isActive = isActive;
  const [row] = await db.update(badgeAdvantagesTable).set(updateData).where(eq(badgeAdvantagesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Bulunamadı" }); return; }
  res.json(row);
});

// DELETE /api/admin-panel/badge-advantages/:id
router.delete("/admin-panel/badge-advantages/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }
  await db.delete(badgeAdvantagesTable).where(eq(badgeAdvantagesTable.id, id));
  res.json({ success: true });
});

// GET /api/admin-panel/analytics/by-plan — paket başına gelir
router.get("/admin-panel/analytics/by-plan", requireAdmin, async (_req: Request, res: Response) => {
  const rows = await db.execute(sql`
    SELECT
      plan_slug,
      COUNT(*)::int as payment_count,
      COALESCE(SUM(amount), 0)::float as total_revenue,
      COALESCE(SUM(kdv_amount), 0)::float as total_kdv,
      COALESCE(SUM(net_amount), 0)::float as total_net
    FROM payments
    WHERE status = 'success'
    GROUP BY plan_slug
    ORDER BY total_revenue DESC
  `);
  res.json(rows.rows);
});

// GET /api/admin-panel/analytics/monthly-assessments — aylık değerlendirme türüne göre
router.get("/admin-panel/analytics/monthly-assessments", requireAdmin, async (_req: Request, res: Response) => {
  const rows = await db.execute(sql`
    SELECT
      TO_CHAR(created_at, 'YYYY-MM') as month,
      assessment_type,
      COUNT(*)::int as count
    FROM assessments
    WHERE created_at >= NOW() - INTERVAL '12 months'
    GROUP BY TO_CHAR(created_at, 'YYYY-MM'), assessment_type
    ORDER BY month ASC, assessment_type ASC
  `);

  const pivoted: Record<string, { month: string; mini: number; full: number }> = {};
  for (const row of rows.rows as { month: string; assessment_type: string; count: number }[]) {
    if (!pivoted[row.month]) pivoted[row.month] = { month: row.month, mini: 0, full: 0 };
    if (row.assessment_type === "mini") pivoted[row.month].mini = row.count;
    else if (row.assessment_type === "full") pivoted[row.month].full = row.count;
  }

  res.json(Object.values(pivoted));
});

// GET /api/admin-panel/analytics/daily
router.get("/admin-panel/analytics/daily", requireAdmin, async (_req: Request, res: Response) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [dsLast24h] = await db.select({ count: count() }).from(domainScansTable).where(gte(domainScansTable.createdAt, since));
  const [dsTotal]   = await db.select({ count: count() }).from(domainScansTable);

  const [lcLast24h] = await db.select({ count: count() }).from(leadCandidatesTable).where(gte(leadCandidatesTable.createdAt, since));
  const [lcTotal]   = await db.select({ count: count() }).from(leadCandidatesTable);

  const [qlLast24h] = await db.select({ count: count() }).from(leadCandidatesTable).where(and(eq(leadCandidatesTable.isQualified, true), gte(leadCandidatesTable.updatedAt, since)));
  const [qlTotal]   = await db.select({ count: count() }).from(leadCandidatesTable).where(eq(leadCandidatesTable.isQualified, true));

  const [tLast24h] = await db.select({ count: count() }).from(leadCandidatesTable).where(and(sql`${leadCandidatesTable.teaserSubject} IS NOT NULL`, gte(leadCandidatesTable.updatedAt, since)));
  const [tTotal]   = await db.select({ count: count() }).from(leadCandidatesTable).where(sql`${leadCandidatesTable.teaserSubject} IS NOT NULL`);

  const cronRuns   = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM cron_job_runs WHERE started_at > ${since}`);
  const cronErrors = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM cron_job_runs WHERE started_at > ${since} AND status != 'ok'`);
  const lastRun    = await db.execute(sql`SELECT job_name, status, started_at FROM cron_job_runs ORDER BY started_at DESC LIMIT 1`);

  const [drRow] = await db.select({ found: sum(discoveryRunsTable.totalFound), added: sum(discoveryRunsTable.totalAdded) }).from(discoveryRunsTable).where(gte(discoveryRunsTable.startedAt, since));

  res.json({
    domainScans:      { last24h: dsLast24h.count, total: dsTotal.count },
    leadCandidates:   { last24h: lcLast24h.count, total: lcTotal.count },
    qualifiedLeads:   { last24h: qlLast24h.count, total: qlTotal.count },
    teasersGenerated: { last24h: tLast24h.count,  total: tTotal.count  },
    cronJobs: {
      last24h_runs:   (cronRuns.rows[0]   as { cnt: number }).cnt,
      last24h_errors: (cronErrors.rows[0] as { cnt: number }).cnt,
      last_run: lastRun.rows[0] ? (lastRun.rows[0] as { job_name: string; status: string; started_at: string }) : null,
    },
    discoveryRuns: {
      last24h_found: Number(drRow?.found  ?? 0),
      last24h_added: Number(drRow?.added ?? 0),
    },
  });
});

// GET /api/admin-panel/analytics/pending-registrations
router.get("/admin-panel/analytics/pending-registrations", requireAdmin, async (_req: Request, res: Response) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await db.select({
    id: customersTable.id,
    fullName: customersTable.fullName,
    email: customersTable.email,
    companyName: customersTable.companyName,
    subscriptionPlan: customersTable.subscriptionPlan,
    createdAt: customersTable.createdAt,
  })
    .from(customersTable)
    .where(and(
      eq(customersTable.subscriptionStatus, "inactive"),
      gte(customersTable.createdAt, thirtyDaysAgo),
    ))
    .orderBy(desc(customersTable.createdAt))
    .limit(20);

  res.json({ count: rows.length, recent: rows });
});

// GET /api/admin-panel/analytics/ops-center — single-call operational overview
router.get("/admin-panel/analytics/ops-center", requireAdmin, async (_req: Request, res: Response) => {
  const { cronGetStats } = await import("../../services/cronRegistry");

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);

  const [
    leadTotal, leadQualified, leadWithContact, leadTeaserSent,
    queueStats,
    cronStats,
    lastBulletin, lastIntelReport, lastDailySummary,
    todayScans, yesterdayScansRes, thisWeekLeadsRes, lastWeekLeadsRes,
    sevenDayScanTrendRes,
  ] = await Promise.all([
    db.select({ count: count() }).from(leadCandidatesTable),
    db.select({ count: count() }).from(leadCandidatesTable)
      .where(eq(leadCandidatesTable.isQualified, true)),
    db.select({ count: count() }).from(leadCandidatesTable)
      .where(and(eq(leadCandidatesTable.isQualified, true), isNotNull(leadCandidatesTable.contactEmail))),
    db.select({ count: count() }).from(leadCandidatesTable)
      .where(isNotNull(leadCandidatesTable.teaserSentAt)),
    db.select({ scanStatus: leadScanQueueTable.scanStatus, cnt: count() })
      .from(leadScanQueueTable).groupBy(leadScanQueueTable.scanStatus),
    cronGetStats(),
    db.select({ sentAt: weeklyBulletinsTable.sentAt, createdAt: weeklyBulletinsTable.createdAt })
      .from(weeklyBulletinsTable).where(isNotNull(weeklyBulletinsTable.sentAt))
      .orderBy(desc(weeklyBulletinsTable.sentAt)).limit(1),
    db.select({ createdAt: intelligenceReportsTable.createdAt })
      .from(intelligenceReportsTable).where(eq(intelligenceReportsTable.status, "published"))
      .orderBy(desc(intelligenceReportsTable.createdAt)).limit(1),
    db.select({ generatedAt: dailySummariesTable.generatedAt })
      .from(dailySummariesTable).orderBy(desc(dailySummariesTable.generatedAt)).limit(1),
    db.select({ count: count() }).from(domainScansTable)
      .where(gte(domainScansTable.createdAt, todayStart)),
    // yesterday comparison
    db.select({ count: count() }).from(domainScansTable)
      .where(and(gte(domainScansTable.createdAt, yesterdayStart), sql`${domainScansTable.createdAt} < ${todayStart}`)),
    // this week leads
    db.select({ count: count() }).from(leadCandidatesTable)
      .where(gte(leadCandidatesTable.createdAt, weekStart)),
    // last week leads
    db.select({ count: count() }).from(leadCandidatesTable)
      .where(and(gte(leadCandidatesTable.createdAt, prevWeekStart), sql`${leadCandidatesTable.createdAt} < ${weekStart}`)),
    // 7-day daily scan trend
    db.execute(sql`
      SELECT TO_CHAR(DATE_TRUNC('day', created_at AT TIME ZONE 'Europe/Istanbul'), 'DD.MM') AS day,
             COUNT(*)::int AS cnt
      FROM domain_scans
      WHERE created_at >= NOW() - INTERVAL '8 days'
      GROUP BY DATE_TRUNC('day', created_at AT TIME ZONE 'Europe/Istanbul')
      ORDER BY 1 ASC
      LIMIT 7
    `),
  ]);

  const CRITICAL_CRONS: { name: string; label: string; category: string }[] = [
    { name: "crtsh",          label: "Sertifika İzleme",  category: "lead"   },
    { name: "domain_rescan",  label: "Domain Rescan",     category: "scan"   },
    { name: "lead_qual",      label: "Lead Nitelendirme", category: "lead"   },
    { name: "dns_monitor",    label: "DNS İzleme",        category: "scan"   },
    { name: "cve_feed_check", label: "CVE Besleme",       category: "intel"  },
    { name: "health_score",   label: "Müşteri Sağlık",    category: "crm"    },
    { name: "haftalik_bulten",label: "Haftalık Bülten",   category: "report" },
    { name: "daily_summary",  label: "Günlük Özet",       category: "report" },
  ];
  const cronMap = Object.fromEntries(cronStats.map(s => [s.job_name, s]));
  const criticalCronHealth = CRITICAL_CRONS.map(({ name, label, category }) => {
    const s = cronMap[name];
    return {
      name, label, category,
      lastRunAt:  s?.last_run_at  ?? null,
      lastStatus: s?.last_status  ?? null,
      lastError:  s?.last_error   ?? null,
      okRuns:     Number(s?.ok_runs    ?? 0),
      errorRuns:  Number(s?.error_runs ?? 0),
    };
  });

  const queueByStatus: Record<string, number> = {};
  for (const r of queueStats) queueByStatus[r.scanStatus ?? "unknown"] = Number(r.cnt);

  const todayN      = Number(todayScans[0]?.count      ?? 0);
  const yesterdayN  = Number(yesterdayScansRes[0]?.count ?? 0);
  const thisWeekN   = Number(thisWeekLeadsRes[0]?.count  ?? 0);
  const lastWeekN   = Number(lastWeekLeadsRes[0]?.count  ?? 0);

  const cronOk    = criticalCronHealth.filter(c => c.lastStatus === "ok").length;
  const cronErr   = criticalCronHealth.filter(c => c.lastStatus === "error").length;
  const cronNever = criticalCronHealth.filter(c => !c.lastRunAt).length;

  res.json({
    leadFunnel: {
      discovered:  Number(leadTotal[0]?.count      ?? 0),
      qualified:   Number(leadQualified[0]?.count   ?? 0),
      withContact: Number(leadWithContact[0]?.count ?? 0),
      teaserSent:  Number(leadTeaserSent[0]?.count  ?? 0),
      contacted:   queueByStatus["contacted"] ?? 0,
      converted:   queueByStatus["converted"] ?? 0,
    },
    criticalCronHealth,
    cronSummary: { ok: cronOk, error: cronErr, neverRan: cronNever,
                   total: CRITICAL_CRONS.length },
    reports: {
      bulletin:     lastBulletin[0]     ?? null,
      intelligence: lastIntelReport[0]  ?? null,
      dailySummary: lastDailySummary[0] ?? null,
    },
    todayScans: todayN,
    sevenDayScans: (sevenDayScanTrendRes.rows as Array<{ day: string; cnt: number }>)
      .map(r => ({ day: String(r.day), count: Number(r.cnt) })),
    comparisons: {
      yesterdayScans: yesterdayN,
      thisWeekLeads:  thisWeekN,
      lastWeekLeads:  lastWeekN,
    },
  });
});

export default router;
