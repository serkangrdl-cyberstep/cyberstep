# CyberStep.io — Dashboard & Raporlama Rehberi

> **Amaç:** Platformdaki tüm dashboard'lar, ekranlar ve raporların ne içerdiğini, hangi veriyi nereden çektiğini ve kimin erişebildiğini açıklar.  
> **Güncelleme:** Haziran 2026  
> **Hedef Kitle:** Ürün ekibi, satış pre-sales, teknik onboarding

---

## İÇİNDEKİLER

1. [Müşteri Portal Dashboard'ları](#1-müşteri-portal-dashboardları)
2. [Admin Panel Dashboard'ları](#2-admin-panel-dashboardları)
3. [Müşteri Raporları](#3-müşteri-raporları)
4. [Admin & Platform Raporları](#4-admin--platform-raporları)
5. [Bildirim Kanalları](#5-bildirim-kanalları)
6. [Veri Güncelleme Sıklıkları](#6-veri-güncelleme-sıklıkları)

---

## 1. Müşteri Portal Dashboard'ları

Müşteri portal'ı `/hesabim/*` altındadır. Tüm sayfalar `useRequireCustomer()` ile oturum doğrulaması yapar.

---

### 1.1 Güvenlik Durumu (`/hesabim/guvenlik-durumu`) ★ Yeni

**Amaç:** Müşterinin tüm güvenlik durumunu tek bakışta özetleyen ana analitik dashboard.

**Veri Kaynağı:** `GET /api/customer/security-overview`

**İçerik:**

| Widget | Ne Gösterir | Veri Nasıl Hesaplanır |
|--------|-------------|----------------------|
| **Siber Güvenlik Notu** | A+ / A / B+ / B / C / D / F harf notu | Domain skoru (0-100) + assessment riski (Kritik: -20p, Yüksek: -10p, Orta: -5p) + sızıntı sayısı (>10: -10p) + kritik CVE sayısı (>5: -10p) |
| **Güvenlik Skoru Trendi** | Recharts LineChart — son 6 taramanın tarihe göre skor grafiği | `domain_scans` tablosundan müşteri e-postasına göre son 6 kayıt |
| **Fidye Yazılımı Maruziyet Skoru** | 0-100 arası risk skoru + Düşük/Orta/Yüksek bant | RDP portu (3389) açık: +25, SMB (445): +20, Telnet (23): +15, VNC: +15, DMARC yok: +20, SPF yok: +15, sızıntı: +10, KEV CVE: +15, SSL geçersiz: +10 |
| **Domain Ele Geçirme Dayanıklılığı** | 0-100 arası skor + Güçlü/Orta/Zayıf bant | SPF: +20, DKIM: +20, DMARC: +25, SSL: +20, Kara liste temiz: +15 |
| **Sektör Karşılaştırması** | Kendi skoru vs sektör ortalaması + percentile | `assessments.sector` + `domain_scans.overall_score` JOIN → SQL GROUP BY sektör |
| **Anlık Sinyal Pill'leri** | Sızıntı sayısı, kritik CVE, korumasız varlık, açık yüksek riskli port, assessment riski | En güncel domain taramasından anlık okuma |

**API Endpoint:** `GET /api/customer/security-overview` (requireCustomer)

**Tier Erişimi:** Tüm müşteriler (veri yoksa CTA ekranı gösterir)

---

### 1.2 Hesabım Ana Sayfası (`/hesabim`)

**Amaç:** Kişiselleştirilebilir güvenlik dashboard'u + hesap ayarları merkezi.

**Tab Sistemi:**

| Tab | İçerik |
|-----|---------|
| **Dashboard** | Özelleştirilebilir widget grid (varsayılan 6 + eklenebilir 5) |
| **Hesap Ayarları** | Profil bilgileri, TOTP/2FA kurulumu, şifre değiştirme |

**Navigasyon (header):**
- 4 birincil link: Güvenlik Durumu, Raporlarım, Alan Adı Tarama, AI Güvenlik
- **Servisler** dropdown: SOC, NOC, DNS İzleme, Tedarikçi Risk, Cloud Güvenlik, CISO Asistan, Pentest Lite, AI Güvenlik Servisleri, Entegrasyonlarım
- **Hesap** dropdown: Servislerim, Faturalar, Kurulum, YK Raporu, Referral / Davet, Enterprise, Çıkış

**Widget Özelleştirme:**
- Sağdan açılan "Özelleştir" slide-in paneli (Sheet bileşeni)
- Tercihler localStorage'a kaydedilir (`cyberstep_dashboard_prefs_v1`)
- 11 widget — Eye/EyeOff toggle ile açıp kapatılır

| Widget | Varsayılan | Ne Gösterir |
|--------|-----------|-------------|
| **Anlık Sinyal Pill'leri** | Açık | Sızıntı, kritik CVE, açık port, assessment riski — en güncel taramadan anlık |
| **Güvenlik Skoru Trendi** | Açık | Recharts LineChart — son 6 taramanın tarihsel skor grafiği |
| **Güvenlik Yol Haritası** | Açık | 30/90/180 günlük aksiyon planı (skor bandına göre otomatik hesaplanır — API gerektirmez) |
| **Fidye Yazılımı Maruziyet** | Açık | 0-100 risk skoru + Düşük/Orta/Yüksek bant |
| **Domain Ele Geçirme Dayanıklılığı** | Açık | SPF/DKIM/DMARC/SSL/kara liste bileşenlerinden hesaplanan 0-100 skor |
| **Sektör Karşılaştırması** | Açık | Kendi skor percentile'ı vs sektör ortalaması |
| **Kurulum İlerleme** | Eklenebilir | Onboarding checklist tamamlanma yüzdesi |
| **Hesap Sağlığı** | Eklenebilir | Müşteri sağlık skoru (0-100) + churn riski bandı |
| **Aktif Servisler** | Eklenebilir | Aktif servis sayısı; bekleyen kurulum adımı varsa sarı badge |
| **Tedarikçi Riski** | Eklenebilir | Kritik/Yüksek riskli tedarikçi sayısı |
| **Hizmet Planım** | Eklenebilir | Mevcut plan hangi servisleri içeriyor |

**Güvenlik Yol Haritası Widget — Skor Bantları:**

| Skor | Seviye | 30-Gün Odağı |
|------|--------|--------------|
| ≥ 80 | İyi | İzleme sürekliliği, gelişmiş tehdit tespiti |
| 60-79 | Orta | E-posta güvenliği, SSL sertifikası yenileme |
| 40-59 | Yüksek Risk | DMARC politikası, erişim kontrolü güçlendirme |
| < 40 | Kritik | Acil müdahale — açık portlar, aktif sızıntı |

**Kritik Uyarı Banner'ı:** Güvenlik notu D veya F olan müşterilerde dashboard'un üstünde kırmızı border'lı uyarı gösterilir.

**Abonelik Yenileme Uyarısı:** Sona ermeye <14 gün kalan aboneliklerde sarı banner.

---

### 1.3 Bulgularım / Remediation (`/hesabim/bulgularim`)

**Amaç:** Güvenlik açıklarından üretilen bilet tablosu ve iyileştirme takibi.

**Veri Kaynağı:** `GET /api/portal/tickets`

**İçerik:**
- Açık bulgular tablosu: bilet numarası, bulgu başlığı, etkilenen varlık, birleşik risk skoru (0-100), SLA süresi/ihlali
- **Durum akışı:** Açık → Devam Ediyor → Doğrulama Bekleniyor → Giderildi / Risk Kabul Edildi
- **Düzeltme Kaydı:** "Düzelttim" butonu → fix açıklaması + tarih kaydı
- **Risk Kabul:** Gerekçe metni ile riskin kabul edilmesi
- **Renk kodlaması:** Risk skoru 80+: kırmızı, 60-79: turuncu, 40-59: sarı, <40: yeşil

---

### 1.4 SOC Dashboard (`/hesabim/soc`)

**Amaç:** Müşterinin SOC olaylarını gerçek zamanlı görüntüleme ve müdahale.

**Veri Kaynağı:** WebSocket `/ws/portal/soc` + `GET /api/soc/portal/*`

**İçerik:**
- Aktif vaka özeti: toplam, kritik, çözüme kavuşan
- Son 10 SOC vakası: numara, başlık, severity, durum, SLA süresi
- Vaka detay ekranı: olay anlatısı, MITRE ATT&CK teknikleri, önerilen aksiyon, zaman çizelgesi
- WebSocket ile anlık güncelleme (yeni vaka → otomatik satır eklenir)

---

### 1.5 NOC Dashboard (`/hesabim/noc`)

**Amaç:** Ağ metrikleri ve kullanılabilirlik izleme.

**Veri Kaynağı:** `GET /api/noc/portal/*`

**İçerik:**
- Kullanılabilirlik yüzdesi (son 24s / 7g / 30g)
- Gerçek zamanlı metrikler: bant genişliği kullanımı, CPU, RAM, aktif session
- Uptime/downtime olay listesi
- NOC kurulum adımları (`/hesabim/noc-kurulum`)

---

### 1.6 Technology Discovery (`/hesabim/technology-discovery`)

**Amaç:** Müşterinin domain'inde tespit edilen teknoloji stack ve güvenlik olgunluğu.

**Veri Kaynağı:** `GET /api/tech-discovery/portal/*`

**İçerik:**
- Tespit edilen teknolojiler: ürün adı, kategori, versiyon (varsa), güven yüzdesi
- 5 analizör sonucu: HTTP başlıkları, DNS, HTML/Script, SSL, Shodan
- Güvenlik Olgunluk Skoru: tech stack'e göre eksik güvenlik kontrolleri
- Önerilen CyberStep servisleri: olgunluk profiline göre otomatik öneride

---

### 1.7 Tedarikçi Portföyü (`/hesabim/tedarikci-portfoyu`)

**Amaç:** Tedarikçi (üçüncü taraf) güvenlik risk takibi.

**Veri Kaynağı:** `GET /api/tprm/*`

**İçerik:**
- Tedarikçi listesi: ad, domain, risk seviyesi, son değerlendirme tarihi
- Tedarikçi anket gönderme: TPRM anket bağlantısı oluştur, e-posta ile ilet
- Anket sonuçları: 5 alan puanı + toplam risk skoru
- Toplu risk dağılımı: Kritik/Yüksek/Orta/Düşük tedarikçi sayısı

---

### 1.8 DNS İzleme (`/hesabim/dns-izleme`)

**Amaç:** Müşterinin izlenen domain'lerinin DNS değişikliklerini görüntüleme.

**Veri Kaynağı:** `GET /api/dns-monitor/portal/*`

**İçerik:**
- İzlenen domain listesi + son kontrol zamanı
- DNS değişiklik olayları: kayıt tipi, eski değer, yeni değer, tespit zamanı
- DNSBL kara liste durumu: 15+ liste üzerinde durum

---

### 1.9 IOC Log (`/hesabim/ioc-log`)

**Amaç:** Müşterinin IOC (Indicator of Compromise) sorgu geçmişi ve kredi durumu.

**İçerik:**
- Toplam kredi bakiyesi, kullanılan kredi
- Sorgu geçmişi: IOC değeri (IP/domain/hash), sorgu tarihi, sonuç
- Onay kuyruğu: HITL (Human-in-the-Loop) onay bekleyen sorgular

---

### 1.10 Cloud Güvenlik (`/hesabim/cloud-guvenlik`)

**Amaç:** Cloud CSPM (Cloud Security Posture Management) bulguları.

**Veri Kaynağı:** `GET /api/cloud-cspm/*`

**İçerik:**
- Cloud hesap listesi (AWS/Azure/GCP)
- CSPM bulgular: konfigürasyon hataları, açık S3 bucket'ları, IAM riski
- Risk seviyesine göre filtreleme

---

### 1.11 CISO Asistan (`/hesabim/ciso-asistan`)

**Amaç:** AI destekli sanal CISO — güvenlik soruları için serbest sohbet.

**Veri Kaynağı:** `GET /api/gemini/chat` (SSE streaming)

**İçerik:**
- Sohbet arayüzü: kullanıcı mesajı → Gemini AI yanıtı (streaming)
- Geçmiş konuşmalar: oturum bazında saklanır
- Bağlam: domain tarama sonuçları + assessment verisi otomatik enjekte edilir

---

### 1.12 Servislerim (`/hesabim/servislerim`)

**Amaç:** Aktif abonelikler ve onboarding adımları yönetimi.

**İçerik:**
- Aktif/pasif servis listesi: servis adı, plan, durum, fiyat
- Her servis için onboarding checklist: müşteri tarafı + CyberStep tarafı adımları
- Onboarding ilerleme yüzdesi (dolu progress bar)
- Kurulum rehberi linkler

---

### 1.13 Diğer Portal Sayfaları

| Sayfa | URL | İçerik |
|-------|-----|---------|
| Entegrasyonlarım | `/hesabim/entegrasyonlarim` | Bağlı üçüncü taraf sistemler (Jira, ServiceNow, vb.) |
| Fortinet | `/hesabim/fortinet-entegrasyonu` | Fortinet cihaz bağlantı ayarları, event akışı durumu |
| Enterprise | `/hesabim/enterprise` | Enterprise satış süreci, özel teklif, POC yönetimi |
| Sepet | `/hesabim/sepet` | Seçilen servisler, toplam tutar, ödeme akışı |
| Faturalar | `/hesabim/faturalar` | Geçmiş faturalar, ödeme durumu, PDF indir |
| Davet | `/hesabim/davet` | Referral kodu, davet istatistikleri, ödül durumu |
| Destek | `/hesabim/destek` | Destek talebi oluşturma, bilet takibi |

---

## 2. Admin Panel Dashboard'ları

Admin panel'i `/panel/*` altındadır. `requireAdmin` middleware ile korunur.

---

### 2.1 Ana Dashboard (`/panel`)

**Amaç:** Platformun genel sağlık durumu ve anlık metrikler.

**İçerik:**
- Toplam müşteri sayısı, aktif abonelik, aylık gelir
- Bugünkü domain tarama sayısı, değerlendirme sayısı
- Son 10 müşteri kaydı
- Aktif SOC vaka sayısı, bekleyen onay sayısı
- Platform sağlık göstergesi (API, DB, cron durumu)

---

### 2.2 Günlük Özet (`/panel/gunluk-ozet`)

**Amaç:** Her sabah 08:00'de otomatik oluşturulan platform özeti.

**Veri Kaynağı:** `GET /api/admin/daily-dashboard`

**İçerik:**
- Dün gelen yeni müşteri + tarama + lead sayısı
- Süresi dolan/yenilenen abonelikler
- SOC günlük istatistikleri: açılan/kapanan vaka, ortalama yanıt süresi
- AI maliyet özeti: günlük Gemini + Claude harcaması (TL)
- Platform anormallik alarmları
- Lead funnel: bugün tespit → iletişim → demo → satış

---

### 2.3 Exposure Score Yönetimi (`/panel/exposure-score`)

**Amaç:** Müşteri bazında risk skoru ve maruziyet takibi.

**Veri Kaynağı:** `GET /api/admin/exposure-score/*`

**İçerik:**
- Müşteri listesi: domain, son domain skoru, assessment risk seviyesi, son tarama tarihi
- Skor dağılım grafiği: 0-100 arası histogram
- Kritik/Yüksek/Orta/Düşük risk segmentleri
- Sektör bazında ortalama skor karşılaştırması
- Aksiyon gerektiren hesaplar: skor <40 veya kırmızı alarm sorusu

---

### 2.4 Domain Taramalar (`/panel/domain-taramalar`)

**Amaç:** Tüm domain taramalarının geçmişi ve yönetimi.

**İçerik:**
- Tarama tablosu: domain, e-posta, skor, tarama tarihi, durum
- Filtreleme: domain adı, skor aralığı, tarih
- Tarama detay linki: `/domain-scan/:id` sayfasına yönlendirme
- Manuel yeniden tarama tetikleme
- Orphaned asset keşfi sonuçları (Gölge IT kartı)

**Shadow IT / ASN Tabanlı Orphaned Asset Keşfi:**

Domain taramasının bir parçası olarak `asnAssetDiscovery.ts` servisi çalışır:

1. Domain'in A kaydından IP alınır
2. `ipapi.co` API → ASN numarası + ASN adı
3. RIPE API → ASN'e ait IP prefix listesi
4. crt.sh API → ASN IP aralığındaki sertifikadan subdomain tespiti
5. HTTP HEAD ile her host'un WAF'sız erişilebilirliği test edilir
6. Sonuçlar `domain_scans.orphaned_assets (JSONB)` kolonuna yazılır

Frontend'de (`/domain-scan/:id`) "Gölge IT / ASN Varlık Keşfi" kartı olarak gösterilir.  
PDF raporunda bölüm 9 olarak yer alır (ücretli planda tam liste, ücretsizde kısmen gizli).

---

### 2.5 Değerlendirmeler (`/panel/degerlendirmeler`)

**Amaç:** Tüm Mini ve Tam Değerlendirmelerin yönetimi.

**İçerik:**
- Değerlendirme listesi: şirket adı, sektör, risk seviyesi, tamamlanma tarihi
- Rapor görüntüleme: `/panel/degerlendirmeler/:id/rapor`
- Sektör ve risk seviyesine göre filtreleme
- Bekleyen AI raporu olanlar: "üretiliyor" etiketi

---

### 2.6 SOC Admin (`/panel/soc`)

**Amaç:** SOC operasyonlarının yönetici görünümü.

**Veri Kaynağı:** `GET /api/soc/admin/*`

**İçerik:**
- Tüm müşteri vakalarının birleşik tablosu
- Triage kuyruğu: işlenmemiş eventler
- SLA ihlali uyarıları
- Playbook yönetimi: mevcut playbook'lar, aktif/pasif durumu
- Analist performans metrikleri
- MITRE ATT&CK teknik dağılımı
- Haftalık özet: açılan/kapanan vaka trendi

---

### 2.7 NOC Admin (`/panel/noc`)

**Amaç:** Tüm müşteri ağ izleme operasyonlarının yönetimi.

**İçerik:**
- Müşteri bazında uptime yüzdesi ve son durum
- Anomali tespitleri: baseline'dan sapma olayları
- FortiGate bağlantı durumu: bağlı / bağlantı kesildi
- Metriklerin son 24 saatlik trend grafiği

---

### 2.8 CVE Yönetimi (`/panel/cve`)

**Amaç:** CVE takibi, Türkiye etki analizi ve müşteri bildirimi yönetimi.

**İçerik:**
- CVE tablosu: CVE-ID, CVSS, EPSS, CISA KEV durumu, yayın tarihi
- Türkiye etkisi: kaç müşteri etkileniyor, hangi teknoloji
- Müşteri eşleşmeleri: hangi müşteride hangi CVE
- Bildirim durumu: e-posta gönderildi mi, açılma oranı
- Manuel CVE ekleme ve düzenleme
- Landing page widget önizlemesi: son 3 kritik CVE

**Landing Page — Kritik Zafiyet Radarı (`CveRadarSection`):**

Public landing sayfasında yer alan bu bölüm iki etkileşimli özellik sunar:

| Özellik | Endpoint | Ne Yapar |
|---------|----------|----------|
| **Güncel Kritik CVE Badge'leri** | `GET /api/cve/latest-critical` | CVSS ≥ 9 son 3 CVE — ID, CVSS skoru, yayın tarihi, CISA KEV etiketi |
| **Domain CVE Hızlı Kontrol** | `POST /api/cve/domain-check` | Kullanıcı domain girer → şirketin tech stack'iyle eşleşen CVE sayısı döner → kayıt CTA'sı |

Veri kaynağı: `cve_findings` tablosu (her 2 saatte güncellenir). Auth gerektirmez — public endpoint.

---

### 2.9 CTI İstihbarat (`/panel/cti-istihbarat`)

**Amaç:** Siber tehdit istihbarat feed'lerinin yönetimi ve içerik paneli.

**İçerik:**
- 9 feed durumu: son güncelleme, kayıt sayısı (URLHaus, OTX, Feodo, ThreatFox, vb.)
- VulnCheck KEV feed: son çekilen aktif exploit listesi
- Otomatik yıllık rapor takvimi: hangi aylarda rapor üretileceği
- Özel Türkiye indeksi: TurkeyThreatIndex skoru ve bileşenler

---

### 2.10 Lead Discovery (`/panel/lead-discovery`)

**Amaç:** Potansiyel müşteri havuzu ve lead kalitesi yönetimi.

**Sekmeler:**

| Sekme | İçerik |
|-------|---------|
| **Shodan** | Shodan taramasından tespit edilen Türk şirketler |
| **crt.sh** | Sertifika şeffaflık loglarından yeni Türk domainleri |
| **Certstream** | Gerçek zamanlı lead filtresi sonuçları (crt.sh polling) |

**Her Lead İçin:** Domain, şirket/org, tespit tarihi, güvenlik skoru tahmini, "Teaser Gönder" aksiyonu

---

### 2.11 AI Maliyet Takibi (`/panel/ai-costs`)

**Amaç:** Claude + Gemini AI maliyetlerinin izlenmesi.

**Veri Kaynağı:** `ai_cost_log` tablosu + `getDailyCost()`

**İçerik:**
- Günlük AI harcaması (₺) — model bazında kırılım (Claude Sonnet, Haiku, Gemini Flash)
- Aylık trend grafiği
- En maliyetli 10 işlem tipi (SOC triage, board report, pentest lite, vb.)
- Bütçe alarm eşiği: günlük ₺X üzeri → admin bildirimi

---

### 2.12 Cron Ayarları (`/panel/cron-ayarlari`)

**Amaç:** 50+ cron görevinin sağlık izleme ve yönetimi.

**Veri Kaynağı:** `cron_job_runs` tablosu + `cronRegistry`

**3 Sekme:**
- **Genel Bakış:** Tüm cron'ların son çalışma zamanı, başarı/hata durumu, ortalama süre
- **Geçmiş:** Son 100 çalışma logu, hata mesajları
- **Catch-up:** Durdurulan cron'ların yeniden çalıştırılması (30 kayıtlı catch-up jobı)

---

### 2.13 Diğer Admin Sayfaları

| Sayfa | URL | İçerik |
|-------|-----|---------|
| Müşteriler | `/panel/musteriler` | Müşteri listesi, plan/durum filtreleme, detay sayfası |
| Faturalar | `/panel/faturalar` | Tüm faturalar, ödeme durumu, gelir özeti |
| Gelir | `/panel/gelir` | MRR, churn rate, LTV grafikleri |
| Onboarding | `/panel/onboarding` | Yeni müşteri onboarding ilerleme takibi |
| Remediation | `/panel/remediation` | Tüm müşteri bulgular ve bilet yönetimi |
| Bülten | `/panel/bulletin` | Haftalık bülten içeriği, onay, gönderim |
| Entegrasyonlar | `/panel/entegrasyonlar` | Hangi müşteride hangi entegrasyon aktif |
| Fortinet | `/panel/fortinet` | Fortinet event akışları, korelasyon sonuçları |
| MS365 | `/panel/ms365` | Azure AD auth durumu, riskli giriş logları |
| ServiceNow | `/panel/servicenow` | INC senkronizasyon durumu, son sync zamanı |
| DNS İzleme | `/panel/dns-izleme` | Tüm izlenen domainler, değişiklik olayları |
| CT İzleme | `/panel/ct-izleme` | Phishing/klon domain tespitleri |
| KVKK | `/panel/kvkk` | KVKK olay kayıtları, bildirim görevleri |
| IOC Kontroller | `/panel/ioc-kontroller` | HITL onay kuyruğu — manuel IOC onayı |
| Kod Güvenliği | `/panel/kod-guvenligi` | GitHub API key sızıntı taramaları |
| Onaylar | `/panel/approvals` | Badge doğrulama ve özel onay talepleri |
| Demo Raporlar | `/panel/demo-raporlar` | Prospect'e gösterilecek otomatik demo rapor üretimi |
| Teknoloji Keşfi | `/panel/technology-discovery` | Tüm müşteri tech stack profilleri |
| İstihbarat | `/panel/intelligence` | Pazar bazlı threat intelligence raporları |
| Endeks Raporu | `/panel/endeks-raporu` | Türkiye Siber Güvenlik Endeksi — aylık hesap |
| Observability | `/panel/observability` | API latency, error rate, DB metrikleri |
| Status | `/panel/status` | Platform uptime durumu (public status page admin) |
| Kariyer | `/panel/kariyer` | İş ilanı yönetimi |

---

## 3. Müşteri Raporları

### 3.1 Domain Güvenlik Tarama Raporu (PDF)

**Erişim:** `/api/domain-scan/:id/pdf`  
**Boyut:** ~4-12 MB (görseller dahil)  
**Üretim:** PDFKit, node-native

**Bölümler:**
1. **Kapak Sayfası:** CyberStep logo, şirket domain, tarama tarihi, genel skor + renk kodlu badge
2. **Yönetici Özeti:** Skor, en kritik 3 bulgu, acil öneri
3. **E-posta Güvenliği:** SPF/DKIM/DMARC detayı, geçme/başarısız durumu, düzeltme adımları
4. **SSL Sertifikası:** Geçerlilik, bitiş tarihi, TLS versiyonu
5. **Domain İtibarı:** VirusTotal, USOM, Feodo, ThreatFox sonuçları
6. **HIBP Sızıntı Analizi:** Sızıntı sayısı ve türleri (şifre, e-posta, kişisel veri)
7. **CVE & Açıklık Analizi:** Tespit edilen CVE'ler, CVSS puanları, CISA KEV durumu
8. **Açık Port Envanteri:** Shodan portları, servis adları, risk seviyesi
9. **Gölge IT / ASN Varlıkları:** Orphaned asset listesi (ücretli planda gösterilir)
10. **Saldırı Senaryoları:** MITRE ATT&CK haritalı 3-6 senaryo (Claude AI üretir)
11. **Öncelikli Aksiyon Planı:** 30 günlük düzeltme yol haritası
12. **Teknik Ekler:** Ham tarama verileri, kaynaklar

**Not:** Ücretsiz taramada bölümler 8, 9, 10 "gizlendi" olarak gösterilir.

---

### 3.2 Domain Güvenlik Pasaportu (PDF)

**Erişim:** `/api/domain-scan/:id/passport`  
**Amaç:** Tek sayfalık "B2B güven belgesi" — tedarikçilere veya müşterilere gösterilebilecek özet sertifika formatı.

**İçerik:**
- Şirket adı, domain, skor, harf notu
- 5 ana kontrol sonucu: E-posta Güvenliği, SSL, Kara Liste, Sızıntı, Port Güvenliği
- "CyberStep Tarafından Doğrulanmıştır" mühürü
- QR kodu: taramanın public doğrulama sayfasına yönlendirir

---

### 3.3 Risk Değerlendirme Raporu

**Erişim:** `/w/:slug/assessment/:id/report` (HTML) + PDF indirme  
**Üretim:** Gemini 2.5 Flash (fire-and-forget, frontend polling)

**İçerik:**
- **Yönetici Özeti:** İş diliyle 2-3 paragraf risk açıklaması
- **Skor Göstergesi:** Gauge chart + alan bazlı radar/bar grafik
- **Finansal Etki:** TL cinsinden tahmini ihlal maliyeti + KVKK ceza riski
- **Alan Bazlı Analiz:** 10 alan her biri için puan, durum, yorum
- **Kırmızı Alarm Bölümü:** "Hayır" yanıtlanan kritik sorular özel kutuda
- **4 Haftalık Aksiyon Planı:** Hafta hafta önceliklendirilmiş görevler
- **Sektör Karşılaştırması:** Türkiye ortalaması vs müşteri skoru
- **Sonraki Adım CTA:** Tam Değerlendirme veya danışmanlık rezervasyonu

---

### 3.4 Pentest Lite Raporu

**Erişim:** `/pentest-lite` sayfasında satır içi + PDF indirme butonu  
**Üretim:** Claude claude-sonnet-4-6, EPSS/CISA KEV zenginleştirme

**6 Senaryo Çıktısı (Her Biri İçin):**
- Verdict: Kırmızı/Sarı/Yeşil
- Risk açıklaması: patron dili, teknik jargon yok
- Engelleme faktörleri: ne sizi koruyor
- Zaman-to-exploit tahmini
- Acil önlemler: 2-3 madde
- MITRE ATT&CK teknik kodu

**Genel Verdict:** Tüm senaryoların ağırlıklı ortalaması

---

### 3.5 BAS Lite Raporu

**Erişim:** `/bas-lite` sayfasında satır içi  
**Üretim:** Claude AI, pasif veri analizi

**İçerik:**
- Simülasyon başlığı ve kategorisi (phishing, ransomware, credential harvesting, vb.)
- Saldırı zinciri adımları
- Tespit olasılığı: CyberStep izleme katmanlarına göre
- Önleme önerileri

---

### 3.6 AI Güvenlik Değerlendirmesi Raporu

**Erişim:** `/ai-guvenlik/:id/rapor`  
**Üretim:** Claude claude-sonnet-4-6

**2 Çıktı:**

**a) Risk Analizi Raporu:**
- Toplam AI risk skoru (0-100)
- 4 alan puanı: AI Araç Yönetimi, Veri Maruziyeti, Yapılandırma, KVKK Uyum
- Kullanılan AI araçların risk profili (şirkete özel)
- KVKK sınır ötesi transfer riski değerlendirmesi
- Öneri listesi: araç bazında aksiyon

**b) AI Kabul Edilebilir Kullanım Politikası (otomatik üretilir):**
- Şirket adına özelleştirilmiş hukuki metin
- Hangi araçlar onaylı, hangisi yasak, hangisi kısıtlı kullanım
- Veri sınıflandırmasına göre kullanım kuralları
- İhlal prosedürü

---

### 3.7 Yönetim Kurulu Raporu (Board Report)

**Erişim:** `/hesabim/yonetim-raporu`  
**Üretim:** Claude AI, aylık otomatik + manuel tetikleme

**İçerik:**
- **Yönetici Özeti:** 3 paragraf — genel durum, ayın en büyük riski, önerilen aksiyonlar
- **Güvenlik Skoru Trendi:** Önceki aya kıyasla değişim
- **Sektör Benchmarking:** Sektör ortalamasına göre pozisyon
- **KVKK + Uyum Skoru:** TR-7545, KVKK uyum durumu
- **Finansal Risk:** TL cinsinden tahmini risk değeri
- **Alıcı Yönetimi:** Yönetim kurulu üyesi e-posta listesi (müşteri ekler)
- **Dağıtım:** Onay sonrası e-posta ile tüm alıcılara gönderim

---

### 3.8 Raporlarım Arşivi (`/raporlarim`)

**Amaç:** Müşterinin tüm geçmiş domain taramaları ve değerlendirmelerinin listesi.

**İçerik:**
- Domain taramaları: domain, skor, tarih, PDF indir
- Değerlendirmeler: şirket, risk seviyesi, tarih, rapora git
- Pentest Lite sonuçları

---

## 4. Admin & Platform Raporları

### 4.1 CISO Haftalık Bülten

**Frekans:** Her Cuma 08:00 (İstanbul)  
**Dağıtım:** E-posta → abone listesi  
**Üretim:** Claude claude-sonnet-4-6, RSS feed'lerinden ham haber → 7 bölümlük içerik

**7 Bölüm:**
1. Tehdit Radarı: haftanın en kritik 3 CVE
2. Türkiye Verileri: USOM, yerel ihlaller, Türk şirket haberleri
3. KVKK/Yasal Gündem: yeni düzenlemeler, ceza kararları
4. AI Güvenlik Notu: AI araç risk güncellemeleri
5. Haftanın Aksiyonu: tek, uygulanabilir öneri
6. LinkedIn Gönderi: hazır kopyala-yapıştır metin
7. Genel HTML e-posta içeriği

**Arşiv:** `/bulten/arsiv` (public) + `/bulten/:slug` (detay)

---

### 4.2 Haftalık Delta Raporu

**Frekans:** Her Pazartesi 08:00  
**Alıcı:** Admin e-postası  
**İçerik:**
- Geçen hafta: yeni müşteri, tarama, değerlendirme sayısı
- Güvenlik skoru değişimleri: en çok iyileşen ve kötüleşen 5 domain
- Yeni kritik bulgular
- Büyüme metrikleri: MoM karşılaştırma

---

### 4.3 Günlük Platform Sağlık Raporu

**Frekans:** Her sabah 07:00  
**Alıcı:** Admin e-postası  
**İçerik:**
- Dün çalışan cron'ların başarı/hata sayısı
- API error rate özeti
- AI maliyet özeti
- Bekleyen kritik aksiyon (SLA ihlali, hata, vs.)

---

### 4.4 SOC Haftalık Raporu

**Frekans:** Her Pazartesi 09:00  
**Alıcı:** SOC admin e-postası  
**İçerik:**
- Açılan / kapanan vaka sayısı
- Ortalama yanıt süresi (kritik/yüksek/orta)
- SLA uyum yüzdesi
- En sık kullanılan playbook
- MITRE ATT&CK haftalık teknik dağılımı

---

### 4.5 Fabric Haftalık Raporu

**Frekans:** Her Pazartesi 08:30  
**Alıcı:** Admin + ilgili müşteri  
**İçerik:**
- Fortinet'ten gelen event özeti
- Korelasyon sonuçları: kaç event SOC vakasına dönüştü
- FortiManager blok listesi: bu hafta eklenen IP/domain sayısı

---

### 4.6 Türkiye Siber Güvenlik Endeksi

**Frekans:** Her ay 1'inde  
**Erişim:** `/panel/endeks-raporu`  
**İçerik:**
- TurkeyThreatIndex skoru (0-100)
- Bileşenler: aktif exploit CVE sayısı, USOM liste büyüklüğü, sektörel sızıntı sayısı
- Önceki aya göre değişim
- Pazar yapılandırmasına göre TR ve AZ (Azerbaycan) indeksleri

---

### 4.7 Demo Raporlar (`/panel/demo-raporlar`)

**Amaç:** Satış sürecinde prospect'e gösterilecek kişiselleştirilmiş demo rapor üretimi.

**Nasıl Çalışır:**
- Admin bir domain girer
- Sistem gerçek tarama çalıştırır (veya simüle eder)
- PDF rapor + teaser linki (`/preview/:token`) üretilir
- Prospect'e e-posta ile gönderilir: "Domain'inizin güvenlik raporunun önizlemesi"

---

## 5. Bildirim Kanalları

| Kanal | Hangi Olaylar | Teknik |
|-------|---------------|--------|
| **E-posta (SMTP)** | Onboarding, sızıntı uyarısı, SOC özeti, haftalık bülten, board report, CVE bildirimi, SLA ihlali | Nodemailer, TR lokali |
| **Telegram Bot** | SOC kritik vaka, DNS değişikliği, SLA ihlali, admin alarm | Fire-and-forget setImmediate |
| **SMS (Netgsm)** | SOC kritik (Türkiye numaraları) | Netgsm REST API |
| **Slack Webhook** | SOC vaka, platform hatası | Generic webhook |
| **Custom Webhook** | SOC olayları (müşteri tanımlı URL) | HMAC imzalı POST |

---

## 6. Veri Güncelleme Sıklıkları

| Veri | Frekans | Tetikleyici |
|------|---------|-------------|
| Domain güvenlik skoru | Manuel veya cron (09:30 İstanbul) | Müşteri talebi veya 30-gün yenileme cron |
| DNS izleme | Her 5 dakika | `dns-cron.ts` |
| SOC triage | Her 5 dakika | `soc-triage cron` |
| NOC metrikleri | Her 5 dakika | `noc-poll cron` |
| CVE feed | Her 2 saat | NVD + VulnCheck polling |
| USOM listesi | Günlük | HTTPS feed çekme |
| CTI feed'leri (URLHaus, OTX, vb.) | Her 6 saat | Paralel cron |
| Shadow IT / ASN orphaned assets | Domain taramasıyla tetiklenir | `asnAssetDiscovery.ts` (ipapi.co → RIPE → crt.sh pipeline) |
| Health score | Günlük 02:00 | `health-score cron` |
| Board report | Aylık (ayın 25'i) | Otomatik + manuel tetikle |
| Haftalık bülten | Cuma 08:00 | `bulletin cron` |
| AI maliyet logu | Her AI çağrısında | `aiCostTracker.ts` |
| Güvenlik notu (credit rating) | `/api/customer/security-overview` çağrısında | Anlık hesaplama (DB'ye yazılmaz, on-the-fly) |

---

*Bu doküman CyberStep.io iç kullanım içindir. Güncelleme tarihi: Haziran 2026 — widget özelleştirme sistemi, Security Roadmap widget, CVE landing widget ve Shadow IT/ASN keşfi eklendi.*
