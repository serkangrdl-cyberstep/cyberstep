# CyberStep.io — Proaktif Kurumsal Satış + Teaser Rapor Motoru
## Replit Agent Promptu

---

## GENEL BAKIŞ

Bu modül üç bileşenden oluşur:

1. **Proaktif Tarama Motoru** — Satış ekibi aday domainleri tarar,
   Claude AI saldırı senaryosu çalıştırır, teaser rapor üretir.

2. **Teaser Rapor & E-posta** — Aday şirkete "1 kritik, 2 orta tehdit
   bulundu" formatında kısmi rapor gönderilir. Detaylar kilitli.
   Benzersiz token'lı önizleme sayfası.

3. **Kurumsal Sözleşme Yönetimi** — Kredi kartı yok. Sözleşme imzalanır,
   admin panelinden servisler aktive edilir, müşteri kendi portalında
   aktif servislerini görür.

Mevcut stack: Node.js + Express + TypeScript + PostgreSQL + Drizzle ORM
+ React + shadcn/ui. ISR (CRM) modülü zaten mevcut — extend edilecek.

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
-- 2. Teaser tarama sonuçları
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prospect_scans (
  id serial PRIMARY KEY,
  prospect_id      integer REFERENCES enterprise_prospects(id) ON DELETE CASCADE,

  -- Tarama özeti (public — teaserde gösterilir)
  overall_score    integer,           -- 0-100
  letter_grade     varchar(2),        -- A/B/C/D/F
  critical_count   integer DEFAULT 0,
  high_count       integer DEFAULT 0,
  medium_count     integer DEFAULT 0,

  -- Detay JSON (locked — sadece ücretli müşteriye açılır)
  full_scan_json   jsonb,
  ai_attack_summary text,             -- Claude AI saldırı senaryosu özeti
  ai_recommendations text,            -- Claude AI öneriler (kilitli)

  -- Teaser paylaşım
  teaser_token     varchar(64) UNIQUE, -- randomUUID, URL'de kullanılır
  teaser_sent_at   timestamp,
  teaser_viewed_at timestamp,
  teaser_view_count integer DEFAULT 0,

  scanned_at       timestamp DEFAULT now(),
  scanned_by       varchar(100)       -- satış ekibi üyesi
);

-- ─────────────────────────────────────────────────────
-- 3. Kurumsal sözleşmeler
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enterprise_contracts (
  id serial PRIMARY KEY,
  prospect_id      integer REFERENCES enterprise_prospects(id),

  contract_number  varchar(50) UNIQUE, -- örn. CS-2026-001
  company_name     varchar(255),
  contact_email    varchar(255),

  -- Hizmetler (array of service slugs)
  services         text[],
  -- örn. ['domain-scan-monthly', 'ai-attack-analysis', 'kvkk-compliance']

  -- Fiyatlandırma
  monthly_fee_tl   numeric(10,2),
  annual_fee_tl    numeric(10,2),
  payment_terms    varchar(50) DEFAULT 'monthly',

  -- Dönem
  start_date       date,
  end_date         date,
  auto_renew       boolean DEFAULT true,

  -- Durum
  status           varchar(30) DEFAULT 'draft',
  -- draft | sent | signed | active | suspended | cancelled

  contract_pdf_url varchar(500),      -- imzalanmış sözleşme dosyası
  signed_at        timestamp,

  notes            text,
  created_at       timestamp DEFAULT now(),
  activated_at     timestamp
);
```

Drizzle schema dosyasına yukarıdaki tabloları ekle ve `npm run db:push` çalıştır.

---

## BÖLÜM 2: BACKEND API

### 2.1 Prospect CRUD
`/api/admin/prospects` altında:
- `GET /` — liste (status, assigned_to, sector filtreli)
- `POST /` — yeni aday ekle
- `PUT /:id` — güncelle (status değişimi + `last_activity_at` otomatik güncelle)
- `DELETE /:id` — sil

### 2.2 Proaktif Tarama
`POST /api/admin/prospects/:id/scan`

Adımlar:
1. Mevcut `/api/domain-scan` akışını çağır (SPF/DMARC/SSL/Shodan/CVE)
2. Tarama tamamlanınca Claude AI saldırı senaryosu çalıştır:
   - System prompt: *"Sen bir kurumsal siber güvenlik danışmanısın. Verilen domain tarama bulgularına göre gerçekçi saldırı senaryoları yaz. Türkçe, teknik ama yöneticiye hitap eden dil kullan. Kritik: %{critical_count} adet kritik bulgu, Orta: %{medium_count} adet."*
   - `ai_attack_summary`: 3 cümle özet (teaserde görünür)
   - `ai_recommendations`: madde madde öneriler (kilitli, ücretli içerik)
3. `prospect_scans` tablosuna kaydet
4. `enterprise_prospects.status = 'scanned'` yap
5. `teaser_token = randomUUID()` ata

### 2.3 Teaser E-posta Gönderimi
`POST /api/admin/prospects/:id/send-teaser`

- `teaser_sent_at` doldur, `status = 'teaser_sent'` yap
- E-posta template (aşağıda Bölüm 3)
- **GÖNDERİM MANUEL ONAY GEREKTİRİR** — endpoint sadece e-posta önizlemesini döndürür, admin "Gönder" butonuna basınca nodemailer ile gider
- Gönderim sonrası `teaser_sent_at` timestamp set et

### 2.4 Teaser Önizleme Sayfası (Public)
`GET /api/public/teaser/:token`

- `teaser_token` ile `prospect_scans` sorgula
- `teaser_view_count++`, `teaser_viewed_at` (ilk görüntülemede) set et
- `enterprise_prospects.status = 'teaser_viewed'` yap
- Döndür: `{ domain, overall_score, letter_grade, critical_count, high_count, medium_count, ai_attack_summary }`
- **Kilitli alanlar döndürülmez:** `full_scan_json`, `ai_recommendations`

Frontend route: `/teaser/:token` — public, login gerektirmez

### 2.5 Kurumsal Sözleşme
`/api/admin/contracts` altında:
- `POST /` — yeni sözleşme oluştur (prospect_id zorunlu)
  - Otomatik `contract_number` üret: `CS-{YIL}-{sıralı 3 hane}`
- `PUT /:id/activate` — `status = 'active'`, `activated_at` doldur
  - Bu endpoint aynı zamanda müşteri kullanıcısı yoksa oluşturur (email → geçici şifre)
  - Aktif servisleri `users` veya `subscriptions` tablosuna ekler
- `PUT /:id/suspend` / `PUT /:id/cancel`
- `GET /` — liste

---

## BÖLÜM 3: TEASER E-POSTA TEMPLATE

Nodemailer ile gönderilecek HTML e-posta:

```
Konu: [ŞİRKET_ADI] — Alan Adınıza İlişkin Kritik Güvenlik Bulgusu

Sayın [İSİM],

[ŞİRKET_ADI] adına [DOMAIN] alan adınız üzerinde standart güvenlik 
değerlendirmesi gerçekleştirdik.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Güvenlik Skoru: [SKOR]/100 ([HARF_NOTU])
  🔴 Kritik Bulgular: [KRİTİK_SAYI]
  🟠 Yüksek Bulgular: [YÜKSEK_SAYI]  
  🟡 Orta Bulgular: [ORTA_SAYI]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[AI_ATTACK_SUMMARY — 3 cümle özet]

Detaylı bulguları ve çözüm önerilerini görüntülemek için:

  👉 [TEASER_URL]

Bu rapor 7 gün geçerlidir.

Ücretsiz 30 dakikalık güvenlik danışmanlığı için yanıtlayabilirsiniz.

CyberStep Güvenlik Ekibi
cyberstep.io | info@cyberstep.io
```

---

## BÖLÜM 4: TEASER FRONTEND SAYFASI

Route: `/teaser/:token`

Tasarım: CyberStep brand (#060D1A arka plan, #00C8FF cyan, #F5A623 amber)

Bölümler:
1. **Hero** — "Alan Adınız İçin Güvenlik Raporu" başlık, domain ve skor rozeti (büyük, göze çarpan)
2. **Özet Metrikler** — Kritik / Yüksek / Orta sayıları renkli kartlarda
3. **AI Saldırı Özeti** — `ai_attack_summary` metni (3 cümle, kırmızı uyarı çerçevesinde)
4. **Kilitli Detaylar** — "Detaylı bulgular ve öneriler için..." blur overlay, üzerinde:
   - "Demo Talep Et" butonu → `mailto:info@cyberstep.io?subject=Demo Talebi - [domain]`
   - "Bize Ulaşın" butonu → `https://cyberstep.io/iletisim`
5. **Footer** — KVKK notu, cyberstep.io linki

Görüntülendiğinde backend'e `GET /api/public/teaser/:token` çağrısı yap, view sayacını artır.

---

## BÖLÜM 5: ADMIN PANEL

### 5.1 Prospect Pipeline Sayfası
Route: `/admin/prospects`

- Kanban veya tablo görünümü (status kolonuna göre gruplu)
- Her kart: şirket adı, domain, skor rozeti, son aktivite tarihi, atanan kişi
- Aksiyon butonları: Tara | Teaser Gönder | Sözleşme Oluştur
- Filtreler: status, sector, assigned_to, şehir
- Yeni aday formu (modal)

### 5.2 Sözleşme Yönetimi Sayfası
Route: `/admin/contracts`

- Liste: sözleşme no, şirket, hizmetler, aylık ücret, durum, başlangıç tarihi
- "Aktive Et" butonu → `PUT /api/admin/contracts/:id/activate`
- "Askıya Al" / "İptal Et" butonları
- Sözleşme detay modal: tüm alanlar + PDF yükleme alanı

### 5.3 Müşteri Portalı (Mevcut paneli extend et)
Aktif sözleşmesi olan kurumsal müşteri giriş yaptığında:
- "Aktif Hizmetlerim" kartları (`enterprise_contracts.services` array'inden)
- Aylık tarama raporları (varsa)
- Sözleşme bilgisi (başlangıç/bitiş tarihi, auto-renew durumu)

---

## BÖLÜM 6: CRON JOBS

`wrapCron` pattern ile (mevcut cron yapısına ekle):

```
Her gün 09:00 — contract_renewal_check
  → end_date 30 gün içinde olan aktif sözleşmeler için uyarı maili
  
Her gün 08:00 — teaser_followup_check  
  → teaser_sent durumundaki, 3 gün içinde görüntülenmemiş adayları
    assigned_to'ya bildirim gönder (mail veya admin panel notification)
```

---

## UYGULAMA SIRASI

1. Drizzle migration (tablolar)
2. Backend API (CRUD + scan + teaser endpoints)
3. Teaser frontend sayfası (`/teaser/:token`)
4. Admin panel sayfaları (prospects + contracts)
5. Müşteri portali extend
6. Cron jobs
7. Test: Gerçek bir domain tara → teaser üret → önizle

---

## KISITLAR

- Teaser e-posta gönderimi **her zaman manuel onay gerektirir** — otomatik gönderme yok
- `ai_recommendations` ve `full_scan_json` asla public endpoint'e sızmaz
- Kurumsal müşteri aktivasyonu admin onayı olmadan gerçekleşmez
- Yeni npm paketi ekleme — mevcut stack ile çöz
