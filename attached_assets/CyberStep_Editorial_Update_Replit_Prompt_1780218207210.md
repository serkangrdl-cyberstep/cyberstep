# CyberStep.io — Web Sitesi İçerik Güncelleme
## Editoryal İnceleme Bulgularına Göre Replit Agent Promptu

---

## REPLIT AGENT PROMPTU — KOPYALA-YAPIŞTIR

You are updating content, copy, and data across the CyberStep.io frontend.
The app uses React + TypeScript + Vite + Tailwind + shadcn/ui.

Work through each section below in order.
Do NOT change any logic, routing, or backend code — only text content,
component data arrays, and minor UI fixes.

---

## BÖLÜM A — NAVİGASYON GÜNCELLEMELERİ

### A1 — AI Güvenlik Dropdown'a Eksik Link Ekle

Find the navigation component (likely `src/components/Navigation.tsx` or
`src/components/Header.tsx`). Locate the "AI Güvenlik" dropdown array.

Add these missing items at the end of the dropdown:

```typescript
// Add after the last existing dropdown item:
{ label: 'AI Sahte Doküman Tespiti', href: '/sahte-dokuman' },
{ label: 'Sanal CISO', href: '/sanal-ciso' },
```

### A2 — "Araçlar" Dropdown Ekle

After the "AI Güvenlik" dropdown and before "Sızıntı Kontrolü" link,
add a new "Araçlar" dropdown:

```typescript
{
  label: 'Araçlar',
  items: [
    { label: 'Alan Adı Güvenlik Taraması', href: '/domain-tarama' },
    { label: 'Sızıntı İzleyici', href: '/sizinti-izleyici' },
    { label: 'KVKK Ceza Simülatörü', href: '/kvkk-ceza-sim' },
    { label: 'Microsoft 365 Denetimi', href: '/m365-denetim' },
    { label: 'Sektörel Kıyaslama', href: '/sektorel-kiyaslama' },
    { label: 'ROI Hesaplayıcı', href: '/roi-hesaplayici' },
    { label: 'Marka Koruma', href: '/marka-koruma' },
    { label: 'Tüm Araçlar →', href: '/araclar' },
  ]
}
```

Remove the standalone "Sızıntı Kontrolü" link from the top nav
(it's now inside the Araçlar dropdown as "Sızıntı İzleyici").

---

## BÖLÜM B — ANA SAYFA GÜNCELLEMELERİ (home.tsx veya HomePage.tsx)

### B1 — BETA Bildirimini Güncelle

Find the system notification / beta banner. Change:

```
ÖNCE:
"BETA — Platform geliştirme aşamasındadır.
Bu dönemde oluşturulan rozetler resmi geçerlilik taşımaz."

SONRA:
"YENİ — Platform sürekli gelişiyor. Yeni özellikler her hafta ekleniyor."
```

### B2 — Hero İstatistiklerini Güncelle

Find the stats/counter section. Update these values:

```
ÖNCE:                          SONRA:
500+  Şirket Analiz Edildi  →  500+  Şirket Tarandı
3.2dk Ortalama Test Süresi  →  20dk  Ortalama Değerlendirme
%94   Müşteri Memnuniyeti   →  60+   Kritik Kontrol Noktası
20    Kritik Kontrol         →  22    Araç ve Servis
```

### B3 — "Nasıl Çalışır?" Bölümünü Güncelle

Find the "Nasıl Çalışır" section. Update from 3 adım to 4 adım:

```
BÖLÜM BAŞLIĞI: değişmez ✓

ALT METİN:
ÖNCE: "Teknik bilgi gerekmez. 3 adımda işletmenizin siber sağlık karnesini çıkarın."
SONRA: "Teknik bilgi gerekmez. 4 adımda şirketinizin siber güvenlik haritasını çıkarın."

ADIM 1 — başlık: "Değerlendirmeyi Tamamlayın"
ADIM 1 — metin:
"Şirketinizle ilgili temel güvenlik sorularını yanıtlayın.
Teknik bilgi gerekmez — tüm sorular günlük iş süreçleriniz hakkında."

ADIM 2 — başlık: değişmez ✓
ADIM 2 — metin: değişmez ✓

ADIM 3 — başlık: "AI Raporunuzu Anında Alın"
ADIM 3 — metin:
"Yapay zeka bulgularınızı saniyeler içinde analiz eder.
'Önce şunu kapat' sıralamasıyla, sektörünüze özel,
uygulanabilir aksiyon planı anında hazır."

ADIM 4 — başlık: "Uzman Doğrulaması" (YENİ ADIM)
ADIM 4 — metin:
"Tam Değerlendirme raporları 24 saat içinde
uzman siber güvenlik danışmanı tarafından incelenir.
Onay sonrası raporunuza 'Uzman Doğrulandı' rozeti eklenir
ve sizi bilgilendiririz."
ADIM 4 — ikon: kalkan + onay işareti (✓)
ADIM 4 — renk vurgusu: gold/amber (diğer adımlardan görsel olarak ayrışsın)
```

### B4 — "Neden CyberStep?" Bölümü Badge Çakışmasını Düzelt

Find the two sections that both use the "Neden CyberStep?" badge.

First section (merdiven metaforu bölümü):
```
Badge: "Neden CyberStep?" → değişmez ✓
```

Second section (Brand Story / "Güvenlik almayın" bölümü):
```
ÖNCE Badge: "Neden CyberStep?"
SONRA Badge: "Felsefemiz"
```

### B5 — Marka Hikayesi "işletme" Kelimelerini Düzelt

Find the Brand Story section. Update:

```
ÖNCE H2: "Güvenlik" almayın. İş sürekliliği satın alın.
SONRA H2: değişmez ✓

ÖNCE paragraf 1:
"Bir şirket sahibinin MFA ya da EDR'ı anlaması gerekmiyor.
Şunu bilmesi gerekiyor: 'Yarın fidye saldırısı gelse işim kaç
gün durur? Maliyeti ne olur?' CyberStep tam bunu gösteriyor."

SONRA paragraf 1: değişmez ✓ (bu paragrafta sorun yok)

Adım kartları — bul ve güncelle:
KART 1:
ÖNCE: "işletmenizin" varsa
SONRA: "şirketinizin"

KART 3:
ÖNCE: "Siber Sağlık Skorun her adımda yükselir —
        müşterilere, bankaya, sigortacıya gösterebileceğin somut kayıt."
SONRA: "Güvenlik skorunuz her adımda yükselir —
        müşterilere, bankaya, sigortacıya, ihale komitesine
        gösterebileceğiniz somut kanıt."
```

### B6 — Araçlar Grid'ini Güncelle

Find the tools/services grid component. Make these changes:

**FİYAT DÜZELTMESİ — Araç #14:**
```
ÖNCE:  { title: 'Yapay Zeka Güvenlik Değerlendirmesi', price: '—' }
SONRA: { title: 'Yapay Zeka Güvenlik Değerlendirmesi', price: '2.900 TL' }
```

**EKSİK SERVİSLER — Grid'e ekle (mevcut 22 kartın sonuna):**
```typescript
{
  id: 23,
  title: 'AI Phishing Simülasyonu',
  description: 'Şirketinizi hedef alan gerçekçi AI phishing senaryolarını görün',
  href: '/ai-phishing-simulasyonu',
  price: '1.990 TL',
  badge: 'ücretli'
},
{
  id: 24,
  title: 'AI Araç İzleme',
  description: 'Kullandığınız yapay zeka araçlarının gizlilik politikası değişikliklerini takip edin',
  href: '/ai-arac-izleme',
  price: '490 TL/ay',
  badge: 'ücretli'
},
{
  id: 25,
  title: 'AI Politika Otogüncelleme',
  description: 'Yapay zeka kullanım politikanız her çeyrek otomatik güncellenir',
  href: '/ai-politika',
  price: '990 TL/yıl',
  badge: 'ücretli'
},
{
  id: 26,
  title: 'Sanal CISO',
  description: 'Aylık yönetim kurulu raporu, danışmanlık ve güvenlik yol haritası',
  href: '/sanal-ciso',
  price: '8.000 TL/ay',
  badge: 'ücretli'
},
```

**SIZINTI İZLEYİCİ FİYAT DÜZELTMESİ:**
```
ÖNCE:  { title: 'Karanlık Web Sızıntı İzleyici', price: '—' }
SONRA: { title: 'Karanlık Web Sızıntı İzleyici', price: '2.900 TL/yıl' }
```

---

## BÖLÜM C — HAKKIMIZDA SAYFASI (/hakkimizda)

Find `src/pages/AboutPage.tsx` or similar.

### C1 — "Orta Ölçekli" İfadesini Düzelt

```
ÖNCE:
"Büyük kurumlar için yapılmış araçlar,
orta ölçekli şirketlerin sorununu çözmüyor."

SONRA:
"Büyük kurumlar için yapılmış araçlar,
çoğu şirketin gerçek sorununu çözmüyor."
```

### C2 — Karşılaştırma Tablosuna Satır Ekle

Find the competitor comparison table. Add these two rows:

```
Mevcut son satır: "Tespit et, rapor ver — bitti" vs "Bul, gönder, düzelt, doğrula — kapalı döngü"

Sonuna ekle:
| AB'ye ihraç edenler için EU AI Act desteği yok | EU AI Act uyum skoru ve aksiyon planı |
| Türkçe destek yok | Türkçe arayüz, Türkçe rapor, Türkçe destek |
```

---

## BÖLÜM D — FİYATLAR SAYFASI (/fiyatlar)

Find `src/pages/PricingPage.tsx` or similar.

### D1 — AI Phishing Simülasyonu Kategorisini Netleştir

Find where "AI Phishing Simülasyonu" appears in pricing.
Change from yıllık abonelik to tek seferlik:

```
ÖNCE (Yıllık Abonelik bölümünde):
"AI Phishing Simülasyonu — 1.990 TL / yıl"

SONRA (Tek Seferlik bölümüne taşı):
"AI Phishing Simülasyonu — 1.990 TL (tek seferlik)"
```

### D2 — Sanal CISO'yu Aylık Abonelik Bölümüne Ekle

Find the monthly subscription pricing section. Add:

```typescript
{
  name: 'Sanal CISO',
  price: '8.000',
  period: 'ay',
  href: '/sanal-ciso',
  description: 'Aylık yönetim kurulu raporu + danışmanlık + güvenlik yol haritası'
}
```

### D3 — AI Koruma Paketi Bölümü Ekle

After the existing pricing cards, add a new "Paket" section:

```tsx
<div className="package-highlight-card">
  <badge>En Popüler Paket</badge>
  <h3>AI Koruma Paketi</h3>
  <p>Üç AI güvenlik servisini birlikte alın, %32 tasarruf edin.</p>

  <div className="package-includes">
    <item>✓ AI Güvenlik Değerlendirmesi (2.900 TL)</item>
    <item>✓ AI Araç İzleme — 1 yıl (5.880 TL)</item>
    <item>✓ AI Politika Otogüncelleme — 1 yıl (990 TL)</item>
    <item className="strikethrough">Toplam değer: 9.770 TL</item>
  </div>

  <price>9.990 TL / yıl</price>
  <cta>Paketi Satın Al →</cta>
</div>
```

### D4 — Fiyat Haritası (Bölüm 7) Sanal CISO Ekle

Find the "Aylık Abonelik" price list section:

```
Mevcut liste:
AI Araç İzleme      490 TL / ay
Marka Koruma      3.900 TL / ay

Ekle:
Sanal CISO        8.000 TL / ay
```

---

## BÖLÜM E — SERVİS SAYFALARI

### E1 — /ai-phishing-simulasyonu Sayfası

Find or create `src/pages/AIPhishingPage.tsx`.

Update/verify these elements:

```
H1: "Yapay Zeka ile Sizi Hedef Alan Saldırı Böyle Görünür"
Fiyat badge: "1.990 TL — Tek Seferlik"
Alt metin: "Şirketinizin kamuya açık verilerini AI ile analiz edip,
             3 farklı spear-phishing senaryosu oluşturuyoruz.
             E-posta gönderilmez — sadece farkındalık."
```

### E1b — Tam Değerlendirme Sayfasına Uzman Doğrulama Bölümü Ekle

Find the full assessment page (`/assessment/full/start` veya `/tam-degerlendirme`).
After the pricing/feature list, add a trust section:

```tsx
<div className="expert-review-trust-block">
  {/* Amber/gold renk teması */}
  <div className="trust-badge">
    🛡️ Uzman Doğrulaması Dahil
  </div>

  <h3>AI Raporu + İnsan Gözü</h3>

  <p>
    Raporunuz ödeme sonrası <strong>anında hazır</strong> olur.
    Arka planda uzman siber güvenlik danışmanımız 24 saat içinde
    raporu inceler ve onaylar.
  </p>

  <div className="two-moments">
    <div className="moment">
      <span className="time">Hemen</span>
      <span className="event">AI raporunuz hazır, indirebilirsiniz</span>
    </div>
    <div className="moment highlight">
      <span className="time">24 saat içinde</span>
      <span className="event">
        "Uzman Doğrulandı" rozeti eklenir,
        sizi e-posta ile bilgilendiririz
      </span>
    </div>
  </div>

  <p className="note">
    Uzmanımız rapora ek not eklerse güncelleme bildirimi alırsınız.
    Raporunuzla ilgili sorularınız için 1 saat ücretsiz danışmanlık hakkınız var.
  </p>
</div>
```

### E1c — Fiyatlar Sayfası Güven Bantına "Uzman Kontrolü" Ekle

Find the trust/guarantee strip on the pricing page:

```
Mevcut güven bantı öğeleri:
✓ 256-bit SSL şifreli güvenli ödeme
✓ 500+ şirket tarafından tercih edildi
✓ 24-48 saat içinde uzman değerlendirmesi   ← GÜNCELLE
✓ KVKK uyumlu veri işleme

GÜNCELLE:
"24-48 saat içinde uzman değerlendirmesi"
→
"Tam Değerlendirme'de uzman doğrulaması dahil"
```

### E2 — /sanal-ciso Sayfası

Find or create `src/pages/SanalCISOPage.tsx`.

Update/verify:

```
H1: "CISO'nuz Artık Sizinle — Kadro Maliyeti Olmadan"
Fiyat: "8.000 TL / ay"
Alt metin fiyat bağlamı ekle:
"Kıdemli CISO yıllık maliyeti: 1.200.000 - 2.400.000 TL
 CyberStep Sanal CISO yıllık maliyeti: 96.000 TL"
```

### E3 — /eu-ai-act Sayfası

Find or create `src/pages/EUAIActPage.tsx`.

```
H1: "AB Yapay Zeka Yasası Uyum Skoru"
Alt metin: "AB'ye ürün veya hizmet satan şirketler EU AI Act kapsamına giriyor.
             Cezalar: 35 milyon Euro'ya kadar. 20 soruda uyum durumunuzu öğrenin."
Fiyat: "1.990 TL — Tek Seferlik"
```

### E4 — /deepfake-analizi Sayfası

```
H1: "Deepfake & Ses Klonu Tehdit Analizi"
Alt metin: "Yöneticilerinizin dijital izi ses klonu saldırısına açık mı?
             Kamuya açık verilerle risk haritanızı çıkarın."
Fiyat: "1.490 TL — Tek Seferlik"
```

### E5 — /ai-red-team Sayfası

```
H1: "AI Red Team Raporu"
Alt metin: "Bir saldırgan şirketinizi hedef almadan önce AI ile 30 dakikada
             ne öğrenebilir? Siz önce öğrenin."
Fiyat: "2.490 TL — Tek Seferlik"
```

### E6 — /sahte-dokuman Sayfası

```
H1: "Fatura, Sözleşme, Kimlik — Gerçek mi, Sahte mi?"
Fiyat: "49 TL / tarama  |  490 TL / ay (100 tarama)"
```

---

## BÖLÜM F — ENTEGRASYONlar SAYFASI / BÖLÜMÜ

Find the integrations display (admin panel or public page).

### F1 — ISR IMAP Entegrasyonunu Kamuya Açık Görünümden Kaldır

```
"ISR IMAP (AI Satış Asistanı)" satırını
kamuya açık entegrasyon listesinden kaldır.
Bu iç sistem, müşteriye gösterilmemeli.
Admin panelinde kalabilir.
```

### F2 — Claude Model Adını Güncelle

```
ÖNCE: "Claude Sonnet 4.6"
SONRA: "Claude Sonnet" (versiyon numarası olmadan — model güncellendikçe otomatik doğru kalır)
```

---

## BÖLÜM G — GENEL DİL TARAMASI

Run a global search across ALL page/component files for these strings
and replace them:

```
GLOBAL DEĞİŞTİRMELER:

"işletmenizin"   →  "şirketinizin"
"işletmenizi"    →  "şirketinizi"
"işletmenize"    →  "şirketinize"
"işletmeler"     →  "şirketler"
"işletmelerin"   →  "şirketlerin"
"KOBİ'ler için"  →  "Türk şirketleri için"
"KOBİ odaklı"   →  "Türkiye odaklı"
"orta ölçekli şirket" → "şirket"
"küçük ve orta"  →  kaldır veya sadece "şirket" yap

DOKUNMA (bunları değiştirme):
- Blog yazısı başlıklarında "KOBİ" — SEO değeri var
- Rakip karşılaştırma tablolarında "KOBİ fiyatlandırması" — anlam taşıyor
- Teknik dokümanlarda sektör tanımı olarak kullanılan "KOBİ"
```

---

## BÖLÜM H — META VERİLER GÜNCELLEMESİ

Find `index.html` or the metadata configuration file.

```html
<!-- ÖNCE -->
<title>CyberStep.io — KOBİ'ler için Siber Güvenlik Risk Analizi</title>
<meta name="description" content="KOBİ'ler için Türkçe siber güvenlik risk analizi platformu. 20 soruluk ücretsiz Mini Değerlendirme ile şirketinizin risk profilini öğrenin, AI destekli kişiselleştirilmiş rapor alın.">
<meta property="og:title" content="CyberStep.io — KOBİ'ler için Siber Güvenlik Risk Analizi">
<meta property="og:description" content="KOBİ'ler için Türkçe siber güvenlik risk analizi platformu.">
<meta name="twitter:title" content="CyberStep.io — KOBİ'ler için Siber Güvenlik Risk Analizi">

<!-- SONRA -->
<title>CyberStep.io — Türkiye'nin Siber Güvenlik Risk Platformu</title>
<meta name="description" content="Dış saldırı yüzeyi taraması, AI güvenlik analizi, EU AI Act uyumu ve sürekli maruz kalma yönetimi. Türkçe. Her ölçekteki Türk şirketi için.">
<meta property="og:title" content="CyberStep.io — Türkiye'nin Siber Güvenlik Risk Platformu">
<meta property="og:description" content="Saldırganın gözüyle şirketinize bakın. AI destekli analiz, KVKK uyumu, finansal risk tahmini. Ücretsiz domain taramasıyla başlayın.">
<meta name="twitter:title" content="CyberStep.io — Türkiye'nin Siber Güvenlik Risk Platformu">
<meta name="twitter:description" content="Dış saldırı taraması, AI güvenlik analizi, EU AI Act uyumu. Türkçe. Ücretsiz başlayın.">
```

---

## BÖLÜM I — FİYAT TUTARLILIK KONTROL LİSTESİ

After making all changes above, verify these prices are consistent
across ALL pages where they appear:

```
SERVİS                        DOĞRU FİYAT         KONTROL NOKTALARI
─────────────────────────────────────────────────────────────────
AI Güvenlik Değerlendirmesi   2.900 TL             grid, servis sayfası, fiyatlar
EU AI Act Uyum Skoru          1.990 TL             grid, servis sayfası, fiyatlar, dropdown
AI Red Team Raporu            2.490 TL             grid, servis sayfası, fiyatlar
Deepfake Analizi              1.490 TL             grid, servis sayfası, fiyatlar
AI Sahte Doküman              49 TL/tarama         grid, servis sayfası, fiyatlar
AI Phishing Simülasyonu       1.990 TL (tek)       grid, servis sayfası, fiyatlar (tek seferlik)
AI Araç İzleme                490 TL/ay            grid, servis sayfası, fiyatlar
AI Politika Otogüncelleme     990 TL/yıl           grid, servis sayfası, fiyatlar
Sızıntı İzleyici              2.900 TL/yıl         grid, servis sayfası, fiyatlar
Sanal CISO                    8.000 TL/ay          grid, servis sayfası, fiyatlar
Mini Değerlendirme            Ücretsiz             hero, fiyatlar, grid
Tam Değerlendirme             5.990 TL             fiyatlar, servis sayfası
```

---

## BÖLÜM J — SON KONTROL (Tamamlandıktan sonra yap)

1. Ana sayfada "BETA" kelimesi kalıyor mu? → Kalmamalı
2. Herhangi bir yerde "24-48 saat" hâlâ var mı? → Olmamalı
3. "işletme" kelimesi global aramada çıkıyor mu? → Yalnızca blog ve teknik dokümanlarda kabul edilebilir
4. Navigation'da toplam kaç dropdown var? → 2 olmalı: "AI Güvenlik" ve "Araçlar"
5. Grid'de kaç araç/servis var? → 26 olmalı
6. Fiyatlar sayfasında "AI Phishing" hangi kategoride? → "Tek Seferlik" bölümünde
7. Sanal CISO aylık abonelik listesinde var mı? → Evet olmalı

---

## BÖLÜM K — UZMAN DOĞRULAMA AKIŞI (Backend + Admin Panel)

This section requires BOTH frontend and backend changes.
The expert review is a two-stage model:
Stage 1 → AI generates report instantly (already works)
Stage 2 → Expert reviews in background, adds "Uzman Doğrulandı" badge

### K1 — Database: reports tablosuna alan ekle

Find the `reports` table in the Drizzle schema. Add these columns if not present:

```typescript
// In schema.ts, reports table:
expertReviewStatus: varchar('expert_review_status', { length: 20 })
  .default('pending'),
  // 'pending' | 'reviewed' | 'approved' | 'note_added'

expertReviewedAt: timestamp('expert_reviewed_at'),

expertNotes: text('expert_notes'),
// Optional notes the expert adds — shown to customer

expertReviewedBy: varchar('expert_reviewed_by', { length: 100 }),
// Expert name shown on report: "İncelendi: [İsim], Siber Güvenlik Uzmanı"

expertBadgeEarned: boolean('expert_badge_earned').default(false),
// true when expert approves → triggers customer notification
```

### K2 — Admin Panel: Uzman İnceleme Arayüzü

Find the assessments admin page (`/admin-panel/assessments`).

Add an "Uzman İnceleme" tab or section for full assessment reports:

```
Filtre: [ Bekleyen (pending) | İncelendi | Tümü ]

Her satırda:
- Şirket adı
- Değerlendirme tarihi
- AI risk skoru
- Uzman inceleme durumu (bekleyen/onaylandı)
- Aksiyon: [İncele ve Onayla] butonu
```

"İncele ve Onayla" butonu açıldığında modal göster:

```
Modal başlığı: "Uzman İnceleme — [Şirket Adı]"

Bölüm 1: AI Raporu özeti (salt okunur)
  - Risk skoru, kritik bulgular, alan skorları

Bölüm 2: Uzman Notu (isteğe bağlı textarea)
  Placeholder: "Müşteriye eklenecek uzman notu (isteğe bağlı).
                Boş bırakırsanız sadece onay rozeti eklenir."

Bölüm 3: İncelemeyi yapan uzman adı
  Input: "Uzman adı ve unvanı"
  Örnek: "Ahmet Yılmaz, CISSP — Siber Güvenlik Uzmanı"

Butonlar:
  [✓ Onayla ve Rozeti Ekle] — yeşil, primary
  [✗ İptal]
```

### K3 — Onay Tetikleyicisi: Badge + Bildirim

When admin clicks "Onayla ve Rozeti Ekle":

```typescript
// 1. Update report record
await db.update(reports)
  .set({
    expertReviewStatus: 'approved',
    expertReviewedAt: new Date(),
    expertNotes: formData.notes || null,
    expertReviewedBy: formData.expertName,
    expertBadgeEarned: true,
  })
  .where(eq(reports.id, reportId));

// 2. Send customer notification email
await sendEmail({
  to: customer.email,
  subject: `✅ Raporunuz Uzman Tarafından İncelendi — ${customer.companyName}`,
  template: 'expert_review_complete',
  data: {
    companyName: customer.companyName,
    expertName: formData.expertName,
    hasNotes: !!formData.notes,
    reportUrl: `${BASE_URL}/raporlarim/${reportId}`,
  }
});

// 3. If WhatsApp enabled for this customer:
if (customer.whatsappNumber) {
  await sendWhatsApp({
    to: customer.whatsappNumber,
    message: `✅ CyberStep: ${customer.companyName} değerlendirme raporunuz uzman tarafından incelendi ve onaylandı. Raporunuza "Uzman Doğrulandı" rozeti eklendi. 🔗 ${BASE_URL}/raporlarim/${reportId}`
  });
}
```

### K4 — Müşteri Raporu Sayfasına Badge Göster

Find the report display component. Add this block
that only renders when `report.expertBadgeEarned === true`:

```tsx
{report.expertBadgeEarned && (
  <div className="expert-badge-block">
    {/* Amber/gold arka plan, kalkan ikonu */}
    <div className="expert-badge">
      🛡️ Uzman Doğrulandı
    </div>
    <div className="expert-meta">
      <span>{report.expertReviewedBy}</span>
      <span>{formatDate(report.expertReviewedAt)}</span>
    </div>

    {report.expertNotes && (
      <div className="expert-notes">
        <h4>Uzman Notu:</h4>
        <p>{report.expertNotes}</p>
      </div>
    )}
  </div>
)}
```

### K5 — Admin Cron: 24 Saat Sonra Hatırlatıcı

Add a cron job that alerts admin when full assessment reports
have been waiting for expert review for more than 24 hours:

```typescript
// Every day at 09:00 — check for overdue expert reviews
cron.schedule('0 9 * * *', async () => {
  const overdueReports = await db
    .select()
    .from(reports)
    .innerJoin(assessments, eq(reports.assessmentId, assessments.id))
    .where(
      and(
        eq(reports.expertReviewStatus, 'pending'),
        eq(assessments.type, 'full'), // only full assessments
        lt(reports.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
      )
    );

  if (overdueReports.length > 0) {
    await sendAdminEmail({
      subject: `⏰ ${overdueReports.length} rapor uzman incelemesi bekliyor`,
      body: `Aşağıdaki tam değerlendirme raporları 24 saatten uzun süredir
             uzman incelemesi bekliyor:\n\n` +
             overdueReports.map(r =>
               `• ${r.companyName} — ${formatDate(r.createdAt)}`
             ).join('\n') +
             `\n\nAdmin paneli: ${ADMIN_URL}/admin-panel/assessments?filter=pending`
    });
  }
});
```

### K6 — Email Şablonu: expert_review_complete

Add this email template to the email templates system:

```
Konu: ✅ Raporunuz Uzman Tarafından İncelendi — [Şirket Adı]

Sayın [Yetkili Adı],

[Şirket Adı] için hazırlanan siber güvenlik değerlendirme raporunuz,
uzman danışmanımız tarafından incelendi ve onaylandı.

━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ Raporunuza "Uzman Doğrulandı" rozeti eklendi.
━━━━━━━━━━━━━━━━━━━━━━━━━

İnceleyen: [Uzman Adı ve Unvanı]
İnceleme tarihi: [Tarih]

[UZMAN NOTU VAR İSE:]
━━━━━━━━━━━━━━━━━━━━━━━━━
Uzman Notu:
[expertNotes]
━━━━━━━━━━━━━━━━━━━━━━━━━

Güncel raporunuzu görüntülemek için:
[Raporu Görüntüle →] — [reportUrl]

Bu raporu ihale teklifinizde, sigorta başvurunuzda veya
müşterilerinize güven belgesi olarak kullanabilirsiniz.

CyberStep.io
```

---

## ÖZET — YAPILAN DEĞİŞİKLİK SAYISI (GÜNCELLENDİ)

| Bölüm | Değişiklik |
|---|---|
| Navigasyon | 2 yeni dropdown item + 1 yeni dropdown |
| Hero | 4 stat güncelleme + BETA metni |
| Nasıl Çalışır | **3 adımdan 4 adıma genişletildi** — yeni Uzman Doğrulama adımı |
| Brand Story | 1 badge + 1 metin |
| Araçlar Grid | 4 yeni kart + 2 fiyat düzeltme |
| Hakkımızda | 1 metin + 2 tablo satırı |
| Fiyatlar | 3 yapısal değişiklik + 1 yeni paket + **güven bantı güncelleme** |
| Servis Sayfaları | 6 sayfa + **Tam Değerlendirme uzman bloku** |
| **Admin Panel** | **Uzman inceleme arayüzü + onay akışı (YENİ)** |
| **Database** | **reports tablosuna 5 yeni alan (YENİ)** |
| **Backend** | **Onay tetikleyici + bildirim + cron job (YENİ)** |
| **Email** | **expert_review_complete şablonu (YENİ)** |
| Entegrasyonlar | 1 kaldırma + 1 güncelleme |
| Global Dil | "işletme" → "şirket" (tüm dosyalar) |
| Meta Veriler | 5 meta tag güncellemesi |

---

*CyberStep.io Editoryal Güncelleme Promptu v2 — Uzman Doğrulama Akışı Dahil — 31 Mayıs 2026*
