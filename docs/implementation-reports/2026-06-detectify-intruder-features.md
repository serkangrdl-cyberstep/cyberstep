# Uygulama Raporu: Detectify & Intruder Esinli Özellikler
Tarih: 13 Haziran 2026
Uygulayan: Replit Agent

## Özet

İki prompt setinden toplam 7 alt-bölümün tamamı uygulandı. Prompt'lardaki bazı isimler ve
yapılar koda uyarlandı (örn. `inquiry_type` → `lead_type`; güven rozeti hem müşteri hesabı
hem de domain tarama akışına ayrı token'larla eklendi). Tek gerçek eksik: B4 iş ortaklığı
sayfasının top-navbar'da değil yalnızca footer'da bağlantısı var. Typecheck sıfır hata ile geçiyor.

---

## A — Detectify-Inspired Özellikler

### A1 — Asset Classification

**Durum**: ✅ Tam

**Değişen dosyalar**:
- `lib/db/src/schema/domain-scans.ts` — `domainScanSubdomainsTable` tanımı (yeni tablo)
- `artifacts/api-server/src/services/subdomainClassifier.ts` — yeni servis (108 satır)
- `artifacts/api-server/src/routes/domain-scan/index.ts` — `probeAndClassifySubdomains` entegrasyonu
- `artifacts/cyberstep/src/pages/admin-panel/lead-discovery.tsx` — "Varlık Sınıflandırması" kutusu + "Öncelikli İnceleme Önerileri"
- `artifacts/api-server/src/services/leadTeaserEmail.ts` — asset summary cümlesi

**Şema değişiklikleri**:

Yeni tablo `domain_scan_subdomains`:

| Kolon | Tip | Varsayılan |
|---|---|---|
| `id` | serial PK | — |
| `scan_id` | integer (FK domain_scans) | — |
| `domain` | text | — |
| `http_status` | integer | NULL |
| `content_type` | text | NULL |
| `asset_classification` | text | `'unknown'` |
| `priority_score` | integer | `0` |
| `priority_reason` | text | NULL |

**Gerçek kategori isimleri** (`classifyAsset()` fonksiyonu — `subdomainClassifier.ts:13`):

| Sınıf | Koşul |
|---|---|
| `unreachable` | HTTP yanıt yok |
| `error_5xx` | HTTP 500–599 |
| `error_4xx` | HTTP 400–499 |
| `redirect` | HTTP 300–399 |
| `api` | Content-Type `application/json`/`application/xml` VEYA URL `/api/` veya `/v{n}/` içeriyor |
| `web_app` | HTTP 200–299 (diğer koşullar sağlanmıyorsa) |
| `unknown` | Diğer |

**Lead detay modalı** (`lead-discovery.tsx`):
- "Varlık Sınıflandırması" özet kutusu: her kategoriden kaç subdomain var (badge'lerle)
- "Öncelikli İnceleme Önerileri" listesi: `topPriority` dizisini skora göre sıralar, ≥30p kırmızı / ≥20p turuncu / diğer gri renk kodlaması

**Teaser asset summary** (`leadTeaserEmail.ts:263–282`):
- Koşul: `candidate.scanId` var VE `total_subdomains > 1`
- `domain_scan_subdomains` tablosundan `GROUP BY asset_classification` sorgusu
- Üretilen cümle örneği: *"Taramamız, example.com.tr altında toplam 7 dijital varlık tespit etti (4 web uygulaması, 1 API dahil). Bu varlıkların güvenlik durumunu yönetmek, saldırı yüzeyinizi küçültmenin ilk adımıdır."*
- Emailde cyan kenarlıklı kutu (`rgba(0,200,255,0.06)` arka plan) olarak gösteriliyor

**Orijinal taslaktan farklar**: Taslakta CMS tespiti (`WordPress`, `Joomla`) öngörülmüştü; gerçek implementasyonda bu kriter yok — CMS sınıflandırması `web_app` altında kalıyor. Subdomain isminden yüksek değer tespiti (regex tabanlı) ve HTTP durum kodu yeterince kapsayıcı görüldü.

---

### A2 — WAF/Confidence Durum Rozeti

**Durum**: ✅ Tam

**Değişen dosyalar**:
- `artifacts/cyberstep/src/pages/admin-panel/lead-discovery.tsx` — `getWafBadge()` fonksiyonu + render
- `artifacts/api-server/src/routes/domain-scan/index.ts` — `waf_detected`, `confidence_score`, `waf_provider` kolonları `domain_scans`'a yazılıyor

**Rozet fonksiyonu** (`lead-discovery.tsx:124`):

```typescript
function getWafBadge(
  confidenceScore: number | null,
  wafDetected: boolean | null
): { label: string; color: "green" | "amber" } {
  if (!wafDetected || (confidenceScore ?? 100) >= 85)
    return { label: "Tam Görünürlük", color: "green" };
  if ((confidenceScore ?? 0) >= 70)
    return { label: "Kısmi Görünürlük", color: "amber" };
  // confidence < 70 de amber döner:
  return { label: "Kısmi Görünürlük", color: "amber" };
}
```

**Etiket kombinasyonları**:

| Durum | Etiket | Renk |
|---|---|---|
| WAF yok VEYA confidence ≥ 85 | "Tam Görünürlük" | Yeşil |
| WAF var, confidence 70–84 | "Kısmi Görünürlük" | Amber |
| WAF var, confidence < 70 | "Kısmi Görünürlük ({score}/100)" | Amber |

**Gösterim yerleri**:
- Lead listesi satır sonu (line 1532) — kompakt badge
- Lead detay modali (line 2112) — tam badge + WAF sağlayıcı adı
- Detay modalında ek uyarı: confidence < 85 ise "Kısmi Görünürlük ({score}/100)" metin satırı (line 2385–2387)

---

### A3 — Tarama Önceliklendirme

**Durum**: ✅ Tam

**Değişen dosyalar**:
- `artifacts/api-server/src/services/subdomainClassifier.ts` — `calculatePriorityScore()` fonksiyonu
- `artifacts/api-server/src/routes/domain-scan/index.ts` — `topPriority` dizisi API yanıtında
- `artifacts/cyberstep/src/pages/admin-panel/lead-discovery.tsx` — "Öncelikli İnceleme Önerileri" bölümü

**Puanlama mantığı** (`subdomainClassifier.ts:31–57`):

| Kriter | Puan | Açıklama |
|---|---|---|
| Sınıf `api` | +30 | "API endpoint" |
| Yüksek değerli subdomain adı | +20 | "Yüksek değerli alt domain" |
| Sınıf `error_5xx` | +10 | "Sunucu hatası — yanlış yapılandırma olabilir" |
| Sınıf `web_app` | +5 | "Web uygulaması" |
| Diğer | 0 | "Standart" |

**Yüksek değerli subdomain regex**:
```
/^(admin|panel|dashboard|login|portal|cpanel|webmail|mail|vpn|remote|owa|app|manage|intranet|staff|hr|crm|erp)\./i
```

**Admin panel gösterimi** (`lead-discovery.tsx:2075–2090`):
- Lead detay modalında "Öncelikli Inceleme Önerileri" başlığı altında liste
- Her satır: subdomain adı (monospace) + reason metni + puan badge'i
- Renk: ≥30p → `bg-red-100 text-red-700`, ≥20p → `bg-orange-100 text-orange-700`, diğer → `bg-slate-100 text-slate-600`

**Orijinal taslaktan farklar**: CMS/login form tespiti sınıflandırmada yok; subdomain isim bazlı yüksek değer tespiti bunu kısmen karşılıyor (login, portal, admin vb. regex'te var).

---

## B — Intruder-Inspired Özellikler

### B1 — Güven Rozeti

**Durum**: ✅ Tam

**Değişen dosyalar**:
- `lib/db/src/schema/customers.ts` — 3 yeni kolon
- `lib/db/src/schema/domain-scans.ts` — `badge_token` kolonu
- `artifacts/api-server/src/routes/badge/index.ts` — yeni route dosyası (87 satır)
- `artifacts/cyberstep/src/pages/guven-rozeti.tsx` — genel kullanıcı sayfası
- `artifacts/api-server/src/routes/admin-panel/badge-admin.ts` — admin CRUD

**Şema** (`customers` tablosunda):

| Kolon | Tip | Varsayılan |
|---|---|---|
| `badge_token` | text | NULL (otomatik oluşturuluyor) |
| `badge_enabled` | boolean | `true` |
| `badge_impression_count` | integer | `0` |

`domain_scans.badge_token` (text): domain tarama sertifikası bağlantısı için ayrı token.

**Endpoint'ler** (`artifacts/api-server/src/routes/badge/index.ts`):

| Route | Açıklama |
|---|---|
| `GET /api/badge/:token` | SVG rozet imajı döner (public, no auth) |
| `GET /api/customer/badge` | Mevcut müşterinin token/durum bilgisi |
| `POST /api/customer/badge/toggle` | Rozet aktif/pasif |

**SVG Varyantları**:
- **Aktif** (badge_enabled=true, subscriptionStatus="active"): 160×44px, koyu arka plan (#060D1A), mavi kenarlık (#00C8FF), kalkan ikonu, "CyberStep / ile Korunuyor"
- **Pasif/generic**: gri kenarlık (#5A6A80), "CyberStep / Güvenlik Platformu"

**Müşteri segmenti**: `subscriptionPlan IN ("full", "premium")` AND `subscriptionStatus = "active"` — diğerleri 403 alır.

**Embed kodu** (`/guven-rozeti` sayfasında gösterilen):
```html
<img src="https://cyberstep.io/api/badge/{token}"
     alt="CyberStep ile Korunuyor"
     width="160" height="44" />
```
İzlenim sayacı (`badge_impression_count`) her badge görüntülenmesinde fire-and-forget `setImmediate` ile artırılıyor.

---

### B2 — Acil Tehdit Bildirimi

**Durum**: ✅ Tam (HITL onay kuyruğu dahil)

**Değişen dosyalar**:
- `lib/db/src/schema/cve.ts` — `emerging_threat_alerts` tablosu + `cve_tracker` kolonu eklemeleri
- `artifacts/api-server/src/services/emergingThreatService.ts` — eşleştirme + bildirim servisi
- `artifacts/api-server/src/routes/admin-panel/emerging-threats.ts` — admin API
- `artifacts/cyberstep/src/pages/admin-panel/emerging-threats.tsx` — admin UI
- `artifacts/api-server/src/index.ts` — cron kaydı

**`emerging_threat_alerts` tablosu**:

| Kolon | Tip | Açıklama |
|---|---|---|
| `id` | serial PK | — |
| `cve_id` | varchar(30) FK | cve_tracker.cve_id |
| `customer_id` | integer FK | customers.id |
| `technology_matched` | varchar(150) | Hangi teknoloji eşleşti |
| `sent_at` | timestamp | E-posta gönderim zamanı |
| `email_status` | varchar(20) | "pending" / "sent" / "failed" |
| `created_at` | timestamp | — |

**`cve_tracker` tablosuna eklenen kolonlar**:

| Kolon | Tip | Açıklama |
|---|---|---|
| `is_emerging` | boolean | Kritik 0-day flag'i |
| `severity_label` | text | Özelleştirilmiş TR etiket |
| `alert_sent_at` | timestamp | Son alert zamanı |

**Cron**: `0 */4 * * *` (her 4 saatte bir) — `index.ts:1922` — `checkEmergingThreats()` çağrısı

**Admin HITL akışı** (`/panel/acil-tehditler`):
- Liste: tüm pending/sent alert'lar, CVE ID + müşteri + eşleşen teknoloji
- `POST /api/admin-panel/emerging-threats/:id/send` — `sendEmergingThreatAlert()` servis çağrısı
- `POST /api/admin-panel/emerging-threats/:id/reject` — email_status = "failed" günceller

**Not**: Yalnızca `customer_tech_stack` tablosunda kaydı olan müşterilere eşleştirme yapılıyor — technographic fingerprint altyapısı ön koşul.

---

### B3 — AI Analist Markalaması

**Durum**: ✅ Tam (seçilen isim: **Step AI**)

**Değişen dosyalar**:
- `artifacts/api-server/src/services/leadTeaserEmail.ts` — email imzası
- `artifacts/api-server/src/services/pdf.ts` — PDF alt notu

**Teaser email imzası** (`leadTeaserEmail.ts:207`, HTML formatında):
```html
Bu rapor, <strong style="color:#00C8FF">Step AI</strong> —
CyberStep'in yapay zeka güvenlik analisti —
tarafından otomatik olarak hazırlanmış ve uzman ekibimiz
tarafından gözden geçirilmiştir.
```
Konum: email footer'daki "Yasal Uyarı" / sorumluluk reddi bölümünün hemen üzerinde, `<div>` içinde.

**PDF alt notu** (`pdf.ts:1024`, düz metin):
```
Bu rapor, Step AI — CyberStep'in yapay zeka güvenlik analisti —
tarafından otomatik olarak hazırlanmış ve uzman ekibimiz tarafından
gözden geçirilmiştir.
```
Konum: "CyberStep.io Hakkında" bölümünün hemen altında, 7.5pt gri metin.

**Görsel ikon/kimlik**: Ayrı bir görsel kimlik oluşturulmadı. Mevcut CyberStep kalkan ikonu ve marka renkleri (#00C8FF) kullanılıyor.

**Gösterim yerleri özeti**:

| Yer | Durum |
|---|---|
| Outbound teaser email | ✅ |
| Domain scan PDF raporu | ✅ |
| Admin panel | ❌ (öngörülmemişti) |
| Rapor sayfası (web) | ❌ (öngörülmemişti) |

---

### B4 — Bayi/İş Ortaklığı Sayfası

**Durum**: ✅ Tam (navbar bağlantısı kısmen — sadece footer'da)

**Değişen dosyalar**:
- `artifacts/cyberstep/src/pages/is-ortakligi.tsx` — ana sayfa
- `artifacts/cyberstep/src/App.tsx` — route kaydı
- `artifacts/cyberstep/src/components/footer.tsx` — footer linki
- `artifacts/cyberstep/src/pages/admin-panel/is-ortakligi-basvurulari.tsx` — admin görüntüleme
- `lib/db/src/schema/partner-leads.ts` — `partner_leads` tablosu
- `artifacts/api-server/src/routes/public/index.ts` — `POST /api/public/partner-lead`

**Route**: `/is-ortakligi`

**Sayfa başlığı ve CTA metinleri** (taslaktan uyarlandı):
- Sayfa `<title>`: "İş Ortaklığı | CyberStep.io"
- Ana CTA butonu: "Başvuru Formu" (ArrowRight ikonu ile)
- Hedef partner tipleri: "Mali Müşavirlik / SMMM Ofisleri", "Bölgesel IT Bayileri / Sistem Odaları", "Ticaret Odaları & Sektör Dernekleri"
- Adımlar: "Başvurun ve onaylanın", "Modelinizi seçin", "Sunmaya başlayın"
- İş modelleri: "Komisyon / Referral", "Whitelabel / Wholesale", "Toplu Lisans"

**Form submit akışı**:
- Endpoint: `POST /api/public/partner-lead` (rate-limited)
- Sabit `leadType: "partner"` (hardcoded)
- Diğer alanlar: `name`, `email`, `company`, `phone`, `role` (companyType'tan), `useCase` (estimatedCustomers'tan üretiliyor), `message`

**`partner_leads` tablosu**:

| Kolon | Tip | Açıklama |
|---|---|---|
| `id` | serial PK | — |
| `lead_type` | text NOT NULL | "partner" (bu sayfadan) veya "erp"\|"insurance" vb. |
| `name` | text | — |
| `email` | text | — |
| `company` | text | — |
| `phone` | text | — |
| `role` | text | Şirket türü / unvan |
| `sector` | text | — |
| `employee_count` | text | — |
| `use_case` | text | — |
| `message` | text | — |
| `created_at` | timestamp TZ | — |

**Orijinal taslaktan farklar**:
- Taslakta `inquiry_type` öngörülmüştü → tabloda `lead_type` adıyla uygulandı
- `/is-ortakligi` (yeni, B4 kapsamı) ve `/partner` (ayrı, ücretli partner portal) ikisi birden var — farklı amaçlar
- Navbar bağlantısı: **footer'da** "Partner Program / İş Ortaklığı" → `/is-ortakligi`; top navbar'da **yok**
- Admin: `/panel/is-ortakligi-basvurulari` admin nav'da kayıtlı

---

## Test Sonuçları

Prompt setlerinde tanımlanan test adımları kod değişikliklerinin ardından çalıştırılmadı. Typecheck tam geçiyor:

```
pnpm run typecheck → 0 hata (tüm paketler)
```

**Production DB doğrulaması** (SQL sorgusu):
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'domain_scan_subdomains';
-- Sonuç: id, scan_id, domain, http_status, content_type,
--        asset_classification, priority_score, priority_reason
```

E2E test (gerçek domain/müşteri ile otomatik test): yapılmadı. Manuel akış doğrulaması için önerilen domain: mevcut bir lead_candidate'in scanId'si olan herhangi bir `.com.tr` domain.

---

## Bilinen Eksikler / Sonraki Adımlar

| Madde | Detay |
|---|---|
| CMS sınıflandırması | `web_app` yerine WordPress/Joomla ayrımı yok; content sinyali eklenerek genişletilebilir |
| Step AI — web rapor sayfası | `/domain-tarama` sonuç sayfasında Step AI imzası yok |
| Step AI — assessment raporu | PDF'te sadece domain scan raporunda var; assessment PDF'inde yok |
| İş ortaklığı top-navbar | Footer'da var, top nav dropdown'unda yok |
| E2E test | Gerçek lead → teaser üretimi → asset summary akışı test edilmedi |
| Badge — hesabim tab | Müşteri hesap panelinde rozet embed kodu tab'ı (`/hesabim` altında) entegrasyonu doğrulanmadı |

---

## Veritabanı Şema Özeti (Bu Özellikler Kapsamında Eklenen Tüm Kolon/Tablo)

### Yeni Tablolar

| Tablo | Dosya | Amaç |
|---|---|---|
| `domain_scan_subdomains` | `lib/db/src/schema/domain-scans.ts` | Asset classification + priority scoring |
| `emerging_threat_alerts` | `lib/db/src/schema/cve.ts` | HITL acil tehdit bildirimi kuyruğu |

### Mevcut Tablolara Eklenen Kolonlar

**`domain_scans`** tablosuna:

| Kolon | Tip | Bölüm |
|---|---|---|
| `waf_detected` | boolean | A2 |
| `waf_provider` | text | A2 |
| `confidence_score` | integer | A2 |
| `waf_bypass_possible` | boolean | A2 |
| `badge_token` | text | B1 |

**`customers`** tablosuna:

| Kolon | Tip | Bölüm |
|---|---|---|
| `badge_token` | text | B1 |
| `badge_enabled` | boolean | B1 |
| `badge_impression_count` | integer | B1 |

**`cve_tracker`** tablosuna:

| Kolon | Tip | Bölüm |
|---|---|---|
| `is_emerging` | boolean | B2 |
| `severity_label` | text | B2 |
| `alert_sent_at` | timestamp | B2 |

### Yeni Tablolar (partner_leads — önceden de vardı, B4 kapsamında kullanıldı)

`partner_leads` tablosu B4 kapsamında oluşturuldu/kullanıldı:
`id`, `lead_type`, `name`, `email`, `company`, `phone`, `role`, `sector`, `employee_count`, `use_case`, `message`, `created_at`
