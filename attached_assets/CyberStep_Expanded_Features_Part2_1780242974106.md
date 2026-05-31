# CyberStep.io — Kalan Özellikler Tamamlama
## Ürün Turu + AI Satış Brifing + WhatsApp Bot + Tahminsel Upsell

Bu dosya CyberStep_Expanded_Features_Replit_Prompt.md'nin
tamamlayıcısıdır. Aynı Replit oturumunda Sprint 2'ye ekle.

---

## 2.8 ÜRÜN TURU OTOMASYlONU (Product Tour)

İlk girişte kullanıcıyı 5 adımda platforma bağla.
Değeri ilk 5 dakikada göster — activation rate 2-3x artar.

```sql
CREATE TABLE IF NOT EXISTS onboarding_tours (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id) UNIQUE,
  current_step integer DEFAULT 0,
  -- 0 = henüz başlamadı
  completed_steps integer[] DEFAULT '{}',
  started_at timestamp,
  completed_at timestamp,
  skipped_at timestamp
);
```

### Tur Adımları

```typescript
const TOUR_STEPS = [
  {
    step: 1,
    target: '#domain-input',
    // CSS selector — vurgulanacak element
    title: '🔍 İlk Taramanızı Başlatın',
    content: 'Domain adresinizi girin ve "Tara" butonuna basın. '
      + 'Sonuçlar 30 saniyede hazır.',
    position: 'bottom',
    action: 'domain_scan_started',
    // Bu aksiyon gerçekleşince adım tamamlandı say
  },
  {
    step: 2,
    target: '#scan-results-panel',
    title: '📊 Güvenlik Skorunuz',
    content: 'Bu sayı şirketinizin dışarıdan nasıl göründüğünü '
      + 'özetler. Kırmızı bulgular öncelikli kapatılması gerekenler.',
    position: 'left',
    action: 'results_viewed',
  },
  {
    step: 3,
    target: '#critical-findings-list',
    title: '🚨 Kritik Bulgular',
    content: 'Bu bulgulardan herhangi birini tıklayın — '
      + 'nasıl kapatılacağını adım adım göreceğiz.',
    position: 'right',
    action: 'finding_clicked',
  },
  {
    step: 4,
    target: '#notification-settings',
    title: '🔔 Haftalık Takip',
    content: 'E-posta bildirimlerini açın. Her yeni tehdit '
      + 'bulunduğunda anında haberdar olun.',
    position: 'bottom',
    action: 'notifications_enabled',
  },
  {
    step: 5,
    target: '#full-assessment-cta',
    title: '🎯 Tam Tablo için Tam Değerlendirme',
    content: 'Domain taraması dışarıyı gösterir. '
      + 'Tam Değerlendirme içeriyi de kapsar — '
      + 'KVKK, cihazlar, e-posta güvenliği ve daha fazlası.',
    position: 'top',
    action: 'cta_viewed',
    isFinal: true,
  },
];
```

### Frontend Tur Bileşeni

```typescript
// src/components/ProductTour.tsx
// Spotlight overlay + tooltip sistemi

// Kütüphane: intro.js veya sıfırdan yazılabilir (daha iyi kontrol)
// pnpm add intro.js @types/intro.js

import introJs from 'intro.js';
import 'intro.js/introjs.css';

export function startProductTour(customerId: number) {
  // Daha önce tur tamamlandı mı?
  const tourCompleted = localStorage.getItem(`tour_${customerId}`);
  if (tourCompleted) return;

  const intro = introJs();

  intro.setOptions({
    steps: TOUR_STEPS.map(step => ({
      element: document.querySelector(step.target),
      title: step.title,
      intro: step.content,
      position: step.position,
    })),
    nextLabel: 'İleri →',
    prevLabel: '← Geri',
    doneLabel: 'Başla! 🚀',
    skipLabel: 'Turu Geç',
    showStepNumbers: true,
    showBullets: false,
    overlayOpacity: 0.6,
    tooltipClass: 'cyberstep-tour-tooltip',
  });

  intro.onafterchange(async (element) => {
    const stepIndex = intro.currentStep();
    const step = TOUR_STEPS[stepIndex];

    // Adım ilerlemesini backend'e kaydet
    await api.post('/api/portal/tour/progress', {
      step: step.step,
    });
  });

  intro.oncomplete(() => {
    localStorage.setItem(`tour_${customerId}`, 'completed');
    // Konfeti animasyonu 🎉
    showConfetti();
    // Rozet: "İlk Adım" kazandı
    checkAndAwardBadge(customerId, 'first_scan');
  });

  intro.onexit(() => {
    api.post('/api/portal/tour/skip');
  });

  intro.start();
}
```

### CSS Override (CyberStep tema uyumu)

```css
/* src/styles/tour.css */
.cyberstep-tour-tooltip {
  background: #060D1A;
  color: #E8EDF5;
  border: 1px solid #0F2040;
  border-radius: 12px;
  padding: 20px 24px;
  font-family: 'Inter', sans-serif;
  max-width: 320px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5),
              0 0 30px rgba(0,200,255,0.1);
}

.cyberstep-tour-tooltip .introjs-tooltip-title {
  color: #00C8FF;
  font-weight: 700;
  font-size: 15px;
  margin-bottom: 8px;
}

.cyberstep-tour-tooltip .introjs-button {
  background: #00C8FF;
  color: #060D1A;
  font-weight: 700;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
}

.introjs-overlay {
  background: rgba(6,13,26,0.75);
}

.introjs-helperLayer {
  border: 2px solid #00C8FF;
  border-radius: 8px;
  box-shadow: 0 0 20px rgba(0,200,255,0.3);
}
```

### API

```
POST /api/portal/tour/progress    — Adım ilerlemesi kaydet
POST /api/portal/tour/skip        — Tur atlandı
POST /api/portal/tour/restart     — Turu yeniden başlat
GET  /api/portal/tour/status      — Tur durumu
```

---

## 2.9 AI SATIŞ HAZIRLIK BRİFİNG'İ

Satış temsilcisi demo veya görüşme öncesi tek butona basıyor,
Claude 60 saniyede kişiselleştirilmiş hazırlık notu üretiyor.

```sql
CREATE TABLE IF NOT EXISTS sales_briefings (
  id serial PRIMARY KEY,
  deal_id integer REFERENCES isr_deals(id),
  customer_id integer REFERENCES isr_customers(id),
  prepared_for varchar(100),
  -- Satış temsilcisi adı
  meeting_type varchar(30),
  -- 'demo' | 'follow_up' | 'proposal' | 'negotiation' | 'renewal'
  briefing_content jsonb,
  -- Claude çıktısı
  created_at timestamp DEFAULT now(),
  used_at timestamp
  -- Brifing açıldı mı
);
```

### Brifing Üretici

```typescript
export async function generateSalesBriefing(
  dealId: number,
  meetingType: string,
  preparedFor: string
): Promise<SalesBriefing> {

  const deal = await getDealWithCustomer(dealId);
  const customer = deal.customer;
  const scanResult = await getLatestScan(customer.domain);
  const activities = await getRecentActivities(dealId, 5);
  const teaserReport = await getTeaserReport(customer.domain);
  const sectorBenchmark = await getSectorBenchmark(customer.sector);
  const news = await getRecentSectorNews(customer.sector, 3);

  const prompt = `
Sen CyberStep'in deneyimli satış koçusun.
Satış temsilcisine ${meetingType} görüşmesi öncesi
kısa, pratik hazırlık brifing'i hazırla.

MÜŞTERİ PROFİLİ:
Şirket: ${customer.companyName}
Domain: ${customer.domain}
Sektör: ${customer.sector}
Büyüklük: ${customer.employeeCount}

GÜVENLİK DURUMU:
Skor: ${scanResult?.overallScore}/100 (${scanResult?.riskLevel})
Kritik bulgu: ${scanResult?.criticalCount}
Sektör ortalaması: ${sectorBenchmark?.avgScore} 
(Müşteri ${sectorBenchmark?.percentile}. yüzdelikte)

DEAL GEÇMİŞİ:
Aşama: ${deal.pipelineStage}
Son aktiviteler:
${activities.map(a => `- ${a.performedAt}: ${a.description}`).join('\n')}

GÜNCEL SEKTÖR HABERLERİ:
${news.map(n => `- ${n.title}`).join('\n')}

GÖRÜŞME TÜRÜ: ${meetingType}

Şu formatta hazırla:

{
  "opening_hook": "Görüşmeyi açacak 1-2 cümle kanca. Müşteriye özgü, merak uyandıran.",
  
  "key_facts": [
    "Bu görüşmede bilmen gereken 3 kritik bilgi"
  ],
  
  "pain_points": [
    "Bu şirketin muhtemel 3 acı noktası (tarama verisi + sektör + büyüklük bazında)"
  ],
  
  "value_propositions": [
    "Bu müşteriye özel 3 değer önermesi — genel değil, acı noktasına özel"
  ],
  
  "likely_objections": [
    {
      "objection": "Muhtemel itiraz",
      "counter": "En güçlü karşı argüman (bu müşteriye özel)"
    }
  ],
  
  "sector_news_hook": "Güncel haber nasıl kullanılır — 1 cümle bağlantı",
  
  "competitor_angle": "Eğer rakip varsa nasıl farklılaşırsın",
  
  "closing_question": "Görüşmeyi kapatacak en güçlü soru",
  
  "red_flags": "Bu müşteriden gelecek tehlike sinyalleri — nelere dikkat et",
  
  "next_step_suggestion": "Bu görüşmeden çıkılacak ideal sonraki adım"
}

Sadece JSON döndür. Her madde bu müşteriye özel olsun,
genel satış cümlesi değil.
`;

  const briefing = await callClaude(prompt);
  const parsed = JSON.parse(briefing);

  const record = await db.insert(salesBriefings).values({
    dealId, customerId: customer.id,
    preparedFor, meetingType,
    briefingContent: parsed,
  }).returning();

  return record[0];
}
```

### Admin UI

```
ISR deal sayfasında, aktiviteler sekmesinin üstünde:

┌────────────────────────────────────────────────────────┐
│ 🤖 AI Satış Hazırlık Brifing'i                        │
│                                                         │
│ Görüşme türü: [Demo ▾]                                 │
│ [60 Saniyede Hazırla →]                               │
└────────────────────────────────────────────────────────┘

Brifing hazırlandıktan sonra:

┌────────────────────────────────────────────────────────┐
│ 🎯 AÇILIŞ KANCASI                                     │
│ "[opening_hook]"                                       │
├────────────────────────────────────────────────────────┤
│ ⚡ KRİTİK BİLGİLER        🎯 ACI NOKTALARI           │
│ • [fact 1]                 • [pain 1]                 │
│ • [fact 2]                 • [pain 2]                 │
│ • [fact 3]                 • [pain 3]                 │
├────────────────────────────────────────────────────────┤
│ 💬 MUHTEMEL İTİRAZLAR                                 │
│ "Fiyat yüksek" →                                      │
│ [counter argüman]                                      │
├────────────────────────────────────────────────────────┤
│ 🚩 DİKKAT SİNYALLERİ     🎬 KAPANIŞ SORUSU          │
│ [red_flags]                [closing_question]          │
└────────────────────────────────────────────────────────┘

[Yazdır] [PDF'e Aktar] [Paylaş]
```

### API

```
POST /api/isr/deals/:id/briefing     — Yeni brifing üret
GET  /api/isr/deals/:id/briefing     — Son brifing'i getir
GET  /api/isr/deals/:id/briefings    — Tüm brifing geçmişi
```

---

## 2.10 WHATSAPP LEAD BESLEME BOTU

Ücretsiz araç kullanan veya bülten abonesi olan ama
henüz ödeme yapmamış leadlere WhatsApp dizisi.
Mevcut WhatsApp Business API entegrasyonunu kullan.

```sql
CREATE TABLE IF NOT EXISTS whatsapp_sequences (
  id serial PRIMARY KEY,
  name varchar(255) NOT NULL,
  trigger_type varchar(50),
  -- 'free_tool_used' | 'newsletter_signup' | 'mini_assessment' |
  -- 'competitor_check' | 'benchmark_download'
  steps jsonb NOT NULL,
  -- [{day: 1, message: '...'}, {day: 4, message: '...'}, ...]
  is_active boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS whatsapp_enrollments (
  id serial PRIMARY KEY,
  phone varchar(20) NOT NULL,
  email varchar(255),
  company_name varchar(255),
  domain varchar(255),
  sequence_id integer REFERENCES whatsapp_sequences(id),
  current_step integer DEFAULT 0,
  enrolled_at timestamp DEFAULT now(),
  next_message_at timestamp,
  completed_at timestamp,
  unsubscribed_at timestamp,
  converted_at timestamp,
  -- Ödeme yaptı mı?
  lead_score integer DEFAULT 0
);
```

### Hazır Dizi Şablonları

```typescript
const WA_SEQUENCES = [
  {
    name: 'Ücretsiz Araç Kullanıcısı Besleme',
    trigger: 'free_tool_used',
    steps: [
      {
        day: 0, // Hemen
        message: `Merhaba! 👋

[domain] için güvenlik taramanız hazır.

🔴 Kritik bulgu: [critical_count]
🟡 Orta seviye: [high_count]

Tam rapor için: [preview_url]

CyberStep — cyberstep.io`
      },
      {
        day: 3,
        message: `[domain] için hızlı güvenlik ipucu 💡

Bu hafta Türkiye'de [sector] sektöründe
[N] siber saldırı haberi takip ettik.

En yaygın giriş noktası: [top_attack_vector]

Sitenizde bu güvenlik açığı var mı?
Ücretsiz kontrol: cyberstep.io/domain-tarama`
      },
      {
        day: 7,
        message: `[domain] skoru: [score]/100 📊

Sektörünüzdeki şirketlerin %[percentile]'i
sizin üstünüzde.

Farkı kapatmak ne kadar sürer?
Genellikle 2-3 hafta.

15 dakikalık ücretsiz danışmanlık:
[calendly_link]`
      },
      {
        day: 14,
        message: `Son mesajım 🤝

[domain] için tespit ettiğimiz açıklar
hâlâ kapatılmayı bekliyor.

Tam Değerlendirme: 5.990 TL
(Bu hafta %10 indirimli: 5.391 TL)

[Şimdi Başla →]: cyberstep.io/tam-degerlendirme

Devam etmek istemiyorsanız DUR yazabilirsiniz.`
      },
    ]
  },
];
```

### WhatsApp Gönderici Cron

```typescript
// Her saat — zamanı gelmiş mesajları gönder
cron.schedule('0 * * * *', async () => {

  const dueMessages = await db
    .select()
    .from(whatsappEnrollments)
    .where(
      and(
        isNull(whatsappEnrollments.completedAt),
        isNull(whatsappEnrollments.unsubscribedAt),
        lte(whatsappEnrollments.nextMessageAt, new Date())
      )
    );

  for (const enrollment of dueMessages) {
    const sequence = await getSequence(enrollment.sequenceId);
    const step = sequence.steps[enrollment.currentStep];
    if (!step) {
      // Dizi bitti
      await db.update(whatsappEnrollments)
        .set({ completedAt: new Date() })
        .where(eq(whatsappEnrollments.id, enrollment.id));
      continue;
    }

    // Değişkenleri doldur
    const message = await personalizeMessage(
      step.message, enrollment
    );

    // WhatsApp Business API ile gönder
    await sendWhatsAppMessage(enrollment.phone, message);

    // Sonraki adımı planla
    const nextStep = sequence.steps[enrollment.currentStep + 1];
    const nextAt = nextStep
      ? addDays(new Date(), nextStep.day - step.day)
      : null;

    await db.update(whatsappEnrollments).set({
      currentStep: enrollment.currentStep + 1,
      nextMessageAt: nextAt,
      completedAt: nextAt ? null : new Date(),
    }).where(eq(whatsappEnrollments.id, enrollment.id));
  }
});

// "DUR" / "STOP" mesajı gelince abonelikten çıkar
export async function handleWhatsAppIncoming(
  phone: string,
  message: string
): Promise<void> {
  const stopWords = ['dur', 'stop', 'iptal', 'çık', 'hayır'];
  if (stopWords.some(w => message.toLowerCase().includes(w))) {
    await db.update(whatsappEnrollments)
      .set({ unsubscribedAt: new Date() })
      .where(eq(whatsappEnrollments.phone, phone));

    await sendWhatsAppMessage(phone,
      'Aboneliğiniz iptal edildi. İyi günler! 👋'
    );
  }
}
```

---

## 2.11 TAHMİNSEL UPSELL MOTORU

```sql
CREATE TABLE IF NOT EXISTS upsell_predictions (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  calculated_at timestamp DEFAULT now(),

  -- Tahmin edilen en uygun upsell
  predicted_service varchar(100),
  -- 'ai-arac-izleme' | 'sanal-ciso' | 'tam-degerlendirme' | 'kurumsal'

  probability_pct integer,
  -- 0-100: Satın alma olasılığı

  -- Tahmin sinyalleri
  signals jsonb,
  -- {login_count_30d: 15, report_views: 8, ai_page_visits: 3, ...}

  confidence varchar(20),
  -- 'high' | 'medium' | 'low'

  recommended_action varchar(100),
  -- 'send_email' | 'call' | 'in_app_banner' | 'wait'

  actioned_at timestamp,
  converted_at timestamp
);
```

### Tahmin Motoru

```typescript
export async function calculateUpsellPrediction(
  customerId: number
): Promise<UpsellPrediction> {

  const customer = await getCustomer(customerId);
  const activity = await getActivitySummary(customerId, 30);
  const health = await getHealthScore(customerId);
  const pageViews = await getPageViews(customerId, 30);

  // Sinyal ağırlıkları
  const signals = {
    loginCount30d:         activity.loginCount,
    reportViews:           activity.reportViews,
    aiPageVisits:          pageViews.aiGuvenlik || 0,
    findingsClosedCount:   activity.findingsClosedCount,
    healthScore:           health.healthScore,
    planAge:               getDaysSince(customer.createdAt),
    sectorRisk:            await getSectorRiskScore(customer.sector),
  };

  // Kural tabanlı tahmin (ML öncesi basit yaklaşım)
  let predictedService = null;
  let probability = 0;

  if (customer.plan === 'baslangic') {
    // AI sayfasını 3+ kez ziyaret ettiyse AI servisi öner
    if (signals.aiPageVisits >= 3) {
      predictedService = 'ai-guvenlik';
      probability = 65 + (signals.aiPageVisits * 5);
    }
    // Sağlık skoru yüksekse Büyüme planı öner
    else if (signals.healthScore > 70 && signals.loginCount30d > 10) {
      predictedService = 'buyume-plan';
      probability = 55 + (signals.healthScore * 0.3);
    }
  }

  if (customer.plan === 'buyume') {
    // 6+ ay + yüksek kullanım = Kurumsal
    if (signals.planAge > 180 && signals.loginCount30d > 15) {
      predictedService = 'kurumsal-plan';
      probability = 45 + (signals.loginCount30d * 2);
    }
    // AI sayfası ziyareti = AI araç izleme
    else if (signals.aiPageVisits >= 2) {
      predictedService = 'ai-arac-izleme';
      probability = 60;
    }
  }

  if (!predictedService) return null;

  probability = Math.min(95, probability);
  const confidence = probability > 75 ? 'high'
                   : probability > 55 ? 'medium' : 'low';

  // Aksiyon kararı
  const recommendedAction =
    probability > 75 ? 'send_email'  :
    probability > 60 ? 'in_app_banner' :
    probability > 45 ? 'wait' : 'wait';

  const record = await db.insert(upsellPredictions).values({
    customerId, predictedService, probability,
    signals, confidence, recommendedAction,
  }).returning();

  // Yüksek olasılıklıysa otomatik aksiyon başlat
  if (recommendedAction === 'send_email') {
    await sendUpsellEmail(customerId, predictedService, probability);
  } else if (recommendedAction === 'in_app_banner') {
    // Müşteri sonraki girişte banner görür
    await setInAppBanner(customerId, predictedService);
  }

  return record[0];
}
```

### In-App Upsell Banner

```tsx
// Müşteri dashboard'unda — sadece tahmin varsa göster
{upsellPrediction && upsellPrediction.recommendedAction === 'in_app_banner' && (
  <div className="upsell-banner">
    <div className="upsell-icon">✨</div>
    <div className="upsell-content">
      <h4>{UPSELL_MESSAGES[upsellPrediction.predictedService].title}</h4>
      <p>{UPSELL_MESSAGES[upsellPrediction.predictedService].description}</p>
    </div>
    <div className="upsell-actions">
      <button onClick={() => handleUpsellCTA(upsellPrediction)}>
        {UPSELL_MESSAGES[upsellPrediction.predictedService].cta}
      </button>
      <button onClick={dismissBanner} className="dismiss">
        Şimdi değil
      </button>
    </div>
  </div>
)}

const UPSELL_MESSAGES = {
  'ai-arac-izleme': {
    title: 'AI araçlarınızı takip altına alın',
    description: 'Kullandığınız AI araçlarının gizlilik politikası '
      + 'değişince anında haberdar olun.',
    cta: 'Aylık 490 TL ile Başla →',
  },
  'buyume-plan': {
    title: 'Başlangıç planının sınırlarına ulaştınız',
    description: 'Büyüme planıyla KVKK skoru, sektör kıyaslama '
      + 've WhatsApp bildirimi ekleyin.',
    cta: 'Büyüme Planına Geç →',
  },
  'kurumsal-plan': {
    title: 'Kurumsal ölçeğe hazır mısınız?',
    description: 'Sınırsız değerlendirme, aylık danışman görüşmesi '
      + 've TPRM modülü.',
    cta: 'Kurumsal Planı İncele →',
  },
};
```

### Cron

```typescript
// Her gece — tüm aktif müşteriler için tahmin hesapla
cron.schedule('0 1 * * *', async () => {
  const customers = await getActiveCustomers();
  for (const customer of customers) {
    await calculateUpsellPrediction(customer.id);
    await sleep(100); // Rate limit
  }
});
```

---

## TÜM YENİ ÖZELLİKLER — KONSOLIDE ÖZET

```
SPRINT 1 (Bu dosya + önceki):
  ✓ Status page
  ✓ Kariyer sayfası
  ✓ Onboarding tamamlama skoru
  ✓ Başarı rozeti sistemi
  ✓ SEO araç sayfaları

SPRINT 2 (Bu dosya + önceki):
  ✓ Slack / Teams entegrasyonu
  ✓ Güvenlik politika üretici (6 şablon)
  ✓ Vendor güvenlik puanlama
  ✓ Fon başvurusu hazırlık paketi
  ✓ Eğitim sertifikası sistemi
  ✓ AI destekli yardım merkezi
  ✓ Yıllık güvenlik raporu
  ✓ Ürün turu otomasyonu          ← Bu dosya
  ✓ AI satış hazırlık brifing'i   ← Bu dosya
  ✓ WhatsApp lead besleme botu    ← Bu dosya
  ✓ Tahminsel upsell motoru       ← Bu dosya

SPRINT 3:
  ✓ SSO (Google + Microsoft)
  ✓ Veri dışa aktarım API'si
  ✓ Anomali tespiti
  ✓ Multi-tenant white-label

SPRINT 4:
  ✓ Affiliate programı
  ✓ Sertifika pazar yeri
  ✓ Coğrafi genişleme (Azerbaycan)

SPRINT 5 (Ayrı proje):
  ✓ React Native mobil uygulama
```

---

## ADMİN MENÜ TAMAMLAMA

```
─── Pazarlama & Büyüme ──────────────
  🤖  Growth Engine      /admin-panel/growth-engine
  📱  WhatsApp Dizileri  /admin-panel/whatsapp
  🎓  Affiliate Panel    /admin-panel/affiliates
  📊  Upsell Tahminleri  /admin-panel/upsell-predictions

─── Ürün & İçerik ───────────────────
  🎯  Ürün Turu          /admin-panel/product-tour
  🏆  Rozetler           /admin-panel/badges
  📚  Yardım Merkezi     /admin-panel/help-center
  🎓  Eğitim Modülleri   /admin-panel/training

─── Satış Araçları ──────────────────
  💼  Satış Brifing'leri /admin-panel/sales-briefings
  (ISR menüsü altında da görünür)
```

---

*CyberStep.io — Kalan Özellikler Tamamlama — Mayıs 2026*
