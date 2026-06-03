# CyberStep.io — AI Yönetimli Şirket İş Planı
## %90 AI, %10 İnsan — Tam Operasyon Modeli

**Tarih:** Haziran 2026
**Versiyon:** 1.0 — Yaşayan Döküman

---

## VİZYON

Türkiye'nin siber güvenlik risk platformu.
Minimum insan kaynağıyla maksimum etki.
Her süreç AI tarafından yürütülür,
insan sadece karar noktalarında devreye girer.

---

## BÖLÜM 1: İŞ MODELİ

### Gelir Akışları

```
1. SaaS Abonelik (Tekrarlayan — Ana Gelir)
   AI SOC Lite/Standart/Pro
   AI NOC Lite/Standart/Pro
   SOC+NOC Kombinasyon
   Tehdit İstihbarat Besleme
   CVE İzleme Aboneliği

2. Tek Seferlik Servis
   EASM Değerlendirmesi
   Pentest Lite
   E-posta Güvenlik Sertifikasyonu
   TPRM / Tedarikçi Risk Raporu

3. İstihbarat Aboneliği (İleride)
   Premium CISO Bülteni
   Sektör Derinleme Raporları
   API erişimi
```

### Fiyatlandırma Mantığı

```
Giriş noktası düşük:
  Ücretsiz domain tarama → 0 TL
  Mini değerlendirme → 0 TL
  E-posta sertifikasyonu → 2.500 TL (tek seferlik)

Aboneliğe geçiş:
  SOC Lite → 3.900 TL/ay
  Tam Koruma → 19.990 TL/yıl

Kurumsal tavan:
  SOC Pro → 16.500 TL/ay
  SOC+NOC Pro → 24.900 TL/ay
  Sanal CISO → 8.000 TL/ay
```

---

## BÖLÜM 2: %90 AI YÖNETİM MİMARİSİ

### AI Yönetim Katmanları

```
KATMAN 1 — TAM OTOMASYON (%0 insan)
  Lead generation pipeline (gece çalışır)
  Certstream / crt.sh / Shodan tarama
  Domain güvenlik tarama
  IOC feed toplama ve işleme
  CVE tespit ve Türkiye etki analizi
  Aylık/haftalık rapor üretimi
  Sosyal medya içerik üretimi
  E-posta teaser üretimi
  Tehdit istihbarat besleme (FortiGate push)
  Fatura oluşturma
  Yenileme hatırlatmaları

KATMAN 2 — AI ÜRETİR, İNSAN ONAYLAR (%5 insan)
  Sosyal medya paylaşımları
  CVE breaking alert yayını
  Aylık endeks raporu
  CISO haftalık bülteni
  Yüksek değerli lead email'leri

KATMAN 3 — AI DESTEKLİ İNSAN (%10 insan)
  Karmaşık müşteri soruları
  Enterprise satış görüşmeleri
  Partner/vendor anlaşmaları
  Hukuki/KVKK konular
  Kritik incident müdahale

KATMAN 4 — TAM İNSAN (%5 — asla AI değil)
  Strateji kararları
  Yatırımcı görüşmeleri
  Kriz yönetimi
  Etik sınır kararları
```

### İnsan Kaynağı Gereksinimleri

```
Şu an (0-50 müşteri):
  1 kişi — ISR + Müşteri başarısı
  (Sabah 1-2 saat liste onayı + email gönderimi)
  (Haftada 2-3 saat sosyal medya onayı)
  (Müşteri sorularına yanıt)

50-200 müşteri:
  1 ISR (yarı zamanlı → tam zamanlı)
  1 Teknik destek (yarı zamanlı)

200-500 müşteri:
  2 ISR
  1 Müşteri başarısı
  1 Teknik (SOC analist)
```

---

## BÖLÜM 3: SİSTEMLER VE OTOMASYON SEVİYESİ

### 3.1 Lead Generation (✅ Kurulu)

```
Durum: Aktif, test aşaması

Akış:
  02:00 Certstream + crt.sh → yeni TR domainler
  02:30 CyberStep tarama (paralel 5'li)
  03:30 Claude Haiku kalifikasyon
  04:00 Hunter.io + Apollo kontak bulma
  04:30 Email taslağı üretimi
  05:00 ISR günlük listesi hazır

Otomasyon: %95
İnsan: Sabah 30 dk onay + gönder butonu

Eksik / İyileştirme:
  □ Bounce rate takibi
  □ Açılma oranı optimizasyonu
  □ A/B test (2 farklı email şablonu)
  □ Yanıt gelince ISR IMAP otomatik karşılama
```

### 3.2 Müşteri Onboarding (⚠️ Eksik)

```
Şu an: Manuel
Hedef: Self-servis, sıfır insan müdahalesi

Olması gereken akış:
  1. cyberstep.io/fiyatlar → paket seç
  2. Iyzico → kredi kartı → ödeme
  3. Otomatik: müşteri kaydı oluştur
  4. Onboarding email serisi başlar (3 email)
     Gün 0: "Hesabınız hazır" + portal linki
     Gün 1: "İlk taramanızı yapın" rehberi
     Gün 3: "Şu ana kadar neler tespit ettik"
  5. Portal: domain ekle → otomatik tarama başlar
  6. Gün 7: "İlk hafta raporu" email
  7. Gün 14: Check-in + upsell önerisi

Hepsi Claude + Postmark + Iyzico webhook ile
tam otomatik çalışır.

Geliştirme: 1 hafta
```

### 3.3 Müşteri Portalı (⚠️ Kısmen Kurulu)

```
Mevcut:
  Domain tarama ✓
  Risk skoru ✓
  Bulgu listesi ✓

Eksik:
  □ Self-servis abonelik yönetimi
    (paket yükselt/düşür/iptal)
  □ Fatura geçmişi
  □ Whitelist yönetimi (IOC altyapısı hazır)
  □ Bildirim tercihleri
    (email/SMS/Telegram seç)
  □ Onboarding checklist
    (% tamamlanma göstergesi)
  □ Health score dashboard
    "Bu ay güvenliğiniz geçen aya göre X% iyileşti"
```

### 3.4 Müşteri Başarısı / Churn Prevention (❌ Yok)

```
En önemli eksik.
Müşteri sessizleştiğinde hiç tetikleyici yok.

Kurulacak sistem:

Sağlık skoru hesabı (her gece):
  Portal giriş: son 7 gün → +10
  Rapor indirdi → +15
  Yeni domain ekledi → +20
  Email açtı → +5
  Hiç girmedi → -10/gün

Otomatik tetikleyiciler:
  Skor < 40:
    "Sisteminizde yeni bulgular var" email
    (Claude kişiselleştirir — gerçek veri)

  Skor < 20:
    ISR'a "Bu müşteri kaybolmak üzere" uyarısı
    + tavsiye edilen aksiyon

  30 gün giriş yok:
    "Nasılsınız?" email
    (satış değil, samimi check-in)

  Abonelik bitişine 30 gün:
    Yenileme hatırlatma email serisi
    Gün 30: ilk hatırlatma
    Gün 14: "yenileme bonusu" teklifi
    Gün 7:  son hatırlatma
    Gün 1:  acil uyarı

Geliştirme: 1 hafta
```

### 3.5 Sosyal Medya (✅ Hazır, Test Aşaması)

```
Durum: Engine hazır, hesaplar açıldı

Akış:
  Pazar 20:00 → haftalık içerik üretimi
  Her platform için görsel + metin + hashtag
  Admin panelde onay
  09:30 otomatik yayın

Otomasyon: %85
İnsan: Haftada 30-45 dk onay

Özel günler DB'de hazır.
İlk yayın: 1 ay veri birikmeden önce başlatma.
```

### 3.6 İçerik ve Otorite (⚠️ Kısmen Kurulu)

```
Mevcut:
  Aylık endeks raporu engine ✓
  Haftalık CISO bülteni ✓
  CVE anlık etki sistemi ✓

Eksik:
  □ Blog yazısı üretimi
    Aylık 4 blog yazısı (Claude Sonnet)
    SEO odaklı, Türkçe
    Kategori: CVE analizi, sektör spotlights,
    KVKK rehberleri, teknik ipuçları

  □ Blog CMS entegrasyonu
    Ghost veya Wordpress API
    Taslak üretilir, admin onaylar, yayınlanır

  □ LinkedIn newsletter
    (LinkedIn'in kendi newsletter özelliği)
    Aylık raporun LinkedIn versiyonu

  □ YouTube Shorts / Reels
    Aylık endeks verisinden otomatik video
    (Bu aşamada erken — ileride değerlendir)
```

### 3.7 SEO ve Organik Büyüme (❌ Yok)

```
En büyük uzun vadeli büyüme kanalı.
Şu an sıfır.

Kurulacaklar:

Teknik SEO:
  □ Sitemap otomatik güncelleme
  □ Schema markup (Organization, FAQ)
  □ Core Web Vitals optimizasyonu
  □ cyberstep.io/cve/[id] sayfaları
    → Her CVE için otomatik sayfa
    → "CVE-2024-XXXX Türkiye etkisi" araması
    → Organik trafik

İçerik SEO:
  □ Blog yazıları (Claude üretir)
  □ Araç sayfaları (ücretsiz DMARC checker, vs.)
  □ Karşılaştırma sayfası (SecurityScorecard vs)
  □ Yerel SEO ("İstanbul siber güvenlik")

Backlink:
  □ Basın bülteni → Webrazzi, BThaber
  □ ISACA Türkiye makale katkısı
  □ Akademik kaynak olma

Geliştirme: 2-3 hafta (teknik) + sürekli içerik
```

### 3.8 Fatura ve Ödeme (⚠️ Kısmen Kurulu)

```
Mevcut:
  Iyzico ödeme ✓ (production key bekleniyor)
  Tek seferlik ödeme ✓

Eksik:
  □ Otomatik aylık yenileme
    Iyzico subscription API
    Kart kayıt + aylık otomatik çekim

  □ Başarısız ödeme akışı (dunning)
    Gün 0:  ödeme başarısız → email
    Gün 3:  "Kartınızı güncelleyin" hatırlatma
    Gün 7:  servis askıya alma uyarısı
    Gün 10: servis durdur + reaktivasyon linki

  □ Paket yükseltme/düşürme
    Orantılı ücret hesabı
    Anında aktif

  □ E-fatura
    Türkiye'de zorunlu
    GIB entegrasyonu veya
    Logo/Paraşüt API entegrasyonu
    Her ödemede otomatik e-fatura

Geliştirme: 1-2 hafta
```

### 3.9 Destek Sistemi (❌ Yok)

```
Şu an: Email'e gelen her şey ISR'a düşüyor.

Kurulacak:

Tier 1 — Tam AI (Claude):
  SSS soruları → anında yanıt
  "Nasıl kullanırım?" → rehber linki
  "Fatura nerede?" → portal linki
  "Domain nasıl eklerim?" → adım adım

Tier 2 — AI + İnsan:
  Teknik sorular → Claude taslak + ISR onay
  Şikayet → Claude empati + ISR aksiyon

Tier 3 — Tam İnsan:
  Kritik incident
  İptal tehdiği
  Hukuki konu

Araç: Mevcut ISR IMAP sistemi bu rolü üstlenir.
Gemini + Claude hibrit yanıt.

Destek portalı:
  Sık sorulan sorular (statik, SEO'ya katkı)
  Canlı chat widget (Crisp veya Tawk.to — ücretsiz)
  Ticket sistemi (Jira entegrasyonu hazır)
```

### 3.10 Ortaklık ve Kanal Satışı (❌ Yok)

```
Şu an: Sadece doğrudan satış

İleride:
  KVKK danışmanları → white-label rapor
  BT entegratörleri → portal aboneliği
  Muhasebe/hukuk firmaları → müşterilerine önersin

Bu kanallar için:
  Partner portal
  Komisyon takip sistemi
  Co-branded rapor

Öncelik: 50+ müşteriden sonra
```

---

## BÖLÜM 4: OTORITE YOLCULUĞU TAKVİMİ

### Ay 1-3: Veri Biriktirme

```
Haftalık:
  □ Gece pipeline çalışır, veri birikir
  □ Sosyal medya: haftada 3-4 paylaşım
    (tarama istatistikleri, güvenlik ipuçları)
  □ Blog: ayda 2 yazı (Claude üretir, insan onaylar)

Aylık:
  □ İlk endeks raporu (100+ domain tarandıktan sonra)
  □ Basın bülteni → Webrazzi, BThaber
  □ LinkedIn newsletter ilk sayısı

Hedef:
  LinkedIn: 200+ takipçi
  E-posta listesi: 50+ abone
  Organik tarama: 5/gün
```

### Ay 4-6: Momentum

```
Haftalık:
  □ CISO bülteni aktif (ilk aboneler)
  □ CVE breaking alert (her kritik CVE'de)
  □ Sosyal medya carousel paylaşımları

Aylık:
  □ Endeks raporu düzenli
  □ Sektör deep-dive (Finans veya Sağlık)
  □ ISACA Türkiye'ye konuşmacı başvurusu

Hedef:
  LinkedIn: 1.000+ takipçi
  "CyberStep verilerine göre" ilk medya alıntısı
  E-posta listesi: 300+ abone
  Aylık organik tarama: 50+
```

### Ay 7-12: Otorite

```
Çeyreklik:
  □ Sektör derinleme PDF raporu
  □ Basın bülteni + medya outreach
  □ ISACA/TÜBİSAD etkinlik sunumu

Yıllık:
  □ "Türkiye Siber Güvenlik Durumu 2026" raporu
  □ IDC/Gartner'ın referans aldığı ilk Türk kaynak

Hedef:
  LinkedIn: 3.000+ takipçi
  Medya alıntısı: 10+
  E-posta listesi: 1.000+
  "CyberStep" aramasında Google ilk sayfa
```

---

## BÖLÜM 5: GELİR PROJEKSİYONU

### Muhafazakar Senaryo

```
Ay 3:
  Müşteri: 8
  Ortalama: 6.500 TL/ay
  MRR: 52.000 TL

Ay 6:
  Müşteri: 25
  Ortalama: 7.200 TL/ay
  MRR: 180.000 TL

Ay 12:
  Müşteri: 65
  Ortalama: 8.100 TL/ay
  MRR: 526.500 TL
  ARR: 6.3M TL

Yıl 2:
  Müşteri: 180
  Ortalama: 8.800 TL/ay
  MRR: 1.584.000 TL
  ARR: 19M TL
```

### Operasyonel Maliyet (Yıl 1)

```
AI altyapısı:
  Claude (Haiku ağırlıklı)    ~120 TL/ay
  Shodan $69                  ~2.200 TL/ay
  Hunter.io $34               ~1.100 TL/ay
  Postmark                    ~320 TL/ay

Platform:
  Replit (→ Hetzner ay 6+)    ~640 TL/ay
  Supabase                    ~320 TL/ay
  Domain + SSL                ~50 TL/ay

Pazarlama:
  Google Ads (opsiyonel)      ~3.000 TL/ay
  LinkedIn Ads (opsiyonel)    ~2.000 TL/ay

TOPLAM ALTYapı: ~4.750 TL/ay (~$145)

8 müşteri x 6.500 TL = 52.000 TL gelir
Altyapı oranı: %9 — çok sağlıklı
```

---

## BÖLÜM 6: EKSİK SİSTEMLER — ÖNCELİK LİSTESİ

### Acil (Satışa Başlamadan Önce)

```
1. Self-servis abonelik yönetimi
   Paket yükselt/düşür/iptal
   Müşteri portaldaki self-servis

2. Otomatik onboarding email serisi
   Ödeme sonrası tetiklenen 5 email
   Claude + Postmark, sıfır insan

3. Otomatik aylık yenileme
   Iyzico subscription API
   Başarısız ödeme akışı

4. E-fatura entegrasyonu
   Her ödemede otomatik
   Logo/Paraşüt API
```

### Bu Ay (İlk 30 Gün)

```
5. Müşteri sağlık skoru
   Churn prevention tetikleyicileri
   ISR'a "kaybolmak üzere" uyarısı

6. Blog altyapısı + SEO
   Ghost veya Wordpress API
   Claude haftalık yazı üretimi

7. CVE sayfaları (cyberstep.io/cve/[id])
   Organik trafik için
   Otomatik oluşturulur

8. Destek sistemi
   Tier 1 AI yanıt (Claude)
   ISR'a escalation
```

### Sonraki Sprint (30-60 Gün)

```
9. LinkedIn newsletter aktifleştirme

10. SSS sayfası + Araç sayfaları
    (DMARC checker, SSL checker)
    Organik trafik + lead capture

11. Akademik veri erişim programı
    Üniversite iletişimi başlatılır

12. ISACA/TÜBİSAD başvurusu
```

---

## BÖLÜM 7: RİSKLER VE AZALTMA

```
Risk 1: Replit güvenilirliği
  Azaltma: 50 müşteride Hetzner'a taşı
  Süre: 1 günlük migration

Risk 2: False positive → güven kaybı
  Azaltma: Scoring accuracy prompt uygulandı
  Süre: Bu hafta

Risk 3: Rekabetin fark etmesi
  Azaltma: Fortinet entegrasyonu + Türkçe + KVKK
  kopyalamak 12-18 ay alır

Risk 4: Churn (müşteri kaybı)
  Azaltma: Sağlık skoru sistemi (acil eksik)
  Kritik: İlk müşterilerden biri ayrılırsa
  çok erken uyarı

Risk 5: API maliyeti artışı
  Azaltma: 4 katmanlı Haiku filtresi
  200 müşteride ~$390/ay — gelirin %0.3'ü
```

---

## BÖLÜM 8: %90 AI ŞİRKET KONTROLPANELİ

Her sabah 08:00'de otomatik üretilecek
tek sayfalık yönetici özeti:

```
CyberStep Günlük Özet — 3 Haziran 2026
─────────────────────────────────────────
GELİR
  Aktif abonelik: 23
  Bugünkü MRR: 187.400 TL
  Bu ay eklenen: 3
  Bu ay kaybedilen: 0
  Kalan abonelik süresi (ortalama): 8.2 ay

LEAD PIPELINE
  Dün gece tarandı: 187 domain
  Kalifikasyon: 34 lead
  Email hazır: 28
  Gönderildi: 0 (onay bekliyor)

PLATFORM
  Aktif tarama: 0 hata
  Son CVE: CVE-2026-XXXX (dün 14:23)
  IOC işlendi: 1.247 (24 saat)

OTORITE
  LinkedIn takipçi: 847
  Son paylaşım: Dün 09:30
  Bülten abonesi: 234
  Bu hafta hazır içerik: 12/12

SAĞLIK
  Churn riski yüksek müşteri: 2
  30 günde yenileme: 4 müşteri
  Destek bekleyen: 1 ticket
─────────────────────────────────────────
BUGÜN YAPILACAK (ISR — 45 dk):
  1. 28 email gönder (onay + gönder)
  2. 12 sosyal medya içeriği onayla
  3. 2 churn riskli müşteriye bak
  4. 1 destek ticket yanıtla
```

---

## BÖLÜM 9: UZUN VADELİ BÜYÜME YOL HARİTASI

```
2026 H2 — Türkiye'de otorite
  İlk 50 müşteri
  Medya alıntısı başlıyor
  Hetzner'a taşınma

2027 H1 — Ölçekleme
  100+ müşteri
  Fortinet partnership görüşmesi
  Partner kanal başlatma
  Premium bülten aboneliği geliri

2027 H2 — Azerbaycan
  AZ TLD taramaları başlar
  Azerice içerik üretimi
  İlk AZ müşteri

2028 — Orta Asya
  Gürcistan + Kazakistan
  "Bölgenin siber güvenlik istihbarat kuruluşu"
  Uluslararası konferans sunumları (FIRST.org)

2029 — Platform Olgunluğu
  AWS Local Zone İstanbul
  SOC 2 Type II
  BDDK sertifikası
  Enterprise müşteri segmenti açılır
  FortiGate log analizi servisi (şimdi çok erken)
```

---

## ÖZET: 10 HAFTALIK SPRINT PLANI

```
Hafta 1-2 (Şu An):
  ✅ Pipeline test ve stabilizasyon
  ✅ Sosyal medya hesapları açıldı
  □ Scoring accuracy prompt Replit'e ver
  □ IOC güven altyapısı Replit'e ver
  □ Iyzico production key

Hafta 3-4:
  □ Self-servis abonelik yönetimi
  □ Onboarding email serisi
  □ Otomatik yenileme (Iyzico subscription)
  □ İlk sosyal medya paylaşımları

Hafta 5-6:
  □ Müşteri sağlık skoru + churn prevention
  □ E-fatura entegrasyonu
  □ Blog altyapısı + ilk 2 yazı
  □ CVE sayfaları (SEO)

Hafta 7-8:
  □ Destek sistemi Tier 1 (Claude)
  □ SSS + araç sayfaları
  □ İlk bülten gönderimi (50+ abone hedefi)

Hafta 9-10:
  □ İlk satış girişimleri
  □ Fortinet ekosistemi outreach
  □ KVKK danışmanları partner görüşmesi
  □ Akademik iletişim başlatma
```

---

*CyberStep.io — AI Yönetimli Şirket İş Planı*
*Haziran 2026 — v1.0*
*Bu döküman her çeyrekte güncellenir.*
