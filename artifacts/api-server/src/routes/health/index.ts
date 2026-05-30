import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  customerHealthScoresTable,
  customerActivityEventsTable,
  healthInterventionsTable,
  customersTable,
  domainScansTable,
} from "@workspace/db";
import { eq, desc, gte, count, sql, and, lt } from "drizzle-orm";
import { requireCustomer, getCustomerId, requireAdmin } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { sendMail } from "../../services/email";

const router = Router();

// ─── Health Score Calculation ────────────────────────────────────────────────

interface HealthResult {
  engagementScore: number;
  actionScore: number;
  scanScore: number;
  alertScore: number;
  valueScore: number;
  healthScore: number;
  healthTier: "healthy" | "at_risk" | "critical" | "churned";
  churnProbability: number;
  churnRiskFactors: string[];
}

async function calculateHealthScore(customerId: number): Promise<HealthResult> {
  const now = new Date();
  const day7 = new Date(now.getTime() - 7 * 86400_000);
  const day14 = new Date(now.getTime() - 14 * 86400_000);
  const day21 = new Date(now.getTime() - 21 * 86400_000);
  const day30 = new Date(now.getTime() - 30 * 86400_000);

  // Last login from activity events
  const [lastLogin] = await db.select({ occurredAt: customerActivityEventsTable.occurredAt })
    .from(customerActivityEventsTable)
    .where(and(eq(customerActivityEventsTable.customerId, customerId), eq(customerActivityEventsTable.eventType, "login")))
    .orderBy(desc(customerActivityEventsTable.occurredAt)).limit(1);

  const loginRecency = lastLogin
    ? (now.getTime() - new Date(lastLogin.occurredAt).getTime()) / 86400_000
    : 999;

  const loginScore = loginRecency <= 7 ? 100 : loginRecency <= 14 ? 60 : loginRecency <= 30 ? 30 : 0;

  // Action score — domain scans viewed
  const [lastScanView] = await db.select({ occurredAt: customerActivityEventsTable.occurredAt })
    .from(customerActivityEventsTable)
    .where(and(eq(customerActivityEventsTable.customerId, customerId), eq(customerActivityEventsTable.eventType, "scan_viewed")))
    .orderBy(desc(customerActivityEventsTable.occurredAt)).limit(1);
  const actionScore = lastScanView ? (new Date(lastScanView.occurredAt) > day30 ? 70 : 40) : 20;

  // Scan score — recent domain scans
  const [customer] = await db.select({ email: customersTable.email, createdAt: customersTable.createdAt })
    .from(customersTable).where(eq(customersTable.id, customerId));
  let scanScore = 0;
  if (customer) {
    const [recentScan] = await db.select({ id: domainScansTable.id })
      .from(domainScansTable)
      .where(and(eq(domainScansTable.email, customer.email), gte(domainScansTable.createdAt, day30)))
      .limit(1);
    if (recentScan) scanScore += 60;
    const [olderScan] = await db.select({ id: domainScansTable.id })
      .from(domainScansTable).where(eq(domainScansTable.email, customer.email)).limit(1);
    if (olderScan) scanScore += 40;
    scanScore = Math.min(100, scanScore);
  }

  // Alert score — report viewed events
  const [recentAlert] = await db.select({ occurredAt: customerActivityEventsTable.occurredAt })
    .from(customerActivityEventsTable)
    .where(and(eq(customerActivityEventsTable.customerId, customerId), eq(customerActivityEventsTable.eventType, "report_viewed")))
    .orderBy(desc(customerActivityEventsTable.occurredAt)).limit(1);
  const alertScore = recentAlert ? (new Date(recentAlert.occurredAt) > day14 ? 100 : 60) : 0;

  // Value score — domain score improvement
  const [latest, prev] = await db.select({ score: domainScansTable.overallScore })
    .from(domainScansTable)
    .where(customer ? eq(domainScansTable.email, customer.email) : sql`false`)
    .orderBy(desc(domainScansTable.createdAt)).limit(2);
  let valueScore = 30;
  if (latest && prev) {
    const change = (latest.score ?? 0) - (prev.score ?? 0);
    valueScore = change > 5 ? 100 : change > 0 ? 60 : change === 0 ? 30 : 0;
  }

  const healthScore = Math.round(
    loginScore * 0.25 + actionScore * 0.30 + scanScore * 0.20 + alertScore * 0.15 + valueScore * 0.10
  );

  const riskFactors: string[] = [];
  if (loginRecency > 21) riskFactors.push("21_gun_giris_yok");
  if (actionScore < 30) riskFactors.push("bulgular_kapatilmiyor");
  if (alertScore === 0) riskFactors.push("uyarilar_acilmiyor");
  if (valueScore === 0) riskFactors.push("risk_skoru_kotu_gidiyor");

  const tier = healthScore >= 70 ? "healthy" : healthScore >= 45 ? "at_risk" : healthScore >= 20 ? "critical" : "churned";
  const churnProbability = Math.min(100, Math.max(0, 100 - healthScore + riskFactors.length * 8));

  return {
    engagementScore: loginScore,
    actionScore,
    scanScore,
    alertScore,
    valueScore,
    healthScore,
    healthTier: tier,
    churnProbability,
    churnRiskFactors: riskFactors,
  };
}

// ─── Track Activity (exported for use in other routes) ────────────────────────

export async function trackActivity(customerId: number, eventType: string, metadata?: Record<string, unknown>): Promise<void> {
  try {
    await db.insert(customerActivityEventsTable).values({ customerId, eventType, metadata: metadata ?? null });
  } catch { /* best-effort */ }
}

// ─── Calculate All Health Scores (cron) ──────────────────────────────────────

export async function calculateAllHealthScores(): Promise<void> {
  const customers = await db.select({ id: customersTable.id })
    .from(customersTable)
    .where(eq(customersTable.subscriptionStatus, "active"));

  for (const c of customers) {
    try {
      const result = await calculateHealthScore(c.id);

      // Check if we need to trigger interventions
      const [prev] = await db.select({ healthScore: customerHealthScoresTable.healthScore, interventionTriggered: customerHealthScoresTable.interventionTriggered })
        .from(customerHealthScoresTable)
        .where(eq(customerHealthScoresTable.customerId, c.id))
        .orderBy(desc(customerHealthScoresTable.calculatedAt)).limit(1);

      await db.insert(customerHealthScoresTable).values({
        customerId: c.id,
        ...result,
        churnProbability: String(result.churnProbability),
      });

      // Trigger interventions on score drops
      if (prev && !prev.interventionTriggered) {
        await checkInterventions(c.id, result.healthScore, prev.healthScore ?? 100, result.churnRiskFactors);
      }
    } catch (err) {
      logger.warn({ err, customerId: c.id }, "Health score calculation failed");
    }
  }
  logger.info({ count: customers.length }, "Health scores calculated");
}

async function checkInterventions(customerId: number, currentScore: number, prevScore: number, riskFactors: string[]): Promise<void> {
  const [customer] = await db.select({ email: customersTable.email, fullName: customersTable.fullName })
    .from(customersTable).where(eq(customersTable.id, customerId));
  if (!customer) return;

  let interventionType: string | null = null;

  if (currentScore < 25 && prevScore >= 25) {
    interventionType = "personal_call";
    // Admin alert
    logger.warn({ customerId, score: currentScore }, "CRITICAL: Customer needs personal call");
  } else if (currentScore < 40 && prevScore >= 40) {
    interventionType = "whatsapp_nudge";
    await sendMail({
      to: customer.email,
      subject: "CyberStep hesabinizda dikkat gerektiren bulgular var",
      html: `<p>Merhaba ${customer.fullName},</p>
<p>Hesabinizdaki son taramalarda dikkat gerektiren bulgular tespit edildi. Yardimci olabilecegimiz bir durum var mi?</p>
<p><a href="${getBaseUrl()}/hesabim">Hesabima Git</a></p>
<p>CyberStep.io</p>`,
    });
  } else if (currentScore < 60 && prevScore >= 60) {
    interventionType = "email_reengagement";
    await sendMail({
      to: customer.email,
      subject: `${customer.fullName}, hesabinizda yeni bulgular var`,
      html: `<p>Merhaba ${customer.fullName},</p>
<p>Domain taramanizda yeni guvenllik bulgulari tespit edildi. Raporunuzu incelemenizi oneririz.</p>
<p><a href="${getBaseUrl()}/raporlarim">Raporlarimi Goruntule</a></p>
<p>CyberStep.io</p>`,
    });
  } else if (riskFactors.includes("21_gun_giris_yok")) {
    interventionType = "feature_highlight";
    await sendMail({
      to: customer.email,
      subject: "CyberStep'te yeni ozellikler sizi bekliyor",
      html: `<p>Merhaba ${customer.fullName},</p>
<p>Bir suredir goremediniz. Bu arada pek cok yeni ozellik ekledik — domain tarama, tehdit istihbarati ve daha fazlasi.</p>
<p><a href="${getBaseUrl()}/hesabim">Kesfet</a></p>
<p>CyberStep.io</p>`,
    });
  }

  if (interventionType) {
    await db.insert(healthInterventionsTable).values({
      customerId,
      interventionType,
      healthScoreAtTrigger: currentScore,
    });
    await db.update(customerHealthScoresTable)
      .set({ interventionTriggered: true, interventionType, interventionSentAt: new Date() })
      .where(eq(customerHealthScoresTable.customerId, customerId));
    logger.info({ customerId, interventionType }, "Intervention triggered");
  }
}

function getBaseUrl(): string {
  const domains = process.env["REPLIT_DOMAINS"];
  return domains ? `https://${domains.split(",")[0]?.trim()}` : "http://localhost:80";
}

// ─── Customer Routes ──────────────────────────────────────────────────────────

// GET /api/health/my-score
router.get("/health/my-score", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;

  const [latest] = await db.select()
    .from(customerHealthScoresTable)
    .where(eq(customerHealthScoresTable.customerId, customerId))
    .orderBy(desc(customerHealthScoresTable.calculatedAt)).limit(1);

  if (!latest) {
    // Calculate on demand if no score exists
    const result = await calculateHealthScore(customerId);
    await db.insert(customerHealthScoresTable).values({
      customerId,
      ...result,
      churnProbability: String(result.churnProbability),
    });
    res.json(result);
    return;
  }

  res.json(latest);
});

// POST /api/health/track — track activity event
router.post("/health/track", requireCustomer, async (req: Request, res: Response) => {
  const customerId = getCustomerId(req) as number;
  const { eventType, metadata } = req.body as { eventType?: string; metadata?: Record<string, unknown> };
  if (!eventType) { res.status(400).json({ error: "eventType gerekli" }); return; }

  await trackActivity(customerId, eventType, metadata);
  res.json({ ok: true });
});

// ─── Admin Routes ─────────────────────────────────────────────────────────────

// GET /api/admin/health/overview
router.get("/admin/health/overview", requireAdmin, async (_req: Request, res: Response) => {
  // Get latest score per customer
  const scores = await db
    .selectDistinctOn([customerHealthScoresTable.customerId], {
      customerId: customerHealthScoresTable.customerId,
      healthScore: customerHealthScoresTable.healthScore,
      healthTier: customerHealthScoresTable.healthTier,
      churnProbability: customerHealthScoresTable.churnProbability,
      churnRiskFactors: customerHealthScoresTable.churnRiskFactors,
      calculatedAt: customerHealthScoresTable.calculatedAt,
    })
    .from(customerHealthScoresTable)
    .orderBy(customerHealthScoresTable.customerId, desc(customerHealthScoresTable.calculatedAt));

  const healthy = scores.filter(s => s.healthTier === "healthy").length;
  const atRisk = scores.filter(s => s.healthTier === "at_risk").length;
  const critical = scores.filter(s => s.healthTier === "critical").length;
  const churned = scores.filter(s => s.healthTier === "churned").length;

  res.json({ healthy, atRisk, critical, churned, total: scores.length, scores });
});

// GET /api/admin/health/at-risk
router.get("/admin/health/at-risk", requireAdmin, async (_req: Request, res: Response) => {
  const scores = await db
    .selectDistinctOn([customerHealthScoresTable.customerId], {
      customerId: customerHealthScoresTable.customerId,
      healthScore: customerHealthScoresTable.healthScore,
      healthTier: customerHealthScoresTable.healthTier,
      churnProbability: customerHealthScoresTable.churnProbability,
      churnRiskFactors: customerHealthScoresTable.churnRiskFactors,
      calculatedAt: customerHealthScoresTable.calculatedAt,
    })
    .from(customerHealthScoresTable)
    .where(sql`${customerHealthScoresTable.healthTier} IN ('at_risk','critical','churned')`)
    .orderBy(customerHealthScoresTable.customerId, desc(customerHealthScoresTable.calculatedAt));

  // Join with customer info
  const enriched = await Promise.all(scores.map(async s => {
    const [customer] = await db.select({ fullName: customersTable.fullName, email: customersTable.email, subscriptionPlan: customersTable.subscriptionPlan })
      .from(customersTable).where(eq(customersTable.id, s.customerId));
    const [lastLogin] = await db.select({ occurredAt: customerActivityEventsTable.occurredAt })
      .from(customerActivityEventsTable)
      .where(and(eq(customerActivityEventsTable.customerId, s.customerId), eq(customerActivityEventsTable.eventType, "login")))
      .orderBy(desc(customerActivityEventsTable.occurredAt)).limit(1);
    return { ...s, customer, lastLogin: lastLogin?.occurredAt };
  }));

  enriched.sort((a, b) => Number(b.churnProbability) - Number(a.churnProbability));
  res.json(enriched);
});

// GET /api/admin/health/interventions
router.get("/admin/health/interventions", requireAdmin, async (_req: Request, res: Response) => {
  const interventions = await db.select()
    .from(healthInterventionsTable)
    .orderBy(desc(healthInterventionsTable.triggeredAt))
    .limit(50);
  res.json(interventions);
});

// POST /api/admin/health/recalculate
router.post("/admin/health/recalculate", requireAdmin, async (_req: Request, res: Response) => {
  void calculateAllHealthScores();
  res.json({ ok: true, message: "Saglik skoru hesaplamasi basladi" });
});

export default router;
