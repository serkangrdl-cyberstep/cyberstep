# CyberStep.io — %90 AI Yönetimli Şirket Sistemleri
## Replit Agent Promptu — Self-Serve + Otomasyon + Analitik

---

## AMAÇ

Bu prompt altı sistemi inşa eder:

1. Self-Serve Onboarding + Abonelik Yönetimi
2. Finansal Otomasyon (e-fatura + dunning)
3. Ürün Analitiği (PostHog entegrasyonu)
4. Upsell Otomasyonu
5. Platform Self-Monitoring
6. Rekabet ve Pazar İzleme

Her biri insan müdahalesi olmadan çalışır.
Toplam geliştirme: ~2 hafta.

---

## BÖLÜM 1: SELF-SERVE ONBOARDİNG

### 1.1 Veritabanı

```sql
-- Onboarding durumu
CREATE TABLE IF NOT EXISTS customer_onboarding (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id) UNIQUE,

  -- Adım durumları
  step_payment_completed boolean DEFAULT false,
  step_portal_accessed boolean DEFAULT false,
  step_domain_added boolean DEFAULT false,
  step_first_scan_completed boolean DEFAULT false,
  step_report_viewed boolean DEFAULT false,
  step_notification_configured boolean DEFAULT false,

  -- Tamamlanma
  completed_at timestamp,
  completion_pct integer DEFAULT 0,

  -- Email serisi
  welcome_email_sent_at timestamp,
  day1_email_sent_at timestamp,
  day3_email_sent_at timestamp,
  day7_email_sent_at timestamp,

  started_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Abonelik değişiklik log
CREATE TABLE IF NOT EXISTS subscription_changes (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  change_type varchar(30),
  -- 'upgrade' | 'downgrade' | 'cancel' | 'reactivate'
  from_plan varchar(50),
  to_plan varchar(50),
  reason text,
  -- İptal sebebi (müşterinin yazdığı)
  effective_date date,
  performed_by varchar(50) DEFAULT 'customer',
  prorated_amount decimal(10,2),
  -- Orantılı ücret/iade
  created_at timestamp DEFAULT now()
);
```

### 1.2 Onboarding Email Serisi

```typescript
// src/onboarding/emailSeries.ts
// Iyzico webhook → ödeme alındı → bu tetiklenir

export async function startOnboardingSequence(
  customerId: number
): Promise<void> {

  const customer = await getCustomer(customerId);

  // Onboarding kaydı oluştur
  await db.insert(customerOnboarding).values({
    customerId,
    stepPaymentCompleted: true,
  }).onConflictDoNothing();

  // Email 1 — Anında (ödeme sonrası)
  await sendEmail({
    to: customer.email,
    subject: `🎉 CyberStep hesabınız hazır — hemen başlayın`,
    html: buildWelcomeEmail(customer),
    from: 'welcome@cyberstep.io',
    fromName: 'CyberStep',
  });

  await db.update(customerOnboarding).set({
    welcomeEmailSentAt: new Date(),
  }).where(eq(customerOnboarding.customerId, customerId));

  // Email 2 — 1. gün
  await scheduleEmail(customerId, 'day1', addDays(new Date(), 1));

  // Email 3 — 3. gün
  await scheduleEmail(customerId, 'day3', addDays(new Date(), 3));

  // Email 4 — 7. gün (ilk hafta raporu)
  await scheduleEmail(customerId, 'day7', addDays(new Date(), 7));
}

// Her email tipi için Claude Haiku içerik üretir
async function buildOnboardingEmail(
  customer: Customer,
  day: 'day1' | 'day3' | 'day7'
): Promise<string> {

  const onboarding = await getOnboardingStatus(customer.id);
  const completedSteps = countCompletedSteps(onboarding);

  const prompts = {
    day1: `
Müşteri ${customer.companyName} için
1. gün onboarding emaili yaz.
Domain eklemedilerse: nasıl ekleyeceklerini anlat.
Ekledilerse: "harika, ilk taramanız tamamlandı" de.
Tamamlanan adım sayısı: ${completedSteps}/6
Kısa, net, adım adım. Max 4 cümle.
    `,
    day3: `
Müşteri ${customer.companyName} için 3. gün emaili.
${onboarding.stepFirstScanCompleted
  ? `İlk taramaları tamamlandı. Buldukları hakkında bilgi ver.`
  : `Henüz tarama yapmadılar. Tek tıkla nasıl başlatacaklarını anlat.`}
Max 3 cümle + tek CTA butonu.
    `,
    day7: `
Müşteri ${customer.companyName} için 7. gün özeti.
${onboarding.stepFirstScanCompleted
  ? `İlk hafta tamamlandı. Başarılarını kutla, bir sonraki adımı öner.`
  : `Henüz başlamadılar. Son bir teşvik et.`}
Veri varsa sayıları kullan. Max 5 cümle.
    `,
  };

  return callClaude(prompts[day], {
    model: 'claude-haiku-4-5',
    maxTokens: 200,
    system: 'CyberStep onboarding emaili yaz. Türkçe, samimi, baskısız.',
  });
}
```

### 1.3 Self-Serve Abonelik Yönetimi

```typescript
// Portal'da müşterinin kendi yapabileceği işlemler

// Paket yükseltme
// POST /api/portal/subscription/upgrade
export async function upgradeSubscription(
  customerId: number,
  newPlan: string
): Promise<void> {

  const current = await getActiveSubscription(customerId);
  const newPrice = PLAN_PRICES[newPlan];
  const currentPrice = PLAN_PRICES[current.plan];

  // Kalan günler için orantılı fark hesapla
  const daysLeft = differenceInDays(current.renewsAt, new Date());
  const dailyDiff = (newPrice - currentPrice) / 30;
  const proratedCharge = Math.max(0, Math.round(dailyDiff * daysLeft));

  // Iyzico'dan fark tutarını çek
  if (proratedCharge > 0) {
    await chargeIyzico(customerId, proratedCharge,
      `${current.plan} → ${newPlan} yükseltme farkı`);
  }

  await db.update(subscriptions).set({
    plan: newPlan,
    monthlyAmount: newPrice,
    updatedAt: new Date(),
  }).where(eq(subscriptions.customerId, customerId));

  await db.insert(subscriptionChanges).values({
    customerId,
    changeType: 'upgrade',
    fromPlan: current.plan,
    toPlan: newPlan,
    proratedAmount: proratedCharge,
  });

  // Teşekkür + yeni özellikler emaili
  await sendPlanChangeEmail(customerId, 'upgrade', newPlan);
}

// İptal
// POST /api/portal/subscription/cancel
export async function cancelSubscription(
  customerId: number,
  reason: string
): Promise<void> {

  const sub = await getActiveSubscription(customerId);

  // Dönem sonuna kadar aktif bırak
  await db.update(subscriptions).set({
    cancelledAt: new Date(),
    cancelsAt: sub.renewsAt,
    // Dönem bitmeden erişim devam eder
    status: 'cancelling',
  }).where(eq(subscriptions.customerId, customerId));

  await db.insert(subscriptionChanges).values({
    customerId,
    changeType: 'cancel',
    fromPlan: sub.plan,
    reason,
    effectiveDate: sub.renewsAt,
  });

  // Winback email serisi başlat
  await scheduleWinbackEmails(customerId, sub.renewsAt);

  // ISR'a bildir (iptal sebebi önemliyse)
  if (reason.length > 20) {
    await createISRTask({
      customerId,
      type: 'cancellation',
      priority: 'medium',
      description: `İptal sebebi: "${reason}"`,
    });
  }
}
```

---

## BÖLÜM 2: FİNANSAL OTOMASYON

### 2.1 E-Fatura (Zorunlu)

```typescript
// src/billing/einvoice.ts
// Paraşüt API entegrasyonu
// Alternatif: Logo veya Mikro

export async function createEInvoice(
  payment: Payment
): Promise<string> {

  const customer = await getCustomer(payment.customerId);

  const invoiceData = {
    // Paraşüt API formatı
    description: `CyberStep ${payment.planName} — ${payment.periodLabel}`,
    date: formatDate(new Date(), 'YYYY-MM-DD'),
    due_date: formatDate(new Date(), 'YYYY-MM-DD'),
    currency: 'TRY',

    contact: {
      name: customer.companyName || customer.name,
      email: customer.email,
      tax_number: customer.taxNumber || null,
    },

    lines: [{
      description: payment.description,
      quantity: 1,
      unit_price: payment.amountExVat,
      vat_rate: 20, // %20 KDV
    }],

    // E-arşiv fatura (B2C) veya e-fatura (B2B)
    invoice_type: customer.taxNumber ? 'e_invoice' : 'e_archive',
  };

  const response = await axios.post(
    'https://api.parasut.com/v4/{company_id}/e_invoice_inboxes',
    invoiceData,
    {
      headers: {
        Authorization: `Bearer ${process.env.PARASUT_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const invoiceNo = response.data.data.attributes.invoice_no;

  // DB'ye kaydet
  await db.update(payments).set({
    einvoiceNo: invoiceNo,
    einvoiceUrl: response.data.data.attributes.pdf_url,
    einvoiceCreatedAt: new Date(),
  }).where(eq(payments.id, payment.id));

  // Müşteriye fatura emaili
  await sendEmail({
    to: customer.email,
    subject: `E-Fatura: ${invoiceNo} — CyberStep.io`,
    html: buildInvoiceEmail(customer, invoiceNo,
      response.data.data.attributes.pdf_url),
    from: 'fatura@cyberstep.io',
    attachments: [{
      filename: `cyberstep-fatura-${invoiceNo}.pdf`,
      url: response.data.data.attributes.pdf_url,
    }],
  });

  return invoiceNo;
}

// Iyzico webhook'una ekle:
// Ödeme başarılı → createEInvoice() çağır
```

### 2.2 Dunning (Başarısız Ödeme Akışı)

```typescript
// src/billing/dunningManager.ts

// Iyzico webhook: payment_failed → bu çağrılır
export async function handlePaymentFailure(
  customerId: number,
  failureReason: string
): Promise<void> {

  const customer = await getCustomer(customerId);

  await db.update(subscriptions).set({
    status: 'payment_failed',
    paymentFailedAt: new Date(),
    paymentFailureReason: failureReason,
    paymentRetryCount: sql`payment_retry_count + 1`,
  }).where(eq(subscriptions.customerId, customerId));

  // Gün 0 — Anlık email
  await sendEmail({
    to: customer.email,
    subject: '⚠️ Ödemeniz alınamadı — CyberStep',
    html: buildDunningEmail(customer, 'day0'),
    from: 'billing@cyberstep.io',
  });
}

// Cron: Her gün kontrol
cron.schedule('0 10 * * *', async () => {
  const failedSubs = await db.select()
    .from(subscriptions)
    .where(eq(subscriptions.status, 'payment_failed'));

  for (const sub of failedSubs) {
    const daysFailed = differenceInDays(
      new Date(), sub.paymentFailedAt
    );

    const customer = await getCustomer(sub.customerId);

    if (daysFailed === 3) {
      // Gün 3 — Kart güncelleme isteği
      await sendEmail({
        to: customer.email,
        subject: '💳 Ödeme yönteminizi güncelleyin',
        html: buildDunningEmail(customer, 'day3'),
        from: 'billing@cyberstep.io',
      });
    }

    if (daysFailed === 7) {
      // Gün 7 — Son uyarı + SMS
      await sendEmail({
        to: customer.email,
        subject: '🔴 Servis 3 gün içinde duracak',
        html: buildDunningEmail(customer, 'day7'),
        from: 'billing@cyberstep.io',
      });
      await sendSMS(
        customer.phone,
        `CyberStep: Ödemeniz alınamadı. 3 gün içinde güncelleyin: ${BASE_URL}/portal/billing`
      );
    }

    if (daysFailed === 10) {
      // Gün 10 — Servis durdur
      await db.update(subscriptions).set({
        status: 'suspended',
        suspendedAt: new Date(),
      }).where(eq(subscriptions.id, sub.id));

      await sendEmail({
        to: customer.email,
        subject: 'CyberStep servisi durduruldu',
        html: buildDunningEmail(customer, 'day10'),
        from: 'billing@cyberstep.io',
      });
    }

    if (daysFailed >= 30) {
      // Gün 30 — Arşivle
      await db.update(customers).set({
        isActive: false,
        archivedAt: new Date(),
      }).where(eq(customers.id, sub.customerId));
    }
  }
});
```

---

## BÖLÜM 3: ÜRÜN ANALİTİĞİ

```typescript
// PostHog kurulumu
// pnpm add posthog-node

import { PostHog } from 'posthog-node';
const posthog = new PostHog(process.env.POSTHOG_API_KEY!, {
  host: 'https://app.posthog.com'
});

// src/analytics/tracker.ts

export function trackEvent(
  customerId: string,
  event: string,
  properties?: Record<string, any>
): void {
  posthog.capture({
    distinctId: customerId,
    event,
    properties: {
      ...properties,
      platform: 'cyberstep',
    },
  });
}

// Takip edilecek olaylar — mevcut kod içine ekle:

// Portal giriş
trackEvent(customerId, 'portal_login', {
  source: req.headers['user-agent'],
});

// Domain ekleme
trackEvent(customerId, 'domain_added', {
  domain,
  total_domains: newCount,
});

// Tarama başlatma
trackEvent(customerId, 'scan_started', {
  domain,
  scan_type: 'manual',
});

// Rapor indirme
trackEvent(customerId, 'report_downloaded', {
  report_type: 'assessment',
  domain,
});

// Paket yükseltme
trackEvent(customerId, 'plan_upgraded', {
  from_plan: oldPlan,
  to_plan: newPlan,
});

// İptal
trackEvent(customerId, 'subscription_cancelled', {
  plan: currentPlan,
  reason: cancellationReason,
  months_active: monthsActive,
});

// Onboarding adım tamamlama
trackEvent(customerId, 'onboarding_step_completed', {
  step: 'first_scan',
  day_of_onboarding: daysSinceSignup,
});

// NOT: PostHog dashboard'unda şu funnel'ları kur:
// 1. Ücretsiz tarama → Kayıt → Ödeme dönüşümü
// 2. Ödeme → İlk tarama → Rapor indirme
// 3. SOC Lite → SOC Standart yükseltme
```

---

## BÖLÜM 4: UPSELL OTOMASYONU

```typescript
// src/growth/upsellEngine.ts
// Her gece çalışır, tetikleyicileri kontrol eder

const UPSELL_RULES = [
  {
    id: 'soc_lite_to_standard',
    trigger: async (customerId: number) => {
      const sub = await getSubscription(customerId);
      if (sub.plan !== 'soc_lite') return false;
      // 30 günde 20+ alarm gördüyse
      const alarmCount = await getAlarmCount(customerId, 30);
      return alarmCount >= 20;
    },
    message: (customer: Customer) => ({
      subject: `${customer.companyName} — SOC kapasitenizi artırın`,
      body: `Bu ay ${customer.alarmCount} güvenlik alarmı izledik.
SOC Lite planı 20 alarm kapasiteli.
SOC Standart ile 3x daha fazla izleme ve
öncelikli müdahale. Fark: günde sadece 150 TL.`,
      cta: { text: 'SOC Standart\'a Geç', url: '/portal/upgrade' },
    }),
  },

  {
    id: 'assessment_to_monitoring',
    trigger: async (customerId: number) => {
      const sub = await getSubscription(customerId);
      if (!sub.plan.includes('assessment')) return false;
      // 3 kez rapor indirdiyse
      const downloads = await getReportDownloads(customerId, 30);
      return downloads >= 3;
    },
    message: (customer: Customer) => ({
      subject: `Raporunuzu 3 kez indirdiniz — sürekli izleme zamanı`,
      body: `Güvenlik durumunuzu düzenli takip ettiğinizi görüyoruz.
Aylık manuel kontrol yerine sürekli izleme ile
değişiklikler anında gelsin.`,
      cta: { text: 'CVE İzlemeyi Başlat', url: '/portal/upgrade' },
    }),
  },

  {
    id: 'soc_to_soc_noc',
    trigger: async (customerId: number) => {
      const sub = await getSubscription(customerId);
      const hasSOC = sub.plan.includes('soc');
      const hasNOC = sub.plan.includes('noc');
      if (!hasSOC || hasNOC) return false;
      // 60 günü geçmişse
      const daysActive = differenceInDays(new Date(), sub.startedAt);
      return daysActive >= 60;
    },
    message: (customer: Customer) => ({
      subject: `SOC + NOC kombinasyonuyla tam koruma`,
      body: `60 gündür SOC servisimizi kullanıyorsunuz.
SOC saldırıları izliyor, NOC ağ performansını.
İkisi birlikte %30 indirimle.`,
      cta: { text: 'NOC Ekle — %30 İndirim', url: '/portal/upgrade' },
    }),
  },
];

export async function runUpsellEngine(): Promise<void> {
  const customers = await getActiveCustomers();

  for (const customer of customers) {
    for (const rule of UPSELL_RULES) {
      // Bu kural için son 30 günde mesaj gönderildi mi?
      const recentUpsell = await getRecentUpsell(
        customer.id, rule.id, 30
      );
      if (recentUpsell) continue;

      const shouldTrigger = await rule.trigger(customer.id);
      if (!shouldTrigger) continue;

      const msg = rule.message(customer);

      await sendEmail({
        to: customer.email,
        subject: msg.subject,
        html: buildUpsellEmail(msg, customer),
        from: 'success@cyberstep.io',
      });

      await logUpsell(customer.id, rule.id);

      // PostHog
      trackEvent(customer.id.toString(), 'upsell_shown', {
        rule_id: rule.id,
        current_plan: customer.plan,
      });
    }
  }
}

// Cron: Her gece 23:00
cron.schedule('0 23 * * *', async () => {
  await runUpsellEngine();
});
```

---

## BÖLÜM 5: PLATFORM SELF-MONİTORİNG

### 5.1 Uptime Monitoring

```typescript
// src/monitoring/uptimeChecker.ts
// UptimeRobot veya BetterStack webhook alır

// POST /api/monitoring/uptime-alert
router.post('/uptime-alert', async (req, res) => {
  const { monitor, status, reason } = req.body;

  if (status === 'down') {
    // Telegram + SMS anlık bildirim
    await sendTelegram(
      process.env.ADMIN_TELEGRAM_ID!,
      `🔴 PLATFORM ÇÖKTÜ\n${monitor}\nSebep: ${reason}`
    );
    await sendSMS(
      process.env.ADMIN_PHONE!,
      `CyberStep DOWN: ${monitor}`
    );

    await db.insert(outageLog).values({
      monitor, startedAt: new Date(), status: 'down',
    });
  }

  if (status === 'up') {
    await sendTelegram(
      process.env.ADMIN_TELEGRAM_ID!,
      `✅ Platform tekrar çalışıyor: ${monitor}`
    );
    await db.update(outageLog).set({
      resolvedAt: new Date(), status: 'resolved',
    }).where(
      and(eq(outageLog.monitor, monitor),
          isNull(outageLog.resolvedAt))
    );
  }

  res.json({ ok: true });
});
```

### 5.2 Maliyet Alertleri

```typescript
// src/monitoring/costAlerter.ts
// Her gece 23:30 çalışır

export async function checkCosts(): Promise<void> {
  const today = formatDate(new Date());

  // Shodan credit
  const shodanCredit = await getShodanCreditUsage();
  if (shodanCredit > 90) {
    await sendTelegram(
      process.env.ADMIN_TELEGRAM_ID!,
      `⚠️ Shodan credit azalıyor: ${shodanCredit}/100`
    );
  }

  // Hunter.io limit
  const hunterUsage = await getHunterUsage();
  if (hunterUsage.remaining < 50) {
    await sendTelegram(
      process.env.ADMIN_TELEGRAM_ID!,
      `⚠️ Hunter.io ${hunterUsage.remaining} lookup kaldı`
    );
  }

  // Claude günlük maliyet
  const claudeCost = await getClaudeDailyCost(today);
  const threshold = parseFloat(
    process.env.CLAUDE_DAILY_COST_THRESHOLD || '5'
  );
  if (claudeCost > threshold) {
    await sendTelegram(
      process.env.ADMIN_TELEGRAM_ID!,
      `⚠️ Claude günlük maliyet: $${claudeCost.toFixed(2)} (limit: $${threshold})`
    );
  }

  // Cron job durumu — gece pipeline çalıştı mı?
  const pipelineRan = await db.select()
    .from(nightlyPipelineRuns)
    .where(eq(nightlyPipelineRuns.runDate, today))
    .limit(1);

  if (!pipelineRan[0] && new Date().getHours() >= 8) {
    await sendTelegram(
      process.env.ADMIN_TELEGRAM_ID!,
      `🚨 Gece pipeline ÇALIŞMADI: ${today}`
    );
  }
}

cron.schedule('30 23 * * *', checkCosts);
```

### 5.3 Status Sayfası

```
// cyberstep.io/status

Sistem Durumu — CyberStep.io
Son güncelleme: 2 dakika önce

🟢 Web Platformu           Çalışıyor
🟢 Tarama Motoru           Çalışıyor
🟢 Gece Pipeline           Son çalışma: Bu sabah 05:34
🟢 Email Bildirimleri      Çalışıyor
🟢 Ödeme Sistemi (Iyzico)  Çalışıyor

Son 30 günde uptime: %99.8

[RSS ile takip et] [Status güncellemelerine abone ol]

// Bu sayfa UptimeRobot/BetterStack webhook'undan
// otomatik güncellenir.
```

---

## BÖLÜM 6: REKABET VE PAZAR İZLEME

```typescript
// src/intelligence/marketWatcher.ts

// İzlenecek RSS kaynakları
const MARKET_FEEDS = [
  // Türkiye haberleri
  { url: 'https://bthaber.com/feed/',
    label: 'BThaber', type: 'tr_news' },
  { url: 'https://webrazzi.com/feed/',
    label: 'Webrazzi', type: 'tr_news' },
  { url: 'https://www.btk.gov.tr/haberler/rss',
    label: 'BTK', type: 'regulation' },

  // Rakip blog'ları (RSS varsa)
  { url: 'https://echocti.com/feed/',
    label: 'EchoCTI', type: 'competitor' },

  // Siber güvenlik
  { url: 'https://feeds.feedburner.com/TheHackersNews',
    label: 'HackerNews', type: 'security' },
  { url: 'https://www.bleepingcomputer.com/feed/',
    label: 'BleepingComputer', type: 'security' },
];

export async function runMarketWatcher(): Promise<void> {
  const seen = await getSeenArticles();
  const newItems: FeedItem[] = [];

  for (const feed of MARKET_FEEDS) {
    try {
      const items = await parseFeed(feed.url);
      for (const item of items) {
        if (seen.has(item.url)) continue;
        newItems.push({ ...item, source: feed.label, type: feed.type });
        await markAsSeen(item.url);
      }
    } catch { /* Feed başarısız — devam */ }
  }

  if (newItems.length === 0) return;

  // Türkiye + siber güvenlik + rakip ile ilgili olanları filtrele
  const relevant = newItems.filter(item =>
    isRelevant(item.title + ' ' + item.summary)
  );

  if (relevant.length === 0) return;

  // Claude Haiku ile haftalık özet
  // (Cuma günleri toplanıp haftalık özet yapılır)
  await db.insert(marketWatchItems).values(
    relevant.map(item => ({
      title: item.title,
      url: item.url,
      source: item.source,
      type: item.type,
      summary: item.summary,
      publishedAt: item.publishedAt,
    }))
  );
}

// Her Cuma 09:00 — haftalık pazar özeti
cron.schedule('0 9 * * 5', async () => {
  const weekItems = await getWeeklyMarketItems();
  if (weekItems.length === 0) return;

  // Claude ile özet
  const summary = await callClaude(`
Bu hafta Türkiye siber güvenlik piyasasında:

${weekItems.map(i => `- ${i.source}: ${i.title}`).join('\n')}

Önemli gelişmeleri 5 maddede özetle.
CyberStep'i etkileyen varsa belirt.
Rakip EchoCTI ile ilgili varsa özellikle vurgula.
  `, {
    model: 'claude-haiku-4-5',
    maxTokens: 300,
  });

  await sendEmail({
    to: process.env.ISR_TEAM_EMAIL!,
    subject: `📰 Haftalık Pazar Özeti — ${formatDate(new Date())}`,
    html: buildMarketSummaryEmail(summary, weekItems),
    from: 'intel@cyberstep.io',
  });
});

// Anlık: Rakip içerik yayınlayınca bildir
async function isRelevant(text: string): Promise<boolean> {
  const keywords = [
    'türkiye', 'kvkk', '7545', 'btk', 'usom',
    'echocti', 'siber güvenlik', 'fortinet',
    'fidye yazılımı', 'veri ihlali',
  ];
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

// Her 4 saatte bir feed kontrol
cron.schedule('0 */4 * * *', runMarketWatcher);
```

---

## BÖLÜM 7: KVKK OTOMASYON

```sql
-- Veri saklama politikası
CREATE TABLE IF NOT EXISTS data_retention_policy (
  table_name varchar(100) PRIMARY KEY,
  retention_days integer NOT NULL,
  action varchar(20) DEFAULT 'delete',
  -- 'delete' | 'archive' | 'anonymize'
  last_cleaned_at timestamp
);

INSERT INTO data_retention_policy VALUES
  ('lead_candidates',    720, 'delete', NULL),
  ('domain_scan_findings', 365, 'archive', NULL),
  ('ioc_action_log',     365, 'archive', NULL),
  ('certstream_queue',    30, 'delete', NULL),
  ('daily_isr_tasks',    180, 'delete', NULL),
  ('social_media_posts', 365, 'archive', NULL);
```

```typescript
// Her ayın 1'i 03:00 — veri temizleme
cron.schedule('0 3 1 * *', async () => {
  const policies = await db.select().from(dataRetentionPolicy);

  for (const policy of policies) {
    const cutoff = subDays(new Date(), policy.retentionDays);

    if (policy.action === 'delete') {
      await db.execute(
        sql`DELETE FROM ${sql.identifier(policy.tableName)}
            WHERE created_at < ${cutoff}`
      );
    }

    await db.update(dataRetentionPolicy).set({
      lastCleanedAt: new Date(),
    }).where(eq(dataRetentionPolicy.tableName, policy.tableName));
  }

  logger.info('Veri saklama politikası uygulandı');
});

// Müşteri silme talebi (KVKK Madde 7)
// POST /api/portal/account/delete-request
export async function handleDeletionRequest(
  customerId: number
): Promise<void> {

  // Aktif abonelik varsa önce iptal et
  await cancelSubscription(customerId, 'KVKK silme talebi');

  // 30 gün sonra sil (yasal süre)
  await db.update(customers).set({
    deletionRequestedAt: new Date(),
    scheduledDeletionAt: addDays(new Date(), 30),
  }).where(eq(customers.id, customerId));

  // Onay emaili
  await sendEmail({
    to: customer.email,
    subject: 'Hesap silme talebiniz alındı',
    html: `30 gün içinde tüm verileriniz silinecektir.
           Vazgeçmek için: ${BASE_URL}/portal/cancel-deletion`,
    from: 'privacy@cyberstep.io',
  });
}
```

---

## BÖLÜM 8: ENVIRONMENT VARIABLES

```bash
# Finansal
PARASUT_API_KEY=         # e-fatura (parasut.com)
PARASUT_COMPANY_ID=

# Analitik
POSTHOG_API_KEY=         # posthog.com (ücretsiz self-host veya cloud)

# Monitoring
UPTIME_ROBOT_WEBHOOK=    # uptimerobot.com webhook URL
BETTERSTACK_WEBHOOK=     # betterstack.com (alternatif)
CLAUDE_DAILY_COST_THRESHOLD=5  # $5 geçince uyar

# Market watcher
MARKET_WATCHER_ENABLED=true

# KVKK
DATA_RETENTION_ENABLED=true
```

---

## TEST SENARYOSU

```
1. Onboarding:
   Test ödemesi yap → welcome email geldi mi?
   Portal'a gir → onboarding adımı işaretlendi mi?
   Gün 1 emaili zamanlandı mı?

2. Dunning:
   Test aboneliği oluştur → payment_failed yap
   3 gün bekle (veya tarihi geriye al)
   → Gün 3 emaili gönderildi mi?

3. E-fatura:
   Parasut sandbox'ında test et
   Ödeme kaydı oluştur → createEInvoice() çağır
   → Fatura oluştu mu?
   → Email gitti mi?

4. Upsell:
   Müşteri için 25 alarm kaydı oluştur
   runUpsellEngine() çalıştır
   → 'soc_lite_to_standard' emaili gönderildi mi?

5. Monitoring:
   POSTHOG_API_KEY ile portal_login eventi gönder
   PostHog dashboard'unda görünüyor mu?

6. Market watcher:
   runMarketWatcher() manuel çalıştır
   → market_watch_items tablosuna kayıt düştü mü?
   Cuma gelince → haftalık özet emaili gitti mi?
```

---

*CyberStep.io — %90 AI Yönetimli Şirket Sistemleri — 2026*
*Self-Serve + Finansal Otomasyon + Analitik + Upsell + Monitoring*
