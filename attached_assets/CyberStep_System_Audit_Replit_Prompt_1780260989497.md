# CyberStep.io — Sistem Audit Raporu
## Replit Agent Promptu — Kapsamlı Durum Değerlendirmesi

---

## TALİMAT

Sen CyberStep.io'nun baş teknik mimarısın.
Projenin tüm dosyalarını, veritabanı şemalarını,
route'larını, bileşenlerini ve konfigürasyonunu tara.

Aşağıdaki formatta kapsamlı bir durum raporu üret.
Raporu Markdown olarak `/mnt/user-data/outputs/` veya
proje kök dizinine `SISTEM_AUDIT_RAPORU.md` olarak kaydet.

---

## BÖLÜM A: VERİTABANI ŞEMA ENVANTERI

Drizzle şema dosyalarını tara (`src/db/schema.ts` veya benzeri).

Her tablo için:
```
Tablo Adı | Sütun Sayısı | İlişkiler | Son Migration | Durum
```

Özellikle şunları kontrol et:
- Tablolar var ama migrate edilmemiş mi?
- Foreign key constraint eksik olan var mı?
- Index eksikliği var mı? (sık sorgulanan alanlar)
- Drizzle ORM ile tanımlanmış ama tabloya yansımamış alan var mı?

---

## BÖLÜM B: MODÜL VE ÖZELLİK ENVANTERİ

Aşağıdaki her modülü kontrol et.
Durumu belirt: ✅ Tamamlandı | ⚠️ Kısmen Çalışıyor | ❌ Eksik/Yok | 🔑 API Key Bekliyor

### B1 — Temel Platform

```
[ ] Domain Güvenlik Taraması
    - Shodan entegrasyonu
    - VirusTotal entegrasyonu
    - AbuseIPDB entegrasyonu
    - URLHaus entegrasyonu
    - USOM entegrasyonu
    - HIBP entegrasyonu
    - SSL/TLS kontrol
    - SPF/DKIM/DMARC kontrol
    - Subdomain tarama
    - Blacklist kontrol

[ ] Güvenlik Değerlendirme Sistemi
    - Mini assessment (20 soru)
    - Tam assessment (60 soru)
    - AI rapor üretimi
    - Uzman doğrulama akışı
    - Sertifika üretimi

[ ] Müşteri Portal (/hesabim)
    - Dashboard
    - Raporlarım
    - Servislerim
    - Faturalar
    - Entegrasyonlar
    - Ayarlar

[ ] Ödeme Sistemi
    - Iyzico single payment
    - Iyzico recurring (abonelik)
    - Fatura PDF
    - E-fatura (GİB)
```

### B2 — AI Servisleri

```
[ ] AI Güvenlik Değerlendirmesi (/ai-guvenlik)
[ ] AI Phishing Simülasyonu (/ai-phishing-simulasyonu)
[ ] EU AI Act Uyum Skoru (/eu-ai-act)
[ ] AI Red Team Raporu (/ai-red-team)
[ ] Deepfake & Ses Klonu Analizi (/deepfake-analizi)
[ ] AI Sahte Doküman Tespiti (/sahte-dokuman)
[ ] AI Araç İzleme (/ai-arac-izleme)
[ ] AI Politika Otogüncelleme (/ai-politika)
[ ] Sanal CISO (/sanal-ciso)
```

### B3 — Fortinet Entegrasyonu

```
[ ] FortiManager JSON-RPC entegrasyonu
[ ] FortiGate Automation Stitch webhook endpoint
    URL: /api/fabric/webhook/:token
[ ] FortiAnalyzer syslog receiver
    TCP: 5514, UDP: 5515
[ ] FortiManager IP blok motoru
    Address object oluşturma + group ekleme + policy push
[ ] Security Fabric cihaz keşfi
[ ] Kurulum sihirbazı (/hesabim/fortinet-entegrasyonu)
[ ] Demo modu (test event simülasyonu)
```

### B4 — CTI Platform

```
[ ] IoC Registry veritabanı (ioc_registry tablosu)
[ ] Threat actor profilleri
[ ] Kampanya yönetimi
[ ] Feed entegrasyonları:
    - USOM feed
    - URLHaus feed
    - Feodo Tracker feed
    - FortiGuard feed (API key gerekli)
    - Talos feed (API key gerekli)
    - GreyNoise (API key gerekli)
    - MISP (URL + key gerekli)
[ ] IoC enrichment pipeline
[ ] Müşteri tehdit alaka motoru
[ ] Aylık CTI raporu
```

### B5 — SOC Servisi

```
[ ] SOC case management (soc_cases tablosu)
[ ] Playbook motoru (soc_playbooks tablosu)
[ ] Claude 4-katmanlı triage pipeline
    - Katman 0: Kural motoru
    - Katman 1: Claude Haiku
    - Katman 2: Claude Sonnet
    - Katman 3: Extended analysis
[ ] Eskalasyon motoru (seviye 0-4)
[ ] SLA takibi
[ ] SOC operatör paneli (/admin-panel/soc)
    - WebSocket gerçek zamanlı stream
    - Case listesi ve detay
    - Playbook yönetimi
[ ] Müşteri SOC dashboard (/hesabim/soc)
[ ] Haftalık SOC raporu (otomatik)
[ ] AI maliyet takibi (ai_usage_log tablosu)
```

### B6 — ISR / CRM Modülü

```
[ ] isr_customers (müşteri/lead kaydı)
[ ] isr_deals (pipeline yönetimi)
[ ] Pipeline Kanban (/admin-panel/isr/pipeline)
[ ] Lead üretim sayfası (/admin-panel/isr/lead-gen)
[ ] Apollo.io entegrasyonu (API key gerekli)
[ ] Hunter.io entegrasyonu (API key gerekli)
[ ] LinkedIn Yardımcısı (Claude tabanlı)
[ ] Aktivite takibi (isr_activities)
[ ] Görev ve hatırlatıcı sistemi (crm_tasks)
```

### B7 — Enterprise Sales & Sözleşme

```
[ ] enterprise_prospects tablosu
[ ] Teaser rapor üretimi
[ ] Preview sayfası (/preview/:token)
[ ] Enterprise sözleşme yönetimi
[ ] Sözleşme PDF üretimi (Puppeteer)
[ ] Servis aktivasyon paneli
[ ] Fatura sistemi (enterprise_invoices)
```

### B8 — Muhasebe & CRM Genişletme

```
[ ] Fatura PDF + seri no sistemi
[ ] Tahsilat takibi + otomatik hatırlatma
[ ] MRR/ARR dashboard (/admin-panel/revenue)
[ ] Müşteri 360° görünümü
[ ] Etiket ve segment sistemi
[ ] Görev + hatırlatıcı motoru
[ ] NPS otomasyonu
[ ] Muhasebe webhook entegrasyonu
[ ] Abonelik yaşam döngüsü yönetimi
```

### B9 — Growth Engine

```
[ ] growth_triggers tablosu
[ ] SSL expiry trigger
[ ] CVE alert trigger (NVD API)
[ ] Sektör saldırı FOMO trigger
[ ] KVK ceza trigger
[ ] Skor düşüşü upsell trigger
[ ] "Rakibiniz Nerede?" aracı (/rakip-karsilastirma)
[ ] Port değişiklik delta tespiti
[ ] Tedarikçi zinciri yayılma
[ ] Benchmark download lead mıknatısı
[ ] EKAP ihale takibi
[ ] MERSİS yeni şirket takibi
[ ] Tahminsel upsell motoru
[ ] WhatsApp lead besleme botu
```

### B10 — Genişletilmiş Özellikler

```
[ ] Status page (status.cyberstep.io)
[ ] Kariyer sayfası (/kariyer)
[ ] Onboarding tamamlama skoru
[ ] Başarı rozeti sistemi
[ ] SEO araç sayfaları (/araclar/*)
[ ] Slack/Teams entegrasyonu
[ ] Güvenlik politika üretici (6 şablon)
[ ] Vendor güvenlik puanlama
[ ] Fon başvurusu hazırlık paketi
[ ] Eğitim sertifikası sistemi
[ ] AI destekli yardım merkezi
[ ] Yıllık güvenlik raporu
[ ] Ürün turu (intro.js)
[ ] AI satış hazırlık brifing'i
[ ] Affiliate programı
[ ] Sertifika pazar yeri
[ ] SSO (Google + Microsoft)
[ ] White-label altyapısı
[ ] Veri dışa aktarım API'si
[ ] Anomali tespiti
```

### B11 — CASM Modülleri

```
[ ] Remediation workflow (remediation_tickets tablosu)
[ ] Birleşik risk öncelik skoru
[ ] Attack path visualization (Mermaid.js)
[ ] Kapalı döngü doğrulama (verification_scan_queue)
[ ] Cloud CSPM - AWS (cloud_connections tablosu)
[ ] Cloud CSPM - Azure
[ ] GitHub/GitLab secrets scanning
```

---

## BÖLÜM C: API KEY VE KONFIGÜRASYON DURUMU

`.env` dosyasını veya Replit Secrets'ı kontrol et.
Her değişken için: ✅ Tanımlı | ❌ Eksik | ⚠️ Test/Demo değeri

```
TEMEL:
[ ] DATABASE_URL
[ ] REDIS_URL
[ ] ANTHROPIC_API_KEY
[ ] SESSION_SECRET
[ ] ENCRYPTION_KEY

ÖDEME:
[ ] IYZICO_API_KEY
[ ] IYZICO_SECRET_KEY
[ ] IYZICO_BASE_URL
[ ] PAPARA_API_KEY
[ ] E_INVOICE_API_URL
[ ] E_INVOICE_API_KEY
[ ] BANK_IBAN

TARAMA SERVİSLERİ:
[ ] SHODAN_API_KEY
[ ] VIRUSTOTAL_API_KEY
[ ] ABUSEIPDB_API_KEY
[ ] HIBP_API_KEY

CTI FEED'LERİ:
[ ] FORTIGUARD_API_KEY
[ ] TALOS_API_KEY
[ ] UMBRELLA_API_KEY
[ ] GREYNOISE_API_KEY
[ ] MISP_URL
[ ] MISP_API_KEY
[ ] SECURITYTRAILS_API_KEY
[ ] CENSYS_API_ID
[ ] CENSYS_API_SECRET

FORTİNET:
[ ] FM_API_USER
[ ] FORTIGATE_TRUSTED_IPS

CRM/SATIŞ:
[ ] APOLLO_API_KEY
[ ] HUNTER_API_KEY
[ ] CALENDLY_API_KEY
[ ] SALES_TEAM_EMAIL

İLETİŞİM:
[ ] SMTP_HOST / SENDGRID_API_KEY
[ ] WHATSAPP_PHONE_NUMBER_ID
[ ] WHATSAPP_ACCESS_TOKEN
[ ] SLACK_WEBHOOK_URL

ANALİTİK:
[ ] POSTHOG_API_KEY
[ ] CLOUDFLARE_API_TOKEN
[ ] GOOGLE_API_KEY (Safe Browsing)

BULUT CSPM:
[ ] (Müşteri bazlı — admin panelinden girilecek)

GENEL:
[ ] BASE_URL
[ ] ADMIN_URL
[ ] SYSLOG_PORT
[ ] DEMO_MODE
[ ] APP_VERSION
```

---

## BÖLÜM D: FRONTEND ROUTE ENVANTERİ

Tüm React route'larını tara (React Router veya benzeri).
Her route için: ✅ Sayfa var | ❌ Yok | ⚠️ Placeholder

**Public Sayfalar:**
```
[ ] /
[ ] /fiyatlar
[ ] /hakkimizda
[ ] /kariyer
[ ] /status
[ ] /preview/:token
[ ] /verify/:token
[ ] /nps/:token
[ ] /odeme/:invoice_token
[ ] /sertifika/:token
[ ] /rakip-karsilastirma
[ ] /benchmark-raporu
[ ] /araclar/*
[ ] /yatirim-paketi
[ ] /sektor/*
[ ] /giris
[ ] /kayit
[ ] /affiliate
```

**Müşteri Portal (/hesabim):**
```
[ ] /hesabim
[ ] /hesabim/degerlendirmelerim
[ ] /hesabim/raporlarim
[ ] /hesabim/servislerim
[ ] /hesabim/soc
[ ] /hesabim/faturalar
[ ] /hesabim/entegrasyonlar
[ ] /hesabim/fortinet-entegrasyonu
[ ] /hesabim/cloud-guvenlik
[ ] /hesabim/bulgularim (remediation)
[ ] /hesabim/politikalarim
[ ] /hesabim/destek
[ ] /hesabim/odeme-yontemi
[ ] /hesabim/api-key
[ ] /hesabim/bildirimler
[ ] /hesabim/sertifikalar
```

**Admin Panel (/admin-panel):**
```
[ ] /admin-panel (dashboard)
[ ] /admin-panel/customers
[ ] /admin-panel/segments
[ ] /admin-panel/tasks
[ ] /admin-panel/nps

[ ] /admin-panel/assessments
[ ] /admin-panel/reports

[ ] /admin-panel/isr/pipeline
[ ] /admin-panel/isr/customers
[ ] /admin-panel/isr/lead-gen
[ ] /admin-panel/isr/inbox
[ ] /admin-panel/isr/quotes
[ ] /admin-panel/isr/contracts
[ ] /admin-panel/isr/invoices
[ ] /admin-panel/isr/reports

[ ] /admin-panel/enterprise/prospects
[ ] /admin-panel/enterprise/contracts

[ ] /admin-panel/invoices
[ ] /admin-panel/collections
[ ] /admin-panel/revenue
[ ] /admin-panel/mrr

[ ] /admin-panel/soc
[ ] /admin-panel/soc/cases/:id
[ ] /admin-panel/soc/playbooks

[ ] /admin-panel/cti
[ ] /admin-panel/cti/ioc
[ ] /admin-panel/cti/actors
[ ] /admin-panel/cti/campaigns
[ ] /admin-panel/cti/feeds
[ ] /admin-panel/cti/vendors

[ ] /admin-panel/growth-engine
[ ] /admin-panel/whatsapp
[ ] /admin-panel/affiliates

[ ] /admin-panel/fabric/integrations
[ ] /admin-panel/fabric/events
[ ] /admin-panel/fabric/correlations

[ ] /admin-panel/remediation
[ ] /admin-panel/cloud-cspm
[ ] /admin-panel/code-secrets

[ ] /admin-panel/ai-costs
[ ] /admin-panel/status

[ ] /admin-panel/settings
[ ] /admin-panel/settings/accounting
[ ] /admin-panel/settings/email-templates
```

---

## BÖLÜM E: BACKEND API ENVANTERİ

Tüm Express route'larını tara.
Her endpoint için: ✅ Var | ❌ Yok | ⚠️ Stub/Placeholder

Kritik endpoint'leri kontrol et:
```
[ ] POST /api/scan/domain
[ ] GET  /api/scan/:id/results
[ ] POST /api/assessments/start
[ ] POST /api/assessments/:id/submit
[ ] GET  /api/reports/:id
[ ] POST /api/payments/create
[ ] POST /api/webhooks/iyzico
[ ] POST /api/fabric/webhook/:token
[ ] POST /api/fabric/syslog/:token
[ ] GET  /health
[ ] GET  /metrics
```

---

## BÖLÜM F: CRON JOB ENVANTERİ

Scheduler dosyasını tara (`src/scheduler/` veya benzeri).
Her job için: ✅ Aktif | ❌ Eksik | ⚠️ Pasif

```
[ ] Domain tarama kuyruğu (her 15 dk)
[ ] SSL expiry check (her gece 01:00)
[ ] CVE alert check (her gece 02:00)
[ ] Lead Apollo fetch (her gece 02:00)
[ ] Lead domain tarama (her gece 03:00)
[ ] Kontak zenginleştirme (her gece 04:00)
[ ] Daily lead raporu (her sabah 08:30)
[ ] Teaser takip e-postaları (09:00)
[ ] SLA breach check (her 5 dk)
[ ] SOC triage kuyruğu (her 5 dk)
[ ] Batch alert korelasyon (her 15 dk)
[ ] Threat feed güncelleme (her saat)
[ ] Müşteri tehdit alaka (her gece 01:00)
[ ] IoC enrichment (her gece 02:00)
[ ] Attack path analizi (her gece 02:00)
[ ] Cloud CSPM tarama (her gece 03:00)
[ ] GitHub secrets tarama (her Pazar 04:00)
[ ] Remediation doğrulama (her saat)
[ ] Haftalık SOC raporu (Pazartesi 09:00)
[ ] Aylık CTI raporu (her ay 1'i)
[ ] Aylık AI maliyet raporu (her ay 1'i)
[ ] Sözleşme yenileme hatırlatıcı (her sabah 09:30)
[ ] Onboarding nudge e-postaları (her gece)
[ ] NPS anket gönderimi (her gece)
[ ] Upsell tahmin hesaplama (her gece 01:00)
[ ] WhatsApp dizi gönderimi (her saat)
[ ] EKAP ihale çekme (her gece 03:00)
[ ] MERSİS yeni şirket (her Pazartesi)
[ ] Port değişiklik delta (her Pazar 04:00)
```

---

## BÖLÜM G: DIŞ SERVİS ENTEGRASYON DURUMU

Her entegrasyon için bağlantıyı test et:

```
TARAMA:
[ ] Shodan API     → test endpoint
[ ] VirusTotal     → test endpoint
[ ] AbuseIPDB      → test endpoint
[ ] HIBP           → test endpoint

CTI:
[ ] USOM RSS feed  → erişilebilir mi?
[ ] URLHaus API    → erişilebilir mi?
[ ] FortiGuard web → erişilebilir mi?

ÖDEME:
[ ] Iyzico sandbox → test ödeme çalışıyor mu?

İLETİŞİM:
[ ] SMTP/E-posta   → test e-posta gidebiliyor mu?
[ ] WhatsApp API   → bağlı mı?

FORTİNET:
[ ] FortiManager   → bağlantı testi
```

---

## BÖLÜM H: DOCKER HAZIRLIĞI

```
[ ] Dockerfile var mı?
[ ] docker-compose.yml var mı?
[ ] .env.example tam dolu mu?
[ ] Tüm portlar docker-compose'da tanımlı mı?
[ ] Health check endpoint (/health) var mı?
[ ] Metrics endpoint (/metrics) var mı?
[ ] Worker servisi ayrı container'da mı?
[ ] Syslog server ayrı container'da mı?
```

---

## BÖLÜM I: GÜVENLİK KONTROL LİSTESİ

```
[ ] Tüm API endpoint'leri auth middleware arkasında mı?
[ ] Webhook endpoint'leri token ile koruluyor mu?
[ ] API key'ler .env'de, koda gömülmüş yok mu?
[ ] Şifrelenmiş hassas veriler (token'lar AES-256'lı mı)?
[ ] Rate limiting var mı? (public endpoint'lerde)
[ ] SQL injection koruması (Drizzle parameterized query)?
[ ] XSS koruması (React built-in + CSP header)?
[ ] CORS doğru yapılandırılmış mı?
[ ] HTTPS only (Replit default, Docker'da da olacak mı)?
```

---

## BÖLÜM J: PERFORMANS GÖZLEMİ

```
[ ] En yavaş API endpoint'ler (response time > 2s)
[ ] En büyük veritabanı tabloları
[ ] Index eksik olan sık sorgulanan alanlar
[ ] N+1 query sorunu olan yerler
[ ] Memory leak riski olan long-running job'lar
[ ] Claude API timeout riski olan promptlar
    (max 30s timeout var mı?)
```

---

## RAPOR FORMATI

Yukarıdaki her bölümü tara ve şu formatta raporla:

```markdown
# CyberStep.io Sistem Audit Raporu
Tarih: [bugün]
Replit Agent: [versiyon]

## Özet

Toplam modül/özellik: XXX
✅ Tamamlandı: XX (%XX)
⚠️ Kısmen: XX (%XX)
❌ Eksik: XX (%XX)
🔑 API Key Bekliyor: XX

## Kritik Eksikler (Hemen Yapılmalı)
...

## API Key Gereksimleri
...

## Veritabanı Durumu
...

[Her bölüm için detaylı tablo]

## Önerilen Aksiyon Sırası
1. ...
2. ...
```

Raporu bitirdikten sonra:
1. `SISTEM_AUDIT_RAPORU.md` olarak kaydet
2. Kritik eksik sayısını özetle
3. Hangi API key'lerin önce alınması gerektiğini sırala
4. Tahmini "production-ready" için ne kadar iş kaldığını belirt

---

*CyberStep.io Sistem Audit Promptu — 31 Mayıs 2026*
