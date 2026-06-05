/**
 * Günlük Yönetici Özeti — Toplayıcı Servis
 *
 * Dokümandaki isim → Gerçek tablo/alan adı eşleştirmesi:
 *   subscriptions.monthlyAmount  → customerServiceSubscriptionsTable.amountPaid
 *   subscriptions.renewsAt       → customerServiceSubscriptionsTable.expiresAt
 *   riskLevel = 'critical'       → healthTier = 'critical'
 *   dailyIsrTasks                → leadScanQueueTable (scanStatus)
 *   nightlyPipelineRuns          → leadScanQueueTable (son 24 saat özeti)
 *   customers.isActive           → subscriptionStatus = 'active'
 */

import { db } from "@workspace/db";
import {
  customersTable,
  customerServiceSubscriptionsTable,
  customerHealthScoresTable,
  cveTrackerTable,
  iocActionLogTable,
  socialMediaPostsTable,
  bulletinSubscribersTable,
  leadScanQueueTable,
  dailySummariesTable,
  pendingApprovalsTable,
  type ActionItem,
} from "@workspace/db";
import { eq, count, gte, lte, and, sum, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

// ─── Tarih yardımcıları ────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

function subDays(d: Date, n: number): Date {
  return new Date(d.getTime() - n * 86_400_000);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

function subHours(d: Date, n: number): Date {
  return new Date(d.getTime() - n * 3_600_000);
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── Aksiyon listesi ──────────────────────────────────────────────────────────

function buildActionItems(stats: {
  emailsReady: number;
  pendingPosts: number;
  highRisk: number;
  renewalsDue: number;
  overdue: number;
  pendingApprovals?: number;
}): ActionItem[] {
  const items: ActionItem[] = [];

  if ((stats.pendingApprovals ?? 0) > 0) items.unshift({
    priority: 0,
    icon: "check-circle",
    description: `${stats.pendingApprovals} aksiyon onayınızı bekliyor`,
    url: "/panel/approvals",
    estimatedMinutes: (stats.pendingApprovals ?? 0) * 2,
  });

  if (stats.emailsReady > 0) items.push({
    priority: 1,
    icon: "mail",
    description: `${stats.emailsReady} lead e-postası gönderilmeye hazır`,
    url: "/panel/lead-gen/queue",
    estimatedMinutes: Math.ceil(stats.emailsReady * 0.5),
  });

  if (stats.highRisk > 0) items.push({
    priority: 2,
    icon: "alert-triangle",
    description: `${stats.highRisk} müşteri kritik churn riski`,
    url: "/panel/saglik",
    estimatedMinutes: stats.highRisk * 5,
  });

  if (stats.overdue > 0) items.push({
    priority: 2,
    icon: "credit-card",
    description: `${stats.overdue} askıya alınmış abonelik`,
    url: "/panel/musteri-servisleri",
    estimatedMinutes: stats.overdue * 3,
  });

  if (stats.pendingPosts > 0) items.push({
    priority: 3,
    icon: "share-2",
    description: `${stats.pendingPosts} sosyal medya içeriği onay bekliyor`,
    url: "/panel/sosyal-medya",
    estimatedMinutes: Math.ceil(stats.pendingPosts * 2),
  });

  if (stats.renewalsDue > 0) items.push({
    priority: 5,
    icon: "refresh-cw",
    description: `${stats.renewalsDue} abonelik 30 gün içinde yenileniyor`,
    url: "/panel/musteri-servisleri",
    estimatedMinutes: 5,
  });

  return items.sort((a, b) => a.priority - b.priority);
}

// ─── Ana toplayıcı fonksiyon ──────────────────────────────────────────────────

export async function collectDailySummary(date: Date = new Date()): Promise<void> {
  const yesterday = subDays(date, 1);
  const last24h   = subHours(date, 24);
  const plus30d   = addDays(date, 30);

  // ── Gelir ──────────────────────────────────────────────────────────────────

  // Aktif abonelik sayısı (customerServiceSubscriptionsTable.status = 'active')
  const [activeSubs] = await db.select({ count: count() })
    .from(customerServiceSubscriptionsTable)
    .where(eq(customerServiceSubscriptionsTable.status, "active"));

  // MRR = aktif aboneliklerin amountPaid toplamı
  const [mrrData] = await db.select({
    total: sum(customerServiceSubscriptionsTable.amountPaid),
  }).from(customerServiceSubscriptionsTable)
    .where(eq(customerServiceSubscriptionsTable.status, "active"));

  const currentMrr = Number(mrrData?.total ?? 0);

  // Geçen ay MRR tahmini (30 gün önceki aktif abonelikler toplamı)
  const [prevMrrData] = await db.select({
    total: sum(customerServiceSubscriptionsTable.amountPaid),
  }).from(customerServiceSubscriptionsTable)
    .where(
      and(
        eq(customerServiceSubscriptionsTable.status, "active"),
        lte(customerServiceSubscriptionsTable.startedAt, subDays(date, 30)),
      )
    );
  const prevMrr = Number(prevMrrData?.total ?? 0);
  const momMrrChange = prevMrr > 0
    ? ((currentMrr - prevMrr) / prevMrr) * 100
    : 0;

  // Bugün yeni kaydolan müşteri sayısı
  const [newToday] = await db.select({ count: count() })
    .from(customersTable)
    .where(
      and(
        gte(customersTable.createdAt, startOfDay(date)),
        lte(customersTable.createdAt, endOfDay(date)),
      )
    );

  // 30 gün içinde yenilenmesi gereken aktif abonelikler
  const [renewalsDue] = await db.select({ count: count() })
    .from(customerServiceSubscriptionsTable)
    .where(
      and(
        eq(customerServiceSubscriptionsTable.status, "active"),
        lte(customerServiceSubscriptionsTable.expiresAt, plus30d),
      )
    );

  // Askıya alınmış (ödeme sorunu olan) abonelikler
  // customerServiceSubscriptionsTable'da 'suspended' = payment_failed karşılığı
  const [overduePayments] = await db.select({ count: count() })
    .from(customerServiceSubscriptionsTable)
    .where(eq(customerServiceSubscriptionsTable.status, "suspended"));

  // ── Pipeline ────────────────────────────────────────────────────────────────

  // Gece taranan domain sayısı (leadScanQueueTable — son 24 saatte eklenenler)
  const [scannedLastNight] = await db.select({ count: count() })
    .from(leadScanQueueTable)
    .where(gte(leadScanQueueTable.createdAt, last24h));

  // Nitelendirilen lead sayısı (scanStatus = 'qualified')
  const [qualified] = await db.select({ count: count() })
    .from(leadScanQueueTable)
    .where(
      and(
        gte(leadScanQueueTable.createdAt, last24h),
        eq(leadScanQueueTable.scanStatus, "qualified"),
      )
    );

  // Gönderilmeye hazır e-postalar (scanStatus = 'pending')
  const [emailsReady] = await db.select({ count: count() })
    .from(leadScanQueueTable)
    .where(
      and(
        gte(leadScanQueueTable.createdAt, startOfDay(date)),
        eq(leadScanQueueTable.scanStatus, "pending"),
      )
    );

  // Dün gönderilen e-postalar (scanStatus = 'sent', createdAt = dün)
  const [emailsSentYesterday] = await db.select({ count: count() })
    .from(leadScanQueueTable)
    .where(
      and(
        gte(leadScanQueueTable.createdAt, startOfDay(yesterday)),
        lte(leadScanQueueTable.createdAt, endOfDay(yesterday)),
        eq(leadScanQueueTable.scanStatus, "sent"),
      )
    );

  // ── Müşteri Sağlığı ─────────────────────────────────────────────────────────

  // Kritik: customerHealthScoresTable.healthTier = 'critical'
  // Her müşterinin en son satırına bakıyoruz (DISTINCT ON customerId)
  const healthRaw = await db.execute<{ health_tier: string; cnt: string }>(
    sql`
      SELECT health_tier, COUNT(*) AS cnt
      FROM (
        SELECT DISTINCT ON (customer_id) health_tier
        FROM customer_health_scores
        ORDER BY customer_id, calculated_at DESC
      ) sub
      GROUP BY health_tier
    `
  );
  const healthCounts: Record<string, number> = {};
  for (const row of healthRaw.rows) {
    healthCounts[row.health_tier] = Number(row.cnt);
  }

  const highChurnRiskCount   = healthCounts["critical"] ?? 0;
  const mediumChurnRiskCount = healthCounts["at_risk"]  ?? 0;

  // ── Platform ────────────────────────────────────────────────────────────────

  // Son 24 saatte tespit edilen CVE'ler (cveTrackerTable.detectedAt)
  const [cveAlerts] = await db.select({ count: count() })
    .from(cveTrackerTable)
    .where(gte(cveTrackerTable.detectedAt, last24h));

  // Son 24 saatte işlenen IOC aksiyonları
  const [iocCount] = await db.select({ count: count() })
    .from(iocActionLogTable)
    .where(gte(iocActionLogTable.createdAt, last24h));

  // ── İçerik ──────────────────────────────────────────────────────────────────

  // Onay bekleyen sosyal medya postları (status = 'draft')
  const [pendingPosts] = await db.select({ count: count() })
    .from(socialMediaPostsTable)
    .where(eq(socialMediaPostsTable.status, "draft"));

  // Dün yayınlanan sosyal medya postları (status = 'published', publishedAt = dün)
  const [publishedYesterday] = await db.select({ count: count() })
    .from(socialMediaPostsTable)
    .where(
      and(
        gte(socialMediaPostsTable.publishedAt, startOfDay(yesterday)),
        lte(socialMediaPostsTable.publishedAt, endOfDay(yesterday)),
      )
    );

  // Aktif bülten abonesi sayısı (bulletinSubscribersTable.isActive = true)
  const [newsletterSubs] = await db.select({ count: count() })
    .from(bulletinSubscribersTable)
    .where(eq(bulletinSubscribersTable.isActive, true));

  // ── Bekleyen HITL onayları ────────────────────────────────────────────────

  const [hitlPending] = await db.select({ count: count() })
    .from(pendingApprovalsTable)
    .where(eq(pendingApprovalsTable.status, "pending"));

  // ── Aksiyon listesi ─────────────────────────────────────────────────────────

  const actionItems = buildActionItems({
    emailsReady:      Number(emailsReady?.count   ?? 0),
    pendingPosts:     Number(pendingPosts?.count  ?? 0),
    highRisk:         highChurnRiskCount,
    renewalsDue:      Number(renewalsDue?.count   ?? 0),
    overdue:          Number(overduePayments?.count ?? 0),
    pendingApprovals: Number(hitlPending?.count   ?? 0),
  });

  // ── Kaydet (UPSERT) ─────────────────────────────────────────────────────────

  await db.insert(dailySummariesTable).values({
    summaryDate:               formatDate(date),
    activeSubscriptions:       Number(activeSubs?.count ?? 0),
    mrrTrl:                    String(currentMrr.toFixed(2)),
    newCustomersToday:         Number(newToday?.count ?? 0),
    renewalsDue30Days:         Number(renewalsDue?.count ?? 0),
    overduePayments:           Number(overduePayments?.count ?? 0),
    momMrrChange:              String(momMrrChange.toFixed(2)),
    domainsScannedLastNight:   Number(scannedLastNight?.count ?? 0),
    leadsQualified:            Number(qualified?.count ?? 0),
    emailsReadyToSend:         Number(emailsReady?.count ?? 0),
    emailsSentYesterday:       Number(emailsSentYesterday?.count ?? 0),
    highChurnRiskCount,
    mediumChurnRiskCount,
    cveAlertsLast24h:          Number(cveAlerts?.count ?? 0),
    iocProcessedLast24h:       Number(iocCount?.count ?? 0),
    socialPostsPendingApproval: Number(pendingPosts?.count ?? 0),
    socialPostsPublishedYesterday: Number(publishedYesterday?.count ?? 0),
    newsletterSubscribers:     Number(newsletterSubs?.count ?? 0),
    actionItems,
    generatedAt:               new Date(),
  }).onConflictDoUpdate({
    target: dailySummariesTable.summaryDate,
    set: {
      activeSubscriptions:       Number(activeSubs?.count ?? 0),
      mrrTrl:                    String(currentMrr.toFixed(2)),
      newCustomersToday:         Number(newToday?.count ?? 0),
      renewalsDue30Days:         Number(renewalsDue?.count ?? 0),
      overduePayments:           Number(overduePayments?.count ?? 0),
      momMrrChange:              String(momMrrChange.toFixed(2)),
      domainsScannedLastNight:   Number(scannedLastNight?.count ?? 0),
      leadsQualified:            Number(qualified?.count ?? 0),
      emailsReadyToSend:         Number(emailsReady?.count ?? 0),
      emailsSentYesterday:       Number(emailsSentYesterday?.count ?? 0),
      highChurnRiskCount,
      mediumChurnRiskCount,
      cveAlertsLast24h:          Number(cveAlerts?.count ?? 0),
      iocProcessedLast24h:       Number(iocCount?.count ?? 0),
      socialPostsPendingApproval: Number(pendingPosts?.count ?? 0),
      socialPostsPublishedYesterday: Number(publishedYesterday?.count ?? 0),
      newsletterSubscribers:     Number(newsletterSubs?.count ?? 0),
      actionItems,
      generatedAt:               new Date(),
    },
  });

  logger.info({ date: formatDate(date), mrr: currentMrr, actionItems: actionItems.length }, "Daily summary collected");
}
