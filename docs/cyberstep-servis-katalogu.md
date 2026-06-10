# CyberStep.io — Servis Kataloğu & Teknik Açıklama Dokümantasyonu

> **Amaç:** Satış sunumları, teknik brifing ve partner onboarding için hazırlanmıştır.  
> **Güncelleme:** Haziran 2026  
> **Hedef Kitle:** Satış ekibi, teknik pre-sales, C-level sunum  
> **Bağlantılı Döküman:** Dashboard ve raporların tam açıklaması için → `docs/dashboard-reporting.md`

---

## İÇİNDEKİLER

1. [Platform Genel Yapısı](#1-platform-genel-yapısı)
2. [Ücretsiz Araçlar](#2-ücretsiz-araçlar)
3. [Risk Değerlendirme Servisleri](#3-risk-değerlendirme-servisleri)
4. [Domain Güvenlik Taraması — Teknik Derinlik](#4-domain-güvenlik-taraması--teknik-derinlik)
   - 4.1 Veri Kaynakları
   - 4.2 Güvenlik Puanı Hesaplama
   - 4.3 Shadow IT / ASN Varlık Keşfi
   - 4.4 Saldırı Senaryosu Analizi
   - 4.5 CTEM Skorlama Katmanı *(Siber Güvenlik Notu, Fidye Skoru, Domain Hijack Skoru)*
5. [AI Destekli Servisler](#5-ai-destekli-servisler)
6. [Yönetilen Güvenlik Servisleri (SOC & NOC)](#6-yönetilen-güvenlik-servisleri-soc--noc)
7. [Entegrasyon Servisleri](#7-entegrasyon-servisleri)
8. [İstihbarat & İzleme Servisleri](#8-istihbarat--izleme-servisleri)
9. [Müşteri Dashboard'ları](#9-müşteri-dashboardları)
10. [Satış & Büyüme Otomasyonu](#10-satış--büyüme-otomasyonu)
11. [Fiyat Özeti](#11-fiyat-özeti)
12. [Veri Akışı Diyagramı](#12-veri-akışı-diyagramı)

---

## 1. Platform Genel Yapısı

CyberStep.io, Türk KOBİ'lere yönelik **bulut tabanlı, çok katmanlı bir siber güvenlik platformudur.** Pasif tarama tekniklerini, yapay zeka analizini ve yönetilen güvenlik operasyonlarını tek bir platformda birleştiren SaaS mimarisine sahiptir.

### Teknoloji Altyapısı

| Katman | Teknoloji |
|--------|-----------|
| **Frontend** | React + Vite + TanStack Query + shadcn/ui |
| **API** | Node.js 24 / Express 5 |
| **Veritabanı** | PostgreSQL + Drizzle ORM |
| **AI — Rapor** | Google Gemini 2.5 Flash (Replit AI Proxy) |
| **AI — Analiz** | Anthropic Claude claude-sonnet-4-6 (SOC, Pentest, Growth) |
| **AI — Hızlı Sınıflandırma** | Claude Haiku 4.5 (SOC Tier-1 triage) |
| **PDF** | PDFKit (node-native, CyberStep marka renk paleti) |
| **Zamanlayıcı** | node-cron (50+ cron görevi, izleme paneli dahil) |
| **Email** | SMTP (Nodemailer) — TR lokali, özel domain |
| **SMS** | Netgsm API (Türkiye) |

### Nasıl Konumlanır?

```
[Müşteri Domain/Altyapısı]
        │
        ▼ (pasif tarama — sistemlere dokunmaz)
[CyberStep Tarama Motoru]
  Shodan / crt.sh / RIPE / Censys / VirusTotal / HIBP / USOM / NVD ...
        │
        ▼
[AI Analiz Katmanı]
  Gemini — Risk raporu
  Claude — Saldırı senaryosu / SOC triage / Pentest Lite
        │
        ▼
[Müşteri Paneli + Entegrasyon Push]
  Jira / ServiceNow / FortiManager / CrowdStrike / MS365
```

---

## 2. Ücretsiz Araçlar

Tüm ücretsiz araçlar `/araclar/*` path'i altında çalışır, kayıt gerektirmez, lead generation amaçlıdır.

---

### 2.1 Domain Güvenlik Taraması

**URL:** `/araclar/domain-guvenlik-taramasi`

**Ne Yapar?**
Şirket domain'inin e-posta güvenliği (SPF/DKIM/DMARC), SSL sertifikası geçerliliği ve kara liste durumunu anında sorgular.

**Nasıl Çalışır?**

```
Kullanıcı domain girer
       ↓
DNS sorgusu → SPF / DKIM / DMARC kayıtları
       ↓
SSL kontrolü → Sertifika geçerlilik süresi
       ↓
/api/public/domain-score endpoint → JSON yanıt
       ↓
Skor: SPF(20p) + DKIM(20p) + DMARC(25p) + SSL(25p) + MX(10p) = /100
```

**Veri Kaynakları:** DNS çözümleme (Node.js `dns/promises` modülü)

**Müşteriye Faydası:** "SPF kaydınız yok — herhangi biri sizin adınıza e-posta gönderebilir" gibi anında, somut bir bulgu. Tam tarama için CTA.

---

### 2.2 SSL Sertifika Kontrol

**URL:** `/araclar/ssl-kontrol`

**Ne Yapar?**
SSL sertifikasının geçerliliğini, bitiş tarihini ve yapılandırma kalitesini kontrol eder.

**Nasıl Çalışır?**
Domain-score API'si çağrılır; `ssl.valid`, `ssl.expiresAt` alanları frontend'de ayrıştırılır. Bitiş tarihine göre renk kodlaması: >60 gün yeşil, <30 gün sarı, <7 gün kırmızı.

**Müşteriye Faydası:** "SSL'iniz 18 gün sonra sona eriyor — ziyaretçileriniz 'Güvenli Değil' uyarısı görmeye başlayacak."

---

### 2.3 DMARC, SPF ve DKIM Kontrol

**URL:** `/araclar/dmarc-kontrol`

**Ne Yapar?**
E-posta spoofing korumasının (DMARC/SPF/DKIM) doğru yapılandırılıp yapılandırılmadığını 3 renk gösterge ile özetler.

**Nasıl Çalışır?**
DNS TXT sorguları → Her kayıt için `Var / Yok` göstergesi. DMARC politikası (`none/quarantine/reject`) ayrıştırılır.

**Müşteriye Faydası:** CEO dolandırıcılığı ve phishing tespiti için en hızlı kontrol.

---

### 2.4 KVKK Ceza Riski Hesaplayıcı

**URL:** `/araclar/kvkk-ceza-hesaplayici`

**Ne Yapar?**
Şirket büyüklüğü ve ihlal türüne göre 2026 KVKK para cezası riskini hesaplar.

**Nasıl Çalışır?**
Frontend-only hesaplama. Üç ihlal türü:
- **Veri ihlali bildirmeme (md. 12):** Küçük ₺94.688 / Büyük ₺472.130
- **DPA sözleşmesi yok (md. 11):** Küçük ₺28.406 / Büyük ₺94.688
- **VERBİS kaydı yok (md. 8):** Küçük ₺94.688 / Büyük ₺189.000

**Müşteriye Faydası:** KVKK uyum yatırımını somut para cezası riskiyle karşılaştırma imkânı.

---

### 2.5 Dark Web Sızıntı Sorgulama

**URL:** `/araclar/dark-web-sorgulama`

**Ne Yapar?**
Şirket e-postası veya domain'inin bilinen dark web veri ihlali veritabanlarında yer alıp almadığını sorgular.

**Nasıl Çalışır?**
`/sizinti-izleyici` servisine yönlendirir. Tam sorgulama için HaveIBeenPwned (HIBP) API ve CyberStep tehdit istihbarat veritabanı kullanılır.

---

### 2.6 Siber Güvenlik ROI Hesaplayıcı

**URL:** `/araclar/siber-risk-roi`

**Ne Yapar?**
Siber güvenlik yatırımının geri dönüş süresini ve kurtarılan risk maliyetini hesaplar.

**Nasıl Çalışır?**
Sektör ve çalışan sayısına göre ortalama ihlal maliyeti benchmark'ı (IBM/Verizon 2025 verisi temel alınmış) + KVKK ceza riski + iş durma süresi maliyeti. CyberStep hizmeti eklenen senaryo ile karşılaştırma.

**Müşteriye Faydası:** "Aylık ₺4.990 yatırım, ₺3.2M potansiyel riski karşılıyor" gibi C-level mesaj.

---

### 2.7 Kritik Zafiyet Radarı (Landing Page Widget)

**URL:** `/` (Ana sayfa)

**Ne Yapar?**
Son 3 kritik CVE (CVSS ≥ 9.0) canlı olarak gösterilir. Kullanıcı domain girerek CVE eşleşmesini sorgulayabilir.

**Nasıl Çalışır?**

```
GET /api/cve/latest-critical
  → cve_tracker tablosu → status=published, cvss>=9.0, son 3 kayıt

POST /api/cve/domain-check
  → customer_tech_stack tablosu → domain tech stack eşleştirme
  → cve_domain_matches tablosu → aktif CVE eşleşmeleri
  → Yanıt: etkilenen CVE listesi veya "eşleşme yok"
```

**Gösterilen Bilgiler:** CVE kimliği, CVSS puanı, "Exploit mevcut" / "CISA KEV" / "Yama yok" badge'leri, ilgili CVE detay sayfasına bağlantı.

---

## 3. Risk Değerlendirme Servisleri

### 3.1 Mini Değerlendirme (Ücretsiz)

**Kapsam:** 20 soru / 10 güvenlik alanı  
**Süre:** 5-10 dakika  
**Ücret:** Ücretsiz

**10 Güvenlik Alanı:**

| Alan | Kapsam |
|------|--------|
| Yönetişim | Politika, sorumluluk, bütçe |
| Kimlik Yönetimi | MFA, şifre politikası, ayrıcalıklı erişim |
| E-posta Güvenliği | SPF/DKIM/DMARC, phishing farkındalığı |
| Cihaz Güvenliği | Antivirüs, yamaları güncelleme, şifreleme |
| Ağ Güvenliği | Firewall, VPN, ağ segmentasyonu |
| Veri Koruma | Yedekleme, şifreleme, veri sınıflandırma |
| Yazılım/AI Araçlar | SaaS denetim, shadow AI, lisans yönetimi |
| Fiziksel Güvenlik | Ofis erişim, ekipman kilitleme |
| Tedarik Zinciri | Tedarikçi sözleşmeleri, 3. taraf risk |
| Olay Müdahale | IR planı, iletişim prosedürleri |

**Puanlama Mantığı:**
- Evet = 5 puan | Kısmen = 3 puan | Bilmiyorum = 1 puan | Hayır = 0 puan
- Normal soru ağırlığı = 1x | Kritik soru ağırlığı = 2x
- Maksimum skor: 140 puan

**Kırmızı Alarm Soruları (Hayır = Özel Uyarı):**
Sorular 3, 5, 6, 7, 11, 12, 14, 17, 18 — bu sorulara "Hayır" yanıtı verilmesi raporda özel kritik uyarı tetikler.

**AI Raporu Nasıl Üretilir?**

```
Yanıtlar batch POST ile API'ye gönderilir
       ↓
POST /assessments/:id/complete
       ↓
Gemini 2.5 Flash'a gönderilen prompt:
  - Alan puanları + ham yanıtlar
  - Domain scan sonuçları (varsa)
  - Sektör benchmarkları
  - "Jargon dönüşüm sözlüğü" (MFA → "şifre çalınsa bile sistem erişilemez")
       ↓
Fire-and-forget: AI arka planda üretir
       ↓
Frontend her 2 saniyede /assessments/:id/report'u poll eder
       ↓
Rapor hazır olduğunda gösterilir
```

**Rapor Çıktısı:**
- Yönetici özeti (iş diliyle)
- Finansal etki tahmini (TL cinsinden, KVKK cezası dahil)
- 4 haftalık öncelikli aksiyon planı
- Sektör karşılaştırması (Türkiye ortalamasına göre)
- Görsel puan göstergesi + alan bazlı grafik

---

### 3.2 Tam Değerlendirme

**Kapsam:** 60 soru / 10 alan (her alan 6 soru)  
**Ücret:** ₺4.900 – ₺5.990 (tek seferlik)

**Mini'den Farkı:**
- Her alanda 3x daha derin analiz
- Sektör karşılaştırması daha granüler
- 1 saatlik uzman danışmanlık seansı dahil
- 30 günlük otomatik yeniden tarama
- PDF rapor indirme

---

### 3.3 Premium Danışmanlık

**Ücret:** ₺17.990 (tek seferlik)

**Kapsam:** Tam Değerlendirme + 4 saatlik uzman seansı + özel yol haritası + 3 aylık öncelikli destek + yönetim kurulu sunumu

---

## 4. Domain Güvenlik Taraması — Teknik Derinlik

Ücretli versiyonda `/domain-tarama` sayfasındaki tam tarama aşağıdaki 20+ harici kaynaktan veri çeker.

### 4.1 Veri Kaynakları ve Ne Döndürürler

| Kaynak | API Türü | Döndürülen Veri |
|--------|----------|-----------------|
| **Shodan** | REST (API key) | Açık portlar, servisler, işletim sistemi, ürün versiyonları, ISP/Org, ülke, bilinen CVE sayısı |
| **crt.sh** | Public REST | Sertifika Şeffaflığı kayıtları — tüm subdomain'ler ve bunların tespit tarihi |
| **HaveIBeenPwned (HIBP)** | REST (API key) | İhlal adı, tarih, etkilenen hesap sayısı, sızdırılan veri türleri (e-posta/şifre/adres vb.) |
| **VirusTotal** | REST (API key) | 70+ güvenlik satıcısı tespiti, domain itibar puanı, zararlı/şüpheli sayısı |
| **URLHaus (Abuse.ch)** | Public REST | Malware yayıcı olarak listelenme durumu, tehdit türü |
| **USOM (BTK)** | Günlük feed (HTTPS) | Türkiye ulusal zararlı link listesi — günlük çekilen ve yerel DB'ye yazılan liste |
| **AbuseIPDB** | REST (API key) | IP itibar puanı, toplam rapor sayısı, kötüye kullanım güven yüzdesi, ülke |
| **AlienVault OTX** | REST (API key) | Tehdit raporu (pulse) sayısı, hedef alınan ülkeler, zararlı yazılım isimleri |
| **Google Safe Browsing** | REST (API key) | Zararlı yazılım, sosyal mühendislik ve istenmeyen yazılım tespiti |
| **NIST NVD** | Public REST | Tech stack'e göre CVE detayları, CVSS puanı, açıklama |
| **FIRST.org EPSS** | Public REST | CVE'nin 30 gün içinde istismar edilme olasılığı (0.0–1.0) ve yüzdelik dilim |
| **CISA KEV** | Public JSON Feed | Aktif istismar edilen güvenlik açıkları kataloğu |
| **SSL Labs (Qualys)** | Public REST | SSL/TLS notu (A+/A/B/C/F), endpoint durumu, protokol zayıflıkları |
| **Feodo Tracker** | Public Liste | Aktif botnet C2 sunucularının IP bloklist'i |
| **ThreatFox (Abuse.ch)** | Public REST | Domain'e bağlı zararlı yazılım ismi, tehdit türü |
| **Mozilla Observatory** | Public REST | HTTP güvenlik başlıkları notu ve puanı |
| **RIPE Stat API** | Public REST | ASN numarası için IP prefix'leri (Shadow IT keşfi için) |
| **ipapi.co** | Public REST | IP → ASN numarası, organizasyon adı |
| **Censys** | REST (API key) | ASN'deki ilgili host'lar, servisler, ülke/şehir |

---

### 4.2 Güvenlik Puanı Hesaplama (0–100)

```
Baz: 100 puan

SPF Kaydı (maks 20 puan):
  hardfail  = 20p
  softfail  = 14p
  neutral   = 10p
  yok       = 0p

SSL Sertifikası (maks 25 puan):
  >60 gün   = 25p
  30-59 gün = 20p
  14-29 gün = 15p
  7-13 gün  = 8p
  1-6 gün   = 2p
  süresi dolmuş/yok = 0p

DMARC Kaydı (maks 25 puan):
  p=reject      = 25p
  p=quarantine  = 20p
  p=none        = 10p
  yok           = 0p

DKIM (maks 20 puan):
  geçer         = 20p
  başarısız/yok = 8p

MX Kaydı (maks 10 puan):
  mevcut = 10p
  yok    = 0p

Port Riski Kesintisi:
  portRiskClassifier.ts → Shodan açık portlara göre risk puanı düşülür
  (örn: port 23/Telnet = -15p, port 3389/RDP = -10p, vs.)

Toplam = Baz - Port Kesintisi (0–100 arasında sınırlanır)
```

---

### 4.3 Shadow IT / ASN Tabanlı Orphaned Asset Keşfi

**Ne Yapar?**
Şirketin aynı ASN (Otonom Sistem) bloğundaki, WAF/CDN koruması olmayan ve doğrudan internetten erişilebilir alt alan adlarını tespit eder.

**Nasıl Çalışır?**

```
1. Ana domain'in IP adresi DNS ile çözümlenir
   örn: sirket.com.tr → 185.x.x.x

2. ipapi.co API'si ile IP → ASN bilgisi alınır
   örn: ASN12345, "Turknet Bilisim Ltd."

3. RIPE Stat API ile ASN'ye ait tüm IP prefix'leri çekilir
   örn: [185.x.0.0/20, 185.x.16.0/22, ...]

4. crt.sh'den tespit edilen subdomain'lerin (en fazla 50 adet) IP'leri çözümlenir

5. Her subdomain IP'si ASN prefix'leriyle karşılaştırılır
   → Aynı ASN'de, ana domain'den farklı IP = potansiyel varlık

6. Her varlık için paralel kontrol:
   - HTTP (port 80) erişilebilir mi?
   - HTTPS (port 443) erişilebilir mi?
   - WAF tespiti (Cloudflare, Sucuri, AWS CF, Imperva HTTP başlık analizi)

7. Risk sınıflandırması:
   WAF YOK + erişilebilir = HIGH (Gölge IT riski)
   WAF VAR + erişilebilir = MEDIUM (Ayrı yönetim gerektirir)
```

**PDF Raporda:** "Gölge IT / ASN Varlık Keşfi" bölümü, her varlığın subdomain, IP, WAF durumu ve risk açıklaması ile listelenir (ücretsiz raporda gizlenir).

---

### 4.4 Saldırı Senaryosu Analizi (Claude AI)

**Amaç:** Teknik tarama bulguları → MITRE ATT&CK haritalı, patron diline çevrilmiş saldırı senaryoları.

**Nasıl Çalışır?**

```
buildPrompt() fonksiyonu şu verileri birleştirir:
  - Açık portlar (Shodan)
  - CVE listesi (EPSS > 0.005 veya CISA KEV'de olanlar)
  - WAF durumu
  - E-posta güvenliği (SPF/DMARC/DKIM)
  - Domain itibarı

Claude Haiku'ya gönderilir (hız odaklı)

Özel kurallar:
  ✗ WAF tespiti varsa "bypass" senaryosu üretme
  ✗ Teknik skor ile tehdit seviyesi uyumsuzsa (skor>80 ama "Kritik" diyorsa) düzelt
  ✓ Sadece aktif/istismar edilen CVE'ler "Kritik" senaryolarda kullanılır

Çıktı JSON formatı:
  - risk_ozet: Yönetici özeti
  - genel_tehdit_seviyesi: Kritik/Yüksek/Orta/Düşük
  - senaryolar[]: Her biri için:
      başlık, olasılık, aciliyet,
      giriş_noktası, saldırı_zinciri[],
      mitre_teknikler[{kod, isim}],
      etki, kvkk_etkisi, acil_önlemler[]
  - once_kapat[]: Öncelikli 3-5 aksiyon
```

---

### 4.5 CTEM Skorlama Katmanı

Bu katman, domain tarama verilerini post-process ederek tek bir domain puanının ötesinde **çok boyutlu risk profili** üretir. Sonuçlar `GET /api/customer/security-overview` endpoint'i üzerinden müşteri Güvenlik Durumu Dashboard'ına taşınır.

---

#### 4.5.1 Siber Güvenlik Notu (Cyber Credit Rating)

**Mantık:** Finans sektörünün kredi notu modelinden ilham alan, tek harf + artı/eksi ile ifade edilen bütünleşik risk skoru.

**Hesaplama:**

```
Girdi: Domain skoru (0–100, section 4.2'den)

1. Baz not belirleme:
   90–100 → A+
   80–89  → A
   70–79  → B+
   60–69  → B
   50–59  → C
   40–49  → D
   0–39   → F

2. Risk cezaları (not basamağı düşürür):
   Assessment riski = Kritik → -2 basamak
   Assessment riski = Yüksek → -1 basamak
   HIBP sızıntı sayısı > 10   → -1 basamak
   Aktif CVE eşleşmesi   > 5  → -1 basamak

3. Not basamak sırası:
   A+ → A → B+ → B → C → D → F (en kötü)
```

**Gösterim Yerleri:**
- `/hesabim` ana sayfası → SecurityRatingWidget (harf + açıklama)
- `/hesabim/guvenlik-durumu` → büyük harf badge
- `/domain-tarama` sonuç sayfası → skor kartında `"A Notu"` satır içi badge

---

#### 4.5.2 Fidye Yazılımı Maruziyet Skoru (Ransomware Exposure Score)

**Mantık:** 0–100 arası *artan risk* skoru. Yüksek = kötü.

**Etkenler ve Ağırlıklar:**

| Etken | Puan |
|-------|------|
| RDP portu (3389) açık | +25 |
| SMB portu (445) açık | +20 |
| Telnet portu (23) açık | +15 |
| VNC (5900) açık | +15 |
| DMARC kaydı yok | +20 |
| SPF kaydı yok | +15 |
| HIBP sızıntısı var | +10 |
| CISA KEV'de CVE eşleşmesi | +15 |
| SSL geçersiz / süresi dolmuş | +10 |

**Bant Sınıflaması:**
- 0–25: Düşük risk
- 26–50: Orta risk
- 51–75: Yüksek risk
- 76–100: Kritik risk

**Müşteriye Sunumu:** Her etken pill olarak gösterilir: hangi faktörün kaç puan eklediği, düzeltme önerisiyle birlikte.

---

#### 4.5.3 Domain Ele Geçirme Dayanıklılığı (Domain Hijacking Score)

**Mantık:** 0–100 arası *azalan risk* skoru. Yüksek = iyi korumalı.

**Bileşenler:**

| Bileşen | Puan |
|---------|------|
| SPF kaydı geçerli | +20 |
| DKIM kaydı geçerli | +20 |
| DMARC politikası (reject/quarantine) | +25 |
| SSL sertifikası geçerli | +20 |
| USOM/VirusTotal kara listede değil | +15 |

**Bant Sınıflaması:**
- 80–100: Güçlü
- 50–79: Orta
- 0–49: Zayıf

---

#### 4.5.4 Güvenlik Skoru Trendi (Exposure Trend)

**Ne Gösterir:** Son 6 domain taramanın tarihe göre çizgi grafiği.

**Veri:** `domain_scans` tablosu → müşteri e-postasına göre en son 6 kayıt → `scan_date + overall_score`

**Kullanım Alanı:** Müşteriye "güvenlik yatırımının etkisini" somut grafik olarak göstermek. Skor yükseliyorsa pozitif ROI kanıtı.

---

#### 4.5.5 Sektör Karşılaştırması (Sector Benchmarking)

**Ne Gösterir:** Müşterinin kendi sektörü içindeki pozisyonu.

**Hesaplama:**

```sql
SELECT
  a.sector,
  AVG(d.overall_score) AS sector_avg,
  PERCENT_RANK() OVER (
    PARTITION BY a.sector
    ORDER BY MAX(d.overall_score)
  ) AS percentile
FROM assessments a
JOIN domain_scans d ON d.email = a.contact_email
GROUP BY a.sector, a.contact_email
```

**Müşteriye Sunumu:** "Finans sektörü ortalaması: 64 — Sizin skorunuz: 78 — Sektörün üst %23'ündesiniz."

---

## 5. AI Destekli Servisler

### 5.1 Pentest Lite

**Ücret:** ₺990/ay (veya tek seferlik)  
**Ne Yapar?**
Aktif saldırı yapmadan, pasif tarama verileri ve istismar istihbaratını birleştirerek 6 farklı saldırı vektörü için risk verdict'i üretir.

**6 Senaryo:**

| Senaryo | MITRE Tekniği | Veri Kaynağı |
|---------|---------------|--------------|
| Ransomware Giriş Riski | T1190 (Exploit Public App) | CVE + EPSS + açık portlar |
| CEO Dolandırıcılığı Riski | T1566 (Phishing) | DMARC/SPF/DKIM durumu |
| Veri Sızdırma Riski | T1041 (Exfil Over C2) | HIBP + Shodan + ThreatFox |
| Web Defacement Riski | T1491 (Defacement) | VirusTotal + URLHaus + SSL |
| Tedarik Zinciri Riski | T1195 (Supply Chain) | Shadow IT servisleri |
| Credential Stuffing | T1078 (Valid Accounts) | HIBP ihlal sayısı + MFA durumu |

**Claude AI Rolü:**
Her senaryo için "zaman-to-exploit tahmini", "engelleme faktörleri" ve "acil önlemler" üretir. CISA KEV'de listelenen CVE varsa otomatik olarak "Aktif İstismar Altında" etiketi eklenir.

**Çıktı:** Her senaryo için Yeşil/Sarı/Kırmızı verdict + genel risk verdict + PDF raporu

---

### 5.2 AI Güvenlik Değerlendirmesi

**Ücret:** ₺4.990 (tek seferlik)  
**Ne Yapar?**
Şirketin AI araç kullanımının getirdiği güvenlik ve KVKK uyum risklerini 25 soruluk değerlendirme ile analiz eder.

**4 Değerlendirme Alanı:**

| Alan | Kapsam |
|------|--------|
| AI Araç Yönetimi | Hangi AI araçlar kullanılıyor, shadow AI var mı, politika var mı |
| Veri Maruziyeti | Kişisel/ticari veri AI araçlarına yapıştırılıyor mu |
| Yapılandırma | Model eğitimi opt-out durumu, DPA sözleşmesi |
| KVKK Uyum | Sınır ötesi veri transferi, VERBİS kaydı |

**Dahili AI Araç Kaydı (20+ araç önceden tanımlı):**

| Araç | Risk Seviyesi | Neden |
|------|---------------|-------|
| ChatGPT Free | Yüksek | Veri model eğitimine kullanılabilir |
| ChatGPT Plus (Opt-out) | Orta | Opt-out ile azaltılır ama sınır ötesi transfer riski |
| Microsoft 365 Copilot | Düşük | EU Data Boundary, DPA mevcut |
| Google Gemini (Workspace) | Orta | Workspace politikasına bağlı |
| Claude (Pro/API) | Orta-Düşük | İçerik eğitimde kullanılmaz, DPA mevcut |
| GitHub Copilot | Orta | Kod içinde IP/sır sızıntısı riski |

**Çıktı:** Risk skoru kartı + şirkete özel "AI Kabul Edilebilir Kullanım Politikası" belgesi (Claude tarafından otomatik üretilir)

---

### 5.3 AI Politika Servisi

**Ücret:** ₺990/yıl  
**Ne Yapar?**
Şirket için yasal geçerliliği olan AI kullanım politikası hazırlar ve yıllık günceller.

---

### 5.4 AI Araç İzleme

**Ücret:** ₺490/ay  
**Ne Yapar?**
Çalışanların kullandığı AI araçları (Shadow AI dahil) network seviyesinde tespit eder, yeni araç eklendiğinde uyarı verir.

---

### 5.5 AI Phishing Simülasyonu

**Ücret:** ₺1.990 (tek seferlik)  
**Ne Yapar?**
Claude AI tarafından üretilen, şirkete özel bağlamda hazırlanmış AI-destekli phishing e-postaları ile çalışan farkındalığını test eder.

---

### 5.6 Yönetim Kurulu Raporu (Board Report)

**Ücret:** Başlangıç plan dahil / ₺2.490/ay ayrı  
**Ne Yapar?**
CISO asistan rolü — teknik güvenlik durumunu yönetim kurulu diline otomatik çevirir.

**Nasıl Çalışır?**

```
Her ay otomatik tetiklenir:
       ↓
Claude AI → 3 paragraf yönetici özeti:
  1. Genel Durum (geçen aya göre değişim)
  2. Ayın En Büyük Riski
  3. Önerilen Aksiyonlar

Rapor içeriği:
  - Güvenlik skoru trendi (önceki aya kıyasla)
  - Sektör benchmarking
  - KVKK + TR-7545 uyum skoru
  - TL cinsinden finansal risk tahmini

Dağıtım:
  - Belirlenen yönetim kurulu üyelerine otomatik e-posta
  - Müşteri portali üzerinden onay/not ekleme
```

---

### 5.7 CISO Haftalık Bülten

**Ücret:** Ücretsiz (abone ol, haftalık e-posta)  
**Ne Yapar?**
Her Cuma sabahı Türkiye'ye özel siber güvenlik özeti gönderir.

**Claude AI Rolü:**
RSS feed'lerden toplanan ham haberler → 7 bölümlük editöryal içerik:
1. Tehdit Radarı (haftanın en kritik CVE'leri)
2. Türkiye Verileri (USOM, yerel ihlaller)
3. KVKK/Yasal Gündem
4. AI Güvenlik Notu
5. Haftanın Aksiyonu
6. LinkedIn gönderi metni (hazır, kopyala-yapıştır)
7. HTML e-posta formatında tüm bülten

---

### 5.8 BAS Lite (Breach & Attack Simulation)

**URL:** `/bas-lite`  
**Ücret:** Plan dahil / Ayrı paket  
**Ne Yapar?**
Aktif saldırı yapmadan, mevcut güvenlik telemetrisini kullanarak saldırı simülasyonu sonuçlarını modelleyen pasif BAS katmanı.

**Nasıl Çalışır?**

```
Mevcut domain tarama + CVE + port verileri alınır
       ↓
Claude AI — saldırı simülasyonu:
  Hangi saldırı tekniği hangi aşamada tespit edilirdi?
  Mevcut kontroller (WAF/DMARC/SPF) ne kadar engeller?
  Tespit olasılığı yüzdesi
       ↓
Senaryo kategorileri:
  - Phishing (e-posta tabanlı)
  - Ransomware (lateral movement)
  - Credential Harvesting
  - Web Defacement
  - Data Exfiltration
  - Supply Chain
       ↓
Her senaryo için: Saldırı zinciri + Tespit noktaları + Önleme önerileri
```

**Pentest Lite'tan Farkı:** Pentest Lite verdict (kırmızı/sarı/yeşil) + MITRE haritalama üretir. BAS Lite ise kontrollerin simülasyon saldırılarını hangi aşamada durduracağını modeller — güvenlik ekibine tatbikat senaryosu sunar.

---

## 6. Yönetilen Güvenlik Servisleri (SOC & NOC)

### 6.1 SOC — Security Operations Center

#### SOC Lite | ₺4.990/ay
- AI tabanlı triage (7/24 otomatik)
- Haftalık özet rapor
- Kritik uyarı bildirimleri

#### SOC Standart | ₺9.990/ay + ₺5.000 kurulum
- 7/24 izleme + analist desteği
- MITRE ATT&CK haritalama
- Fortinet / MS365 entegrasyonu

#### SOC Pro | ₺19.990/ay + ₺10.000 kurulum
- Tam yönetilen SOC
- Özel playbook geliştirme
- Yerinde destek seçeneği

**Teknik Derinlik — AI Triage Pipeline:**

```
Ham Güvenlik Olayı (Fortinet/MS365/DNS gelir)
       ↓
Tier 0 — Kural Motoru:
  Beyaz liste mi? Duplike mi? → Kapat

Tier 1 — Claude Haiku (hızlı):
  "Zararlı mı, zararsız mı?" — <100ms
  → Zararlıysa Tier 2'ye

Tier 2 — Claude Sonnet (derin):
  MITRE ATT&CK tekniği tespiti
  Olay anlatısı üretme
  → Otomatik playbook seçimi

Playbook Yürütme:
  - FortiManager API → IP/domain bloklama
  - ServiceNow → Incident açma
  - Slack/Telegram/SMS → Analist bildirimi
  - KVKK değerlendirmesi → Kişisel veri etkisi var mı?

SLA:
  Kritik → 15 dakika yanıt
  Yüksek → 1 saat
  Orta   → 4 saat
```

**Müşteriye Faydası:**
- "Alert fatigue" %90+ azalma (kural + AI filtresi)
- 7/24 kapsam, tek analist maliyeti yok
- "Patron dili" özeti — teknik jargon yok

---

### 6.2 NOC — Network Operations Center

#### NOC Lite | ₺2.490/ay
#### NOC Standart | ₺4.990/ay
#### NOC Pro | ₺9.990/ay

**Teknik Derinlik:**

```
FortiGate REST API polling (her 5 dakika):
  - Bant genişliği kullanımı
  - CPU/RAM kullanımı
  - Aktif session sayısı
       ↓
Kullanılabilirlik İzleme (her dakika):
  HTTP health check → uptime hesaplama
       ↓
14 Günlük Baseline Öğrenme:
  Normal trafik paterni çıkarılır
  Anomali tespiti devreye girer
       ↓
SOC Korelasyonu:
  Ağ yavaşlaması + SOC güvenlik uyarısı = DDoS/saldırı tespiti
```

**SOC + NOC Lite Bundle: ₺6.490/ay** (ayrı ayrı ₺7.480)

---

## 7. Entegrasyon Servisleri

### 7.1 Fortinet Security Fabric

**Ücret:** ₺4.990/ay + ₺2.500 kurulum

**Ne Yapar?**
Fortinet ekipmanlarından gelen tüm güvenlik eventlerini CyberStep SOC ile ilişkilendirir, tehdit tespitinde otomatik FortiManager üzerinden IP bloklama yapar.

**Teknik Detay:**

```
Müşteri tarafı:
  FortiManager/FortiGate → HTTPS üzerinden ham event akışı
  → POST /api/ingest/fortinet (raw text body)
  → JSON.parse ile ayrıştırılır

CyberStep tarafı:
  AES-256-GCM ile şifrelenmiş kimlik bilgileri (ENCRYPTION_KEY secret)
  FortiManager JSON-RPC API:
    - Adres grubu güncelleme: CyberStep-Blocklist
    - Otomatik firewall kuralı oluşturma

Korelasyon:
  Fortinet event + MS365 login + DNS değişikliği = Koordineli saldırı tespiti
```

---

### 7.2 Microsoft 365 / Azure AD

**Ücret:** ₺1.490/ay

**Nasıl Çalışır?**

```
OAuth 2.0 multi-tenant akışı:
  Müşteri → CyberStep'e Graph API yetkisi verir

Her 15 dakikada polling:
  GET /auditLogs/signIns → Riskli girişler
  GET /security/alerts   → E-posta tehditleri

Özel Tespit:
  "İmkânsız Seyahat": 1 saat içinde iki farklı ülkeden giriş → SOC uyarısı
  MFA bypass girişimi → Otomatik hesap kilitleme önerisi
  
Fortinet Korelasyonu:
  MS365 riskli giriş IP'si → Fortinet loglarında aynı IP arama
  → Koordineli saldırı tespiti
```

---

### 7.3 ServiceNow

**Ücret:** ₺2.490/ay + ₺3.000 kurulum

**Çift Yönlü Senkronizasyon:**

```
CyberStep SOC → ServiceNow:
  Kritik/Yüksek olay → INC açılır
  Severity mapping: Kritik=1, Yüksek=2, Orta=3, Düşük=4
  Work notes otomatik eklenir

ServiceNow → CyberStep:
  HMAC-SHA256 webhook doğrulama
  State değişikliği, atama güncelleme, yorum
  → SOC aktivite loguna yazılır

Senkronizasyon: Her 15 dakika cron + webhook anlık
```

---

### 7.4 Jira

**Ücret:** Entegrasyon servis paketine dahil

**Nasıl Çalışır?**
Kritik ve Yüksek severity bulgular → Jira'da otomatik issue açılır. Atlassian Document Format ile zengin açıklama, öncelik haritalaması ve CyberStep etiketleri eklenir.

---

### 7.5 CrowdStrike Falcon

**Yön:** Outbound (CyberStep → CrowdStrike)  
**Ne Gönderir?**
CyberStep'in tespit ettiği kötü amaçlı IP, domain ve dosya hash'leri → CrowdStrike IOC olarak push edilir → Endpoint'lerde otomatik engelleme

---

### 7.6 QRadar / FortiSIEM

**Yön:** Outbound (CyberStep → SIEM)  
**Protokol:** Syslog (TCP/UDP) veya REST API  
**Ne Gönderir?**
CyberStep olay logları standart CEF/Syslog formatında SIEM'e iletilir.

---

### 7.7 Slack / Telegram / SMS (Netgsm)

**Bildirim Türleri:**
- SOC kritik olay uyarısı
- SLA ihlali bildirimi
- DNS değişikliği uyarısı
- Haftalık özet

**Teknik:** Fire-and-forget `setImmediate` pattern, hata retry mekanizması

---

## 8. İstihbarat & İzleme Servisleri

### 8.1 CVE Türkiye Etki Sistemi

**Ücret:** CVE İzleme Lite ₺990/ay — Pro ₺4.990/ay

**Ne Yapar?**
Yeni kritik CVE yayınlandığında Türkiye'deki etkilenen şirketleri tespit eder, uyarı gönderir.

**Nasıl Çalışır?**

```
NVD/VulnCheck feed → Yeni CVE tespiti (saatlik cron)
       ↓
turkeyImpactAnalyzer:
  customer_tech_stack tablosu → Türk domain tech stack tarama
  Versiyon karşılaştırması (granüler eşleştirme)
  Sektör ve şehir bazında demografik kırılım
       ↓
Etkilenen müşterilere otomatik e-posta bildirimi
       ↓
Landing page CVE Radar widget güncellenir
       ↓
CISO Haftalık Bülten'e dahil edilir
```

---

### 8.2 DNS İzleme

**Ücret:** ₺990/ay

**Nasıl Çalışır?**

```
Her 5 dakikada:
  SPF/DKIM/DMARC kayıt kontrolü
  15+ DNSBL (DNS Blacklist) kontrolü
  NS/MX kayıt değişikliği tespiti
       ↓
Değişiklik tespitinde:
  Anlık Slack/Telegram/SMS bildirimi
  Domain hijacking erken uyarısı
```

---

### 8.3 Technographic Fingerprint Engine

**Kullanım:** Lead generation + risk skoru zenginleştirme  
**Nasıl Çalışır?**

```
5 Paralel Analizör:
  1. HTTP Header Analizi (X-Powered-By, Server, Cookie vb.)
  2. DNS Kayıt Analizi (MX → Google/Office365, CNAME → CDN tespiti)
  3. HTML/Script Analizi (meta tags, script src'leri, favicon hash)
  4. SSL Sertifika Analizi (CN/SAN → hosting provider tespiti)
  5. Shodan Veri Analizi (ürün versiyonu, banner bilgisi)

Güven skoru hesaplama:
  Birden fazla analizörden aynı sonuç → güven artar
  örn: "SAP" → %90 güven (header + html + shodan üçü de teyit etti)

Güvenlik Olgunluk Skoru:
  Tespit edilen tech stack → eksik güvenlik kontrolleri belirlenir
  → CyberStep servis önerileri otomatik üretilir
```

---

### 8.4 CTI İstihbarat Sistemi

**Ücret:** Threat Intel Starter ₺2.490/ay — Pro ₺9.990/ay

**Bileşenler:**

| Bileşen | Kaynak | Sıklık |
|---------|--------|--------|
| VulnCheck KEV | VulnCheck API | Saatlik |
| USOM Feed | BTK/USOM | Günlük |
| URLHaus | Abuse.ch | 6 saatlik |
| Feodo Tracker | Abuse.ch | 6 saatlik |
| ThreatFox | Abuse.ch | 6 saatlik |
| OTX Pulses | AlienVault | 6 saatlik |
| Dark Web İzleme | Özel entegrasyon | Günlük |

---

### 8.5 EASM (External Attack Surface Management)

**Ücret:** ₺2.990/çeyrek — ₺9.990/yıl

**Kapsam:**
- Tüm subdomain'ler (crt.sh + Shodan)
- ASN tabanlı orphaned asset keşfi
- Censys ilgili host analizi
- Açık port ve servis envanteri
- Yeni varlık tespitinde uyarı

---

### 8.6 Sertifika Şeffaflık Logu İzleme

**Ücret:** ₺490/ay

**Ne Yapar?**
Şirket adına sahte SSL sertifikası oluşturulduğunda (phishing sitesi hazırlığı) anında uyarı verir. crt.sh gerçek zamanlı izleme + günlük crt.sh REST API yedek kaynağı.

---

### 8.7 KVKK Bildirim Sistemi

**Ücret:** ₺1.990/ay + ₺500 kurulum

**Ne Yapar?**
Veri ihlali tespit edildiğinde 72 saatlik KVKK bildirim yükümlülüğü için otomatik ön-bildirim taslağı ve yasal belge şablonları hazırlar.

---

## 9. Müşteri Dashboard'ları

Müşteri portal'ındaki tüm dashboard ve ekranların tam açıklaması için ayrı dökümanı inceleyin:  
**→ `docs/dashboard-reporting.md`**

Bu bölüm yalnızca servis kataloğu bağlamında öne çıkan dashboard'ların kısa özetini içerir.

### 9.1 Güvenlik Durumu Dashboard'ı (`/hesabim/guvenlik-durumu`)

Platformun ana analitik ekranı. Section 4.5'teki tüm CTEM skorlarını tek bir dashboard'da birleştirir.

| Widget | Açıklama |
|--------|----------|
| Siber Güvenlik Notu | A+…F harf notu, büyük badge |
| Skor Trendi Grafiği | Son 6 taramanın Recharts çizgi grafiği |
| Fidye Maruziyet Skoru | 0-100 risk puanı + faktör pill'leri |
| Domain Hijack Skoru | 0-100 dayanıklılık puanı |
| Sektör Karşılaştırması | Kendi sektörü içindeki percentile |
| Anlık Sinyaller | Sızıntı, kritik CVE, açık port, assessment riski |

**Tier Erişimi:** Tüm müşteriler (ilk tarama yoksa CTA)

---

### 9.2 Diğer Müşteri Ekranları (Özet)

| Sayfa | URL | Kapsam |
|-------|-----|--------|
| SOC Dashboard | `/hesabim/soc` | Aktif vakalar, SLA takibi, olay anlatısı |
| NOC Dashboard | `/hesabim/noc` | Ağ metrikleri, uptime yüzdesi |
| Bulgularım | `/hesabim/bulgularim` | Remediation biletleri, iyileştirme kaydı |
| Technology Discovery | `/hesabim/technology-discovery` | Tech stack profili, güvenlik olgunluğu |
| Tedarikçi Portföyü | `/hesabim/tedarikci-portfoyu` | 3. taraf risk, TPRM anketleri |
| DNS İzleme | `/hesabim/dns-izleme` | DNS değişiklik olayları |
| IOC Log | `/hesabim/ioc-log` | IOC sorgu geçmişi, kredi bakiyesi |
| Cloud Güvenlik | `/hesabim/cloud-guvenlik` | CSPM bulguları |
| CISO Asistan | `/hesabim/ciso-asistan` | Gemini AI serbest sohbet |

---

## 10. Satış & Büyüme Otomasyonu

Bu bileşenler müşteriye doğrudan satılmaz; platform içinde çalışarak satış ekibini güçlendirir.

### 10.1 Growth Engine (Proaktif Outreach)

**Ne Yapar?**
Belirli "tetikleyiciler" gerçekleştiğinde otomatik olarak kişiselleştirilmiş satış e-postası üretir ve gönderir.

**7 Tetikleyici:**

| Tetikleyici | Örnek Senaryo |
|-------------|---------------|
| SSL sona erme | "sirket.com.tr SSL'iniz 14 gün sonra sona eriyor" |
| Yeni kritik CVE | "Kullandığınız teknolojide aktif istismar edilen CVE yayınlandı" |
| Sektörel veri ihlali | "Finans sektöründe büyük ihlal — şirketiniz risk altında mı?" |
| KVKK cezası haberi | "Benzer sektörde ₺472K KVKK cezası — uyum durumunuz?" |
| Güvenlik skoru düşüşü | "Geçen aya göre güvenlik skorunuz 12 puan düştü" |
| Domain yenileme yaklaşması | "Domain süresi doluyor + güvenlik açıkları var" |
| Rekabetçi benchmark | "Sektör ortalamasının 23 puan altındasınız" |

**Claude AI Rolü:** Her tetikleyici için "patron dili" — teknik jargon yok, somut iş riski, tek eylem çağrısı.

---

### 10.2 ISR Lead Generation Sistemi

**Ne Yapar?**
Harici lead kaynaklarından (Apollo.io, Hunter.io, crt.sh) potansiyel müşteri tespiti ve otomatik önceliklendirme.

**Nasıl Çalışır?**

```
crt.sh Gerçek Zamanlı Lead Filtresi:
  Türk domainlerinin yeni SSL sertifikaları
  → Filtre: şirket adı + sektor eşleştirme
  → Saatlik cron: kuyruğa al → lead_candidates tablosu

Technographic Skoring:
  Her lead için teknoloji profili
  → Güvenlik olgunluğu düşük + şirket büyüklüğü orta = yüksek öncelik

Teaser Oluşturma:
  /preview/:token → Yetkisiz erişim linki
  Lead'e "Güvenlik Raporunuzun Önizlemesi" e-postası gönderilir

Gemini AI — E-posta Sınıflandırma:
  Gelen yanıt e-postaları → new_deal / rfq_response / revision_request
  Satış temsilcisine "Sonraki En İyi Aksiyon" önerisi
```

---

### 10.3 Referral Programı

**Nasıl Çalışır?**
- Her müşteriye benzersiz referral kodu (`/hesabim/davet`)
- `?ref=KOD` ile kayıt → referral event kaydı
- Referral tamamlanınca otomatik ödül (abonelik uzatma)

---

## 11. Fiyat Özeti

### Tek Seferlik Hizmetler

| Hizmet | Fiyat |
|--------|-------|
| Mini Değerlendirme | Ücretsiz |
| Tam Değerlendirme | ₺4.900 – ₺5.990 |
| Premium Danışmanlık | ₺17.990 |
| AI Güvenlik Değerlendirmesi | ₺4.990 |
| Pentest Lite | ₺990 (veya aylık) |
| AI Phishing Simülasyonu | ₺1.990 |

### Aylık Abonelikler

| Hizmet | Aylık Fiyat | Kurulum |
|--------|-------------|---------|
| SOC Lite | ₺4.990 | — |
| SOC Standart | ₺9.990 | ₺5.000 |
| SOC Pro | ₺19.990 | ₺10.000 |
| NOC Lite | ₺2.490 | — |
| NOC Standart | ₺4.990 | — |
| NOC Pro | ₺9.990 | — |
| SOC + NOC Lite Bundle | ₺6.490 | — |
| Full Protection Bundle | ₺14.990 | — |
| Fortinet Security Fabric | ₺4.990 | ₺2.500 |
| Microsoft 365 Entegrasyonu | ₺1.490 | — |
| ServiceNow Entegrasyonu | ₺2.490 | ₺3.000 |
| DNS İzleme | ₺990 | — |
| CT Log İzleme | ₺490 | — |
| KVKK Bildirim Sistemi | ₺1.990 | ₺500 |
| CVE İzleme Lite | ₺990 | — |
| CVE İzleme Standart | ₺2.490 | — |
| CVE İzleme Pro | ₺4.990 | — |
| Threat Intel Starter | ₺2.490 | — |
| Threat Intel Pro | ₺9.990 | — |
| EASM | ₺2.990 | — |
| AI Araç İzleme | ₺490 | — |
| AI Politika Servisi | ₺990/yıl | — |
| Yönetim Kurulu Raporu | ₺2.490 | — |
| Pentest Lite | ₺990 | — |

---

## 12. Veri Akışı Diyagramı

```
                    ┌─────────────────────────────────────┐
                    │         MÜŞTERİ                     │
                    │  (Domain, E-posta, Altyapı)         │
                    └──────────────┬──────────────────────┘
                                   │  Pasif Tarama
                    ┌──────────────▼──────────────────────┐
                    │      DIŞ VERİ KAYNAKLARI            │
                    │  Shodan · crt.sh · HIBP · USOM      │
                    │  VirusTotal · NVD · EPSS · KEV       │
                    │  RIPE · ipapi.co · SSL Labs          │
                    │  AbuseIPDB · OTX · Mozilla Obs.      │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────┐
                    │      CYBERSTEP İŞLEME MOTORU        │
                    │                                     │
                    │  ┌─────────────┐  ┌─────────────┐  │
                    │  │ Skor Motoru │  │ ASN Keşfi   │  │
                    │  │  0–100 puan │  │ Orphaned    │  │
                    │  └─────────────┘  │ Assets      │  │
                    │                   └─────────────┘  │
                    │  ┌─────────────────────────────┐   │
                    │  │      AI ANALİZ             │   │
                    │  │  Gemini → Değerlendirme    │   │
                    │  │  Claude → Saldırı Sen.     │   │
                    │  │  Claude → SOC Triage       │   │
                    │  │  Claude → Pentest Lite     │   │
                    │  │  Claude → Board Report     │   │
                    │  └─────────────────────────────┘   │
                    └──────────────┬──────────────────────┘
                                   │
               ┌───────────────────┼───────────────────┐
               │                   │                   │
    ┌──────────▼──────┐  ┌─────────▼──────┐  ┌────────▼──────────┐
    │  MÜŞTERİ PANELİ│  │   ENTEGRASYONâ   │  │    BİLDİRİMLER   │
    │  /hesabim/*     │  │   PUSH          │  │                  │
    │  PDF Rapor      │  │  Jira           │  │  E-posta         │
    │  Dashboard      │  │  ServiceNow     │  │  Slack/Telegram  │
    │  Board Report   │  │  FortiManager   │  │  SMS (Netgsm)    │
    └─────────────────┘  │  CrowdStrike    │  │  Webhook         │
                         │  QRadar/SIEM    │  └──────────────────┘
                         └────────────────┘
```

---

*Bu doküman CyberStep.io iç kullanım içindir. Dış paylaşımda müşteri özel referanslar çıkarılmalıdır.*
