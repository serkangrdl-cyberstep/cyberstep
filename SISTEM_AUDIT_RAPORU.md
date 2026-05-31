# CyberStep.io — Sistem Audit Raporu

**Tarih:** 31 Mayıs 2026  
**Kapsam:** Tam kaynak kodu taraması + canlı veritabanı sorgusu  
**Ortam:** Replit pnpm monorepo, Node.js 24, PostgreSQL

---

## Özet

| Metrik | Değer |
|---|---|
| Toplam veritabanı tablosu (canlı) | **116** |
| Drizzle şema dosyası | **43** |
| Backend route modülü | **45+** |
| Aktif cron job | **28** |
| Frontend sayfa bileşeni | **80+** |

| Durum | Sayı | Oran |
|---|---|---|
| ✅ Tamamlandı | **87** | %59 |
| ⚠️ Kısmen Çalışıyor | **29** | %20 |
| ❌ Eksik/Yok | **22** | %15 |
| 🔑 API Key Bekliyor | **9** | %6 |

---

## Kritik Eksikler (Hemen Yapılmalı)

1. **IYZICO_API_KEY + IYZICO_SECRET_KEY** — Ödeme altyapısı kod olarak hazır ama anahtar yok; hiçbir ücretli satış gerçekleşemiyor.
2. **SOC_ADMIN_EMAIL** — Tanımlanmamışsa SOC eskalasyon e-postaları hiç gitmiyor (fail-closed davranış).
3. **SHODAN / VIRUSTOTAL / ABUSEIPDB / HIBP / GOOGLE_SAFE_BROWSING** — Kod + DB sütunları hazır; sadece API key eksik; alan adı tarama raporlarında bu servislerin kartları boş kalıyor.
4. **Redis** — SOC triage önbelleği in-memory; sunucu her yeniden başladığında önbellek sıfırlanıyor. Veriler kaybolmuyor ama performans düşüyor.
5. **Docker / Production readiness** — Dockerfile yok; sağlık endpoint'i (`GET /health`) yok; şu an sadece Replit'te çalışabiliyor.

---

## API Key Gereksinimleri (Öncelik Sırasına Göre)

| # | Servis | Env Key | Maliyet | Etki |
|---|---|---|---|---|
| 1 | Iyzico | `IYZICO_API_KEY` + `IYZICO_SECRET_KEY` | Ücretsiz (sandbox) | Ödeme tamamen durmuş |
| 2 | SOC Admin E-posta | `SOC_ADMIN_EMAIL` | - | Eskalasyon bildirimleri gitmiyor |
| 3 | AbuseIPDB | `ABUSEIPDB_API_KEY` | Freemium ($0–20/ay) | IP itibar taraması |
| 4 | Google Safe Browsing | `GOOGLE_SAFE_BROWSING_API_KEY` | Ücretsiz (10K/gün) | Phishing/malware tespiti |
| 5 | HIBP | `HIBP_API_KEY` | $3.50/ay | Veri sızıntısı kontrolü |
| 6 | VirusTotal | `VIRUSTOTAL_API_KEY` | Freemium | 70 AV motoru taraması |
| 7 | Shodan | `SHODAN_API_KEY` | $49/ay | Açık port maruziyet tespiti |
| 8 | Apollo.io | `APOLLO_API_KEY` | Ücretli | ISR lead üretimi |
| 9 | Hunter.io | `HUNTER_API_KEY` | Freemium | ISR e-posta zenginleştirme |

---

## Bölüm A: Veritabanı Şema Envanteri

### Canlı Tablo Sayısı: 116

| Kategori | Tablolar | Durum |
|---|---|---|
| Kimlik & Oturum | customers, admin_users, tenants, tenant_users, sessions | ✅ |
| Değerlendirme | assessments, assessment_answers, reports, questions | ✅ |
| Domain Tarama | domain_scans, domain_scan_purchases | ✅ |
| AI Değerlendirme | ai_assessments, ai_assessment_answers, ai_tools_registry, ai_tool_policy_snapshots | ✅ |
| AI İzleme & Politika | ai_monitoring_subscriptions, ai_monitoring_alerts, ai_policy_documents, ai_policy_subscriptions | ✅ |
| AI Kullanım | ai_usage_log | ✅ |
| SOC | soc_cases, soc_playbooks, soc_activity_log, soc_sla_config, soc_ip_whitelist | ✅ |
| Fortinet Fabric | fortinet_integrations, fabric_events, fabric_correlations, fortimanager_block_actions | ✅ |
| ISR / CRM | isr_customers, isr_deals, isr_activities, isr_quotes, isr_quote_lines, isr_rfqs, isr_rfq_responses, isr_reminders, isr_vendors, isr_distributors, isr_margin_rules, isr_email_inbox, crm_tasks | ✅ |
| Enterprise | enterprise_prospects, enterprise_contracts, enterprise_contract_services, enterprise_invoices | ✅ |
| Growth Engine | growth_triggers, growth_engine_settings, competitor_checks, ekap_tenders, new_companies_registry, benchmark_downloads | ✅ |
| Müşteri Sağlık | customer_health_scores, customer_activity_events, health_interventions | ✅ |
| Referral | referral_codes, referral_events | ✅ |
| Partner | partners, partner_leads, white_label_partners | ✅ |
| Blog & İçerik | blog_posts, blog_content_calendar, news_items, news_sources, weekly_digests | ✅ |
| Ödeme & Fatura | payments, invoice_sequences, accounting_settings | ✅ |
| Rozet & Başarım | badge_advantages, achievement_badges, customer_achievements | ✅ |
| Diğer | pentest_lite_requests, phishing_simulations, eu_aiact_assessments, red_team_reports, deepfake_assessments, document_scans, tprm_questionnaire_links/responses, onboarding_progress, nps_surveys, scan_leads, lead_scan_queue, work_packages, api_product_keys, service_prices, pricing_plans, status_service_health, status_incidents, site_settings... | ✅ |

### Potansiyel Sorunlar

| Sorun | Detay |
|---|---|
| Orphaned migration sütunları | `domain_scans` tablosunda `attack_scenarios_started_at` başta olmak üzere birçok sütun `ALTER TABLE IF NOT EXISTS` ile eklendi; Drizzle push yerine elle uygulandı. Drizzle şeması ile DB arasında kayma riski var. |
| `ioc_registry` tablosu yok | CTI Platform için planlanmış ama ne şemada ne DB'de mevcut. |
| `remediation_tickets` yok | CASM Remediation workflow için planlanmış ama mevcut değil. |
| `verification_scan_queue` yok | Kapalı döngü doğrulama için planlanmış ama mevcut değil. |
| `cloud_connections` yok | Cloud CSPM (AWS/Azure) için planlanmış ama mevcut değil. |
| Index eksikliği | `domain_scans.email`, `assessments.email`, `fabric_events.customer_id`, `fabric_events.created_at` — sık sorgulanan alanlar ama explicit index tanımı yok; tablo büyüdükçe yavaşlar. |

---

## Bölüm B: Modül ve Özellik Envanteri

### B1 — Temel Platform

#### Domain Güvenlik Taraması

| Alt Servis | Durum | Not |
|---|---|---|
| SPF/DKIM/DMARC kontrolü | ✅ | Tam uygulandı, DNS sorgusu |
| MX kaydı kontrolü | ✅ | |
| SSL/TLS kontrolü | ✅ | SSL expiry + issuer + SSL Labs grade |
| HIBP veri sızıntısı | ⚠️ | Kod hazır, `HIBP_API_KEY` eksik |
| Kara liste kontrolü | ✅ | Çoklu liste, in-memory cache |
| Shadow IT tespiti | ✅ | 30+ servis kategorisi |
| HTTP güvenlik başlıkları | ✅ | Score hesaplanıyor |
| URLHaus kontrolü | ✅ | İmplementasyon mevcut |
| USOM kontrolü | ✅ | Startup'ta yükleniyor, günlük yenileniyor |
| crt.sh subdomain tarama | ✅ | Certificate transparency |
| NVD CVE taraması | ✅ | CVSS ≥7.0 filtreli |
| Shodan açık port taraması | 🔑 | Kod hazır, `SHODAN_API_KEY` eksik |
| VirusTotal taraması | 🔑 | Kod hazır, `VIRUSTOTAL_API_KEY` eksik |
| AbuseIPDB IP itibarı | 🔑 | Kod hazır, `ABUSEIPDB_API_KEY` eksik |
| Google Safe Browsing | 🔑 | Kod hazır, `GOOGLE_SAFE_BROWSING_API_KEY` eksik |
| SSL Labs grade | ✅ | Mevcut tarama akışında |
| KEP yapılandırma kontrolü | ✅ | Türkiye'ye özgü |
| MITRE ATT&CK analizi | ✅ | Claude ile, ⚠️ ~2 dk gecikmeli |

#### Güvenlik Değerlendirme Sistemi

| Özellik | Durum |
|---|---|
| Mini assessment (20 soru) | ✅ |
| Tam assessment (55 soru) | ✅ full-assessment-runner.tsx |
| Gemini AI rapor üretimi | ✅ |
| Uzman doğrulama akışı | ✅ reviewToken + verificationToken |
| Sertifika üretimi | ⚠️ Şema hazır (certificationTier), UI kısmi |

#### Müşteri Portal (/hesabim)

| Sayfa | Durum |
|---|---|
| Ana dashboard | ✅ /hesabim |
| Raporlarım | ✅ /raporlarim |
| Servislerim | ⚠️ Kısmi |
| Faturalar | ✅ /hesabim/faturalar |
| Entegrasyonlar | ✅ /entegrasyonlarim |
| Fortinet kurulum | ✅ /hesabim/fortinet-entegrasyonu |
| SOC dashboard | ✅ /hesabim/soc |
| Destek | ✅ /hesabim/destek |
| Yönetim raporu | ✅ /hesabim/yonetim-raporu |
| Davet (referral) | ✅ /hesabim/davet |

#### Ödeme Sistemi

| Özellik | Durum |
|---|---|
| Iyzico tek ödeme | 🔑 Kod hazır, API key yok |
| Iyzico abonelik | 🔑 Kod hazır, API key yok |
| Fatura PDF | ✅ invoice.ts + pdf.ts |
| E-fatura (GİB) | ❌ Uygulama yok |

---

### B2 — AI Servisleri

| Servis | Sayfa | Backend | Durum |
|---|---|---|---|
| AI Güvenlik Değerlendirmesi | /ai-guvenlik/start | ai-assessment/index.ts | ✅ |
| AI Phishing Simülasyonu | /ai-phishing-simulasyonu | phishing-sim/index.ts | ✅ |
| EU AI Act Uyum | /eu-ai-act | eu-aiact/index.ts | ✅ |
| AI Red Team Raporu | /ai-red-team | red-team/index.ts | ✅ |
| Deepfake & Ses Klonu | /deepfake-analizi | deepfake/index.ts | ✅ |
| Sahte Doküman Tespiti | /sahte-dokuman | doc-scan/index.ts | ✅ |
| AI Araç İzleme | Yok (hesabim/servisler) | ai-monitoring/index.ts | ⚠️ Backend tam, UI kısmi |
| AI Politika Üretici | /ai-politika | ai-policy/index.ts | ✅ |
| Sanal CISO | sanal-ciso.tsx mevcut | ❌ Dedicated backend yok | ⚠️ Kısmi |

---

### B3 — Fortinet Entegrasyonu

| Özellik | Durum | Dosya |
|---|---|---|
| FortiManager JSON-RPC | ✅ | services/fabric-fortimanager.ts |
| FortiGate webhook (POST /api/fabric/webhook/:token) | ✅ | routes/fabric/index.ts |
| FortiAnalyzer syslog (TCP/UDP) | ✅ | routes/fabric/index.ts |
| FortiManager IP blok (adres objesi + grup + policy) | ✅ | services/fabric-fortimanager.ts |
| Security Fabric cihaz keşfi | ✅ | fmDiscoverDevices() |
| Kurulum sihirbazı (/hesabim/fortinet-entegrasyonu) | ✅ | |
| Demo modu | ✅ | demoMode column + simülasyon |
| Blok doğrulama (6 saatlik cron) | ✅ | services/fabric-cron.ts |
| Şifreli credential saklama | ✅ | AES-256-GCM, ENCRYPTION_KEY Secret |

---

### B4 — CTI Platform

| Özellik | Durum | Not |
|---|---|---|
| IoC Registry (ioc_registry tablosu) | ❌ | Tablo yok |
| Threat actor profilleri | ❌ | |
| Kampanya yönetimi | ❌ | |
| USOM feed entegrasyonu | ✅ | Günlük yenileniyor |
| URLHaus feed | ✅ | Domain taramasında aktif |
| Feodo Tracker | ❌ | |
| FortiGuard feed | 🔑 | API key gerekli |
| Talos feed | 🔑 | API key gerekli |
| GreyNoise | 🔑 | API key gerekli |
| MISP | 🔑 | URL + key gerekli |
| IoC enrichment pipeline | ❌ | |
| Müşteri tehdit alaka motoru | ❌ | |
| Aylık CTI raporu | ❌ | |

> **Not:** CTI'nın büyük bölümü henüz uygulanmamış. USOM ve URLHaus domain tarama akışına entegre edilmiş durumda, ancak tam bir CTI platformu yok.

---

### B5 — SOC Servisi

| Özellik | Durum | Not |
|---|---|---|
| soc_cases tablosu | ✅ | |
| soc_playbooks tablosu | ✅ | Startup'ta seed ediliyor |
| Claude 4-katmanlı triage | ✅ | Haiku→Sonnet→Extended |
| Eskalasyon motoru (0–4) | ✅ | soc-escalation.ts |
| SLA takibi | ✅ | soc_sla_config + breach check |
| SOC admin paneli (/panel/soc) | ✅ | |
| WebSocket gerçek zamanlı | ✅ | initSOCWebSocket |
| Müşteri SOC (/hesabim/soc) | ✅ | |
| Haftalık SOC raporu | ✅ | runWeeklySOCReports, Pazartesi 09:00 |
| AI maliyet takibi | ✅ | ai_usage_log, aylık rapor cron |
| Redis önbelleği | ⚠️ | REDIS_SOC_CACHE_TTL env var var ama Redis bağlantısı yok; in-memory çalışıyor |

---

### B6 — ISR / CRM Modülü

| Özellik | Durum |
|---|---|
| isr_customers | ✅ |
| isr_deals | ✅ |
| Pipeline (/panel/enterprise/pipeline) | ✅ |
| Lead üretim (/panel/isr/lead-gen benzeri) | ⚠️ Kısmi |
| Apollo.io entegrasyonu | 🔑 services/apolloService.ts hazır, API key eksik |
| Hunter.io entegrasyonu | 🔑 services/hunterService.ts hazır, API key eksik |
| IMAP e-posta okuma | ✅ ISR_IMAP_PASS Secret ile aktif |
| isr_activities | ✅ |
| crm_tasks | ✅ |
| NPS | ✅ nps_surveys tablosu, Salı 11:00 cron |
| ISR AI asistan | ⚠️ services/isr-ai.ts mevcut, UI kısmi |

---

### B7 — Enterprise Sales & Sözleşme

| Özellik | Durum |
|---|---|
| enterprise_prospects tablosu | ✅ |
| Teaser rapor üretimi | ✅ teaserReportService.ts |
| Preview (/preview/:token) | ✅ preview.tsx |
| Enterprise sözleşme yönetimi | ✅ enterprise_contracts |
| Sözleşme PDF | ⚠️ pdf.ts var, özel sözleşme şablonu belirsiz |
| enterprise_invoices | ✅ |
| Servis aktivasyon paneli | ✅ /panel/enterprise/pipeline |

---

### B8 — Muhasebe & CRM Genişletme

| Özellik | Durum |
|---|---|
| Fatura PDF + seri no (invoice_sequences) | ✅ |
| Tahsilat takibi + otomatik hatırlatma | ✅ Günlük 10:00 cron |
| MRR/ARR dashboard (/panel/gelir) | ✅ AdminGelir sayfası |
| Müşteri 360° (/panel/musteriler/:id) | ✅ Musteri360 bileşeni |
| Etiket & segment (customer_tags) | ✅ |
| CRM görev + hatırlatıcı (crm_tasks) | ✅ Günlük 08:30 cron |
| NPS otomasyonu | ✅ |
| Muhasebe webhook entegrasyonu | ❌ |
| Abonelik yaşam döngüsü yönetimi | ⚠️ Kısmi (nextBillingDate var, otomatik yenileme yok) |

---

### B9 — Growth Engine

| Özellik | Durum |
|---|---|
| growth_triggers tablosu | ✅ |
| SSL expiry trigger | ✅ Gece 01:00 cron |
| CVE alert trigger (NVD API) | ✅ Gece 02:30 cron |
| Sektör saldırı FOMO trigger | ⚠️ Tablo var, UI/tetikleyici kısmi |
| KVK ceza trigger | ⚠️ |
| Skor düşüşü upsell trigger | ⚠️ Health score var, upsell trigger kısmi |
| Rakip karşılaştırma (/rakip-karsilastirma) | ✅ Sayfa mevcut |
| Port değişiklik delta | ✅ Pazar 04:00 cron |
| Benchmark download lead mıknatısı | ⚠️ benchmark_downloads tablosu var, otomasyon kısmi |
| EKAP ihale takibi | ⚠️ ekap_tenders tablosu var, cron yok |
| MERSİS yeni şirket | ⚠️ new_companies_registry tablosu var, cron yok |
| Tahminsel upsell motoru | ⚠️ |
| WhatsApp lead besleme botu | ❌ Uygulama yok |
| Tedarikçi zinciri yayılma | ❌ |

---

### B10 — Genişletilmiş Özellikler

| Özellik | Durum |
|---|---|
| Status page (/status) | ✅ |
| Kariyer (/kariyer) | ⚠️ job_applications tablosu + formu var, sayfa route belirsiz |
| Onboarding tamamlama skoru | ✅ onboarding_progress |
| Başarı rozeti sistemi | ✅ achievement_badges |
| SEO araç sayfaları (/araclar/*) | ✅ 6 araç |
| Güvenlik politika üretici | ✅ ai-policy (AI tabanlı) |
| Sektörel SEO sayfaları (/sektor/*) | ✅ 5 sektör |
| White-label altyapısı | ✅ white_label_partners + /panel/whitelabel |
| Veri dışa aktarım API'si (v1) | ✅ /v1/score, /v1/scan, /v1/certificate, /v1/benchmark |
| Partner programı | ✅ /ortak, partner şeması |
| Blog autopilot | ✅ Pazartesi + Perşembe 09:00 |
| Slack/Teams entegrasyonu | ❌ |
| Vendor güvenlik puanlama | ❌ |
| Fon başvurusu paketi | ❌ |
| Eğitim sertifikası sistemi | ❌ |
| AI destekli yardım merkezi | ❌ |
| Yıllık güvenlik raporu | ❌ |
| Ürün turu (intro.js) | ❌ |
| Affiliate (commission) programı | ❌ Referral ✅ ama affiliate marketplace ❌ |
| SSO (Google + Microsoft) | ❌ |

---

### B11 — CASM Modülleri

| Özellik | Durum |
|---|---|
| Remediation workflow (remediation_tickets) | ❌ Tablo yok |
| Birleşik risk öncelik skoru | ✅ scoring.ts |
| Attack path visualization (MITRE) | ⚠️ Attack scenarios mevcut, görsel Mermaid yok |
| Kapalı döngü doğrulama (verification_scan_queue) | ❌ |
| Cloud CSPM - AWS (cloud_connections) | ❌ |
| Cloud CSPM - Azure | ❌ |
| GitHub/GitLab secrets scanning | ❌ |

---

## Bölüm C: API Key ve Konfigürasyon Durumu

| Kategori | Değişken | Durum | Not |
|---|---|---|---|
| **TEMEL** | DATABASE_URL | ✅ | PostgreSQL, canlı |
| | REDIS_URL | ❌ | SOC cache in-memory çalışıyor |
| | ANTHROPIC (Claude) | ✅ | ai-client.ts aktif, Replit integration |
| | AI_INTEGRATIONS_GEMINI_* | ✅ | Replit tarafından otomatik sağlanıyor |
| | SESSION_SECRET | ✅ | Secret olarak tanımlı |
| | ENCRYPTION_KEY | ✅ | Secret olarak tanımlı (AES-256 için) |
| **SMTP** | SMTP_USER | ✅ | Env var mevcut |
| | SMTP_PASS | ✅ | Secret olarak tanımlı |
| **ÖDEME** | IYZICO_API_KEY | ❌ | Kod hazır, key yok |
| | IYZICO_SECRET_KEY | ❌ | Kod hazır, key yok |
| **TARAMA** | SHODAN_API_KEY | ❌ | Kod hazır |
| | VIRUSTOTAL_API_KEY | ❌ | Kod hazır |
| | ABUSEIPDB_API_KEY | ❌ | Kod hazır |
| | HIBP_API_KEY | ❌ | Kod hazır |
| | GOOGLE_SAFE_BROWSING_API_KEY | ❌ | Kod hazır |
| **CRM/SATIŞ** | APOLLO_API_KEY | ❌ | apolloService.ts hazır |
| | HUNTER_API_KEY | ❌ | hunterService.ts hazır |
| **ISR** | ISR_IMAP_PASS | ✅ | Secret olarak tanımlı |
| **SOC** | SOC_ADMIN_EMAIL | ⚠️ | Bilinmiyor; eksikse eskalasyon mailleri gitmiyor |
| **ADMİN** | ADMIN_EMAIL | ✅ | Env var mevcut |
| | ADMIN_URL | ✅ | Env var mevcut |
| **CTI** | FORTIGUARD_API_KEY | ❌ | CTI platform yok |
| | TALOS_API_KEY | ❌ | |
| | GREYNOISE_API_KEY | ❌ | |
| | MISP_URL + MISP_API_KEY | ❌ | |

---

## Bölüm D: Frontend Route Envanteri

### Public Sayfalar

| Route | Durum |
|---|---|
| / | ✅ |
| /giris | ✅ |
| /kayit | ✅ |
| /sifre-sifirla | ✅ |
| /totp-kurulum | ✅ |
| /fiyatlar | ✅ |
| /hakkimizda | ✅ |
| /iletisim | ✅ |
| /blog + /blog/:slug | ✅ |
| /status | ✅ |
| /preview/:token | ✅ |
| /nps/:token | ✅ |
| /rakip-karsilastirma | ✅ |
| /sektor/:slug | ✅ (5 sektör) |
| /araclar/ssl-kontrol | ✅ |
| /araclar/domain-guvenlik-taramasi | ✅ |
| /araclar/kvkk-ceza-hesaplayici | ✅ |
| /araclar/dmarc-kontrol | ✅ |
| /araclar/dark-web-sorgulama | ✅ |
| /araclar/siber-risk-roi | ✅ |
| /kvkk, /gizlilik-politikasi, /cerez-politikasi | ✅ |
| /ortak (partner portal) | ✅ |
| /ortak/giris | ✅ |
| /w/:slug (white-label) | ✅ |
| /affiliate | ❌ Sayfa yok |
| /sertifika/:token | ❌ Route yok |
| /kariyer | ⚠️ Sayfa dosyası var, route kayıt belirsiz |

### Müşteri Portal (/hesabim)

| Route | Durum |
|---|---|
| /hesabim | ✅ |
| /raporlarim | ✅ |
| /entegrasyonlarim | ✅ |
| /hesabim/enterprise | ✅ |
| /hesabim/davet | ✅ |
| /hesabim/faturalar | ✅ |
| /hesabim/fortinet-entegrasyonu | ✅ |
| /hesabim/soc | ✅ |
| /hesabim/destek | ✅ |
| /hesabim/yonetim-raporu | ✅ |
| /hesabim/cloud-guvenlik | ❌ |
| /hesabim/bulgularim | ❌ |
| /hesabim/politikalarim | ❌ |
| /hesabim/odeme-yontemi | ❌ |
| /hesabim/api-key | ❌ |
| /hesabim/bildirimler | ❌ |

### Admin Panel (/panel)

| Route | Durum |
|---|---|
| /panel | ✅ |
| /panel/giris | ✅ |
| /panel/workspace | ✅ |
| /panel/workspace-ayarlari | ✅ |
| /panel/ayarlar | ✅ |
| /panel/musteriler | ✅ |
| /panel/musteriler/:id (360°) | ✅ |
| /panel/degerlendirmeler | ✅ |
| /panel/degerlendirmeler/:id/rapor | ✅ |
| /panel/odemeler | ✅ |
| /panel/faturalar | ✅ |
| /panel/gelir | ✅ |
| /panel/enterprise/pipeline | ✅ |
| /panel/blog | ✅ |
| /panel/whitelabel | ✅ |
| /panel/soc | ✅ |
| /panel/ai-costs | ✅ |
| /panel/saglik (health scores) | ✅ |
| /panel/growth-engine | ✅ |
| /panel/entegrasyonlar | ✅ |
| /panel/isr/* | ⚠️ Kısmi |
| /panel/cti/* | ❌ |
| /panel/fabric/* | ⚠️ Fabric admin kısmi |
| /panel/remediation | ❌ |
| /panel/cloud-cspm | ❌ |

### Servis Akışları

| Route | Durum |
|---|---|
| /assessment/start | ✅ |
| /assessment/:id | ✅ |
| /assessment/:id/report | ✅ |
| /domain-tarama | ✅ |
| /ai-guvenlik/start | ✅ |
| /ai-guvenlik/:id/rapor | ✅ |
| /pentest-lite | ✅ |
| /ai-phishing-simulasyonu | ✅ |
| /eu-ai-act | ✅ |
| /ai-red-team | ✅ |
| /deepfake-analizi | ✅ |
| /sahte-dokuman | ✅ |

---

## Bölüm E: Backend API Envanteri (Kritik Endpoint'ler)

| Endpoint | Durum | Not |
|---|---|---|
| POST /api/scan/domain | ✅ domain-scan/index.ts |
| GET /api/scan/:id/results | ✅ |
| POST /api/assessments/start | ✅ |
| POST /api/assessments/:id/complete | ✅ |
| GET /api/reports/:id | ✅ |
| POST /api/payments/create | ✅ Kod hazır, Iyzico key yok |
| POST /api/webhooks/iyzico | ⚠️ Doğrulanmamış |
| POST /api/fabric/webhook/:token | ✅ Token korumalı |
| POST /api/fabric/syslog/:token | ✅ |
| GET /health | ❌ Express health endpoint yok |
| GET /metrics | ❌ Prometheus/metrics yok |
| GET /api/v1/score | ✅ |
| GET /api/v1/scan | ✅ |
| GET /api/v1/certificate | ✅ |
| GET /api/v1/benchmark | ✅ |
| POST /api/domain-scan/:id/attack-scenarios | ✅ Compare-and-set kurtarma |
| GET /api/soc/cases | ✅ |
| POST /api/board-report | ✅ |
| POST /api/pentest-lite | ✅ |
| POST /api/public/partner-lead | ✅ |

---

## Bölüm F: Cron Job Envanteri

### Aktif Cron'lar (28 adet)

| Job | Zamanlama | Kaynak |
|---|---|---|
| ✅ 30 günlük değerlendirme hatırlatıcı | Günlük 09:00 TR | index.ts |
| ✅ Domain yeniden tarama | Günlük 09:30 TR | index.ts |
| ✅ Haftalık delta raporu | Pazartesi 08:00 TR | index.ts |
| ✅ ISR IMAP işleme | Her 5 dakika | index.ts |
| ✅ Scan lead drip | Saatte bir | index.ts |
| ✅ Enflasyon hatırlatıcı | Pazartesi 09:00 TR | index.ts |
| ✅ RSS haber toplama | Günlük 06:00 TR | index.ts |
| ✅ Haftalık digest üretimi | Cuma 07:00 TR | index.ts |
| ✅ Blog autopilot | Pzt+Per 09:00 TR | index.ts |
| ✅ AI araç politika izleme | Pazar 02:00 TR | index.ts |
| ✅ Çeyreklik politika güncelleme | 1 Oca/Nis/Tem/Eki 03:00 | index.ts |
| ✅ USOM listesi yenileme | Günlük 03:00 UTC | index.ts |
| ✅ Müşteri sağlık skoru | Günlük 02:00 TR | index.ts |
| ✅ Tahsilat hatırlatıcı | Günlük 10:00 TR | index.ts |
| ✅ CRM otomatik etiketleme | Günlük 03:30 TR | index.ts |
| ✅ Görev hatırlatıcı | Günlük 08:30 TR | index.ts |
| ✅ NPS gönderimi | Salı 11:00 TR | index.ts |
| ✅ Growth: SSL expiry | Günlük 01:00 TR | index.ts |
| ✅ Growth: CVE uyarısı | Günlük 02:30 TR | index.ts |
| ✅ Growth: Port değişikliği | Pazar 04:00 TR | index.ts |
| ✅ SOC triage kuyruğu | Her 5 dakika | soc-cron.ts |
| ✅ SOC SLA breach kontrolü | Her 5 dakika | soc-cron.ts |
| ✅ SOC haftalık rapor | Pazartesi 09:00 TR | soc-cron.ts |
| ✅ SOC aylık AI maliyet raporu | Her ayın 1'i 08:00 TR | soc-cron.ts |
| ✅ Fabric batch korelasyon | Her 15 dakika | fabric-cron.ts |
| ✅ FortiManager sağlık + cihaz keşfi | Günlük 02:45 TR | fabric-cron.ts |
| ✅ Fabric haftalık raporu | Pazartesi 08:00 TR | fabric-cron.ts |
| ✅ Blok doğrulama | Her 6 saatte | fabric-cron.ts |

### Planlanmış ama Eksik Cron'lar

| Job | Durum |
|---|---|
| ❌ Lead Apollo fetch | Tablo var, cron yok |
| ❌ Kontak zenginleştirme | |
| ❌ Threat feed güncelleme (saatlik) | USOM günlük var |
| ❌ IoC enrichment pipeline | CTI yoksa anlamsız |
| ❌ Attack path analizi (gece) | |
| ❌ Cloud CSPM tarama | Cloud yok |
| ❌ GitHub secrets tarama | |
| ❌ Remediation doğrulama | Remediation yok |
| ❌ Aylık CTI raporu | CTI yok |
| ❌ WhatsApp dizi gönderimi | WhatsApp yok |
| ❌ EKAP ihale çekme | Tablo var, cron yok |
| ❌ MERSİS yeni şirket | Tablo var, cron yok |
| ❌ Onboarding nudge e-postaları | |

---

## Bölüm G: Dış Servis Entegrasyon Durumu

| Servis | Kategori | Uygulama | API Key |
|---|---|---|---|
| Gemini AI (Google) | AI | ✅ Replit otomatik | ✅ |
| Claude (Anthropic) | AI | ✅ ai-client.ts | ✅ |
| USOM | CTI | ✅ Aktif | - (ücretsiz RSS) |
| URLHaus | CTI | ✅ Aktif | - (ücretsiz API) |
| NVD CVE | Güvenlik | ✅ Aktif | - (ücretsiz) |
| crt.sh | Subdomain | ✅ Aktif | - (ücretsiz) |
| SMTP/E-posta | İletişim | ✅ Aktif | ✅ SMTP_PASS |
| Iyzico | Ödeme | ✅ Kod hazır | ❌ |
| Shodan | Tarama | ✅ Kod hazır | ❌ |
| VirusTotal | Tarama | ✅ Kod hazır | ❌ |
| AbuseIPDB | Tarama | ✅ Kod hazır | ❌ |
| HIBP | Tarama | ✅ Kod hazır | ❌ |
| Google Safe Browsing | Tarama | ✅ Kod hazır | ❌ |
| FortiManager | Fortinet | ✅ Tam | Müşteri sağlar |
| Jira | ITSM | ✅ Müşteri entegrasyonu | Müşteri sağlar |
| QRadar | SOC | ✅ Müşteri entegrasyonu | Müşteri sağlar |
| CrowdStrike | SOC | ✅ Müşteri entegrasyonu | Müşteri sağlar |
| Trend Micro | SOC | ✅ Müşteri entegrasyonu | Müşteri sağlar |
| Apollo.io | ISR | ✅ Kod hazır | ❌ |
| Hunter.io | ISR | ✅ Kod hazır | ❌ |
| IMAP | ISR | ✅ Aktif | ✅ ISR_IMAP_PASS |
| WhatsApp | İletişim | ❌ | ❌ |
| Slack | İletişim | ❌ | ❌ |

---

## Bölüm H: Docker Hazırlığı

| Kontrol | Durum |
|---|---|
| Dockerfile | ❌ Yok |
| docker-compose.yml | ❌ Yok |
| .env.example | ❌ Yok |
| GET /health express endpoint | ❌ Yok (health/ route müşteri sağlık skoru içindir) |
| GET /metrics (Prometheus) | ❌ Yok |
| Worker servisi container | ❌ (cron'lar ana sunucu process'inde) |
| Syslog server ayrı container | ❌ (fabric route'larında inline) |
| PORT env var | ✅ Kullanılıyor |

> **Not:** Uygulama şu an yalnızca Replit ortamında çalışıyor. On-premise/Docker kurulumu için anlamlı bir iş gerekiyor.

---

## Bölüm I: Güvenlik Kontrol Listesi

| Kontrol | Durum | Not |
|---|---|---|
| Auth middleware (39 route dosyasında) | ✅ | requireCustomer, requireAdmin |
| Webhook token koruması | ✅ | Fabric webhook token bazlı |
| API key'ler env'de, koda gömülmemiş | ✅ | process.env kullanımı doğru |
| Şifreli hassas veri (AES-256-GCM) | ✅ | FortiManager password'u şifreli |
| Rate limiting (public endpoint) | ✅ | express-rate-limit aktif |
| SQL injection koruması | ✅ | Drizzle ORM parameterized query |
| XSS koruması | ✅ | React built-in + CORS |
| CORS kısıtlı allowlist | ✅ | Domain allowlist uygulandı |
| HTTPS | ✅ | Replit default |
| Attack-scenario orphan recovery | ✅ | Compare-and-set ile kurtarma |
| GET/POST attack-scenarios PUBLIC | ⚠️ | Bilerek (anonim tarama için); IDOR tradeoff kabul edilmiş |

---

## Bölüm J: Performans Gözlemi

| Alan | Durum | Not |
|---|---|---|
| Alan adı taraması (18 paralel check) | ⚠️ | Promise.all — en yavaş servis tüm taramayı blokluyor; zaman aşımı kontrol edilmeli |
| MITRE attack-scenario üretimi (Claude) | ⚠️ | Üretimde ~2 dakika. UI artık bekleme bildirimi veriyor; 4.5 dk timeout var |
| SOC triage (her 5 dk) | ✅ | In-process lock overlap koruması var |
| Redis eksikliği | ⚠️ | SOC cache in-memory; restart'ta sıfırlanıyor |
| Index eksikliği (büyük tablolarda) | ⚠️ | domain_scans, fabric_events, assessments — sütunlar sık sorgulanıyor ama explicit index yok |
| Cron'lar tek process'te | ⚠️ | Sunucu crash'i tüm zamanlanmış görevleri durduruyor; orphaned generation bug buradan çıktı |
| Claude timeout | ⚠️ | Pentest-lite ve board report akışlarında explicit timeout yok |

---

## Canlı Veritabanı Kullanım İstatistikleri

| Tablo | Kayıt |
|---|---|
| customers | 4 |
| assessments | 12 |
| reports | 3 |
| domain_scans | 4 (1'i VirusTotal verili) |
| soc_cases | 8 |
| fabric_events | 13 |
| pentest_lite_requests | 1 |
| blog_posts | 5 |
| ai_assessments | 0 |
| board_reports | 0 |
| enterprise_prospects | 0 |
| isr_customers | 0 |

> Uygulama test/geliştirme aşamasında; üretimde az kullanım mevcut.

---

## Önerilen Aksiyon Sırası

### Acil (Bu Hafta)

1. **Iyzico API anahtarlarını ekle** — `IYZICO_API_KEY` + `IYZICO_SECRET_KEY` → Replit Secrets'a gir. Sandbox ile test et.
2. **SOC_ADMIN_EMAIL'i ayarla** — Eskalasyon bildirimleri gitmiyor.
3. **Ücretsiz tarama API'lerini ekle** — Google Safe Browsing (ücretsiz, 10K/gün), AbuseIPDB (ücretsiz 1K/gün), HIBP ($3.50/ay). Hepsi kod hazır, sadece key ekle.

### Kısa Vadeli (1-2 Ay)

4. **VirusTotal + Shodan API anahtarları** — Domain tarama raporunun en değerli kartlarını açar.
5. **Apollo.io + Hunter.io anahtarları** — ISR outbound otomasyonunu aktifleştirir.
6. **Redis** — SOC cache kalıcı hale gelir; restart'ta veri kaybı olmaz.
7. **GET /health endpoint** — Monitoring, load balancer, Docker health check için zorunlu.
8. **Kritik DB index'leri** — `domain_scans(email)`, `fabric_events(customer_id, created_at)`, `assessments(email)`.
9. **Diğer AI akışlarında orphan kurtarma** — Pentest-lite, board-report, AI-assessment: aynı compare-and-set pattern'i uygula (Task #10).

### Orta Vadeli (3-6 Ay)

10. **CTI Platform** — ioc_registry tablosu, threat actor profilleri, MISP/FortiGuard/GreyNoise feed'leri.
11. **CASM** — remediation_tickets, attack path Mermaid görselleştirme, kapalı döngü doğrulama.
12. **Cloud CSPM** — AWS/Azure bağlantısı.
13. **EKAP + MERSİS cron'ları** — Tablolar hazır, cron eklenmeli.
14. **WhatsApp entegrasyonu** — Lead besleme botu.
15. **Docker hazırlığı** — Dockerfile, docker-compose, /health endpoint, worker ayrımı.

---

## Tahmini "Production-Ready" Durumu

| Bileşen | Hazırlık |
|---|---|
| Temel SaaS platform (değerlendirme + tarama + rapor) | **%90** |
| AI servisleri (phishing, deepfake, red team, EU AI Act...) | **%85** |
| Fortinet Security Fabric entegrasyonu | **%90** |
| SOC servisi | **%85** |
| ISR/CRM modülü | **%65** |
| Enterprise sales | **%75** |
| Ödeme sistemi | **%70** (kod %100, key %0) |
| CTI Platform | **%10** |
| CASM / Remediation | **%15** |
| Cloud CSPM | **%5** |
| Docker / On-premise kurulum | **%5** |
| **Genel Ortalama** | **~%65** |

> Temel SaaS ürünü (değerlendirme + domain tarama + AI servisler + SOC + Fortinet) production'a yakın. Ödeme için sadece API key gerekiyor. CTI, CASM ve Cloud CSPM sıfırdan başlatılmalı.

---

*CyberStep.io Sistem Audit Raporu — 31 Mayıs 2026*  
*Kaynak: Tam kaynak kodu taraması (lib/db/src/schema/, artifacts/api-server/src/, artifacts/cyberstep/src/) + canlı PostgreSQL sorgusu (116 tablo)*
