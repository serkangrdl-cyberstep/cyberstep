# CyberStep.io — Proaktif Kurumsal Satış + Sözleşme Yönetimi
## Replit Agent Promptu

---

## GENEL BAKIŞ

Bu modül üç bileşenden oluşur:

1. **Proaktif Tarama Motoru** — Satış ekibi aday domain'leri tarar,
   Claude AI saldırı senaryosu çalıştırır, teaser rapor üretir.

2. **Teaser Rapor & E-posta** — Aday şirkete "1 kritik, 2 orta tehdit
   bulundu" formatında kısmi rapor gönderilir. Detaylar kilitli.
   Benzersiz token'lı önizleme sayfası.

3. **Kurumsal Sözleşme Yönetimi** — Kredi kartı yok. Sözleşme imzalanır,
   admin panelinden servisler aktive edilir, müşteri kendi portalında
   aktif servislerini görür.

Existing stack: Node.js + Express + TypeScript + PostgreSQL + Drizzle ORM
+ React + shadcn/ui. ISR modülü (CRM) zaten mevcut — extend edilecek.

---

## BÖLÜM 1: VERİTABANI

```sql
-- ─────────────────────────────────────────────────────
-- 1. Aday (Prospect) tablosu
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enterprise_prospects (
  id serial PRIMARY KEY,

  -- Şirket bilgisi
  company_name     varchar(255) NOT NULL,
  domain           varchar(255) NOT NULL,
  sector           varchar(100),
  employee_count   varchar(50),
  city             varchar(100),

  -- İletişim
  contact_name     varchar(255),
  contact_title    varchar(100),
  contact_email    varchar(255),
  contact_phone    varchar(50),
  linkedin_url     varchar(500),

  -- Kaynak
  source           varchar(50) DEFAULT 'manual',
  -- 'manual' | 'linkedin' | 'referral' | 'event' | 'inbound'
  assigned_to      varchar(100),
  -- Satış ekibi üyesi

  -- Durum
  status           varchar(30) DEFAULT 'new',
  -- new | scanned | teaser_sent | teaser_viewed | demo_requested
  -- | proposal_sent | contract_sent | won | lost | no_response

  -- Notlar
  notes            text,
  lost_reason      varchar(255),

  created_at       timestamp DEFAULT now(),
  last_activity_at timestamp DEFAULT now()
);

-- ─────────────────────────────────────────────────────
-- 2. Teaser Rapor tablosu
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teaser_reports (
  id serial PRIMARY KEY,
  prospect_id      integer REFERENCES enterprise_prospects(id),

  -- Tarama sonuçları (ham)
  domain_scan_data jsonb,
  -- CyberStep domain scan full output

  -- AI saldırı senaryosu
  attack_scenarios jsonb,
  -- Claude'dan gelen 3 senaryo (tam)

  -- Teaser içerik (müşteriye gösterilecek kısım)
  overall_risk_score   integer,
  -- 0-100
  risk_level       varchar(20),
  -- KRİTİK | YÜKSEK | ORTA | DÜŞÜK

  critical_count   integer DEFAULT 0,
  high_count       integer DEFAULT 0,
  medium_count     integer DEFAULT 0,
  low_count        integer DEFAULT 0,

  -- Teaser'da gösterilen (kilitli detaylar hariç)
  teaser_headline  text,
  -- "acme.com.tr'de fidye yazılımı giriş riski tespit edildi"

  teaser_findings  jsonb,
  -- [{ title, severity, locked: true/false }]
  -- İlk 1 kritik: locked=false (başlık görünür)
  -- Geri kalanlar: locked=true (sadece sayı görünür)

  teaser_scenario_preview text,
  -- Saldırı senaryosunun ilk 2 cümlesi (geri kalanı kilitli)

  -- Token & takip
  preview_token    varchar(64) UNIQUE NOT NULL,
  -- URL: cyberstep.io/preview/:token

  -- E-posta durumu
  email_sent_at    timestamp,
  email_opened_at  timestamp,
  preview_viewed_at timestamp,
  cta_clicked_at   timestamp,
  -- "Tam raporu talep et" tıklandı mı

  -- Takip
  followup_1_sent_at timestamp,
  -- 3 gün sonra otomatik
  followup_2_sent_at timestamp,
  -- 7 gün sonra otomatik

  -- Admin kontrolü
  approved_by      varchar(100),
  -- Göndermeden önce kim onayladı
  approved_at      timestamp,
  status           varchar(20) DEFAULT 'draft',
  -- draft | approved | sent | viewed | cta_clicked | converted

  created_at       timestamp DEFAULT now()
);

-- ─────────────────────────────────────────────────────
-- 3. Kurumsal Sözleşme tablosu
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enterprise_contracts (
  id serial PRIMARY KEY,

  -- Bağlantılar
  prospect_id      integer REFERENCES enterprise_prospects(id),
  customer_id      integer REFERENCES customers(id),
  -- customer_id: müşteri portala erişim kazanınca oluşturulur

  -- Sözleşme kimliği
  contract_number  varchar(30) UNIQUE NOT NULL,
  -- Örnek: CS-2026-0001 (otomatik üretilir)

  -- Şirket bilgisi (sözleşme anındaki snapshot)
  company_name     varchar(255) NOT NULL,
  company_tax_id   varchar(50),
  -- Vergi no
  company_tax_office varchar(100),
  company_address  text,
  billing_contact_name  varchar(255),
  billing_contact_email varchar(255),

  -- Sözleşme detayları
  contract_type    varchar(30) DEFAULT 'annual',
  -- 'monthly' | 'annual' | 'one_time' | 'multi_year'

  billing_cycle    varchar(20) DEFAULT 'annual',
  -- 'monthly' | 'annual' | 'upfront'

  payment_method   varchar(30) DEFAULT 'bank_transfer',
  -- 'bank_transfer' | 'check' | 'credit_card_corporate'

  payment_terms    integer DEFAULT 30,
  -- Kaç günde ödeme: 15, 30, 45, 60

  -- Tarihler
  start_date       date NOT NULL,
  end_date         date,
  -- null = otomatik yenileme

  -- Para
  total_amount_tl  decimal(12,2),
  -- KDV hariç toplam
  discount_pct     integer DEFAULT 0,
  -- Yüzde indirim
  discount_reason  varchar(255),

  -- Durum
  status           varchar(30) DEFAULT 'draft',
  -- draft | sent | negotiating | signed | active | suspended | expired | cancelled

  -- İmza
  sent_at          timestamp,
  signed_at        timestamp,
  signed_by        varchar(255),
  -- Müşteri tarafından imzalayan kişi adı

  -- Aktivasyon
  activated_at     timestamp,
  activated_by     varchar(100),
  -- Admin adı

  -- Doküman
  contract_pdf_path varchar(500),
  signed_pdf_path   varchar(500),

  -- Notlar
  internal_notes   text,
  -- Müşteriye gösterilmez

  created_by       varchar(100),
  created_at       timestamp DEFAULT now(),
  updated_at       timestamp DEFAULT now()
);

-- ─────────────────────────────────────────────────────
-- 4. Sözleşme Kalemleri (satın alınan servisler)
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enterprise_contract_services (
  id serial PRIMARY KEY,
  contract_id      integer REFERENCES enterprise_contracts(id),

  -- Servis tanımı
  service_slug     varchar(100) NOT NULL,
  -- 'domain-tarama' | 'tam-degerlendirme' | 'ai-guvenlik' |
  -- 'eu-ai-act' | 'sanal-ciso' | 'ai-arac-izleme' | vs.
  service_name     varchar(255) NOT NULL,
  -- "Tam Güvenlik Değerlendirmesi"

  -- Fiyat
  unit_price_tl    decimal(10,2) NOT NULL,
  quantity         integer DEFAULT 1,
  -- Örn: 12 (aylık servis için 12 ay)
  line_total_tl    decimal(10,2) NOT NULL,
  -- unit_price × quantity

  -- Aktivasyon
  is_active        boolean DEFAULT false,
  activated_at     timestamp,
  expires_at       timestamp,

  -- Kullanım limitleri (varsa)
  usage_limit      integer,
  -- Örn: 100 domain scan / ay
  usage_count      integer DEFAULT 0,

  notes            varchar(500),
  created_at       timestamp DEFAULT now()
);

-- ─────────────────────────────────────────────────────
-- 5. Fatura tablosu
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enterprise_invoices (
  id serial PRIMARY KEY,
  contract_id      integer REFERENCES enterprise_contracts(id),
  customer_id      integer REFERENCES customers(id),

  invoice_number   varchar(30) UNIQUE NOT NULL,
  -- CS-INV-2026-0001

  period_start     date,
  period_end       date,

  subtotal_tl      decimal(12,2),
  vat_rate         integer DEFAULT 20,
  vat_amount_tl    decimal(12,2),
  total_tl         decimal(12,2),

  due_date         date,
  paid_at          timestamp,
  paid_amount_tl   decimal(12,2),

  status           varchar(20) DEFAULT 'pending',
  -- pending | sent | paid | overdue | cancelled

  pdf_path         varchar(500),
  created_at       timestamp DEFAULT now()
);
```

---

## BÖLÜM 2: API ROTALARI

```
─── TEASER / PROAKTIF TARAMA ───────────────────────────────

POST /api/enterprise/prospects
     Yeni aday ekle

GET  /api/enterprise/prospects
     Liste (filtre: status, assigned_to, sector)

GET  /api/enterprise/prospects/:id
     Aday detayı

PUT  /api/enterprise/prospects/:id
     Güncelle (status, notlar, iletişim)

POST /api/enterprise/prospects/:id/scan
     Domain tara + AI saldırı senaryosu çalıştır
     → Arka planda: domain scan + Claude → teaser_reports kaydı
     → Status: 'scanned'

GET  /api/enterprise/prospects/:id/teaser
     Teaser raporu getir (admin preview)

POST /api/enterprise/prospects/:id/teaser/approve
     Teaser'ı onayla (gönderime hazır)
     Body: { approvedBy: "Ad Soyad" }

POST /api/enterprise/prospects/:id/teaser/send
     Teaser e-postasını gönder
     → email_sent_at set et, status: 'teaser_sent'

─── TEASER ÖNIZLEME (PUBLIC, AUTH YOK) ─────────────────────

GET  /api/preview/:token
     Teaser raporu getir (sadece kilit açık kısımlar)
     → preview_viewed_at set et

POST /api/preview/:token/cta
     "Tam raporu talep et" tıklandı
     → cta_clicked_at set et, status: 'cta_clicked'
     Body: { name, email, phone, message }
     → Admin'e bildirim

─── KURUMSAL SÖZLEŞME ──────────────────────────────────────

POST /api/enterprise/contracts
     Yeni sözleşme oluştur

GET  /api/enterprise/contracts
     Liste

GET  /api/enterprise/contracts/:id
     Detay (servisler dahil)

PUT  /api/enterprise/contracts/:id
     Güncelle

POST /api/enterprise/contracts/:id/send
     Sözleşmeyi müşteriye gönder (e-posta + PDF)

POST /api/enterprise/contracts/:id/sign
     Sözleşmeyi imzalı olarak işaretle
     Body: { signedBy, signedAt }

POST /api/enterprise/contracts/:id/activate
     Sözleşmeyi aktive et → servisleri aç
     → Müşteri hesabı oluştur (yoksa)
     → Tüm contract_services.is_active = true
     → Müşteriye "Servisleriniz aktif" e-postası

POST /api/enterprise/contracts/:id/services/:serviceId/activate
     Tek servisi aktive et (kısmi aktivasyon)

POST /api/enterprise/contracts/:id/invoice
     Fatura oluştur

─── MÜŞTERİ PORTAL ─────────────────────────────────────────

GET  /api/portal/my-services
     Müşterinin aktif servislerini getir
     (enterprise_contract_services'dan)

GET  /api/portal/my-contracts
     Müşterinin sözleşmelerini getir

GET  /api/portal/my-invoices
     Müşterinin faturalarını getir

─── ADMIN ──────────────────────────────────────────────────

GET  /api/admin/enterprise/pipeline
     Satış pipeline özeti
     { newCount, scannedCount, teaserSentCount, wonCount, ... }

GET  /api/admin/enterprise/mrr
     Aylık yinelenen gelir (aktif sözleşmelerden)
```

---

## BÖLÜM 3: CLAUDE AI — TEASER RAPOR PROMPTU

```typescript
export async function generateTeaserReport(
  domainScanData: DomainScanResult,
  companyName: string,
  domain: string,
  sector: string
): Promise<TeaserReportContent> {

  const prompt = `
Sen CyberStep.io'nun kıdemli siber güvenlik analistiydin.
${companyName} (${domain}) şirketinin domain tarama sonuçlarını
analiz ediyorsun.

TARAMA VERİLERİ:
${JSON.stringify(domainScanData, null, 2)}

ŞİRKET SEKTÖRÜ: ${sector}

İKİ ÇIKTI ÜRETECEKSİN:

─────────────────────────────────────────
ÇIKTI 1: TEASER RAPOR (müşteriye gösterilecek kısmi rapor)
─────────────────────────────────────────
Bu raporun amacı: Yeterince ciddi ama detaysız.
"Tehlike var, ama tam olarak ne olduğunu görmek için
tam raporu satın alman gerekiyor" hissi yaratacak.

JSON formatında döndür:
{
  "overall_score": 0-100,
  "risk_level": "KRİTİK|YÜKSEK|ORTA|DÜŞÜK",
  "headline": "Tek cümle. Örnek: acme.com.tr''de aktif fidye
               yazılımı giriş vektörü tespit edildi.",
  "findings": [
    {
      "title": "Bulgu başlığı (kısa, merak uyandıran)",
      "severity": "critical|high|medium|low",
      "locked": false,
      "preview_text": "1 cümle — detay yok, merak uyandır"
    },
    {
      "title": "Yalnızca başlık gösterilir",
      "severity": "high",
      "locked": true,
      "preview_text": null
    }
  ],
  "attack_scenario_preview": "Saldırı senaryosunun ilk 2 cümlesi.
    Dramayı hissettir ama çözümü verme. Tam saldırı anlatısı
    yalnızca ücretli raporda.",
  "locked_sections_hint": "Bu raporda X kritik, Y orta seviye
    bulgu daha ve 3 saldırı senaryosunun tamamı kilitli.",
  "urgency_note": "Bu açıkların aktif saldırılarda kullanılma
    olasılığı — 1 cümle, somut, gerçekçi"
}

KURAL: İlk 1 kritik veya yüksek bulgu locked=false.
Diğerleri hepsi locked=true.

─────────────────────────────────────────
ÇIKTI 2: TAM SALDIRI SENARYOLARI (admin için, müşteriye gönderilmez)
─────────────────────────────────────────
3 farklı saldırı senaryosu. Her biri:
{
  "scenario_type": "ransomware|ceo_fraud|data_breach|...",
  "title": "Senaryo başlığı",
  "narrative": "Saldırı nasıl gerçekleşirdi — 5-6 cümle,
    şirkete özgü veriler kullanarak. Patron dili.",
  "entry_point": "Saldırganın kullandığı giriş noktası",
  "potential_damage_tl": 0,
  "mitre_technique": "T1xxx",
  "prevention": "Bu senaryoyu engelleyecek tek aksiyon"
}

TOPLAM JSON ÇIKTISI:
{
  "teaser": { ...teaser rapor... },
  "full_scenarios": [ ...3 senaryo... ]
}

Sadece JSON döndür.
`;

  const response = await callClaude(prompt, 'claude-sonnet-4-20250514');
  return JSON.parse(response);
}
```

---

## BÖLÜM 4: TEASER E-POSTA ŞABLONu

Subject: `⚠️ [Domain] için güvenlik uyarısı — CyberStep.io`

```html
<!-- Gönderen: CyberStep Güvenlik Ekibi <security@cyberstep.io> -->

Sayın [İletişim Adı],

[Şirket Adı] ([domain]) üzerinde gerçekleştirdiğimiz
dış güvenlik taramasında dikkat gerektiren bulgular tespit ettik.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Güvenlik Skoru: [overall_score]/100
  Risk Seviyesi:  [risk_level badge]

  ● [locked=false bulgunun başlığı]

  🔒 [critical_count] kritik bulgu daha
  🔒 [high_count] yüksek seviye bulgu
  🔒 3 saldırı senaryosu

  [attack_scenario_preview...]
  — devamı kilitli —
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Bu bulgular kamuya açık kaynaklardan elde edilmiştir.
Tam rapor; tüm teknik detayları, saldırı senaryolarını,
KVKK risk analizini ve öncelikli aksiyon planını içermektedir.

[Tam Raporu Görüntüle →]
cyberstep.io/preview/[token]

Raporu incelemenizi ve ardından bir görüşme ayarlamamızı
öneririm.

Saygılarımla,
[Assigned_to adı]
CyberStep.io Güvenlik Ekibi
security@cyberstep.io

─────────────────────────────────────
Bu e-posta [domain] domaininin kamuya açık
güvenlik taramasına dayanmaktadır.
Herhangi bir sisteminize yetkisiz erişim yapılmamıştır.
```

---

## BÖLÜM 5: TEASER ÖNİZLEME SAYFASI (/preview/:token)

```tsx
// src/pages/PreviewPage.tsx
// PUBLIC — auth yok, token ile erişim

export default function PreviewPage() {
  const { token } = useParams();
  const { data: report, isLoading } = useQuery({
    queryKey: ['preview', token],
    queryFn: () => api.get(`/preview/${token}`)
  });

  // CTA form state
  const [showForm, setShowForm] = useState(false);

  if (isLoading) return <LoadingScreen />;
  if (!report) return <NotFoundScreen />;

  return (
    <div className="preview-page dark-theme">

      {/* Header — CyberStep branding */}
      <PreviewHeader domain={report.domain} />

      {/* Risk Skoru */}
      <RiskScoreCard
        score={report.overall_score}
        level={report.risk_level}
        headline={report.teaser_headline}
      />

      {/* Bulgular listesi */}
      <FindingsList findings={report.teaser_findings} />
      {/* locked=false olan gösterilir, locked=true olanlar
          bulanık/kilitli görünür:
          "🔒 Bu bulgunun detayları kilitli" */}

      {/* Saldırı Senaryosu önizleme */}
      <AttackPreview
        preview={report.attack_scenario_preview}
        lockedHint={report.locked_sections_hint}
      />

      {/* Aciliyet notu */}
      <UrgencyNote text={report.urgency_note} />

      {/* CTA Bloku */}
      <div className="cta-block">
        <h2>Tam raporu alın, tüm bulgular açılsın</h2>
        <p>
          Teknik detaylar, 3 saldırı senaryosunun tamamı,
          KVKK risk analizi ve öncelikli aksiyon planı.
        </p>

        {!showForm ? (
          <button
            onClick={() => {
              setShowForm(true);
              api.post(`/preview/${token}/cta`);
            }}
            className="cta-primary"
          >
            Tam Raporu Talep Et →
          </button>
        ) : (
          <CTAForm token={token} />
        )}
      </div>

      {/* Footer notu */}
      <PreviewFooter domain={report.domain} />
    </div>
  );
}

// CTA Form: isim, e-posta, telefon, mesaj
// Submit → API'ye gönder → admin'e bildirim
function CTAForm({ token }) {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', message: ''
  });

  const handleSubmit = async () => {
    await api.post(`/preview/${token}/cta`, form);
    // Show success: "Talebiniz alındı, 24 saat içinde dönüş yapacağız"
  };

  return (
    <form onSubmit={handleSubmit}>
      <input placeholder="Ad Soyad *" required />
      <input placeholder="E-posta *" type="email" required />
      <input placeholder="Telefon" />
      <textarea placeholder="Mesajınız (isteğe bağlı)" />
      <button type="submit">Gönder →</button>
    </form>
  );
}
```

---

## BÖLÜM 6: ADMİN PANELİ — ENTERPRISE MODÜLÜ

### 6.1 Sol Menüye "Enterprise" Bölümü Ekle

```
Mevcut admin menüsüne ekle:
─── Enterprise ─────────
  Adaylar (Prospects)
  Pipeline Görünümü
  Sözleşmeler
  Faturalar
  MRR Raporu
────────────────────────
```

### 6.2 Adaylar Sayfası (/admin-panel/enterprise/prospects)

```
Üst kısım — pipeline sayaçları:
┌─────────┬──────────┬───────────┬──────────┬───────┐
│  Yeni   │ Tarandı  │  Gönderildi│ İlgilendi│  Won  │
│    12   │    8     │     15    │    4     │   2   │
└─────────┴──────────┴───────────┴──────────┴───────┘

"+ Yeni Aday Ekle" butonu → Modal form

Tablo sütunları:
Şirket | Domain | Sektör | Durum | Tarama | Son Aktivite | Atanan | Aksiyonlar

Aksiyonlar:
[Tara] — domain scan + AI scenario başlat
[Teaser'ı Gör] — önizleme
[Onayla & Gönder] — onay + e-posta gönderimi
[Sözleşme Oluştur] — kazanılmış aday için
```

### 6.3 Tarama Modalı

Satış ekibi "Tara" butonuna tıklayınca modal açılır:

```
"[Domain] Taranıyor..."

Adımlar (canlı güncelleme):
✅ Domain taraması başlatıldı
✅ 12 güvenlik modülü çalıştırıldı
✅ Claude AI saldırı senaryoları üretiliyor...
✅ Teaser rapor hazırlandı

[Teaser'ı Önizle →] butonu çıkar
```

### 6.4 Teaser Onay & Gönderim Ekranı

```
Üst kısım: Teaser rapor önizlemesi (müşteri görecek şekilde)

Sol panel — Tam bulgular (sadece admin görür):
- Tüm domain scan sonuçları
- 3 tam saldırı senaryosu

Sağ panel — Gönderim:
Alıcı e-posta: [contact_email]
Gönderen: security@cyberstep.io
Konu: otomatik doldurulur

E-posta önizleme butonu

[Onayla ve Gönder] — primary
[Sadece Kaydet] — draft olarak bırak
```

### 6.5 Sözleşme Oluşturma Sayfası

```
/admin-panel/enterprise/contracts/new

Form bölümleri:

1. MÜŞTERİ BİLGİSİ
   Prospect seç veya yeni bilgi gir
   Vergi no, adres, yetkili kişi

2. SÖZLEŞME TÜRÜ
   ◉ Yıllık  ○ Aylık  ○ Çok Yıllık  ○ Tek Seferlik
   Başlangıç tarihi: [tarih]
   Bitiş tarihi: [tarih] / Otomatik yenileme

3. SERVİS KALEMLERİ
   + Servis Ekle butonu → Servis kataloğundan seç

   Servis tablosu:
   ┌──────────────────────────┬────────┬────┬──────────┐
   │ Servis Adı               │ Birim  │ Ad │ Tutar    │
   ├──────────────────────────┼────────┼────┼──────────┤
   │ Tam Güvenlik Değer.      │5.990 TL│  1 │  5.990 TL│
   │ AI Araç İzleme (yıllık)  │5.880 TL│  1 │  5.880 TL│
   │ Sanal CISO               │8.000 TL│ 12 │ 96.000 TL│
   └──────────────────────────┴────────┴────┴──────────┘

   İndirim: [%  ] → Sebep: [_________]

   ─────────────────────────────
   Ara Toplam:    107.870 TL
   İndirim (%10):  -10.787 TL
   KDV (%20):      19.417 TL
   TOPLAM:        116.500 TL
   ─────────────────────────────

4. ÖDEME KOŞULLARI
   Ödeme yöntemi: ◉ Banka Havalesi  ○ Çek
   Vade: ◉ 30 gün  ○ 15 gün  ○ 45 gün  ○ 60 gün

5. NOTLAR (İç kullanım)

[PDF Önizle] [Taslak Kaydet] [Müşteriye Gönder]
```

### 6.6 Sözleşme Aktivasyon Ekranı

```
Sözleşme imzalandıktan sonra admin bu ekranı açar:

Sözleşme #CS-2026-0001 — Acme Tekstil A.Ş.
Durum: İmzalandı ✅  |  Aktivasyon: Bekliyor ⏳

Servisler:
┌─────────────────────────────┬──────────┬──────────┐
│ Servis                      │ Durum    │ Aksiyon  │
├─────────────────────────────┼──────────┼──────────┤
│ Tam Güvenlik Değerlendirmesi │ Bekliyor │ [Aktive] │
│ AI Araç İzleme               │ Bekliyor │ [Aktive] │
│ Sanal CISO                  │ Bekliyor │ [Aktive] │
└─────────────────────────────┴──────────┴──────────┘

[Tüm Servisleri Aktive Et] — büyük yeşil buton

Müşteri portal erişimi:
E-posta: [contact_email]
[Müşteri Hesabı Oluştur & Davet Gönder]
```

---

## BÖLÜM 7: MÜŞTERİ PORTALI — ENTERPRISE GÖRÜNÜMÜ

Mevcut `/hesabim` sayfasına enterprise görünümü ekle.
Müşterinin sözleşmesi varsa farklı bir dashboard göster:

```tsx
// Müşteri enterprise ise göster:

<EnterprisePortalDashboard>

  {/* Aktif Sözleşme Kartı */}
  <ContractCard
    contractNumber="CS-2026-0001"
    status="active"
    validUntil="31.12.2026"
    autoRenew={true}
  />

  {/* Aktif Servisler */}
  <h2>Aktif Servisleriniz</h2>
  <ServiceGrid services={activeServices} />
  {/*
    Her kart:
    ┌──────────────────────────────┐
    │ 🛡️ Tam Güvenlik Değer.      │
    │ ✅ Aktif                     │
    │ Kullanım: 2/1               │
    │ Geçerlilik: 31.12.2026       │
    │ [Raporu Görüntüle →]         │
    └──────────────────────────────┘
  */}

  {/* Faturalar */}
  <InvoiceList invoices={invoices} />
  {/*
    Her satır: Fatura no | Dönem | Tutar | Durum | İndir
  */}

  {/* Servis Ekleme */}
  <AddServiceCTA
    text="Yeni servis eklemek ister misiniz?"
    ctaText="Servis Talebi Oluştur"
    // → Admin'e bildirim gönderir, yeni sözleşme eki başlatır
  />

</EnterprisePortalDashboard>
```

---

## BÖLÜM 8: OTOMATIK TAKİP (CRON JOBS)

```typescript
// Teaser gönderilmiş ama 3 gün içinde görüntülenmemiş → takip
cron.schedule('0 09:00 * * *', async () => {
  const noResponse = await db
    .select()
    .from(teaserReports)
    .where(
      and(
        eq(teaserReports.status, 'sent'),
        isNull(teaserReports.previewViewedAt),
        lt(teaserReports.emailSentAt,
           new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)),
        isNull(teaserReports.followup1SentAt)
      )
    );

  for (const report of noResponse) {
    await sendFollowupEmail(report, 1);
    await db.update(teaserReports)
      .set({ followup1SentAt: new Date() })
      .where(eq(teaserReports.id, report.id));
  }
});

// Görüntülenmiş ama 7 gün içinde CTA tıklanmamış → 2. takip
cron.schedule('0 09:30 * * *', async () => {
  const viewedNoAction = await db
    .select()
    .from(teaserReports)
    .where(
      and(
        eq(teaserReports.status, 'viewed'),
        isNull(teaserReports.ctaClickedAt),
        isNotNull(teaserReports.previewViewedAt),
        lt(teaserReports.previewViewedAt,
           new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
        isNull(teaserReports.followup2SentAt)
      )
    );

  for (const report of viewedNoAction) {
    await sendFollowupEmail(report, 2);
    await db.update(teaserReports)
      .set({ followup2SentAt: new Date() })
      .where(eq(teaserReports.id, report.id));
  }
});

// Sözleşme bitimine 30 gün kala yenileme hatırlatıcısı
cron.schedule('0 08:00 * * *', async () => {
  const expiring = await db
    .select()
    .from(enterpriseContracts)
    .where(
      and(
        eq(enterpriseContracts.status, 'active'),
        between(
          enterpriseContracts.endDate,
          new Date(),
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        )
      )
    );

  for (const contract of expiring) {
    await sendRenewalReminder(contract);
    await sendAdminRenewalAlert(contract);
  }
});
```

---

## BÖLÜM 9: SERVİS KATALOĞU SABİTİ

```typescript
// src/constants/serviceCatalog.ts
// Sözleşme oluşturma formunda "Servis Ekle" dropdown'unun kaynağı

export const SERVICE_CATALOG = [
  // Değerlendirmeler
  { slug: 'mini-degerlendirme',     name: 'Mini Güvenlik Değerlendirmesi',   unitPrice: 0,      billingType: 'one_time' },
  { slug: 'tam-degerlendirme',      name: 'Tam Güvenlik Değerlendirmesi',    unitPrice: 5990,   billingType: 'one_time' },
  { slug: 'premium-danismanlik',    name: 'Premium Danışmanlık Paketi',      unitPrice: 17990,  billingType: 'one_time' },

  // AI Servisleri
  { slug: 'ai-guvenlik',            name: 'AI Güvenlik Değerlendirmesi',     unitPrice: 2900,   billingType: 'one_time' },
  { slug: 'ai-phishing-sim',        name: 'AI Phishing Simülasyonu',         unitPrice: 1990,   billingType: 'one_time' },
  { slug: 'eu-ai-act',              name: 'EU AI Act Uyum Skoru',            unitPrice: 1990,   billingType: 'one_time' },
  { slug: 'ai-red-team',            name: 'AI Red Team Raporu',              unitPrice: 2490,   billingType: 'one_time' },
  { slug: 'deepfake-analizi',       name: 'Deepfake & Ses Klonu Analizi',    unitPrice: 1490,   billingType: 'one_time' },

  // Abonelik Servisleri (yıllık)
  { slug: 'ai-arac-izleme-yillik',  name: 'AI Araç İzleme (Yıllık)',        unitPrice: 5880,   billingType: 'annual' },
  { slug: 'ai-politika-yillik',     name: 'AI Politika Otogüncelleme',       unitPrice: 990,    billingType: 'annual' },
  { slug: 'sizinti-izleyici',       name: 'Sızıntı İzleyici (Yıllık)',       unitPrice: 2900,   billingType: 'annual' },
  { slug: 'marka-koruma',           name: 'Marka Koruma (Yıllık)',           unitPrice: 46800,  billingType: 'annual' },
  { slug: 'tprm',                   name: 'TPRM Tedarik Zinciri (Yıllık)',   unitPrice: 2900,   billingType: 'annual' },
  { slug: 'dora-bddk',              name: 'DORA/BDDK Uyum (Yıllık)',         unitPrice: 4900,   billingType: 'annual' },

  // Abonelik Servisleri (aylık)
  { slug: 'sanal-ciso',             name: 'Sanal CISO',                      unitPrice: 8000,   billingType: 'monthly' },
  { slug: 'ai-arac-izleme-aylik',   name: 'AI Araç İzleme (Aylık)',          unitPrice: 490,    billingType: 'monthly' },

  // Paketler
  { slug: 'ai-koruma-paketi',       name: 'AI Koruma Paketi (Yıllık)',       unitPrice: 9990,   billingType: 'annual' },
] as const;
```

---

## BÖLÜM 10: SÖZLEŞME PDF ŞABLONu (Puppeteer)

PDF için HTML şablon oluştur. Sözleşme PDF'i şunları içermeli:

```
Sayfa 1 — Kapak:
  - CyberStep.io logosu
  - "HİZMET ABONELIK SÖZLEŞMESİ"
  - Sözleşme No: CS-2026-0001
  - Tarih: [tarih]

Sayfa 2 — Taraflar:
  HİZMET SAĞLAYICI:
  CyberStep.io / [Şirket adı ve adresi]

  MÜŞTERİ:
  [Şirket adı], [Vergi no], [Adres], [Yetkili]

Sayfa 3 — Hizmet Kapsamı:
  [SERVICE_CATALOG'dan seçilen servisler tablosu]
  Başlangıç: [tarih]  Bitiş: [tarih]

Sayfa 4 — Ödeme Koşulları:
  Toplam tutar, vade, yöntem

Sayfa 5 — Genel Koşullar:
  [Standart SaaS sözleşme maddeleri — Türkçe]

İmza Sayfası:
  HİZMET SAĞLAYICI İMZASI    MÜŞTERİ İMZASI
  ___________________         ___________________
  Ad/Unvan:                   Ad/Unvan:
  Tarih:                      Tarih:
```

---

## BÖLÜM 11: ADMİN BİLDİRİM EMAİLLERİ

```typescript
// CTA tıklandığında — satış ekibine anlık bildirim
const ctaAlertEmail = {
  to: SALES_TEAM_EMAIL,
  subject: `🔥 Sıcak Lead: ${companyName} tam raporu talep etti`,
  body: `
    ${companyName} (${domain}) teaser raporundaki
    "Tam Raporu Talep Et" butonuna tıkladı.

    İletişim bilgisi: ${ctaForm.name} — ${ctaForm.email}
    Telefon: ${ctaForm.phone || 'Girilmedi'}
    Mesaj: ${ctaForm.message || 'Yok'}

    Tarama skoru: ${report.overall_score}/100 (${report.risk_level})

    → Aday sayfası: ${ADMIN_URL}/enterprise/prospects/${prospectId}
    → Teaser rapor: ${BASE_URL}/preview/${token}

    Önerilen aksiyon: 24 saat içinde ara.
  `
};

// Servis aktivasyonu — müşteriye
const activationEmail = {
  subject: `✅ Servisleriniz Aktif — CyberStep.io`,
  body: `
    Sayın [Yetkili Adı],

    [Şirket Adı] için CyberStep.io sözleşmeniz
    (#CS-2026-0001) aktive edilmiştir.

    Aktif Servisleriniz:
    [servis listesi]

    Portal erişiminiz:
    → cyberstep.io/hesabim
    E-posta: [email]
    Geçici şifre: [temp_password]

    İyi kullanımlar.
    CyberStep.io Ekibi
  `
};
```

---

## ÖZET — YENİ EKLENENLER

| Bileşen | Açıklama |
|---|---|
| 5 yeni DB tablosu | prospects, teaser_reports, contracts, contract_services, invoices |
| 15+ yeni API endpoint | Tarama, teaser, sözleşme, aktivasyon, portal |
| Public preview sayfası | /preview/:token — kısmi rapor, CTA form |
| Admin enterprise modülü | Pipeline, tarama, onay, sözleşme, aktivasyon |
| Müşteri portal güncelleme | Enterprise servis görünümü |
| Claude teaser prompt | İki çıktı: teaser (müşteriye) + tam senaryo (admin) |
| 3 cron job | Takip e-postaları + sözleşme yenileme |
| PDF sözleşme | Puppeteer ile otomatik üretim |
| Servis kataloğu sabiti | Sözleşme formunda kullanılacak |

---

*CyberStep.io — Proaktif Kurumsal Satış & Sözleşme Modülü — Mayıs 2026*
