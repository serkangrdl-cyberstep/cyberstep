# CyberStep.io — Genişletilmiş Özellikler
## Replit Agent Promptu — Öncelik Sırasına Göre Tüm Yeni Özellikler

---

## BAĞLAM

Existing stack: Node.js + Express + TypeScript + PostgreSQL + Drizzle ORM
+ React + shadcn/ui + Tailwind + Iyzico + Claude API.

Bu prompt 5 sprint'e bölünmüştür. Her sprint bağımsız çalışır.
Sırayla ver — önceki sprint tamamlanmadan sonrakine geçme.

---

# SPRINT 1 — HIZLI KAZANIMLAR (3-5 Gün)

## 1.1 STATUS PAGE (status.cyberstep.io)

```sql
CREATE TABLE IF NOT EXISTS status_incidents (
  id serial PRIMARY KEY,
  title varchar(255) NOT NULL,
  description text,
  severity varchar(20) DEFAULT 'minor',
  -- 'minor' | 'major' | 'critical'
  affected_services text[],
  -- ['domain-scan', 'ai-reports', 'portal', 'api']
  status varchar(20) DEFAULT 'investigating',
  -- 'investigating' | 'identified' | 'monitoring' | 'resolved'
  started_at timestamp DEFAULT now(),
  resolved_at timestamp,
  created_by varchar(100)
);

CREATE TABLE IF NOT EXISTS status_service_health (
  id serial PRIMARY KEY,
  service_name varchar(100) UNIQUE NOT NULL,
  display_name varchar(100) NOT NULL,
  current_status varchar(20) DEFAULT 'operational',
  -- 'operational' | 'degraded' | 'partial_outage' | 'major_outage'
  uptime_30d decimal(5,2) DEFAULT 99.99,
  last_checked_at timestamp DEFAULT now()
);

INSERT INTO status_service_health
  (service_name, display_name) VALUES
  ('domain-scan',     'Domain Güvenlik Taraması'),
  ('ai-reports',      'AI Rapor Üretimi'),
  ('customer-portal', 'Müşteri Portali'),
  ('api',             'API Servisleri'),
  ('email',           'E-posta Bildirimleri'),
  ('admin-panel',     'Admin Paneli');
```

**Public sayfa:** `/status` (auth yok)
- Her servis için yeşil/sarı/kırmızı durum göstergesi
- Son 90 günlük uptime bar chart (GitHub style)
- Aktif olay varsa banner
- Geçmiş olaylar listesi

**Admin:** `/admin-panel/status`
- Servis durumunu değiştir
- Yeni olay oluştur / kapat
- Olay güncellemesi yaz

**Cron:** Her 5 dakikada bir tüm servislerin sağlığını kontrol et,
uptime yüzdesini güncelle.

---

## 1.2 KARİYER SAYFASI LEAD MIKNATI SI

```sql
CREATE TABLE IF NOT EXISTS career_applications (
  id serial PRIMARY KEY,
  name varchar(255) NOT NULL,
  email varchar(255) NOT NULL,
  current_company varchar(255),
  current_title varchar(100),
  linkedin_url varchar(500),
  areas_of_interest text[],
  -- ['satis', 'teknik', 'pazarlama', 'danismanlik']
  message text,
  cv_url varchar(500),
  lead_created boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);
```

**Sayfa:** `/kariyer`
- "Şu an açık pozisyon yok — ama büyüyoruz"
- Şirket kültürü ve misyon
- İlgi alanı seçimi (multi-select)
- Form: isim, e-posta, LinkedIn, mevcut şirket/unvan, mesaj
- Submit → career_applications kaydı → admin bildirimi
- Siber güvenlik sektöründe çalışan = potansiyel partner/satış adayı

---

## 1.3 ONBOARDING TAMAMLAMA SKORU

```sql
CREATE TABLE IF NOT EXISTS onboarding_progress (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id) UNIQUE,
  -- Adımlar (her biri boolean + tamamlanma zamanı)
  domain_added boolean DEFAULT false,
  domain_added_at timestamp,
  first_scan_completed boolean DEFAULT false,
  first_scan_at timestamp,
  first_report_viewed boolean DEFAULT false,
  first_report_at timestamp,
  email_notifications_enabled boolean DEFAULT false,
  profile_completed boolean DEFAULT false,
  -- Şirket adı, sektör, çalışan sayısı dolduruldu
  first_finding_acknowledged boolean DEFAULT false,
  -- Rapordaki bir bulguya "anladım" tıklandı
  whatsapp_connected boolean DEFAULT false,
  completion_pct integer DEFAULT 0,
  -- 0-100
  completed_at timestamp,
  -- %100 olunca
  nudge_1_sent_at timestamp,
  -- %0'da 2. gün
  nudge_2_sent_at timestamp,
  -- %30'da 5. gün
  nudge_3_sent_at timestamp
  -- %60'da 10. gün
);
```

**Müşteri portali dashboard'una ekle:**
```
┌─────────────────────────────────────────────────────┐
│ 🚀 Kurulumunuzu Tamamlayın              %60         │
│ ████████████░░░░░░░░                               │
│                                                      │
│ ✅ Domain eklendi          ✅ İlk tarama yapıldı    │
│ ✅ Rapor görüntülendi      ⬜ E-posta bildirimi     │
│ ⬜ Profil tamamlandı       ⬜ WhatsApp bağlandı     │
│                                                      │
│ [Sonraki Adım: E-posta Bildirimlerini Aç →]         │
└─────────────────────────────────────────────────────┘
```

**Cron:** Her gece — tamamlanmamış onboarding için nudge e-postaları:
- Gün 2 (%0 ise): "Henüz başlamadınız — domain'inizi ekleyin"
- Gün 5 (%30 ise): "Neredeyse tamamladınız — 2 adım kaldı"
- Gün 10 (%60 ise): "Son bir adım — WhatsApp bildirimleri"

---

## 1.4 BAŞARI ROZETİ SİSTEMİ

```sql
CREATE TABLE IF NOT EXISTS achievement_badges (
  id serial PRIMARY KEY,
  slug varchar(100) UNIQUE NOT NULL,
  name varchar(255) NOT NULL,
  description text,
  icon varchar(10),
  -- Emoji
  condition_type varchar(50),
  -- 'finding_closed' | 'score_reached' | 'scan_count' |
  -- 'age_days' | 'service_count' | 'referral_count'
  condition_value integer,
  -- Eşik değeri
  is_shareable boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS customer_achievements (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  badge_id integer REFERENCES achievement_badges(id),
  earned_at timestamp DEFAULT now(),
  shared_at timestamp,
  UNIQUE (customer_id, badge_id)
);

-- Rozetleri seed et
INSERT INTO achievement_badges
  (slug, name, description, icon, condition_type, condition_value)
VALUES
  ('first_scan',       'İlk Adım',            'İlk domain taraması tamamlandı',          '🔍', 'scan_count',     1),
  ('finding_closer_1', 'Güvenlik Koruyucusu', 'İlk kritik bulgu kapatıldı',              '🛡️', 'finding_closed', 1),
  ('finding_closer_5', 'Güvenlik Ustası',     '5 kritik bulgu kapatıldı',                '⚔️', 'finding_closed', 5),
  ('score_60',         'Güvenli Bölge',       'Güvenlik skoru 60 üstüne çıktı',          '📈', 'score_reached',  60),
  ('score_80',         'Üst Seviye',          'Güvenlik skoru 80 üstüne çıktı',          '🏆', 'score_reached',  80),
  ('veteran_90',       '90 Gün Güçlü',        'Platforma 90 gün boyunca aktif kullandı', '💎', 'age_days',       90),
  ('referral_1',       'Savunucu',            'İlk referral müşterisi getirildi',         '🤝', 'referral_count', 1);
```

**Rozet kazanıldığında:**
1. achievement_badges kaydı oluştur
2. Müşteriye e-posta: "🏆 Yeni rozet kazandınız: [Rozet Adı]"
3. Portal dashboard'unda rozet göster
4. LinkedIn paylaşım butonu:
   "CyberStep'te '[Rozet Adı]' rozetini kazandım! 🛡️
    Güvenlik skorum [X]'den [Y]'e yükseldi.
    cyberstep.io/verify/[token]
    #SiberGüvenlik #CyberStep"

**Admin:** Hangi müşteri kaç rozet kazandı — leaderboard.

---

## 1.5 ÜCRETSIZ ARAÇ SEO SAYFALAIRI

Mevcut araçların her biri için ayrı, SEO optimize landing page oluştur.

```typescript
// Her araç için route pattern:
// /araclar/ssl-kontrol
// /araclar/domain-guvenlik-taramasi
// /araclar/kvkk-ceza-hesaplayici
// /araclar/dmarc-kontrol
// /araclar/dark-web-sorgulama
// /araclar/siber-risk-roi

const SEO_TOOL_PAGES = [
  {
    slug: 'ssl-kontrol',
    title: 'Ücretsiz SSL Sertifika Kontrol Aracı',
    metaDescription: 'Web sitenizin SSL sertifikası geçerli mi? '
      + 'Bitiş tarihi ne zaman? Ücretsiz kontrol edin.',
    h1: 'SSL Sertifikanızı Ücretsiz Kontrol Edin',
    targetKeywords: ['ssl kontrol', 'ssl sertifika kontrolü', 'ssl test'],
    relatedTools: ['domain-guvenlik-taramasi', 'dmarc-kontrol'],
    toolComponent: 'SSLChecker',
  },
  {
    slug: 'domain-guvenlik-taramasi',
    title: 'Ücretsiz Domain Güvenlik Taraması',
    metaDescription: 'Şirket domain''inizin güvenlik açıklarını '
      + 'ücretsiz tarayın. SPF, DKIM, DMARC, SSL, kara liste kontrolü.',
    h1: 'Domain Güvenlik Taraması — Ücretsiz',
    targetKeywords: ['domain güvenlik tarama', 'domain blacklist kontrol'],
    relatedTools: ['ssl-kontrol', 'dmarc-kontrol'],
    toolComponent: 'DomainScanner',
  },
  {
    slug: 'kvkk-ceza-hesaplayici',
    title: 'KVKK Ceza Simülatörü — 2026 Güncel',
    metaDescription: 'KVKK ihlalinde ne kadar ceza alabilirsiniz? '
      + '2026 güncel ceza skalasına göre hesaplayın.',
    h1: 'KVKK Ceza Riski Hesaplayıcı',
    targetKeywords: ['kvkk ceza', 'kvkk para cezası hesaplama'],
    relatedTools: ['domain-guvenlik-taramasi'],
    toolComponent: 'KVKKPenaltyCalculator',
  },
];

// Her sayfa şablonu:
// H1 + açıklama
// Araç embed (mevcut component)
// "Bu araç ne işe yarar?" bölümü (Claude ile üretilmiş, 300 kelime)
// SSS (5 soru-cevap, schema.org FAQ markup)
// İlgili araçlar
// "Tam rapor için" CTA → lead form
```

**Sitemap.xml'e tüm araç sayfalarını ekle.**
**Internal linking: Her araç sayfası diğer araçlara bağlantı veriyor.**

---

# SPRINT 2 — ORTA KOMPLEKSLIK (1-2 Hafta)

## 2.1 SLACK / MICROSOFT TEAMS ENTEGRASYONU

```sql
CREATE TABLE IF NOT EXISTS customer_integrations (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  integration_type varchar(30) NOT NULL,
  -- 'slack' | 'teams' | 'webhook'
  config jsonb NOT NULL,
  -- Slack: {webhook_url, channel_name, workspace_name}
  -- Teams: {webhook_url, channel_name}
  -- Webhook: {url, secret, headers}
  is_active boolean DEFAULT true,
  last_used_at timestamp,
  created_at timestamp DEFAULT now()
);
```

**Müşteri portalı: `/hesabim/entegrasyonlar`**

```
Slack Entegrasyonu:
  [Slack'e Bağla →] — OAuth flow
  Hangi bildirimleri gönderelim?
  [✓] Kritik güvenlik uyarıları
  [✓] Haftalık skor özeti
  [✓] Yeni bulgu tespiti
  [ ] Fatura hatırlatmaları
  [ ] Rozet kazanıldığında
  Kanal: #siber-guvenlik
  [Test Gönder]

Teams Entegrasyonu:
  Webhook URL: [___________________]
  [Kaydet] [Test Et]
```

**Bildirim gönderici:**
```typescript
export async function sendSlackNotification(
  customerId: number,
  eventType: string,
  data: Record<string, unknown>
): Promise<void> {
  const integration = await getSlackIntegration(customerId);
  if (!integration?.isActive) return;

  const templates: Record<string, (d: unknown) => object> = {
    'critical_finding': (d: any) => ({
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '🚨 Kritik Güvenlik Uyarısı' }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Domain:* ${d.domain}` },
            { type: 'mrkdwn', text: `*Bulgu:* ${d.findingTitle}` },
            { type: 'mrkdwn', text: `*Ciddiyet:* ${d.severity}` },
            { type: 'mrkdwn', text: `*Risk:* ${d.riskDescription}` },
          ]
        },
        {
          type: 'actions',
          elements: [{
            type: 'button',
            text: { type: 'plain_text', text: 'Raporu Görüntüle →' },
            url: `${BASE_URL}/raporlarim/${d.reportId}`,
            style: 'primary'
          }]
        }
      ]
    }),

    'weekly_summary': (d: any) => ({
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '📊 Haftalık Güvenlik Özeti' }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${d.domain}* bu hafta:\n`
              + `• Güvenlik Skoru: *${d.score}/100* `
              + `(${d.scoreDiff > 0 ? '+' : ''}${d.scoreDiff})\n`
              + `• Açık Bulgu: *${d.openFindings}*\n`
              + `• Kapatılan: *${d.closedFindings}*`
          }
        }
      ]
    }),

    'new_finding': (d: any) => ({
      text: `🔍 *${d.domain}* — Yeni ${d.severity} bulgu: ${d.findingTitle}`,
      blocks: [{
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🔍 *Yeni Bulgu Tespit Edildi*\n`
            + `Domain: *${d.domain}*\n`
            + `Bulgu: *${d.findingTitle}*\n`
            + `Ciddiyet: *${d.severity}*`
        },
        accessory: {
          type: 'button',
          text: { type: 'plain_text', text: 'Detay' },
          url: `${BASE_URL}/raporlarim/${d.reportId}`
        }
      }]
    }),
  };

  const payload = templates[eventType]?.(data);
  if (!payload) return;

  await axios.post(integration.config.webhookUrl, payload);
  await db.update(customerIntegrations)
    .set({ lastUsedAt: new Date() })
    .where(eq(customerIntegrations.id, integration.id));
}
```

**`/api/portal/integrations` endpoint'leri ekle.**

---

## 2.2 OTOMATİK GÜVENLİK POLİTİKA ÜRETİCİ

```typescript
// Mevcut AI politika modülünü genişlet
// Sadece AI araçları değil, tüm güvenlik politikaları

const POLICY_TEMPLATES = [
  {
    slug: 'remote-work',
    name: 'Uzaktan Çalışma Güvenlik Politikası',
    description: 'Evden ve uzak lokasyonlarda çalışma güvenlik kuralları',
    price: 490,
    sections: ['VPN zorunluluğu', 'Kişisel cihaz kuralları',
                'Halka açık WiFi', 'Ekran kilidi', 'Veri aktarımı'],
  },
  {
    slug: 'password-policy',
    name: 'Parola ve Kimlik Doğrulama Politikası',
    description: 'Güçlü parola standartları ve 2FA gereksinimleri',
    price: 290,
    sections: ['Minimum gereksinimler', 'Yasak parolalar',
                '2FA zorunluluğu', 'Paylaşım yasakları', 'Değiştirme periyodu'],
  },
  {
    slug: 'byod',
    name: 'Kişisel Cihaz (BYOD) Kullanım Politikası',
    description: 'Çalışanların kişisel cihazlarını iş için kullanım kuralları',
    price: 390,
    sections: ['Kabul edilebilir cihazlar', 'Şirket verisi erişimi',
                'Güvenlik gereksinimleri', 'Veri silme prosedürü'],
  },
  {
    slug: 'data-classification',
    name: 'Veri Sınıflandırma Politikası',
    description: 'Şirket verilerinin kategorileri ve koruma gereksinimleri',
    price: 490,
    sections: ['Gizlilik seviyeleri', 'İşaretleme standartları',
                'Erişim kontrolleri', 'İmha prosedürleri', 'KVKK uyumu'],
  },
  {
    slug: 'incident-response',
    name: 'Siber Olay Müdahale Politikası',
    description: 'Siber saldırı ve veri ihlali durumunda acil eylem planı',
    price: 590,
    sections: ['Olay sınıflandırması', 'Müdahale ekibi', 'İletişim protokolü',
                'KVKK 72 saat bildirimi', 'Kurtarma adımları'],
  },
  {
    slug: 'social-media',
    name: 'Sosyal Medya Güvenlik Politikası',
    description: 'Şirket sosyal medya hesaplarının güvenli yönetimi',
    price: 290,
    sections: ['Hesap yönetimi', '2FA zorunluluğu', 'Paylaşım kuralları',
                'Şifre yönetimi', 'Yetkili kullanıcılar'],
  },
];
```

**Sayfa:** `/politika-olusturucu`

```
Güvenlik Politikası Kütüphanesi

6 Hazır Politika Şablonu — Claude AI ile şirketinize özel üretilir

[Uzaktan Çalışma]  [Parola]  [BYOD]
[Veri Sınıflandırma]  [Olay Müdahale]  [Sosyal Medya]

Seçilen: Uzaktan Çalışma Politikası — 490 TL
✓ Şirket adınıza özelleştirilmiş
✓ KVKK uyumlu
✓ Word (.docx) + PDF formatında teslim
✓ İmzalanmaya hazır

[Şimdi Oluştur →]
```

**Claude prompt'u:**
```typescript
const policyPrompt = (template, company) => `
Sen deneyimli bir KVKK uyum danışmanı ve siber güvenlik uzmanısın.
${company.companyName} şirketi için "${template.name}" belgesi hazırla.

Şirket Profili:
- Sektör: ${company.sector}
- Çalışan sayısı: ${company.employeeCount}
- Şehir: ${company.city}
- Kullandığı araçlar (varsa): ${company.tools?.join(', ')}

Politika şu bölümleri içermeli:
${template.sections.map((s, i) => `${i+1}. ${s}`).join('\n')}

Format gereksinimleri:
- Resmi belge formatı, numaralı maddeler
- Türkçe, anlaşılır dil (hukuki ama erişilebilir)
- Her bölüm: kural + gerekçe + ihlal durumunda prosedür
- Son bölüm: Yürürlük tarihi + imza alanları
- 400-600 kelime
- KVKK Madde 12 referansı (uygulanabilirse)

Sadece politika metnini döndür.
`;
```

**Çıktı:** DOCX + PDF, `/hesabim/politikalarim`'de saklanır, yıllık güncelleme servisiyle entegre.

---

## 2.3 VENDOR GÜVENLİK PUANLAMA SİSTEMİ

```typescript
// /araclar/vendor-guvenligi
// Satın alma kararı öncesi tedarikçi güvenlik kontrolü

// Form: Tedarikçi domain, satın alınmak istenen ürün/hizmet
// Çıktı: Güvenlik skoru + karar önerisi + detay rapor

const VENDOR_RISK_THRESHOLDS = {
  score: {
    safe: 70,      // Güvenle devam edin
    caution: 45,   // Dikkatli olun, ek sorular sorun
    risky: 0,      // Güvenlik koşullarını sözleşmeye ekleyin
  }
};

export async function assessVendor(
  vendorDomain: string,
  productType: string,
  dataShared: string[]
  // ['musteri_verisi', 'odeme_bilgisi', 'calisanlar', 'finansal']
): Promise<VendorAssessment> {

  // Domain taraması
  const scan = await runDomainScan(vendorDomain);

  // KVKK risk hesabı (paylaşılacak veriye göre)
  const kvkkRisk = calculateKVKKRisk(dataShared, scan);

  // Claude ile karar analizi
  const assessment = await claudeVendorAssessment(
    scan, productType, dataShared, kvkkRisk
  );

  return assessment;
}
```

**Çıktı format:**
```
Tedarikçi: acme-yazilim.com.tr

Genel Skor: 68/100 — DİKKATLİ OLUN 🟡

Önerilen Karar:
Devam edebilirsiniz, ancak aşağıdaki koşulları
sözleşmeye eklemenizi öneririz.

Güçlü Yönler:
✓ SSL sertifikası geçerli
✓ E-posta güvenliği yapılandırılmış
✓ Kara listede görünmüyor

Dikkat Gerektiren:
⚠️ SPF kaydı yapılandırılmamış
⚠️ 2 CVE tespit edildi (orta seviye)
⚠️ ISO 27001 belgesi bulunamadı

KVKK Notu:
Müşteri verisi paylaşacaksanız DPA sözleşmesi
imzalatmanız KVKK Madde 11 gereği zorunludur.

Sözleşmeye Eklenecek Maddeler (3 öneri):
[Claude tarafından üretilmiş]
```

---

## 2.4 FON BAŞVURUSU HAZIRLIK PAKETİ

```typescript
// /yatirim-paketi
// Startup'lar yatırım sürecinde güvenlik due diligence soruları geliyor

const INVESTOR_READY_PACKAGE = {
  name: 'CyberStep Yatırıma Hazırlık Paketi',
  price: 4900,
  deliverables: [
    'Kapsamlı güvenlik değerlendirme raporu (60 soru)',
    'Yönetici özeti (investor dili)',
    'Teknik güvenlik belgesi',
    'Güvenlik yol haritası (12 ay)',
    'CyberStep sertifikası',
    'KVKK uyum durumu',
    'Açıkların öncelik sıralaması',
  ]
};
```

**Landing page:** `/yatirim-paketi`

```
Yatırım Sürecinizde Güvenlik Due Diligence'ı Hazır mı?

Yatırımcılar artık teknik due diligence'da siber güvenlik
soruyor. CyberStep'in Yatırıma Hazırlık Paketi ile
tüm soruları tek raporda yanıtlayın.

"Veri güvenliğinizi nasıl yönetiyorsunuz?"
"KVKK uyumlu musunuz?"
"Güvenlik açıklarınızı nasıl takip ediyorsunuz?"

Paket içeriği: [liste]
Fiyat: 4.900 TL (tek seferlik)
Teslim: 24-48 saat

[Paketi Satın Al →]
```

**Claude prompt'u — investor raporu:**
```typescript
const investorReportPrompt = (assessment, company) => `
Sen bir startup güvenlik danışmanısın.
${company.name} için yatırımcılara sunulacak
güvenlik due diligence raporu hazırla.

Değerlendirme sonuçları:
${JSON.stringify(assessment)}

Rapor bölümleri:
1. EXECUTIVE SUMMARY (1 sayfa, yatırımcı dili)
   - Güvenlik olgunluk seviyesi
   - En kritik 3 bulgu ve durum
   - Önerilen yol haritası özeti

2. TEKNİK BULGULAR (teknik detay)
   - Domain güvenliği
   - Altyapı güvenliği
   - Veri koruma

3. KVKK UYUM DURUMU
   - Mevcut durum
   - Gerekli aksiyonlar
   - Risk tahmini

4. 12 AYLIK GÜVENLİK YOL HARİTASI
   - Q1, Q2, Q3, Q4 hedefleri
   - Tahmini maliyet

Dil: İngilizce (investor standart)
Format: Yapılandırılmış markdown
`;
```

---

## 2.5 SİBER GÜVENLİK EĞİTİM SERTİFİKASI

```sql
CREATE TABLE IF NOT EXISTS training_modules (
  id serial PRIMARY KEY,
  slug varchar(100) UNIQUE NOT NULL,
  title varchar(255) NOT NULL,
  description text,
  content jsonb,
  -- Array of slides: [{type: 'text'|'quiz', content: '...'}]
  question_count integer DEFAULT 5,
  pass_score integer DEFAULT 70,
  -- Geçme notu: %70
  duration_minutes integer DEFAULT 10,
  price_per_user_tl integer DEFAULT 1500,
  -- Kuruşla hesap: 1500 = 15.00 TL
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_enrollments (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  module_id integer REFERENCES training_modules(id),
  employee_name varchar(255),
  employee_email varchar(255),
  started_at timestamp DEFAULT now(),
  completed_at timestamp,
  score integer,
  -- 0-100
  passed boolean DEFAULT false,
  certificate_token varchar(64) UNIQUE,
  certificate_issued_at timestamp
);
```

**Modüller (başlangıç):**
1. Phishing ve Sosyal Mühendislik Farkındalığı (10 dk)
2. Güçlü Parola ve 2FA Kullanımı (8 dk)
3. KVKK Çalışan Yükümlülükleri (12 dk)
4. Uzaktan Çalışma Güvenliği (10 dk)
5. Yapay Zeka Araçları Güvenli Kullanımı (10 dk)

**Her modül:** 5-7 slayt (Claude üretimi) + 5 çoktan seçmeli soru + sertifika

**Sertifika sayfası:** `/sertifika/:token` (public doğrulama)
- QR kod
- Çalışan adı, modül adı, geçer tarih

**Admin:** Hangi çalışanlar tamamladı, hangileri bekliyor — tamamlanma raporu.
KVKK eğitim kanıtı olarak PDF export.

---

## 2.6 AI DESTEKLİ YARDIM MERKEZİ

```sql
CREATE TABLE IF NOT EXISTS help_articles (
  id serial PRIMARY KEY,
  slug varchar(255) UNIQUE NOT NULL,
  title varchar(255) NOT NULL,
  content text,
  category varchar(50),
  -- 'domain-scan' | 'kvkk' | 'billing' | 'technical' | 'getting-started'
  view_count integer DEFAULT 0,
  helpful_count integer DEFAULT 0,
  not_helpful_count integer DEFAULT 0,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  ticket_number varchar(20) UNIQUE NOT NULL,
  -- ST-2026-001
  subject varchar(255) NOT NULL,
  description text,
  category varchar(50),
  priority varchar(20) DEFAULT 'normal',
  status varchar(20) DEFAULT 'open',
  -- open | in_progress | resolved | closed
  ai_response text,
  -- Claude'un otomatik cevabı
  agent_response text,
  resolved_at timestamp,
  created_at timestamp DEFAULT now()
);
```

**Destek talebi akışı:**
```typescript
export async function handleSupportTicket(
  customerId: number,
  subject: string,
  description: string
): Promise<SupportTicket> {

  const customer = await getCustomer(customerId);
  const domainScan = await getLatestScan(customer.domain);

  // 1. Önce benzer help article var mı?
  const articles = await searchHelpArticles(subject);

  // 2. Claude ile kişiselleştirilmiş cevap üret
  const aiResponse = await callClaude(`
Sen CyberStep.io'nun destek uzmanısın.
Müşterinin sorunu: "${description}"

Müşteri bilgisi:
- Domain: ${customer.domain}
- Plan: ${customer.plan}
- Güvenlik skoru: ${domainScan?.overallScore}
- Aktif servisler: ${customer.activeServices?.join(', ')}

Bu sorunu çözecek kısa, net, adım adım rehber yaz.
Teknik terimleri Türkçe açıkla.
Eğer çözemeyeceksek bunu da belirt.
`);

  // 3. Ticket oluştur
  const ticket = await createTicket({
    customerId, subject, description,
    aiResponse,
    status: aiResponse.includes('çözemeyeceğiz')
      ? 'open' : 'resolved',
  });

  // 4. Müşteriye anlık e-posta (AI cevabıyla)
  await sendTicketConfirmation(ticket, customer);

  // 5. AI cevabı yetersizse admin'e bildirim
  if (ticket.status === 'open') {
    await notifyAdmin('new_support_ticket', ticket);
  }

  return ticket;
}
```

**Yardım merkezi sayfası:** `/yardim`
- Kategori bazlı makale listesi
- Arama (anlık)
- "Cevap bulamadım → Destek talebi aç" flow'u
- Müşteri portali `/hesabim/destek`'te ticketlarını görür

---

## 2.7 YILLIK GÜVENLİK RAPORU

```typescript
// Müşteri yıl dönümünde otomatik üretilir
// (ilk ödeme tarihinden tam 1 yıl sonra)

cron.schedule('0 9 * * *', async () => {
  const anniversaries = await findAnniversaryCustomers();
  // firstPaymentAt'ı tam 1 yıl önce olanlar

  for (const customer of anniversaries) {
    await generateAnnualReport(customer.id);
  }
});

export async function generateAnnualReport(
  customerId: number
): Promise<void> {

  const customer = await getCustomer(customerId);
  const scans = await getAllScans(customerId, { months: 12 });
  const closedFindings = await getClosedFindings(customerId, { months: 12 });
  const achievements = await getAchievements(customerId);

  const prompt = `
CyberStep müşterisinin 1 yıllık güvenlik yolculuğu raporunu
yönetim kuruluna sunulabilir formatta hazırla.

Veriler:
- Başlangıç skoru: ${scans[0]?.overallScore}
- Mevcut skor: ${scans[scans.length-1]?.overallScore}
- Kapatılan kritik bulgu: ${closedFindings.critical}
- Kapatılan toplam bulgu: ${closedFindings.total}
- Sektör sıralaması: ${customer.sectorPercentile}. yüzdelik
- Kazanılan rozetler: ${achievements.map(a => a.name).join(', ')}

Rapor şunları içermeli:
1. YÖNETİCİ ÖZETİ — "1 yılda ne başardınız?"
2. SKOR EVRİMİ — Aylık skor trendi + yorum
3. KAPATILANLAR — "Bu açıklar kapatılmamış olsaydı..." finansal etki
4. SEKTÖR KARŞILAŞTIRMA — Rakiplerinize göre neredesiniz?
5. ÖNÜMÜZDEK YIL — 3 öncelikli hedef

Ton: Kutlayıcı ama çözüm odaklı.
Format: Yönetim kuruluna sunulabilir, teknik olmayan dil.
`;

  const reportContent = await callClaude(prompt);
  const pdf = await generateAnnualReportPDF(reportContent, customer, scans);

  await sendAnnualReportEmail(customer, pdf);
}
```

**E-posta konu:** `🎉 CyberStep'le 1 Yıl — Güvenlik Yolculuğunuzun Özeti`

---

# SPRINT 3 — TEKNİK ALTYAPI (2-3 Hafta)

## 3.1 SSO (GOOGLE / MICROSOFT)

```typescript
// Passport.js ile OAuth2

// Google SSO
app.get('/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    hd: undefined // Tüm Google hesapları (iş + kişisel)
  })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/giris' }),
  async (req, res) => {
    const { email, displayName } = req.user.profile;
    await handleOAuthLogin(email, displayName, 'google');
    res.redirect('/hesabim');
  }
);

// Microsoft Azure AD
app.get('/auth/microsoft',
  passport.authenticate('microsoft', {
    scope: ['user.read', 'email']
  })
);

// Giriş sayfasına ekle:
// [Google ile Giriş Yap] [Microsoft ile Giriş Yap]
// ─────── veya ───────
// [E-posta ile Giriş Yap]
```

**Admin ayarlar:** SSO domain kısıtlaması
- "Sadece @acme.com.tr e-postalarına izin ver" seçeneği
- Kurumsal hesaplarda zorunlu SSO modu

---

## 3.2 VERİ DIŞA AKTARIM API'Sİ

```typescript
// Mevcut /v1/score/:domain endpoint'ine ek olarak:

// Müşterinin tüm tarama geçmişi
GET /api/v1/export/scans
  ?format=json|csv
  &from=2026-01-01
  &to=2026-12-31
  Authorization: Bearer [customer_api_key]

// Tüm bulgular
GET /api/v1/export/findings
  ?status=open|closed|all
  &severity=critical|high|medium|low
  &format=json|csv

// Belirli tarama detayı
GET /api/v1/export/scans/:scanId

// Webhook: Yeni bulgu gelince dışarıya push et
POST /api/v1/webhooks
  Body: { url, events: ['new_finding', 'score_change', 'report_ready'] }

// SIEM uyumlu CEF format çıktısı
GET /api/v1/export/siem/cef?scanId=xxx
```

**Admin:** Müşteri API key yönetimi
- Key oluştur, iptal et, kullanım istatistikleri
- IP whitelist seçeneği

---

## 3.3 ANOMALİ TESPİTİ

```typescript
// Kural tabanlı anomali tespiti (ML değil — başlangıç için yeterli)

export async function detectAnomalies(
  domain: string
): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];

  const current = await getCurrentScan(domain);
  const historical = await getHistoricalScans(domain, 30);
  // Son 30 günlük tarama geçmişi

  if (historical.length < 3) return []; // Yeterli veri yok

  // Anormallik 1: Skor ani düşüşü
  const avgScore = average(historical.map(s => s.overallScore));
  if (current.overallScore < avgScore - 15) {
    anomalies.push({
      type: 'score_drop',
      severity: 'high',
      message: `Güvenlik skoru normalin ${avgScore - current.overallScore} puan altına düştü`,
      data: { current: current.overallScore, average: avgScore }
    });
  }

  // Anormallik 2: Yeni port açıldı
  const prevPorts = historical[0]?.openPorts || [];
  const newPorts = current.openPorts?.filter(
    p => !prevPorts.includes(p)
  ) || [];
  const criticalPorts = [3389, 22, 445, 1433, 3306, 5432, 27017];
  const newCritical = newPorts.filter(p => criticalPorts.includes(p));
  if (newCritical.length > 0) {
    anomalies.push({
      type: 'new_critical_port',
      severity: 'critical',
      message: `Kritik port açıldı: ${newCritical.join(', ')}`,
      data: { ports: newCritical }
    });
  }

  // Anormallik 3: SSL yaklaşıyor
  if (current.sslDaysRemaining < 14) {
    anomalies.push({
      type: 'ssl_expiring',
      severity: current.sslDaysRemaining < 7 ? 'critical' : 'high',
      message: `SSL sertifikası ${current.sslDaysRemaining} gün sonra sona eriyor`,
      data: { days: current.sslDaysRemaining }
    });
  }

  // Anormallik 4: Kara listeye girme
  if (current.blacklisted && !historical[0]?.blacklisted) {
    anomalies.push({
      type: 'blacklisted',
      severity: 'critical',
      message: 'Domain kara listeye eklendi',
      data: { lists: current.blacklistSources }
    });
  }

  // Anormallik 5: Yeni sızıntı
  if (current.breachCount > (historical[0]?.breachCount || 0)) {
    anomalies.push({
      type: 'new_breach',
      severity: 'high',
      message: `Yeni veri sızıntısı tespit edildi`,
      data: { newBreaches: current.breachCount - historical[0].breachCount }
    });
  }

  return anomalies;
}

// Her tarama sonrası anomali kontrolü yap
// Anomali varsa → growth_trigger oluştur → e-posta/Slack gönder
```

---

## 3.4 MULTI-TENANT WHITE-LABEL ALTYAPISI

```sql
-- Tenant tablosu
CREATE TABLE IF NOT EXISTS tenants (
  id serial PRIMARY KEY,
  slug varchar(100) UNIQUE NOT NULL,
  -- 'turkcell' | 'isbank' | 'default'
  name varchar(255) NOT NULL,
  subdomain varchar(100) UNIQUE,
  -- turkcell.cyberstep.io
  custom_domain varchar(255),
  -- cyberkalkan.turkcell.com.tr

  -- Branding
  logo_url varchar(500),
  primary_color varchar(20) DEFAULT '#00C8FF',
  secondary_color varchar(20) DEFAULT '#060D1A',
  brand_name varchar(255) DEFAULT 'CyberStep',

  -- Özellik kontrolü
  features_enabled text[],
  -- ['domain-scan', 'ai-reports', 'kvkk'] — her tenant farklı özellik

  -- Fiyatlandırma
  pricing_override jsonb,
  -- null = default fiyatlar, dolu = özel fiyatlar

  -- Revenue share
  revenue_share_pct integer DEFAULT 0,
  -- CyberStep'in tenant'a ödeyeceği komisyon yüzdesi

  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now()
);

-- Her müşteri bir tenant'a bağlı
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_id
  integer REFERENCES tenants(id) DEFAULT 1;
  -- 1 = default (cyberstep.io)
```

**Middleware:**
```typescript
// Her request'te tenant'ı tespit et
app.use(async (req, res, next) => {
  const host = req.hostname;
  // turkcell.cyberstep.io → tenant: 'turkcell'
  // cyberstep.io → tenant: 'default'

  const tenant = await getTenantByDomain(host);
  req.tenant = tenant || defaultTenant;
  next();
});

// Frontend: tenant config'e göre logo, renk, brand adını göster
```

**Admin:** Tenant yönetimi — yeni tenant ekle, branding ayarla, özellik aç/kapat.

---

# SPRINT 4 — İŞ MODELİ (1-2 Hafta)

## 4.1 AFİLİATE PROGRAMI

```sql
CREATE TABLE IF NOT EXISTS affiliates (
  id serial PRIMARY KEY,
  name varchar(255) NOT NULL,
  email varchar(255) UNIQUE NOT NULL,
  affiliate_code varchar(20) UNIQUE NOT NULL,
  -- 'CYBERBLOG', 'TECHYTUBER'
  website_url varchar(500),
  audience_size varchar(50),
  -- 'under_1k' | '1k_10k' | '10k_plus'
  category varchar(50),
  -- 'blog' | 'youtube' | 'linkedin' | 'podcast' | 'newsletter'
  commission_pct integer DEFAULT 15,
  -- Default %15, VIP'lere %20-25
  status varchar(20) DEFAULT 'pending',
  -- pending | approved | suspended
  approved_at timestamp,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS affiliate_conversions (
  id serial PRIMARY KEY,
  affiliate_id integer REFERENCES affiliates(id),
  customer_id integer REFERENCES customers(id),
  order_amount_tl decimal(12,2),
  commission_tl decimal(12,2),
  status varchar(20) DEFAULT 'pending',
  -- pending | approved | paid
  conversion_at timestamp DEFAULT now(),
  paid_at timestamp
);
```

**Affiliate portal:** `/affiliate`
- Kayıt formu (admin onayı gerekli)
- Onaylanan affiliate: `/affiliate/panel`
  - Kendi linki: `cyberstep.io/?ref=CYBERBLOG`
  - Tıklama, dönüşüm, kazanç istatistikleri
  - Ödeme talebi

**Tracking:**
```typescript
// ?ref=AFFILIATE_CODE parametresini cookie'ye kaydet (30 gün)
// Ödeme yapıldığında cookie'den affiliate'i bul, komisyon hesapla
```

---

## 4.2 SERTİFİKA PAZAR YERİ

```sql
CREATE TABLE IF NOT EXISTS external_certifications (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers(id),
  cert_type varchar(50) NOT NULL,
  -- 'iso_27001' | 'soc2' | 'cyber_essentials' | 'kvkk_certified'
  cert_name varchar(255) NOT NULL,
  issuer varchar(255),
  issued_date date,
  expiry_date date,
  cert_number varchar(100),
  document_url varchar(500),
  -- Müşteri yükledi
  verified boolean DEFAULT false,
  -- Admin doğruladı
  verified_at timestamp,
  verified_by varchar(100),
  is_public boolean DEFAULT true,
  -- Rozetlerde gösterilsin mi
  created_at timestamp DEFAULT now()
);
```

**Müşteri portali:**
```
/hesabim/sertifikalar

Sertifikalarım:
[+ Sertifika Ekle]

CyberStep Sertifikaları (otomatik):
  ✅ CyberStep Standart Sertifikası — Aktif
  🔒 CyberStep Altın — Kilitli (skor 75+ gerekli)

Harici Sertifikalar:
  [ISO 27001 Belgesi Yükle]
  [TSE Belgesi Yükle]
  [Diğer]

Tüm sertifikalar şu sayfada doğrulanabilir:
cyberstep.io/verify/[token]
```

**Doğrulama sayfası** (`/verify/:token`) — hem CyberStep hem harici sertifikaları gösterir.

---

## 4.3 COĞRAFİ GENİŞLEME ALTYAPISI

```sql
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS country varchar(10) DEFAULT 'TR',
  ADD COLUMN IF NOT EXISTS language varchar(10) DEFAULT 'tr';

-- Dil dosyaları yapısı
-- src/i18n/tr.json (mevcut)
-- src/i18n/az.json (Azerbaycan Türkçesi)
-- src/i18n/kk.json (Kazakça — sonraki aşama)
```

**Azerbaycan lokalizasyonu:**
```typescript
// Türkçe → Azerbaycan Türkçesi fark minimal
// Değişmesi gereken terimler:
const AZ_OVERRIDES = {
  'şirket': 'şirkət',
  'şirketiniz': 'şirkətiniz',
  'değerlendirme': 'qiymətləndirmə',
  'güvenlik': 'təhlükəsizlik',
  'rapor': 'hesabat',
  'fiyat': 'qiymət',
  'ödeme': 'ödəniş',
};

// Para birimi: AZN (Azerbaycan Manatı)
// KVKK yerine: PDPL (Personal Data Protection Law Azerbaijan)
```

**Landing page:** `az.cyberstep.io`
- Azerbaycan Türkçesi
- AZN fiyatlandırma
- Bakü odaklı içerik

---

# SPRINT 5 — MOBİL UYGULAMA (Ayrı Proje)

## 5.1 React Native Mobil Uygulama

**Bu sprint mevcut Replit projesinden bağımsız — yeni repo gerektirir.**

```
Uygulama adı: CyberStep
Platform: iOS + Android (React Native + Expo)

Ana ekranlar:
1. Dashboard — domain skoru, son tarama, aktif uyarılar
2. Raporlar — tüm tarama raporları, PDF görüntüleme
3. Uyarılar — push notification merkezi
4. ISR (Satış Ekibi) — pipeline, görevler, müşteri kartları
5. Profil — hesap ayarları, bildirim tercihleri

Push Notifications (Firebase):
- Kritik bulgu tespiti
- Skor değişimi
- Görev hatırlatıcısı
- Fatura ödeme hatırlatıcısı
- Yeni teaser CTA

API Bağlantısı:
- Mevcut CyberStep API'sine bağlanır
- JWT token ile auth
- Offline mod: son tarama sonuçları cache'lenir

Ayrı Replit oturumunda şu prompt ile başla:
"Create a React Native + Expo mobile app for CyberStep.io.
 The app connects to the existing Express API at [API_URL].
 Authentication via JWT tokens stored in SecureStore..."
```

---

## TÜM SPRINT ÖZETİ

```
SPRINT 1 (Bu hafta — Hızlı Kazanımlar):
  ✓ Status page (status.cyberstep.io)
  ✓ Kariyer sayfası
  ✓ Onboarding tamamlama skoru
  ✓ Başarı rozeti sistemi
  ✓ SEO araç sayfaları (/araclar/*)

SPRINT 2 (Sonraki 2 hafta — Orta Komplekslik):
  ✓ Slack / Teams entegrasyonu
  ✓ Güvenlik politika üretici (6 şablon)
  ✓ Vendor güvenlik puanlama
  ✓ Fon başvurusu hazırlık paketi (4.900 TL)
  ✓ Eğitim sertifikası sistemi
  ✓ AI destekli yardım merkezi
  ✓ Yıllık güvenlik raporu

SPRINT 3 (Teknik Altyapı):
  ✓ SSO (Google + Microsoft)
  ✓ Veri dışa aktarım API'si
  ✓ Anomali tespiti (kural tabanlı)
  ✓ Multi-tenant white-label altyapısı

SPRINT 4 (İş Modeli):
  ✓ Affiliate programı
  ✓ Sertifika pazar yeri
  ✓ Coğrafi genişleme (Azerbaycan)

SPRINT 5 (Ayrı Proje):
  ✓ React Native mobil uygulama
```

---

## TAHMİNİ GELİR ETKİSİ

```
Özellik                      Aylık Tahmini Ek Gelir
───────────────────────────────────────────────────
Politika üretici              ₺15.000 - 40.000
Fon hazırlık paketi           ₺10.000 - 25.000
Eğitim sertifikası            ₺8.000  - 20.000
Vendor puanlama               ₺5.000  - 15.000
Affiliate (7. aydan)          ₺20.000 - 60.000
White-label (telko)           ₺100.000+ (anlaşmaya göre)
```

---

*CyberStep.io Genişletilmiş Özellikler — Mayıs 2026*
