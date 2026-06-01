# CyberStep.io — Platform Operasyon Master Planı
## Onboarding + Ödeme + Monitoring + Servis Kataloğu
## Replit Agent Promptu

---

## TALİMAT

Bu prompt dört kritik operasyonel sistemi kurar:
1. Müşteri onboarding akışı (self-servis + admin)
2. Ödeme ve servis aktivasyon sistemi
3. Platform monitoring altyapısı
4. Tam servis kataloğu

Sırayla uygula. Her bölümü tamamlayınca rapor et.

---

# BÖLÜM A: SERVİS KATALOĞU

## A1 — Veritabanı: Servis Tanımları

```sql
CREATE TABLE IF NOT EXISTS service_catalog (
  id serial PRIMARY KEY,
  slug varchar(100) UNIQUE NOT NULL,
  name varchar(255) NOT NULL,
  short_description varchar(255),
  full_description text,
  category varchar(50) NOT NULL,
  -- 'assessment' | 'ai_service' | 'monitoring' |
  -- 'soc' | 'consulting' | 'bundle'
  service_type varchar(20) NOT NULL,
  -- 'one_time' | 'monthly' | 'annual' | 'usage'
  price_tl decimal(12,2),
  price_tl_annual decimal(12,2),  -- Yıllık indirimli fiyat
  usage_unit varchar(50),         -- 'tarama', 'kullanıcı', 'domain'
  setup_time_hours integer,       -- Aktivasyona kadar süre
  delivery_time_hours integer,    -- Çıktı teslim süresi
  sla_response_minutes integer,   -- Destek yanıt SLA
  features jsonb,                 -- Özellik listesi
  requirements jsonb,             -- Gereksinimler
  target_audience text[],         -- Hedef müşteri profili
  is_active boolean DEFAULT true,
  is_self_service boolean DEFAULT true,
  requires_admin_approval boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamp DEFAULT now()
);

-- Servis kataloğunu doldur
INSERT INTO service_catalog
  (slug, name, short_description, category, service_type,
   price_tl, setup_time_hours, delivery_time_hours,
   sla_response_minutes, features, target_audience,
   is_self_service, sort_order)
VALUES

-- ─── ÜCRETSİZ ────────────────────────────────────────────
('mini-assessment',
 'Mini Güvenlik Değerlendirmesi',
 '20 soruda şirketinizin siber güvenlik risk seviyesini ölçün',
 'assessment', 'one_time', 0,
 0, 0, NULL,
 '["20 soru", "10 alan analizi", "Risk skoru", "AI raporu", "PDF indirme"]',
 '["Tüm şirket büyüklükleri"]',
 true, 10),

('domain-scan-free',
 'Ücretsiz Domain Güvenlik Taraması',
 'Domain güvenlik açıklarını 30 saniyede tespit edin',
 'assessment', 'one_time', 0,
 0, 0, NULL,
 '["SSL kontrolü", "SPF/DKIM/DMARC", "Kara liste", "Dark web sızıntı", "Skor"]',
 '["Tüm şirket büyüklükleri"]',
 true, 5),

-- ─── DEĞERLENDİRMELER ─────────────────────────────────────
('full-assessment',
 'Tam Güvenlik Değerlendirmesi',
 '60 soruda kapsamlı güvenlik analizi, uzman doğrulamalı',
 'assessment', 'one_time', 5990,
 1, 24,
 480,
 '["60 soru / 10 alan", "KVKK uyum skoru", "Sektör kıyaslama",
   "TL risk tahmini", "PDF rapor", "Uzman doğrulama rozeti",
   "Yönetim kurulu raporu", "12 aylık öneri listesi"]',
 '["5-500 çalışan", "Tüm sektörler"]',
 true, 20),

('premium-assessment',
 'Premium Danışmanlık Değerlendirmesi',
 'Uzman ekiple 4 saatlik derinlemesine analiz',
 'assessment', 'one_time', 17990,
 4, 72,
 60,
 '["Tam Değerlendirme dahil", "4 saat uzman görüşmesi",
   "Özelleştirilmiş yol haritası", "Öncelikli destek 3 ay",
   "Üst yönetim sunumu"]',
 '["50+ çalışan", "Finans, sağlık, kamu"]',
 false, 25),

-- ─── AI SERVİSLERİ ────────────────────────────────────────
('ai-security-assessment',
 'AI Güvenlik Değerlendirmesi',
 'Kullandığınız AI araçlarının KVKK ve güvenlik risklerini ölçün',
 'ai_service', 'one_time', 2900,
 1, 24, 480,
 '["AI araç risk skoru", "KVKK uyum analizi", "Politika önerileri",
   "Sektöre özel riskler", "PDF rapor"]',
 '["AI araç kullanan şirketler", "Teknoloji, finans, sağlık"]',
 true, 30),

('phishing-simulation',
 'AI Phishing Simülasyonu',
 'Şirketinize yönelik gerçekçi phishing senaryoları üretin',
 'ai_service', 'one_time', 1990,
 1, 24, 480,
 '["3 spear-phishing senaryosu", "OSINT analizi",
   "Neden inandırıcı analizi", "Korunma önerileri"]',
 '["Tüm şirketler", "İK, finans, yönetim ekibi yüksek risk"]',
 true, 35),

('eu-ai-act',
 'EU AI Act Uyum Skoru',
 'AB yapay zeka yasasına uyumunuzu ölçün',
 'ai_service', 'one_time', 1990,
 1, 24, 480,
 '["Risk kategorisi belirleme", "Etkilenen maddeler",
   "2026/2027 uyum takvimi", "Ceza maruziyeti (TL)", "Aksiyon planı"]',
 '["AB\'ye ürün/hizmet satan şirketler"]',
 true, 40),

('ai-red-team',
 'AI Red Team Raporu',
 'Saldırgan perspektifinden şirketinizi değerlendirin',
 'ai_service', 'one_time', 2490,
 1, 48, 480,
 '["OSINT analizi", "30 dakikalık saldırı senaryosu",
   "En değerli 3 istihbarat bulgusu", "Quick wins listesi"]',
 '["Orta-büyük şirketler", "Yönetici ekibi kamuya açık"]',
 true, 45),

('deepfake-analysis',
 'Deepfake ve Ses Klonu Analizi',
 'Yöneticilerinizin deepfake ve ses klonu riskini ölçün',
 'ai_service', 'one_time', 1490,
 1, 24, 480,
 '["Kamuya açık ses/video kaynakları tespiti",
   "Ses klonu yeterlilik analizi", "CEO fraud risk skoru",
   "Doğrulama protokolü önerileri"]',
 '["CEO, CFO, yöneticiler kamuya açık içerik üretenler"]',
 true, 50),

('fake-document-scan',
 'Sahte Doküman Tespiti',
 'Fatura, sözleşme ve kimlik belgelerinde manipülasyon tespiti',
 'ai_service', 'usage', 49,
 0, 1, 60,
 '["AI manipülasyon tespiti", "Metadata analizi",
   "Doğruluk skoru", "Anomali raporu"]',
 '["Muhasebe", "Finans", "Hukuk", "İK"]',
 true, 55),

-- ─── ABONELİKLER ──────────────────────────────────────────
('ai-tool-monitoring',
 'AI Araç İzleme Servisi',
 'Kullandığınız AI araçlarının politika değişikliklerini izleyin',
 'monitoring', 'monthly', 490,
 1, 0, 480,
 '["7/24 politika değişiklik izleme", "Anlık e-posta bildirimi",
   "KVKK uyum skoru güncelleme", "Aylık özet rapor"]',
 '["AI araç kullanan tüm şirketler"]',
 true, 60),

('leak-monitor',
 'Sızıntı İzleyici',
 'Dark web ve sızıntı veritabanlarını 7/24 izleyin',
 'monitoring', 'annual', 2900,
 1, 0, 240,
 '["Dark web forum izleme", "Paste site izleme",
   "Yeni sızıntı anlık bildirimi", "Çalışan e-posta kontrolü",
   "Aylık sızıntı raporu"]',
 '["Tüm şirketler"]',
 true, 65),

('ai-policy-autoupdate',
 'AI Politika Otogüncelleme',
 'Yapay zeka kullanım politikanızı otomatik güncel tutun',
 'monitoring', 'annual', 990,
 1, 0, 480,
 '["Yasal değişiklik takibi", "Otomatik politika güncelleme",
   "PDF politika belgesi", "KVKK uyum senkronizasyonu"]',
 '["AI araç kullanan şirketler"]',
 true, 70),

-- ─── SOC SERVİSLERİ ───────────────────────────────────────
('soc-lite',
 'AI SOC Lite',
 '7/24 otomatik tehdit izleme, temel bildirimler',
 'soc', 'monthly', 4900,
 4, 0, 60,
 '["7/24 otomatik izleme", "Kritik tehdit bildirimi",
   "Otomatik IP blok (FortiGate)", "Aylık SOC raporu",
   "Seviye 0-2 otomatik eskalasyon", "SOC dashboard erişimi"]',
 '["5-50 çalışan", "Temel FortiGate koruma"]',
 true, 80),

('soc-standart',
 'AI SOC Standart',
 'İş saatlerinde analist destekli 7/24 izleme',
 'soc', 'monthly', 8500,
 8, 0, 30,
 '["SOC Lite dahil", "İş saatleri analist desteği (09-18)",
   "FortiGate Fabric entegrasyonu", "Haftalık analist özeti",
   "Özel playbook geliştirme (2 adet/ay)",
   "Datadog/Azure Monitor entegrasyonu"]',
 '["50-200 çalışan", "FortiGate + monitoring araçları olanlar"]',
 true, 85),

('soc-pro',
 'AI SOC Pro',
 '7/24 analist destekli kriz yönetimi dahil SOC',
 'soc', 'monthly', 16500,
 24, 0, 15,
 '["SOC Standart dahil", "7/24 analist desteği",
   "Sanal CISO dahil", "Kriz yönetimi (Seviye 4)",
   "Sınırsız özel playbook", "Aylık executive brifing",
   "Tüm entegrasyon desteği"]',
 '["200+ çalışan", "Finans, sağlık, kamu"]',
 false, 90),

('virtual-ciso',
 'Sanal CISO',
 'Aylık stratejik güvenlik danışmanlığı ve raporlama',
 'consulting', 'monthly', 8000,
 24, 0, 60,
 '["Aylık 2 saat strateji görüşmesi", "Yönetim kurulu raporu",
   "Güvenlik yol haritası", "Mevzuat takibi (KVKK, BTK)",
   "Tedarikçi değerlendirme desteği"]',
 '["50+ çalışan", "Kendi CISO\'su olmayan şirketler"]',
 false, 95),

-- ─── PAKETLER ─────────────────────────────────────────────
('bundle-starter',
 'Başlangıç Paketi',
 'İlk kez değerlendirme yaptırmak isteyen şirketler için',
 'bundle', 'one_time', 8990,
 1, 24, 480,
 '["Tam Değerlendirme", "AI Güvenlik Değerlendirmesi",
   "Sızıntı İzleyici 1 yıl", "%24 indirim"]',
 '["5-100 çalışan", "İlk güvenlik değerlendirmesi"]',
 true, 100),

('bundle-ai-security',
 'AI Güvenlik Paketi',
 'AI araç kullanan şirketler için kapsamlı paket',
 'bundle', 'one_time', 11990,
 1, 48, 480,
 '["AI Güvenlik Değerlendirmesi", "AI Phishing Simülasyonu",
   "Deepfake Analizi", "EU AI Act Uyum Skoru",
   "AI Araç İzleme 1 yıl", "AI Politika 1 yıl", "%21 indirim"]',
 '["AI araç kullanan şirketler", "Teknoloji, fintech"]',
 true, 105),

('bundle-full-protection',
 'Tam Koruma Paketi',
 'Kapsamlı yıllık güvenlik paketi',
 'bundle', 'annual', 19990,
 2, 48, 240,
 '["Tüm değerlendirmeler", "Tüm AI servisleri",
   "AI Araç İzleme + Politika", "Sızıntı İzleyici",
   "Sektör kıyaslama raporu", "%25 indirim",
   "Öncelikli destek"]',
 '["20-200 çalışan", "Kapsamlı koruma isteyenler"]',
 true, 110),

('bundle-enterprise-soc',
 'Kurumsal SOC Paketi',
 'Tam koruma + SOC servisi + Fortinet entegrasyonu',
 'bundle', 'annual', 99000,
 24, 72, 30,
 '["Tam Koruma Paketi dahil", "SOC Standart 12 ay",
   "Fortinet Fabric kurulum", "Sanal CISO dahil",
   "Yıllık 2 uzman görüşmesi", "%29 indirim"]',
 '["50+ çalışan", "FortiGate kullananlar", "Kurumsal"]',
 false, 115),

('bundle-kvkk-consultant',
 'KVKK Danışman Paketi',
 'Danışmanlık firmaları için white-label çözüm',
 'bundle', 'annual', 39900,
 4, 24, 240,
 '["10 Tam Değerlendirme hakkı", "White-label portal",
   "Partner branding", "Aylık partner raporu",
   "Ek değerlendirme: 4.990 TL/adet"]',
 '["KVKK danışmanları", "BT hizmet firmaları"]',
 false, 120);
```

---

# BÖLÜM B: MÜŞTERİ ONBOARDING SİSTEMİ

## B1 — Onboarding Veritabanı

```sql
CREATE TABLE IF NOT EXISTS customer_onboarding (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id) UNIQUE,

  -- Onboarding tipi
  onboarding_type varchar(20) DEFAULT 'self_service',
  -- 'self_service' | 'admin_assisted' | 'partner'

  -- Aşama takibi (her 1 = tamamlandı)
  step_registered boolean DEFAULT false,
  step_email_verified boolean DEFAULT false,
  step_first_scan boolean DEFAULT false,
  step_mini_assessment boolean DEFAULT false,
  step_payment boolean DEFAULT false,
  step_service_activated boolean DEFAULT false,
  step_integration_configured boolean DEFAULT false,
  step_first_report_viewed boolean DEFAULT false,
  step_notification_enabled boolean DEFAULT false,
  step_completed boolean DEFAULT false,

  -- Zaman damgaları
  registered_at timestamp,
  email_verified_at timestamp,
  first_scan_at timestamp,
  payment_at timestamp,
  service_activated_at timestamp,
  completed_at timestamp,

  -- Atanan hesap yöneticisi (admin-assisted için)
  assigned_to varchar(100),

  -- Nudge takibi
  nudge_1_sent_at timestamp,  -- Gün 2: İlk tarama
  nudge_2_sent_at timestamp,  -- Gün 5: Assessment
  nudge_3_sent_at timestamp,  -- Gün 10: Ödeme hatırlatma

  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_services (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  service_catalog_id integer REFERENCES service_catalog(id),
  status varchar(20) DEFAULT 'pending',
  -- 'pending' | 'active' | 'expired' | 'cancelled' | 'suspended'
  activated_at timestamp,
  expires_at timestamp,
  -- Kullanım bazlı servisler için
  usage_count integer DEFAULT 0,
  usage_limit integer,
  -- Ödeme
  payment_id integer REFERENCES payments(id),
  amount_paid_tl decimal(12,2),
  -- Yenileme
  auto_renew boolean DEFAULT true,
  next_renewal_at timestamp,
  -- Admin tarafından mı aktive edildi
  activated_by varchar(50) DEFAULT 'self',
  -- 'self' | 'admin' | 'partner' | 'system'
  notes text,
  created_at timestamp DEFAULT now()
);
```

## B2 — Self-Servis Onboarding Akışı

```typescript
// src/services/onboardingService.ts

// ADIM 1: Kayıt
export async function registerCustomer(data: {
  email: string;
  password: string;
  companyName: string;
  phone?: string;
}): Promise<Customer> {

  // Duplicate kontrol
  const existing = await db.select()
    .from(customers).where(eq(customers.email, data.email)).limit(1);
  if (existing[0]) throw new Error('Bu e-posta zaten kayıtlı');

  // Hesap oluştur
  const hashedPassword = await hashPassword(data.password);
  const verifyToken = generateSecureToken();

  const [customer] = await db.insert(customers).values({
    email: data.email,
    passwordHash: hashedPassword,
    companyName: data.companyName,
    phone: data.phone,
    emailVerifyToken: verifyToken,
    status: 'pending_verification',
    plan: 'free',
  }).returning();

  // Onboarding kaydı
  await db.insert(customerOnboarding).values({
    customerId: customer.id,
    onboardingType: 'self_service',
    stepRegistered: true,
    registeredAt: new Date(),
  });

  // Doğrulama e-postası
  await sendVerificationEmail(customer.email, verifyToken);

  // ISR'a lead
  await createISRLead({
    email: customer.email,
    companyName: data.companyName,
    source: 'self_registration',
    stage: 'registered',
  });

  return customer;
}

// ADIM 2: E-posta Doğrulama
export async function verifyEmail(token: string): Promise<void> {
  const customer = await db.select()
    .from(customers)
    .where(eq(customers.emailVerifyToken, token))
    .limit(1);

  if (!customer[0]) throw new Error('Geçersiz doğrulama bağlantısı');

  await db.update(customers).set({
    emailVerified: true,
    emailVerifyToken: null,
    status: 'active',
  }).where(eq(customers.id, customer[0].id));

  await db.update(customerOnboarding).set({
    stepEmailVerified: true,
    emailVerifiedAt: new Date(),
  }).where(eq(customerOnboarding.customerId, customer[0].id));

  // Hoş geldin e-postası + ürün turu tetikle
  await sendWelcomeEmail(customer[0]);
  await scheduleOnboardingNudges(customer[0].id);
}

// ADIM 3: İlk Taramadan Sonra Onboarding İlerlet
export async function onFirstScanCompleted(
  customerId: number
): Promise<void> {
  await db.update(customerOnboarding).set({
    stepFirstScan: true,
    firstScanAt: new Date(),
  }).where(eq(customerOnboarding.customerId, customerId));

  await checkAndCompleteOnboarding(customerId);
}

// ADIM 4: Servis Aktivasyonu (Ödeme Sonrası)
export async function activateService(
  customerId: number,
  serviceCatalogId: number,
  paymentId: number,
  activatedBy: string = 'self'
): Promise<CustomerService> {

  const service = await getServiceCatalog(serviceCatalogId);

  const expiresAt = service.serviceType === 'monthly'
    ? addMonths(new Date(), 1)
    : service.serviceType === 'annual'
    ? addYears(new Date(), 1)
    : null; // one_time: süresi yok

  const [customerService] = await db.insert(customerServices).values({
    customerId,
    serviceCatalogId,
    status: 'active',
    activatedAt: new Date(),
    expiresAt,
    paymentId,
    activatedBy,
    autoRenew: ['monthly', 'annual'].includes(service.serviceType),
  }).returning();

  // Onboarding güncelle
  await db.update(customerOnboarding).set({
    stepPayment: true,
    stepServiceActivated: true,
    paymentAt: new Date(),
    serviceActivatedAt: new Date(),
  }).where(eq(customerOnboarding.customerId, customerId));

  // Servis tipine göre aktivasyon aksiyonları
  await triggerServiceActivation(customerId, service.slug);

  // Aktivasyon e-postası
  await sendServiceActivationEmail(customerId, service);

  return customerService;
}

// Servis bazlı aktivasyon aksiyonları
async function triggerServiceActivation(
  customerId: number,
  serviceSlug: string
): Promise<void> {
  const actions: Record<string, () => Promise<void>> = {
    'full-assessment': async () => {
      await enableAssessmentAccess(customerId);
    },
    'soc-lite': async () => {
      await enableSOCMonitoring(customerId, 'lite');
      await sendSOCWelcomeEmail(customerId);
    },
    'soc-standart': async () => {
      await enableSOCMonitoring(customerId, 'standart');
      await createFortinetIntegration(customerId);
      await sendFortinetSetupGuide(customerId);
    },
    'bundle-full-protection': async () => {
      await activateBundleServices(customerId, [
        'full-assessment', 'ai-security-assessment',
        'phishing-simulation', 'deepfake-analysis',
        'eu-ai-act', 'ai-red-team',
        'ai-tool-monitoring', 'ai-policy-autoupdate', 'leak-monitor',
      ]);
    },
  };

  await actions[serviceSlug]?.();
}
```

## B3 — Admin Tarafı Aktivasyon Paneli

```
/admin-panel/customers/:id/services

────────────────────────────────────────────────────────
Müşteri: Acme Teknoloji A.Ş.
Plan: Free  →  [Plan Değiştir ▾]

Aktif Servisler:
──────────────────────────────────────────────────────
Servis              Durum    Başlangıç    Bitiş       Aksiyonlar
──────────────────────────────────────────────────────
Domain Tarama       ✅ Aktif  —            —           [Kapat]
Mini Assessment     ✅ Aktif  —            —           [Kapat]

Servis Ekle:
──────────────────────────────────────────────────────
Servis: [Tam Değerlendirme                    ▾]
Fiyat:  [5.990 TL        ] (değiştirilebilir)
Ödeme:  ○ Çevrimiçi ödeme yaptı
        ○ Havale/EFT aldı  → Fatura no: [_____]
        ○ Ücretsiz/Deneme  → Sebep: [__________]
        ○ Partner aktivasyonu
Notlar: [________________________________________________]

[Servisi Aktive Et]
──────────────────────────────────────────────────────
```

```typescript
// POST /api/admin/customers/:id/services/activate

router.post('/:customerId/services/activate',
  requireAdmin,
  async (req, res) => {
    const { serviceCatalogId, paymentMethod, overridePrice,
            paymentRef, notes, activatedBy } = req.body;

    let paymentId = null;

    if (paymentMethod === 'manual') {
      // Manuel ödeme kaydı oluştur
      const [payment] = await db.insert(payments).values({
        customerId: req.params.customerId,
        amount: overridePrice || service.priceTl,
        method: 'manual',
        reference: paymentRef,
        status: 'completed',
        processedBy: req.user.userId,
      }).returning();
      paymentId = payment.id;
    }

    const customerService = await activateService(
      parseInt(req.params.customerId),
      serviceCatalogId,
      paymentId,
      'admin'
    );

    // Admin log
    await logAdminAction(req.user.userId, 'service_activated', {
      customerId: req.params.customerId,
      serviceId: serviceCatalogId,
      paymentMethod,
      overridePrice,
      notes,
    });

    res.json({ success: true, service: customerService });
  }
);
```

---

# BÖLÜM C: ÖDEME SİSTEMİ

## C1 — Self-Servis Ödeme Akışı

```typescript
// src/services/paymentService.ts

// POST /api/payments/initiate
export async function initiatePayment(params: {
  customerId: number;
  serviceCatalogId: number;
  couponCode?: string;
}): Promise<IyzicoPaymentResponse> {

  const service = await getServiceCatalog(params.serviceCatalogId);
  const customer = await getCustomer(params.customerId);

  // Kupon kontrolü
  let finalPrice = service.priceTl;
  if (params.couponCode) {
    finalPrice = await applyCoupon(params.couponCode, finalPrice);
  }

  // Iyzico ödeme formu başlat
  const iyzicoRequest = {
    locale: 'tr',
    conversationId: `${params.customerId}-${params.serviceCatalogId}-${Date.now()}`,
    price: finalPrice.toString(),
    paidPrice: finalPrice.toString(),
    currency: 'TRY',
    basketId: `basket-${params.customerId}`,
    paymentGroup: 'PRODUCT',
    callbackUrl: `${process.env.BASE_URL}/api/payments/callback`,
    buyer: {
      id: params.customerId.toString(),
      name: customer.contactName || customer.companyName,
      surname: 'Kullanıcı',
      email: customer.email,
      identityNumber: '11111111111', // TCKN (zorunlu alan)
      registrationAddress: customer.billingAddress || 'Türkiye',
      ip: '85.34.78.112',
      city: customer.city || 'İstanbul',
      country: 'Turkey',
    },
    billingAddress: {
      contactName: customer.billingName || customer.companyName,
      city: customer.city || 'İstanbul',
      country: 'Turkey',
      address: customer.billingAddress || 'Türkiye',
    },
    basketItems: [{
      id: service.slug,
      name: service.name,
      category1: service.category,
      itemType: 'VIRTUAL',
      price: finalPrice.toString(),
    }],
  };

  // Ödeme başlatma kaydı
  await db.insert(paymentAttempts).values({
    customerId: params.customerId,
    serviceCatalogId: params.serviceCatalogId,
    amount: finalPrice,
    status: 'initiated',
    iyzicoConversationId: iyzicoRequest.conversationId,
  });

  const result = await iyzipay.checkoutFormInitialize.create(iyzicoRequest);
  return result;
}

// Iyzico Callback (POST /api/payments/callback)
export async function handlePaymentCallback(
  token: string,
  status: string
): Promise<void> {
  // Token ile ödeme sonucunu doğrula
  const result = await iyzipay.checkoutForm.retrieve({ token });

  if (result.status !== 'success' || result.paymentStatus !== 'SUCCESS') {
    await updatePaymentAttempt(token, 'failed');
    return;
  }

  const attempt = await getPaymentAttemptByConversationId(
    result.conversationId
  );

  // Ödeme kaydı oluştur
  const [payment] = await db.insert(payments).values({
    customerId: attempt.customerId,
    amount: parseFloat(result.price),
    method: 'credit_card',
    iyzicoPaymentId: result.paymentId,
    iyzicoToken: token,
    status: 'completed',
    completedAt: new Date(),
  }).returning();

  // Servisi aktive et
  await activateService(
    attempt.customerId,
    attempt.serviceCatalogId,
    payment.id,
    'self'
  );

  // Fatura kes
  await generateAndSendInvoice(payment.id);

  // Onboarding güncelle
  await onPaymentCompleted(attempt.customerId);
}
```

## C2 — Abonelik Yönetimi

```typescript
// Tekrarlayan ödeme cron — her gece 09:00
cron.schedule('0 9 * * *', async () => {

  // Bugün yenilenecek abonelikler
  const renewals = await db.select()
    .from(customerServices)
    .where(
      and(
        eq(customerServices.status, 'active'),
        eq(customerServices.autoRenew, true),
        lte(customerServices.nextRenewalAt,
            new Date(Date.now() + 24 * 60 * 60 * 1000))
      )
    );

  for (const cs of renewals) {
    try {
      await processRenewal(cs);
    } catch (e) {
      await handleRenewalFailure(cs, e);
    }
  }
});

async function processRenewal(cs: CustomerService): Promise<void> {
  const customer = await getCustomer(cs.customerId);
  const service = await getServiceCatalog(cs.serviceCatalogId);

  // Iyzico'da kayıtlı kart ile otomatik ödeme
  // (Iyzico subscription veya stored card token)
  const result = await iyzipay.subscription.create({
    subscriptionReferenceCode: `renewal-${cs.id}`,
    callbackUrl: `${process.env.BASE_URL}/api/payments/renewal-callback`,
  });

  if (result.status === 'success') {
    // Servis süresini uzat
    await db.update(customerServices).set({
      expiresAt: addPeriod(cs.expiresAt, service.serviceType),
      nextRenewalAt: addPeriod(new Date(), service.serviceType),
    }).where(eq(customerServices.id, cs.id));

    await generateAndSendInvoice(result.paymentId);
  }
}

async function handleRenewalFailure(
  cs: CustomerService,
  attempt: number = 1
): Promise<void> {
  const messages = {
    1: 'Abonelik yenilemesi başarısız. Ödeme bilgilerinizi güncelleyin.',
    2: 'Son ödeme hatırlatması. Hesabınız 3 gün içinde askıya alınacak.',
    3: 'Hesabınız askıya alındı. Yeniden etkinleştirmek için ödeme yapın.',
  };

  await sendPaymentFailureEmail(cs.customerId, messages[attempt]);

  if (attempt >= 3) {
    await db.update(customerServices).set({
      status: 'suspended',
    }).where(eq(customerServices.id, cs.id));
  }
}
```

## C3 — Kupon Sistemi

```sql
CREATE TABLE IF NOT EXISTS coupons (
  id serial PRIMARY KEY,
  code varchar(50) UNIQUE NOT NULL,
  discount_type varchar(20) NOT NULL,
  -- 'percent' | 'fixed_tl'
  discount_value decimal(10,2) NOT NULL,
  max_uses integer,
  used_count integer DEFAULT 0,
  valid_from timestamp,
  valid_until timestamp,
  applicable_services text[],
  -- NULL = tüm servisler
  created_by varchar(100),
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now()
);
```

---

# BÖLÜM D: ENTEGRASYON ONBOARDING SİHİRBAZLARI

## D1 — Fortinet Security Fabric Sihirbazı

```tsx
// /hesabim/entegrasyonlar/fortinet-fabric
// 5 adım, her adım bağımsız test edilebilir

const FORTINET_STEPS = [
  {
    step: 1,
    title: 'Token Oluşturuldu',
    description: 'CyberStep webhook ve syslog token\'larınız hazır.',
    autoCompleted: true, // Servis aktive edilince otomatik
    testable: false,
  },
  {
    step: 2,
    title: 'FortiGate Automation Stitch',
    description: 'FortiGate\'de webhook hedefi tanımlayın.',
    instructions: `
1. FortiGate → Security Fabric → Automation → Automation Stitch
2. + Create New
3. Trigger: FortiOS Event Log (Level: Critical, High)
4. Action: Webhook → POST → [WEBHOOK_URL]
5. Body: JSON (template aşağıda)
    `,
    template: `{"srcip":"%%log.srcip%%","dstip":"%%log.dstip%%",
"threatname":"%%log.threatname%%","severity":"%%log.level%%",
"action":"%%log.action%%","devname":"%%log.devname%%"}`,
    testButton: 'FortiGate\'den Test Gönder',
    testEndpoint: '/api/integrations/test/fortinet-webhook',
  },
  {
    step: 3,
    title: 'FortiAnalyzer Log Forward',
    description: 'FortiAnalyzer\'ı syslog forward için yapılandırın.',
    instructions: `
1. FortiAnalyzer → Log Forwarding → + Create New
2. Remote Server Type: Syslog
3. Server: logs.cyberstep.io  Port: 5514 (TCP)
4. Description: cyberstep:[SYSLOG_TOKEN]
    `,
    testButton: 'Syslog Bağlantısını Test Et',
    optional: true,
  },
  {
    step: 4,
    title: 'FortiManager Blok Listesi',
    description: 'FortiManager\'da read-only API token oluşturun.',
    instructions: `
1. System Settings → Admin → Create New
2. Type: REST API (Read-Write sadece Firewall Objects)
3. Trusted Hosts: 54.93.XX.XX
4. Token'ı kopyalayın ve aşağıya yapıştırın
    `,
    form: ['host', 'port', 'token', 'adom'],
    testButton: 'FortiManager Bağlantısını Doğrula',
    optional: true,
  },
  {
    step: 5,
    title: 'Test ve Tamamlama',
    description: 'Demo olay tetikleyerek entegrasyonu doğrulayın.',
    demoEventButton: 'Demo Saldırı Senaryosu Başlat',
    expectedResults: [
      'Fabric event alındı ✓',
      'Claude triage tamamlandı ✓',
      'SOC case açıldı ✓',
      'Bildirim gönderildi ✓',
    ],
  },
];
```

## D2 — Datadog Sihirbazı

```tsx
const DATADOG_STEPS = [
  {
    step: 1,
    title: 'Webhook URL\'nizi Kopyalayın',
    autoCompleted: true,
    webhookUrl: `https://cyberstep.io/api/integrations/datadog/[TOKEN]`,
  },
  {
    step: 2,
    title: 'Datadog\'da Webhook Ekleyin',
    instructions: `
1. Datadog → Integrations → Webhooks
2. + New Webhook
3. URL: [WEBHOOK_URL]
4. Payload: Varsayılan (değiştirmeyin)
5. Save
    `,
  },
  {
    step: 3,
    title: 'Monitor\'lara Ekleyin',
    instructions: `
1. Monitors → Manage Monitors
2. Her kritik monitor'ı açın
3. Notify section → @webhook-cyberstep ekleyin
4. Önerilen: Error rate, Anomaly, Security signals
    `,
  },
  {
    step: 4,
    title: 'Test',
    testButton: 'Datadog Test Bildirimi Gönder',
  },
];
```

## D3 — Azure Monitor Sihirbazı

```tsx
const AZURE_STEPS = [
  {
    step: 1,
    title: 'Action Group Oluşturun',
    instructions: `
Azure Portal:
1. Monitor → Alerts → Action groups → + Create
2. Name: CyberStep-Alerts
3. Action type: Webhook
4. URI: [WEBHOOK_URL]
5. Enable common alert schema: Evet
    `,
  },
  {
    step: 2,
    title: 'Alert Rule\'larına Ekleyin',
    instructions: `
1. Monitor → Alerts → Alert rules
2. Her kritik kural için: Actions → CyberStep-Alerts ekle
3. Önerilen: Defender alerts, Login anomalies, Config changes
    `,
  },
  {
    step: 3,
    title: 'Opsiyonel: Aktif Sorgulama',
    optional: true,
    form: ['tenantId', 'clientId', 'clientSecret', 'subscriptionId'],
    instructions: `
Azure AD → App registrations → New registration
Assign role: Security Reader (Subscription seviyesinde)
    `,
  },
];
```

## D4 — Slack/Teams/Telegram Sihirbazları

```tsx
// Slack — OAuth flow
const SLACK_STEPS = [
  {
    step: 1,
    title: 'Slack\'e Bağlan',
    oauthButton: 'Slack ile Bağlan',
    oauthUrl: `https://slack.com/oauth/v2/authorize?client_id=...`,
  },
  {
    step: 2,
    title: 'Bildirim Tercihlerini Ayarlayın',
    form: {
      channel: 'Kanal (örn: #siber-guvenlik)',
      events: ['Kritik SOC alarmları', 'Haftalık özet', 'SLA uyarıları'],
    },
  },
];

// Telegram — Bot token
const TELEGRAM_STEPS = [
  {
    step: 1,
    title: 'Telegram Botunuzu Oluşturun',
    instructions: `
1. @BotFather'a mesaj gönderin: /newbot
2. Bot adı verin
3. Token'ı kopyalayın
    `,
    form: ['botToken'],
  },
  {
    step: 2,
    title: 'Chat ID\'nizi Öğrenin',
    instructions: `
Bota /start mesajı gönderin,
sonra aşağıdaki "Chat ID Bul" butonuna tıklayın.
    `,
    autoDetectButton: 'Chat ID\'mi Bul',
  },
];
```

---

# BÖLÜM E: PLATFORM MONİTORİNG

## E1 — Servis Sağlık Kontrolleri

```typescript
// src/monitoring/healthChecks.ts
// GET /health — tüm servislerin durumu

interface ServiceHealth {
  name: string;
  status: 'ok' | 'degraded' | 'down';
  latencyMs?: number;
  message?: string;
}

export async function runAllHealthChecks(): Promise<{
  overall: 'ok' | 'degraded' | 'down';
  services: ServiceHealth[];
  timestamp: string;
}> {

  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkClaudeAPI(),
    checkEmailService(),
    checkWhatsApp(),
    checkIyzico(),
    checkExternalAPIs(),
    checkCronJobs(),
    checkSOCWorker(),
    checkSyslogServer(),
  ]);

  const services = checks.map((r, i) =>
    r.status === 'fulfilled' ? r.value : {
      name: SERVICE_NAMES[i],
      status: 'down' as const,
      message: r.reason?.message,
    }
  );

  const overall = services.every(s => s.status === 'ok') ? 'ok'
    : services.some(s => s.status === 'down') ? 'down'
    : 'degraded';

  return { overall, services, timestamp: new Date().toISOString() };
}

async function checkDatabase(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { name: 'PostgreSQL', status: 'ok', latencyMs: Date.now() - start };
  } catch (e) {
    return { name: 'PostgreSQL', status: 'down', message: e.message };
  }
}

async function checkClaudeAPI(): Promise<ServiceHealth> {
  // Son 5 dakikada Claude çağrısı başarılı oldu mu?
  const recent = await db.select()
    .from(aiUsageLog)
    .where(
      and(
        gte(aiUsageLog.createdAt, new Date(Date.now() - 5 * 60 * 1000)),
        isNotNull(aiUsageLog.outputTokens)
      )
    ).limit(1);

  if (recent.length > 0) {
    return { name: 'Claude API', status: 'ok' };
  }

  // Yoksa hızlı test çağrısı yap
  try {
    const start = Date.now();
    await callClaude('Merhaba', { model: 'claude-haiku-4-5', maxTokens: 5 });
    return { name: 'Claude API', status: 'ok', latencyMs: Date.now() - start };
  } catch (e) {
    return { name: 'Claude API', status: 'down', message: e.message };
  }
}

async function checkCronJobs(): Promise<ServiceHealth> {
  // Son 2 saatte hiç cron çalışmadıysa uyarı
  const lastRun = await db.select()
    .from(cronJobMetrics)
    .orderBy(desc(cronJobMetrics.lastRunAt))
    .limit(1);

  if (!lastRun[0]) return { name: 'Cron Jobs', status: 'down' };

  const minutesSince = (Date.now() - lastRun[0].lastRunAt.getTime()) / 60000;
  return {
    name: 'Cron Jobs',
    status: minutesSince < 120 ? 'ok' : 'degraded',
    message: minutesSince >= 120 ? `Son çalışma: ${Math.round(minutesSince)} dk önce` : undefined,
  };
}
```

## E2 — Müşteri SLA Takibi

```typescript
// Gerçek zamanlı SLA dashboard metrikleri

export async function getCustomerSLAMetrics(
  customerId: number
): Promise<CustomerSLAMetrics> {

  const [openCases, breachedCases, resolvedThisMonth] =
    await Promise.all([
      // Açık vakalar
      db.select({ count: count() })
        .from(socCases)
        .where(
          and(
            eq(socCases.customerId, customerId),
            inArray(socCases.status, ['open', 'investigating'])
          )
        ),

      // SLA ihlalleri
      db.select({ count: count() })
        .from(socCases)
        .where(
          and(
            eq(socCases.customerId, customerId),
            eq(socCases.slaBreached, true),
            gte(socCases.createdAt, startOfMonth(new Date()))
          )
        ),

      // Bu ay çözülen
      db.select({
        count: count(),
        avgResolutionMinutes: avg(socCases.timeToResolveMinutes),
      }).from(socCases)
        .where(
          and(
            eq(socCases.customerId, customerId),
            eq(socCases.status, 'closed'),
            gte(socCases.closedAt, startOfMonth(new Date()))
          )
        ),
    ]);

  // Taahhüt edilen vs gerçekleşen uptime
  const uptimeThisMonth = await calculateUptimePercentage(customerId);

  return {
    openCases: openCases[0]?.count || 0,
    slaBreaches: breachedCases[0]?.count || 0,
    resolvedCases: resolvedThisMonth[0]?.count || 0,
    avgResolutionMinutes: resolvedThisMonth[0]?.avgResolutionMinutes || 0,
    slaCompliancePct: calculateSLACompliance(customerId),
    uptimePct: uptimeThisMonth,
  };
}
```

## E3 — Monitoring Dashboard (Admin)

```
/admin-panel/platform-health

Üst satır — gerçek zamanlı:
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│ API      │ Database │ Claude   │ SOC      │ Cron     │
│ 🟢 OK    │ 🟢 OK    │ 🟢 OK    │ 🟢 OK    │ 🟡 2 job │
│ 45ms     │ 12ms     │ 823ms    │ Aktif    │ gecikmiş │
└──────────┴──────────┴──────────┴──────────┴──────────┘

Servis Kataloğu Durumu:
  Aktif müşteri servisi: 247
  Bu ay aktivasyon: 34
  Bu ay iptal: 3
  Net büyüme: +31

Ödeme Sağlığı:
  Başarılı ödeme (bugün): 5
  Başarısız ödeme: 0
  Bekleyen yenileme (7 gün): 12
  Gecikmiş ödeme: 2

SLA Tablosu — Tüm SOC Müşterileri:
  Müşteri          Tier      SLA %    Açık Case  Breach
  Acme A.Ş.        Standart  %98.5    2          0
  Beta Ltd.        Lite      %100     0          0
  Gamma A.Ş.       Pro       %97.2    1          1 ⚠️

Cron Job Sağlık Tablosu:
  Job Adı                      Son Çalışma    Durum    Süre
  domain_scan_queue             2 dk önce      ✅       3.2s
  threat_feed_update            58 dk önce     ✅       12.1s
  soc_triage_queue              5 dk önce      ✅       0.8s
  ssl_expiry_check              8 saat önce    ✅       4.2s
  weekly_soc_report             Pazartesi      ✅       45.1s
  customer_threat_relevance     3 saat önce    ✅       28.4s
  nps_survey_send               ✅              —
  github_secrets_scan           4 gün önce     ✅       —
```

## E4 — Müşteri Monitoring Bildirimleri

```typescript
// Müşteriyi etkileyen platform sorunlarında bildirim

export async function notifyAffectedCustomers(
  serviceType: string,
  message: string,
  severity: 'critical' | 'degraded'
): Promise<void> {

  // Hangi müşteriler bu servisi kullanıyor?
  const affected = await db.select()
    .from(customerServices)
    .innerJoin(serviceCatalog,
      eq(customerServices.serviceCatalogId, serviceCatalog.id))
    .where(
      and(
        eq(serviceCatalog.category, serviceType),
        eq(customerServices.status, 'active')
      )
    );

  for (const cs of affected) {
    if (severity === 'critical') {
      // Anlık WhatsApp + e-posta
      await sendUrgentPlatformAlert(cs.customerId, message);
    } else {
      // Sadece e-posta
      await sendPlatformStatusEmail(cs.customerId, message);
    }
  }

  // status.cyberstep.io güncelle
  await updateStatusPage(serviceType, severity, message);
}
```

---

# BÖLÜM F: ONBOARDING E-POSTA DİZİLERİ

```typescript
// Servis bazlı tetiklenen e-posta dizileri

const EMAIL_SEQUENCES = {

  // Kayıt sonrası (tüm müşteriler)
  registration: [
    { delay: 0,    subject: 'CyberStep\'e Hoş Geldiniz — İlk Taramanızı Yapın',
      template: 'welcome_with_cta' },
    { delay: 2,    subject: 'Domain\'inizi Henüz Taramadınız',
      template: 'first_scan_nudge' },
    { delay: 5,    subject: 'Türkiye\'de Bu Hafta: [X] Siber Saldırı',
      template: 'sector_threat_news', dynamic: true },
    { delay: 10,   subject: 'Ücretsiz Değerlendirme Hakkınız Sona Eriyor',
      template: 'assessment_expiry' },
    { delay: 14,   subject: 'Son Mesaj: CyberStep Hakkında',
      template: 'final_outreach' },
  ],

  // Tam değerlendirme satın alındı
  full_assessment_purchased: [
    { delay: 0,    subject: 'Değerlendirme Hazır — Başlayın',
      template: 'assessment_start_guide' },
    { delay: 2,    subject: 'Raporunuz Uzman İncelemesinde',
      template: 'expert_review_in_progress' },
    { delay: 4,    subject: '🏆 Uzman Doğrulaması Tamamlandı',
      template: 'expert_verified', trigger: 'on_expert_approval' },
    { delay: 7,    subject: 'Raporunuzdaki En Kritik Bulgu İçin Çözüm',
      template: 'finding_upsell', dynamic: true },
  ],

  // SOC aktivasyonu
  soc_activated: [
    { delay: 0,    subject: 'AI SOC Aktif — İzleme Başladı',
      template: 'soc_welcome' },
    { delay: 1,    subject: 'Fortinet Entegrasyonunu Kurun (30 Dakika)',
      template: 'fortinet_setup_guide' },
    { delay: 7,    subject: 'İlk Hafta SOC Özeti',
      template: 'soc_weekly_summary', trigger: 'after_first_week' },
  ],

  // Fortinet entegrasyonu tamamlandı
  fortinet_configured: [
    { delay: 0,    subject: '✅ Fortinet Entegrasyonu Aktif',
      template: 'fortinet_connected' },
    { delay: 1,    subject: 'FortiGate\'den İlk Tehdit Sinyali Nasıl Görünür?',
      template: 'fortinet_demo_guide' },
  ],
};
```

---

# BÖLÜM G: MÜŞTERİ PORTAL — SERVİS YÖNETİMİ

```
/hesabim/servislerim

Aktif Servislerim:
────────────────────────────────────────────────────────
AI SOC Standart               ✅ Aktif
  Başlangıç: 1 Nisan 2026
  Yenileme: 1 Temmuz 2026
  SLA: %98.5 bu ay
  [SOC Dashboard'uma Git →]   [İptal]

Tam Koruma Paketi             ✅ Aktif
  Başlangıç: 15 Mart 2026
  Bitiş: 15 Mart 2027
  [Paket İçeriğini Gör]

────────────────────────────────────────────────────────
Entegrasyonlarım:
  FortiGate        ✅ Bağlı   (son event: 2 dk önce)
  Datadog          ✅ Bağlı   (son event: 4 saat önce)
  Slack            ✅ Bağlı   (#siber-guvenlik kanalı)
  Azure Monitor    ⬜ Kurulmadı  [Kurulum Rehberi →]
  Telegram         ⬜ Kurulmadı  [5 Dakikada Kur →]

────────────────────────────────────────────────────────
Kullanılabilir Servisler:
  [Servis kataloğu — henüz satın alınmayanlar]
  Her kart: isim + fiyat + "Satın Al" butonu
```

---

## UYGULAMA SIRASI

```
SPRINT 1 — Servis Kataloğu + Onboarding Temel:
  ✓ service_catalog tablosu + seed data
  ✓ customer_services tablosu
  ✓ customer_onboarding tablosu
  ✓ registerCustomer() + verifyEmail() akışı
  ✓ activateService() servisi
  Test: Kayıt ol → e-posta doğrula → ücretsiz servis aktif

SPRINT 2 — Ödeme + Admin Aktivasyon:
  ✓ initiatePayment() + handlePaymentCallback()
  ✓ Admin servis aktivasyon paneli
  ✓ Kupon sistemi
  ✓ Abonelik yenileme cron
  Test: Iyzico sandbox ödeme → servis aktive → fatura gönderildi

SPRINT 3 — Entegrasyon Sihirbazları:
  ✓ Fortinet 5-adım sihirbaz
  ✓ Datadog/Azure/Slack/Telegram sihirbazları
  ✓ Test butonları (her entegrasyon)
  ✓ /hesabim/entegrasyonlar sayfası
  Test: Her sihirbazı uçtan uca tamamla

SPRINT 4 — Platform Monitoring:
  ✓ /health endpoint (tüm servis kontrolleri)
  ✓ Cron job sağlık metrikleri
  ✓ SLA takip tablosu
  ✓ Admin monitoring dashboard
  ✓ Müşteri etkilenme bildirimleri
  Test: Servis down simülasyonu → müşteri bildirimi → status page güncelle

SPRINT 5 — E-posta Dizileri + Portal:
  ✓ Tüm onboarding e-posta şablonları
  ✓ /hesabim/servislerim sayfası
  ✓ Servis iptal/dondurma akışı
  ✓ Yenileme bildirimleri
  Test: Yeni müşteri uçtan uca onboarding akışı
```

---

*CyberStep.io — Platform Operasyon Master Planı — 2026*
