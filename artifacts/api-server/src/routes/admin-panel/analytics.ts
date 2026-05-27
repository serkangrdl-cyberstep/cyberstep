import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { assessmentsTable, reportsTable, paymentsTable } from "@workspace/db";
import { count, sum, avg, sql, desc, gte, and } from "drizzle-orm";
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
  const list = await db.select().from(assessmentsTable).orderBy(desc(assessmentsTable.createdAt)).limit(100);
  res.json(list);
});

export default router;
