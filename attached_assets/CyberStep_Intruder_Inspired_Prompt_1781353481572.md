# CyberStep — Güven Rozeti, Acil Tehdit Bildirimi, AI Analist Markalaması, Bayi Sayfası

## Replit Agent'a Ver

---

## ÖNCE KONTROL ET — HENÜZ DEĞİŞİKLİK YAPMA

Bu prompt dört bağımsız özelliği kapsıyor (rozet, acil tehdit bildirimi, AI
analist markalaması, bayi/partner sayfası). Hepsi mevcut veriyi/altyapıyı
yeniden paketliyor — büyük yeni veri toplama gerektirmiyor. Önce mevcut
yapıyı çıkar:

```
Aşağıdakileri kontrol et ve bana rapor ver, HENÜZ DEĞİŞİKLİK YAPMA:

1. Müşteri/lead'lerin abonelik durumu (ücretli mi, hangi paket) nerede
   tutuluyor? Tablo adı ve ilgili kolonlar nedir?

2. Admin panelde müşteri/abone listesi hangi dosyada? Müşteriye özel
   bir "hesap ayarları" veya "embed kod" benzeri sayfa var mı?

3. CVE/EPSS verisi hangi tabloda tutuluyor ve hangi cron bunu güncelliyor?
   (örn. cve_database, threat_intel vb.) Müşterinin teknoloji yığını
   (customer_tech_stack) ile CVE'leri eşleştiren bir mekanizma var mı?

4. Teaser/bildirim e-postaları üreten servis hangisi? (leadTeaserEmail.ts
   veya benzeri) Yeni bir e-posta tipi (örn. "acil tehdit bildirimi")
   eklemek için aynı altyapı kullanılabilir mi?

5. Public web sitesinin (cyberstep.io) kod tabanı bu repo içinde mi,
   ayrı bir proje mi? Sayfa yapısı (Next.js app router / pages) nasıl?
   Mevcut "Partner" veya "İş Ortaklığı" benzeri bir sayfa var mı?

6. Marka paleti kodda nerede merkezi olarak tanımlı? (tailwind.config,
   theme dosyası vb.) Renkler: #060D1A (koyu zemin), #00C8FF (cyan),
   #F5A623 (amber), #E8EDF5 (açık metin) — bu paletin tanımlı olduğu
   dosyayı bul.

7. AI ile içerik/teaser üreten serviste (leadTeaserEmail.ts veya
   contentGenerator.ts) şu an "CyberStep" dışında bir asistan/analist
   ismi kullanılıyor mu?

Bu bilgileri özetle, ardından devam talimatını bekle. Mevcut tablo/dosya
adlarını KORU — bu prompttaki örnek isimler sadece öneridir.
```

---

## GENEL KURALLAR

- **Surgical/minimal diff**: Mevcut cron job'lar, scoring, teaser akışı,
  PDF üretimi BOZULMAYACAK. Sadece üzerine ekleme.
- **Marka paletini kullan**: #060D1A, #00C8FF, #F5A623, #E8EDF5 — yeni
  oluşturulan her görsel/sayfa bu paletle uyumlu olmalı.
- Migration'lar additive olsun (`ADD COLUMN IF NOT EXISTS`).
- Her bölümden sonra build + smoke test yap.
- Dört bölüm bağımsızdır, istenen sırayla veya tek tek uygulanabilir.
  Önerilen sıra: 1 (rozet) → 2 (acil tehdit) → 3 (AI analist adı) → 4
  (bayi sayfası) — 1 ve 2 en hızlı/somut etkiyi verir.

---

## BÖLÜM 1 — "CyberStep ile Korunuyor" GÜVEN ROZETİ

### Amaç
Intruder'ın "Protected by Intruder" rozeti gibi, ücretli/aktif abonelik
sahibi müşterilere kendi web sitelerine ekleyebilecekleri bir görsel
rozet/embed kodu sun. Bu hem müşterinin kendi ziyaretçilerine güven
sinyali verir hem de CyberStep'e geri link sağlayarak organik görünürlük
yaratır.

### Veri Modeli

Aboneliğin bulunduğu tabloya (BÖLÜM ÖNCESİ kontrolde bulduğun tablo) şu
alanı ekle:

```sql
ALTER TABLE <subscriptions_tablosu>
  ADD COLUMN IF NOT EXISTS badge_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS badge_token text;
```

`badge_token`, her müşteri için benzersiz, tahmin edilemez bir string
olsun (örn. `crypto.randomUUID()` veya mevcut kullanılan token üretim
yöntemi). Bu token, rozetin hangi müşteriye ait olduğunu doğrulamak ve
rozet tıklamalarını/gösterimlerini izlemek için kullanılır.

### Rozet Tasarımı (SVG)

İki varyant oluştur — koyu zemin için ve açık zemin için, marka
paletiyle:

```
Varyant 1 (koyu/transparan arka plan için):
- Arka plan: transparent veya #060D1A
- "CyberStep" yazısı: #E8EDF5
- "ile Korunuyor" / "Protected" yazısı: #00C8FF
- Küçük kalkan ikonu: #00C8FF

Varyant 2 (açık arka plan için):
- Arka plan: #FFFFFF veya transparent
- "CyberStep" yazısı: #060D1A
- "ile Korunuyor" yazısı: #00C8FF
- Kalkan ikonu: #00C8FF

Boyut: ~150x40px (footer'a uygun, küçük ve şık)
```

SVG'leri `/public/badges/cyberstep-badge-dark.svg` ve
`/public/badges/cyberstep-badge-light.svg` olarak ekle (veya mevcut
public asset yapısına uygun konuma).

### Embed Endpoint

Yeni bir public endpoint oluştur (kimlik doğrulama gerektirmez, sadece
token doğrular):

```
GET /api/badge/:badgeToken
```

Bu endpoint:
1. `badge_token`'ı doğrular, `badge_enabled = true` olan aktif bir
   aboneliğe ait mi kontrol eder.
2. Geçerliyse, rozet SVG'sini döndürür (veya bir küçük HTML/JS snippet —
   tıklama sayısını loglamak istiyorsan).
3. Geçersizse 404 veya generic bir "CyberStep" rozeti döndürür (token
   sızıntısı durumunda bilgi vermemek için).

Tıklama/gösterim sayısını basitçe loglamak istersen:

```sql
ALTER TABLE <subscriptions_tablosu>
  ADD COLUMN IF NOT EXISTS badge_impression_count integer DEFAULT 0;
```

Her başarılı GET isteğinde bu sayacı +1 artır (rate-limit ile, örn.
aynı IP'den dakikada 1 sayım).

### Admin Panel / Müşteri Hesap Sayfası Entegrasyonu

Müşteri hesap/ayarlar sayfasına (BÖLÜM ÖNCESİ'nde bulduğun konum) yeni
bir "Güven Rozeti" bölümü ekle:

```
┌─────────────────────────────────────────┐
│ Güven Rozeti                              │
│                                            │
│ [Rozet Önizlemesi - SVG]                  │
│                                            │
│ Web sitenize bu rozeti ekleyerek           │
│ ziyaretçilerinize sürekli güvenlik         │
│ taraması yapıldığını gösterin.            │
│                                            │
│ HTML kodu:                                │
│ ┌────────────────────────────────────┐   │
│ │ <a href="https://cyberstep.io"      │   │
│ │   target="_blank">                  │   │
│ │   <img src="https://cyberstep.io/   │   │
│ │   api/badge/{badgeToken}"            │   │
│ │   alt="CyberStep ile Korunuyor"/>    │   │
│ │ </a>                                 │   │
│ └────────────────────────────────────┘   │
│ [Kopyala] butonu                          │
│                                            │
│ Gösterim sayısı: 1.247                    │
└─────────────────────────────────────────┘
```

Sadece aktif/ücretli abonelik sahiplerine göster (free/teaser
kullanıcılarına gösterme — bu rozet bir "ücretli müşteri ayrıcalığı").

---

## BÖLÜM 2 — ACİL TEHDİT BİLDİRİMİ ("Emerging Threat Alert")

### Amaç
Intruder'ın "Emerging Threat Detection" özelliğine benzer: yeni/kritik
bir CVE duyurulduğunda ve bu CVE, bir müşterinin `customer_tech_stack`
kaydındaki teknolojiyle eşleşiyorsa, o müşteriye otomatik ve proaktif
bir bildirim e-postası gönder. Bu, "biz olaya tepki vermek için sizi
beklemiyoruz" mesajını somutlaştırır.

### Önkoşul
Bu bölüm, mevcut CVE/EPSS cron'unun ve `customer_tech_stack` tablosunun
üzerine inşa edilir. BÖLÜM ÖNCESİ kontrolünde bu ikisinin var olduğunu
doğrula. Yoksa, bu bölümü atla ve bana bildir.

### Veri Modeli

```sql
ALTER TABLE <cve_tablosu>
  ADD COLUMN IF NOT EXISTS severity_label text,  -- 'critical' | 'high' | 'medium' | 'low'
  ADD COLUMN IF NOT EXISTS is_emerging boolean DEFAULT false,  -- son 7 gün içinde yayınlandı mı
  ADD COLUMN IF NOT EXISTS alert_sent_at timestamp;

CREATE TABLE IF NOT EXISTS emerging_threat_alerts (
  id SERIAL PRIMARY KEY,
  cve_id text NOT NULL,
  customer_id integer NOT NULL,  -- ilgili müşteri/lead FK, kendi tablo adına göre düzelt
  technology_matched text,
  sent_at timestamp DEFAULT now(),
  email_status text DEFAULT 'pending'  -- 'pending' | 'sent' | 'failed'
);
```

### Cron Mantığı

Mevcut CVE/EPSS güncelleme cron'unun sonuna (veya yeni, küçük bir cron
job olarak — mevcut wrapCron pattern'ini kullan) şu mantığı ekle:

```typescript
async function checkEmergingThreats() {
  // 1. Son 24 saatte eklenen/güncellenen CVE'leri al,
  //    severity 'critical' veya 'high' VE EPSS skoru > 0.5 olanları filtrele
  const newCriticalCves = await getEmergingCriticalCves();

  for (const cve of newCriticalCves) {
    // 2. customer_tech_stack'te bu CVE'nin ürün/teknolojisiyle eşleşen
    //    müşterileri bul
    const affectedCustomers = await findCustomersByTechnology(cve.affectedProduct);

    for (const customer of affectedCustomers) {
      // 3. Bu müşteriye bu CVE için daha önce alert gönderilmiş mi kontrol et
      const alreadySent = await checkAlertSent(cve.cveId, customer.id);
      if (alreadySent) continue;

      // 4. HITL kuyruğuna ekle (mevcut ISR onay akışına benzer şekilde —
      //    otomatik gönderim yerine, ISR ekibinin onayından geçsin)
      await queueEmergingThreatAlert(cve, customer);
    }
  }
}
```

**Önemli**: Mevcut "send-teaser real email sending should remain manual
(intentional ISR review gate)" prensibiyle uyumlu olarak, bu bildirimler
de otomatik gönderilmesin — admin panelde bir "Acil Tehdit Bildirimleri"
kuyruğuna düşsün, ISR ekibi gözden geçirip onaylasın/gönderesin.

### E-posta İçeriği

Mevcut teaser e-posta üretim servisini (leadTeaserEmail.ts) referans
alarak, yeni bir şablon fonksiyonu ekle:

```typescript
function buildEmergingThreatEmail(customer: Customer, cve: CveRecord): EmailContent {
  return {
    subject: `⚠️ Acil: ${cve.cveId} sisteminizi etkileyebilir`,
    body: `
Sayın ${customer.contactName},

Az önce yayınlanan ${cve.cveId} (CVSS: ${cve.cvssScore}, EPSS: ${cve.epssScore})
güvenlik açığı, taramamızda tespit ettiğimiz ${cve.affectedProduct}
teknolojinizle eşleşiyor.

Bu, CyberStep'in proaktif izleme sisteminin bir parçası — yeni bir tehdit
ortaya çıktığında sizi beklemeden bilgilendiriyoruz.

Önerilen aksiyon: ${cve.remediationSummary}

Detaylı analiz ve aksiyon planı için: [Tam Rapor]

CyberStep Güvenlik Ekibi
    `.trim(),
  };
}
```

### Admin Panel — Acil Tehdit Kuyruğu

Mevcut HITL/ISR onay kuyruğu UI'sına benzer bir görünüm: "Acil Tehdit
Bildirimleri" sekmesi/sayfası, `emerging_threat_alerts` tablosundaki
`pending` durumundaki kayıtları listeler, her biri için "Önizle / Gönder
/ Reddet" aksiyonları sunar.

---

## BÖLÜM 3 — AI ANALİST MARKALAMASI

### Amaç
Mevcut Claude Haiku tabanlı içerik/teaser üretim motorunu, müşteriye
dönük "isimli bir AI güvenlik analisti" olarak markala (Intruder'ın
"GregAI" konseptine benzer, ama Türkçe ve CyberStep markasına uygun).

### İsim Önerisi

Aşağıdaki isimlerden birini seç (veya kullanıcıya sor) — CyberStep
markasıyla uyumlu, akılda kalıcı, Türkçe telaffuzu kolay:

- **"Adım"** (CyberStep — "step/adım" temasıyla uyumlu, "bir adım önde"
  çağrışımı)
- **"Step AI"**
- **"CyberStep Analist"** (en sade, marka adını taşıyor)

Bu prompt'ta örnek olarak **"Adım"** kullanılacak — Replit Agent'a
uygularken kullanıcıya hangi ismi kullanmak istediğini sor, sonra tüm
yerlerde o ismi kullan.

### Uygulama Noktaları

1. **Teaser e-postalarında imza**: Mevcut "CyberStep Güvenlik Ekibi"
   imzasının altına veya yanına küçük bir not:
   ```
   Bu rapor, Adım — CyberStep'in AI güvenlik analisti — tarafından
   otomatik olarak hazırlanmıştır ve ISR ekibimiz tarafından gözden
   geçirilmiştir.
   ```
   (Şeffaflık: AI kullanıldığını gizlemiyoruz, bu güven inşa eder.)

2. **PDF raporlarda**: Kapak sayfasında veya "Yönetici Özeti"
   bölümünün başında küçük bir "Adım AI tarafından hazırlandı" rozeti
   (marka paletiyle, küçük bir ikon + metin).

3. **Admin panelde**: AI tarafından üretilen içeriklerin (teaser,
   öneri, özet) yanında küçük bir "Adım" ikonu/etiketi — ISR ekibi
   hangi içeriğin AI üretimi olduğunu ayırt edebilir (zaten öyle
   olduğu için bu daha çok tutarlı markalama).

4. **Acil tehdit bildirimlerinde** (BÖLÜM 2): "Adım, az önce yayınlanan
   bu CVE'yi taramalarımızla eşleştirdi" gibi bir açılış cümlesi.

### Görsel Kimlik

Basit bir ikon oluştur (react-icons'tan uygun bir robot/asistan ikonu,
örn. `FaRobot` veya `FaBrain`, cyan #00C8FF renginde, küçük dairesel
arka plan ile) — bu ikon yukarıdaki tüm uygulama noktalarında tutarlı
kullanılsın.

---

## BÖLÜM 4 — BAYİ / İŞ ORTAKLIĞI SAYFASI

### Amaç
Intruder'ın "Become a Reseller" / Partner Program sayfası gibi, CyberStep
public web sitesinde görünür bir "İş Ortağı Ol" sayfası oluştur. Bu hem
inbound bayi başvurularını tetikler hem de kurumsal ciddiyet algısı
yaratır.

### Sayfa İçeriği

`/is-ortakligi` veya `/partner` route'unda (mevcut sayfa yapısına uygun
şekilde — BÖLÜM ÖNCESİ kontrolünde bulduğun Next.js yapısını kullan)
şu bölümleri içeren bir sayfa:

```
1. HERO
   Başlık: "CyberStep İş Ortağı Olun"
   Alt başlık: "Müşterilerinize siber güvenlik taraması sunun —
   altyapı bizden, marka sizden."
   CTA: "Başvuru Formu" (sayfa içi anchor veya modal)

2. KİMLER İÇİN?
   3 kart (önceki sunumlarda tanımlanan kanallar):
   - Mali Müşavirlik / SMMM Ofisleri
   - Bölgesel IT Bayileri / Sistem Odaları
   - Ticaret Odaları & Sektör Dernekleri

3. NASIL ÇALIŞIR? (3 adım, Intruder'ın "Launch your first scan in
   minutes" tarzına benzer basitlik)
   1. Başvurun ve onaylanın
   2. Whitelabel/komisyon modelinizi seçin
   3. Müşterilerinize tarama sunmaya başlayın

4. MODELLER (önceki hibrit fiyatlandırma sunumundan)
   - Komisyon/Referral
   - Whitelabel/Wholesale
   - Toplu Lisans (kurumlar/dernekler için)

5. BAŞVURU FORMU
   Alanlar: Şirket adı, iletişim kişisi, e-posta, telefon, şirket türü
   (mali müşavirlik / IT bayisi / dernek / diğer), tahmini müşteri
   sayısı, mesaj.

   Form submit edildiğinde: mevcut contact form altyapısını kullan
   (Supabase'e kaydet + bildirim e-postası), ama farklı bir
   `inquiry_type = 'partner'` etiketiyle ayır ki normal müşteri
   taleplerinden ayrılabilsin.
```

### Tasarım

Marka paletini kullan (#060D1A koyu zemin, #00C8FF/#F5A623 vurgular,
#E8EDF5 metin) — mevcut sitenin diğer sayfalarıyla (Home, FAQ, Contact)
aynı bileşenleri (Button, CTABanner, FAQAccordion varsa) yeniden kullan,
yeni component icat etme.

### Navigasyon

Ana navigasyon menüsüne (Navbar.tsx) "İş Ortaklığı" linkini ekle —
mevcut link listesine eklenecek, layout'u bozmayacak şekilde.

---

## TEST

1. Build:
   ```
   pnpm --filter @workspace/api-server run build
   pnpm --filter @workspace/cyberstep run build
   ```

2. **Bölüm 1 testi**: Aktif bir test aboneliği için badge_token üret,
   `/api/badge/<token>` endpoint'ini tarayıcıda aç, SVG doğru render
   oluyor mu kontrol et. Müşteri hesap sayfasında "Güven Rozeti"
   bölümü görünüyor mu, kopyalama butonu çalışıyor mu?

3. **Bölüm 2 testi**: Manuel olarak test amaçlı bir "kritik CVE" kaydı
   ekle (gerçek bir CVE ID kullan ama is_emerging=true işaretle),
   `customer_tech_stack`'te o teknolojiye sahip bir test müşterisi
   olduğundan emin ol, cron'u manuel tetikle:
   ```sql
   -- test verisi ekle, sonra:
   SELECT * FROM emerging_threat_alerts WHERE email_status = 'pending';
   ```
   Admin panelde "Acil Tehdit Bildirimleri" kuyruğunda görünüyor mu?

4. **Bölüm 3 testi**: Bir test domain için teaser üret, e-posta
   içeriğinde "Adım" (veya seçilen isim) referansı doğru şekilde
   geçiyor mu?
   ```sql
   SELECT domain, teaser_body FROM lead_candidates WHERE domain = '<test_domain>';
   ```

5. **Bölüm 4 testi**: `/is-ortakligi` sayfasını tarayıcıda aç, mobil ve
   masaüstü görünümde test et, formu test verisiyle submit et,
   Supabase'de `inquiry_type = 'partner'` ile kaydedildiğini doğrula.

6. Regresyon: Mevcut teaser/PDF/admin panel akışlarının bozulmadığını
   doğrulamak için 2-3 eski lead üzerinde hızlı bir kontrol yap.

7. git commit && git push.

---

## ÖNCELİK SIRASI (zaman kısıtlıysa)

1. **Bölüm 1 (Güven Rozeti)** — en düşük efor, somut ve hemen
   kullanılabilir; ilk ücretli müşterilere "bonus" olarak sunulabilir.
2. **Bölüm 4 (Bayi Sayfası)** — statik içerik + form, mevcut altyapıyı
   kullanıyor, görünürlük açısından hızlı kazanım.
3. **Bölüm 3 (AI Analist Adı)** — küçük ama tüm müşteri temas
   noktalarına yayılması gerektiğinden biraz daha geniş diff.
4. **Bölüm 2 (Acil Tehdit Bildirimi)** — en değerli ama CVE eşleştirme
   mantığının doğruluğu kritik; yanlış eşleştirme (ilgisiz CVE için
   alarm) güven kaybı yaratabilir, bu yüzden HITL onayı şart ve test
   en dikkatli yapılması gereken bölüm.
