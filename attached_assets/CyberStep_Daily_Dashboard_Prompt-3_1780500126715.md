# CyberStep.io — Günlük Yönetici Özeti
## Replit Agent Promptu — Sabah 08:00 Otomatik Dashboard

---

## AMAÇ

Her sabah 08:00'de tek bir email ve
admin panel sayfası üretilir.

Tüm operasyonu tek bakışta gösterir:
Gelir, pipeline, platform, içerik, sağlık.

İnsan için günlük aksiyon listesi çıkar.
Hedef: 45 dakikada günü tamamla.

---

## BÖLÜM 1: VERİTABANI

```sql
CREATE TABLE IF NOT EXISTS daily_summaries (
  id serial PRIMARY KEY,
  summary_date date UNIQUE NOT NULL,

  active_subscriptions integer DEFAULT 0,
  mrr_trl decimal(12,2) DEFAULT 0,
  new_customers_today integer DEFAULT 0,
  renewals_due_30_days integer DEFAULT 0,
  overdue_payments integer DEFAULT 0,
  mom_mrr_change decimal(5,2) DEFAULT 0,

  domains_scanned_last_night integer DEFAULT 0,
  leads_qualified integer DEFAULT 0,
  emails_ready_to_send integer DEFAULT 0,
  emails_sent_yesterday integer DEFAULT 0,
  pipeline_cost_usd decimal(8,4) DEFAULT 0,

  high_churn_risk_count integer DEFAULT 0,
  medium_churn_risk_count integer DEFAULT 0,
  open_support_tickets integer DEFAULT 0,

  scan_errors_last_24h integer DEFAULT 0,
  cve_alerts_last_24h integer DEFAULT 0,
  ioc_processed_last_24h integer DEFAULT 0,

  social_posts_pending_approval integer DEFAULT 0,
  social_posts_published_yesterday integer DEFAULT 0,
  linkedin_followers integer DEFAULT 0,
  newsletter_subscribers integer DEFAULT 0,

  action_items jsonb DEFAULT '[]',
  generated_at timestamp DEFAULT now()
);

-- Müşteri sağlık skoru
CREATE TABLE IF NOT EXISTS customer_health_scores (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id) UNIQUE,

  score_portal_activity integer DEFAULT 50,
  score_scan_engagement integer DEFAULT 50,
  score_email_engagement integer DEFAULT 50,
  score_report_downloads integer DEFAULT 50,
  score_payment_health integer DEFAULT 100,

  overall_score integer DEFAULT 50,
  risk_level varchar(20),
  -- 'healthy' | 'at_risk' | 'critical'

  last_portal_login timestamp,
  last_email_opened timestamp,

  score_7_days_ago integer,
  trend varchar(10),
  -- 'improving' | 'stable' | 'declining'

  calculated_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Churn tetikleyici log
CREATE TABLE IF NOT EXISTS churn_trigger_log (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  risk_level varchar(20),
  trigger_type varchar(50),
  email_sent boolean DEFAULT false,
  isr_task_created boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);
```

---

## BÖLÜM 2: SAĞLIK SKORU HESAPLAYICI

```typescript
// src/dashboard/healthScoreCalculator.ts

const HEALTH_WEIGHTS = {
  portal_activity:  0.30,
  scan_engagement:  0.25,
  email_engagement: 0.20,
  report_downloads: 0.15,
  payment_health:   0.10,
};

export async function calculateCustomerHealth(
  customerId: number
): Promise<void> {

  const now = new Date();

  // Portal aktivitesi
  const lastLogin = await getLastPortalLogin(customerId);
  const daysSinceLogin = lastLogin
    ? Math.floor((now.getTime() - lastLogin.getTime()) / 86400000)
    : 999;

  const portalScore =
    daysSinceLogin === 0  ? 100 :
    daysSinceLogin <= 3   ?  85 :
    daysSinceLogin <= 7   ?  70 :
    daysSinceLogin <= 14  ?  45 :
    daysSinceLogin <= 30  ?  20 : 0;

  // Tarama kullanımı
  const recentScans = await getRecentScanCount(customerId, 14);
  const scanScore =
    recentScans >= 5 ? 100 :
    recentScans >= 2 ?  75 :
    recentScans >= 1 ?  50 : 0;

  // Email etkileşimi
  const emailStats = await getEmailStats(customerId, 30);
  const openRate = emailStats.sent > 0
    ? emailStats.opened / emailStats.sent : 0;

  const emailScore =
    openRate >= 0.5 ? 100 :
    openRate >= 0.3 ?  75 :
    openRate >= 0.1 ?  50 :
    openRate > 0    ?  25 : 0;

  // Rapor indirme
  const downloads = await getReportDownloads(customerId, 30);
  const reportScore = downloads >= 2 ? 100 : downloads >= 1 ? 70 : 20;

  // Ödeme sağlığı
  const hasOverdue = await checkOverduePayment(customerId);
  const paymentScore = hasOverdue ? 0 : 100;

  const overall = Math.round(
    portalScore  * HEALTH_WEIGHTS.portal_activity  +
    scanScore    * HEALTH_WEIGHTS.scan_engagement  +
    emailScore   * HEALTH_WEIGHTS.email_engagement +
    reportScore  * HEALTH_WEIGHTS.report_downloads +
    paymentScore * HEALTH_WEIGHTS.payment_health
  );

  const riskLevel =
    overall >= 60 ? 'healthy' :
    overall >= 30 ? 'at_risk' : 'critical';

  const prevScore = await getPreviousHealthScore(customerId, 7);
  const trend =
    overall > (prevScore || 0) + 5 ? 'improving' :
    overall < (prevScore || 0) - 5 ? 'declining' : 'stable';

  await db.insert(customerHealthScores).values({
    customerId, overallScore: overall, riskLevel,
    scorePortalActivity:  portalScore,
    scoreScanEngagement:  scanScore,
    scoreEmailEngagement: emailScore,
    scoreReportDownloads: reportScore,
    scorePaymentHealth:   paymentScore,
    lastPortalLogin: lastLogin,
    score7DaysAgo: prevScore, trend,
    calculatedAt: now,
  }).onConflictDoUpdate({
    target: customerHealthScores.customerId,
    set: {
      overallScore: overall, riskLevel, trend,
      scorePortalActivity:  portalScore,
      scoreScanEngagement:  scanScore,
      scoreEmailEngagement: emailScore,
      scoreReportDownloads: reportScore,
      scorePaymentHealth:   paymentScore,
      score7DaysAgo: prevScore,
      updatedAt: now,
    }
  });
}

export async function calculateAllHealthScores(): Promise<void> {
  const all = await db.select({ id: customers.id })
    .from(customers)
    .where(eq(customers.isActive, true));

  for (const c of all) {
    await calculateCustomerHealth(c.id);
    await sleep(100);
  }
}
```

---

## BÖLÜM 3: ÖZET TOPLAYICI

```typescript
// src/dashboard/summaryCollector.ts

export async function collectDailySummary(
  date: Date
): Promise<void> {

  const yesterday = subDays(date, 1);

  // Gelir
  const [activeCust] = await db.select({ count: count() })
    .from(customers).where(eq(customers.isActive, true));

  const [mrrData] = await db.select({
    total: sum(subscriptions.monthlyAmount)
  }).from(subscriptions).where(eq(subscriptions.status, 'active'));

  const [newToday] = await db.select({ count: count() })
    .from(customers).where(
      and(
        gte(customers.createdAt, startOfDay(date)),
        lte(customers.createdAt, endOfDay(date))
      )
    );

  const [renewals] = await db.select({ count: count() })
    .from(subscriptions).where(
      and(
        eq(subscriptions.status, 'active'),
        lte(subscriptions.renewsAt, addDays(date, 30))
      )
    );

  const [overdue] = await db.select({ count: count() })
    .from(subscriptions).where(
      eq(subscriptions.status, 'payment_failed')
    );

  const currentMrr = Number(mrrData?.total || 0);
  const lastMonthMrr = await getMRROnDate(subDays(date, 30));
  const momChange = lastMonthMrr > 0
    ? ((currentMrr - lastMonthMrr) / lastMonthMrr) * 100 : 0;

  // Pipeline
  const [lastRun] = await db.select()
    .from(nightlyPipelineRuns)
    .where(eq(nightlyPipelineRuns.runDate, formatDate(date)))
    .limit(1);

  const [emailsReady] = await db.select({ count: count() })
    .from(dailyIsrTasks).where(
      and(
        eq(dailyIsrTasks.runDate, formatDate(date)),
        eq(dailyIsrTasks.contactStatus, 'ready')
      )
    );

  const [emailsSent] = await db.select({ count: count() })
    .from(dailyIsrTasks).where(
      and(
        eq(dailyIsrTasks.runDate, formatDate(yesterday)),
        eq(dailyIsrTasks.contactStatus, 'sent')
      )
    );

  // Sağlık
  const [highRisk] = await db.select({ count: count() })
    .from(customerHealthScores)
    .where(eq(customerHealthScores.riskLevel, 'critical'));

  const [medRisk] = await db.select({ count: count() })
    .from(customerHealthScores)
    .where(eq(customerHealthScores.riskLevel, 'at_risk'));

  // Platform
  const [cveAlerts] = await db.select({ count: count() })
    .from(cveTracker).where(
      and(
        gte(cveTracker.detectedAt, subHours(date, 24)),
        inArray(cveTracker.status, ['analyzed', 'published'])
      )
    );

  const [iocCount] = await db.select({ count: count() })
    .from(iocActionLog)
    .where(gte(iocActionLog.createdAt, subHours(date, 24)));

  // İçerik
  const [pendingPosts] = await db.select({ count: count() })
    .from(socialMediaPosts)
    .where(eq(socialMediaPosts.status, 'draft'));

  const [newsletterSubs] = await db.select({ count: count() })
    .from(bulletinSubscribers)
    .where(eq(bulletinSubscribers.isActive, true));

  // Aksiyon listesi
  const actions = buildActionItems({
    emailsReady:   emailsReady?.count   || 0,
    pendingPosts:  pendingPosts?.count  || 0,
    highRisk:      highRisk?.count      || 0,
    renewalsDue:   renewals?.count      || 0,
    overdue:       overdue?.count       || 0,
  });

  await db.insert(dailySummaries).values({
    summaryDate: formatDate(date),
    activeSubscriptions: activeCust?.count || 0,
    mrrTrl: currentMrr,
    newCustomersToday: newToday?.count || 0,
    renewalsDue30Days: renewals?.count || 0,
    overduePayments: overdue?.count || 0,
    momMrrChange: momChange,
    domainsScannedLastNight: lastRun?.domainsScanned || 0,
    leadsQualified: lastRun?.domainsQualified || 0,
    emailsReadyToSend: emailsReady?.count || 0,
    emailsSentYesterday: emailsSent?.count || 0,
    pipelineCostUsd: lastRun?.totalCostUsd || 0,
    highChurnRiskCount: highRisk?.count || 0,
    mediumChurnRiskCount: medRisk?.count || 0,
    cveAlertsLast24h: cveAlerts?.count || 0,
    iocProcessedLast24h: iocCount?.count || 0,
    socialPostsPendingApproval: pendingPosts?.count || 0,
    newsletterSubscribers: newsletterSubs?.count || 0,
    actionItems: actions,
  }).onConflictDoUpdate({
    target: dailySummaries.summaryDate,
    set: { actionItems: actions, generatedAt: new Date() }
  });
}

function buildActionItems(stats: {
  emailsReady: number;
  pendingPosts: number;
  highRisk: number;
  renewalsDue: number;
  overdue: number;
}): ActionItem[] {

  const items: ActionItem[] = [];

  if (stats.emailsReady > 0) items.push({
    priority: 1, icon: '📧',
    description: `${stats.emailsReady} lead email gönderilmeye hazır`,
    url: '/admin-panel/isr/daily',
    estimatedMinutes: Math.ceil(stats.emailsReady * 0.5),
  });

  if (stats.highRisk > 0) items.push({
    priority: 2, icon: '🚨',
    description: `${stats.highRisk} müşteri kritik churn riski`,
    url: '/admin-panel/customers?risk=critical',
    estimatedMinutes: stats.highRisk * 5,
  });

  if (stats.overdue > 0) items.push({
    priority: 2, icon: '💳',
    description: `${stats.overdue} gecikmiş ödeme`,
    url: '/admin-panel/billing?status=overdue',
    estimatedMinutes: stats.overdue * 3,
  });

  if (stats.pendingPosts > 0) items.push({
    priority: 3, icon: '📱',
    description: `${stats.pendingPosts} sosyal medya içeriği onay bekliyor`,
    url: '/admin-panel/social-media',
    estimatedMinutes: Math.ceil(stats.pendingPosts * 2),
  });

  if (stats.renewalsDue > 0) items.push({
    priority: 5, icon: '🔄',
    description: `${stats.renewalsDue} abonelik 30 gün içinde yenileniyor`,
    url: '/admin-panel/billing?filter=renewing',
    estimatedMinutes: 5,
  });

  return items.sort((a, b) => a.priority - b.priority);
}
```

---

## BÖLÜM 4: CHURN TETİKLEYİCİLERİ

```typescript
// src/dashboard/churnTriggers.ts

export async function processChurnTriggers(): Promise<void> {

  const atRisk = await db.select()
    .from(customerHealthScores)
    .innerJoin(customers,
      eq(customerHealthScores.customerId, customers.id))
    .where(
      inArray(customerHealthScores.riskLevel,
        ['critical', 'at_risk'])
    );

  for (const c of atRisk) {
    // 7 günde bir max 1 tetikleyici
    const lastTrigger = await getLastChurnTrigger(c.customerId);
    const daysSince = lastTrigger
      ? Math.floor((Date.now() - lastTrigger.getTime()) / 86400000)
      : 999;
    if (daysSince < 7) continue;

    // Claude Haiku ile kişiselleştirilmiş email
    const recentFindings = await getRecentFindings(c.domain, 3);

    const emailContent = await callClaude(`
Müşteri ${c.companyName} için kısa check-in emaili yaz.
Son portal girişi: ${daysSince} gün önce.
${recentFindings.length > 0
  ? `Yeni bulgular: ${recentFindings.map(f => f.title).join(', ')}`
  : 'Yeni bulgu yok.'}
Satış baskısı yok. Samimi, kısa, yardımcı ol.
Maksimum 3 cümle + CTA: portal linki.
    `, {
      model: 'claude-haiku-4-5',
      maxTokens: 150,
    });

    await sendEmail({
      to: c.email,
      subject: `${c.domain} — güvenlik durumunuz`,
      html: buildChurnEmail(emailContent, c),
      from: 'security@cyberstep.io',
    });

    if (c.riskLevel === 'critical') {
      await createISRTask({
        customerId: c.customerId,
        type: 'churn_risk',
        priority: 'high',
        description:
          `Kritik risk — skor: ${c.overallScore}. Email gönderildi.`,
      });
    }

    await db.insert(churnTriggerLog).values({
      customerId: c.customerId,
      riskLevel: c.riskLevel,
      triggerType: 'auto_email',
      emailSent: true,
      isrTaskCreated: c.riskLevel === 'critical',
    });
  }
}
```

---

## BÖLÜM 5: CRON JOB'LAR

```typescript
// 07:00 — Sağlık skorları + churn tetikleyiciler
cron.schedule('0 7 * * *', async () => {
  await calculateAllHealthScores();
  await processChurnTriggers();
});

// 07:45 — Özet topla
cron.schedule('45 7 * * *', async () => {
  await collectDailySummary(new Date());
});

// 08:00 — Email gönder
cron.schedule('0 8 * * *', async () => {
  const [summary] = await db.select()
    .from(dailySummaries)
    .where(eq(dailySummaries.summaryDate,
      formatDate(new Date())))
    .limit(1);

  if (!summary) return;

  const mrr = new Intl.NumberFormat('tr-TR').format(summary.mrrTrl);
  const taskCount = (summary.actionItems as any[]).length;

  await sendEmail({
    to: process.env.ISR_TEAM_EMAIL!,
    subject: `🌅 ${formatDate(new Date())} — ${taskCount} görev · MRR ${mrr} TL`,
    html: buildSummaryEmail(summary),
    from: 'dashboard@cyberstep.io',
    fromName: 'CyberStep Dashboard',
  });
});
```

---

## BÖLÜM 6: DASHBOARD SAYFASI (/admin-panel/dashboard)

```
─── BUGÜNÜN GÖREVLERİ (~45 dk) ─────────────────────────────
📧 28 lead email hazır         ~14 dk   [Git →]
🚨 2 kritik churn riski        ~10 dk   [Git →]
📱 12 sosyal medya bekliyor    ~24 dk   [Git →]

─── GELİR ───────────────────────────────────────────────────
MRR: 187.400 TL   ▲ %8.3   |   Müşteri: 23 (+1 bugün)
30 gün yenileme: 4          |   Geciken: 0

─── PİPELİNE ────────────────────────────────────────────────
Dün gece: 187 domain → 34 lead → $4.23
Email: 28 hazır  |  Dün: 22 gönderildi (%36 açıldı)

─── MÜŞTERİ SAĞLIĞI ────────────────────────────────────────
🟢 Sağlıklı: 19  🟡 Orta: 2  🔴 Kritik: 2

Kritik:
  Acme A.Ş.  skor:18  22 gün giriş yok  [İncele →]
  Beta Ltd.  skor:24  Ödeme gecikmiş    [İncele →]

─── PLATFORM ────────────────────────────────────────────────
Pipeline: 🟢  |  CVE: 1  |  IOC: 1.247  |  Hata: 0

─── İÇERİK ─────────────────────────────────────────────────
Onay: 12  |  LinkedIn: 847 takipçi  |  Bülten: 234
```

---

## BÖLÜM 7: API ROTALAR

```
GET /api/admin/dashboard/today      → Bugünkü özet JSON
GET /api/admin/dashboard/history    → Son 30 gün trend
GET /api/admin/customers/health     → Sağlık listesi
GET /api/admin/dashboard/export     → PDF rapor
POST /api/admin/dashboard/send-test → Test email gönder
```

---

## TEST SENARYOSU

```
1. Sağlık skoru:
   calculateCustomerHealth(testCustomerId)
   → customer_health_scores tablosunda kayıt var mı?
   → overall_score 0-100 arası mı?
   → risk_level doğru mu?

2. Özet toplama:
   collectDailySummary(new Date())
   → daily_summaries tablosuna kaydedildi mi?
   → action_items boş değil mi?

3. Email test:
   POST /api/admin/dashboard/send-test
   → Email geldi mi?
   → MRR ve görev sayısı konu satırında var mı?
   → Linkler çalışıyor mu?

4. Churn tetikleyici:
   Test müşterisinin son_login'ini 40 gün geriye al.
   calculateCustomerHealth() → risk_level: 'critical'
   processChurnTriggers() → email gönderildi mi?
   → churn_trigger_log tablosunda kayıt var mı?
```

---

*CyberStep.io — Günlük Yönetici Özeti — 2026*
*Sabah 08:00 — 45 dakikada günü bitir*
