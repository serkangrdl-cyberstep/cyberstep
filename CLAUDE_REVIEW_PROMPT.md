# CyberStep.io — Kapsamlı Ürün & Strateji İnceleme Talebi

Sen deneyimli bir B2B SaaS danışmanısın; aynı zamanda Türkiye KOBİ pazarını, siber güvenlik sektörünü ve SaaS fiyatlandırmasını iyi bilen birisisin. Aşağıda CyberStep.io platformunun **eksiksiz teknik ve ürün envanteri** verilmektedir.

Lütfen şu sorulara yanıt ver:
1. Genel değerlendirme: Ürün bütünlüğü, boşluklar, fazlalıklar
2. Fiyatlandırma: Türkiye KOBİ pazarı için doğru mu, neyi değiştirirdin?
3. Go-to-Market: Hangi özelliği öne çıkarırdın, nasıl sıraya koyardın?
4. Kritik eksikler: Rakip avantajı yaratabilecek neyin eksik olduğunu düşünüyorsun?
5. Hızlı kazanımlar: 90 günde en yüksek geliri getirecek 3 aksiyon nedir?

---

## 1. ÜRÜN TANIMI

**CyberStep.io** — Türkçe, KOBİ odaklı siber güvenlik risk analizi ve sürekli izleme SaaS platformu.

**Hedef kitle:** 1–500 çalışan arası Türk KOBİleri (finans, sağlık, e-ticaret, üretim, lojistik, BT, turizm, eğitim, inşaat sektörleri).

**Temel değer önermesi:** "Teknik bilgi gerektirmeden, 20 dakikada şirketinizin siber güvenlik risk seviyesini öğrenin; yapay zeka destekli rapor ve uzman danışmanlıkla aksiyona geçin."

**Dil & Yerelleştirme:** Tüm arayüz ve içerik Türkçe. KVKK, USOM, VERBIS gibi Türkiye'ye özgü düzenlemeler entegre.

---

## 2. FRONTEND — SAYFALAR & ARAÇLAR

### Genel Sayfalar
- **Ana Sayfa** (`/`) — Değer önerisi, nasıl çalışır, güven unsurları, fiyatlandırma, SSS, son blog yazıları
- **Fiyatlar** (`/fiyatlar`) — Canlı DB'den çekilen planlar
- **Hakkımızda** (`/hakkimizda`)
- **İletişim** (`/iletisim`)
- **KVKK** (`/kvkk`)
- **Blog** (`/blog`, `/blog/:slug`) — Admin panelden yönetilen, SEO optimizeli yazılar

### Değerlendirme Akışı
- **Mini Değerlendirme Başlangıç** (`/assessment/start`) — Şirket bilgileri formu (isim, yetkili, e-posta, sektör, çalışan sayısı)
- **Mini Değerlendirme Runner** (`/assessment/:id`) — 20 soruluk wizard, 5 güvenlik alanı (A-E), görsel cevap butonları
- **Rapor** (`/assessment/:id/report`) — AI destekli risk analizi, skor göstergesi, alan kırılımı grafiği, aksiyonlar
- **Tam Değerlendirme Başlangıç** (`/assessment/full/start`) — Ücretli; 55 soru, 10 alan
- **Tam Değerlendirme Runner** (`/assessment/full/:id`)

### Ücretsiz Araçlar & Araç Kutusu
| Araç | URL | Açıklama |
|---|---|---|
| Alan Adı Taraması | `/domain-tarama` | Harici saldırı yüzeyi analizi (SPF, DMARC, DKIM, MX, SSL, HIBP, URLHaus, USOM, VirusTotal, AbuseIPDB, CVE, Shodan, crt.sh) |
| ROI Hesaplayıcı | `/roi-hesaplayici` | Sektör × KVKK riski × çalışan büyüklüğüne göre siber saldırı maliyet vs. koruma ROI hesabı |
| Güven Rozeti | `/guven-rozeti` | Alan adı güvenlik skoru SVG rozeti (web sitesine gömülebilir, canlı veri) |
| Sızıntı İzleyici | `/sizinti-izleyici` | HIBP tabanlı e-posta sızıntı sorgulama |
| KVKK DPA Oluşturucu | `/kvkk-dpa-olustur` | Kişisel veri işleme sözleşmesi oluşturucu |
| Siber Panik Rehberi | `/siber-panik` | Siber saldırı anında ne yapılmalı; adım adım rehber |
| KVKK VERBİS Rehberi | `/kvkk-verbis` | VERBİS kayıt rehberi |
| M365 Denetim | `/m365-denetim` | Microsoft 365 güvenlik yapılandırma denetim aracı |
| Siber Sigorta | `/siber-sigorta` | Siber sigorta ihtiyaç analizi ve yönlendirme |
| Sektörel Kıyaslama | `/sektorel-kiyaslama` | Sektör bazında güvenlik skorları karşılaştırması |
| KVKK Ceza Simülatörü | `/kvkk-ceza-sim` | KVKK ihlali ceza hesaplayıcı |
| Phishing Simülasyonu | `/phishing-sim` | Çalışan farkındalık testi bilgi/yönlendirme sayfası |
| Saldırı Simülasyonu | `/saldiri-simulasyonu` | Saldırı vektörü simülasyonu |
| TPRM Anketi | `/tprm/anket/:token` | Tedarik zinciri risk yönetimi; tedarikçilere gönderilen özel anket |

### Müşteri Portalı
- `/giris`, `/kayit`, `/sifre-sifirla` — Kimlik doğrulama
- `/hesabim` — Hesap yönetimi
- `/raporlarim` — Kullanıcının tüm değerlendirme raporları

### Partner Portalı
- `/ortak` — Partner dashboard (is paketleri, müşteri yönetimi)
- `/ortak/giris` — Partner girişi
- `/w/:slug` — White-label tenant sayfası (özel logo, renk, alan adı)

---

## 3. BACKEND API ROTALARI

**Prefix:** `/api`

### Çekirdek
- `GET /health` — Sağlık kontrolü
- `GET /public/pricing` — Canlı fiyatlandırma planları (auth gerekmez)
- `GET /advisories` — Güvenlik uyarıları (publik)

### Değerlendirme
- `POST /assessments` — Yeni değerlendirme oluştur
- `GET /assessments/:id` — Değerlendirme detayı
- `POST /assessments/:id/answers` — Cevapları toplu kaydet
- `POST /assessments/:id/complete` — Tamamla + Gemini/Claude AI rapor tetikle (async)
- `GET /assessments/:id/report` — Rapor sorgula (frontend her 2sn'de poll eder)
- `GET /assessments/stats/summary` — Özet istatistikler
- `GET /assessments/:id/pdf` — PDF rapor indir

### Alan Adı Tarama
- `POST /domain-scan` — Tam tarama
- `GET /domain-scan/:id` — Tarama sonucu
- `GET /guven-rozeti/:domain/badge.svg` — Canlı güven rozeti SVG (publik CDN uyumlu)
- `GET /guven-rozeti/:domain` — JSON skor verisi

### Yapay Zeka
- `POST /gemini` — Sohbet (SSE stream)
- `POST /gemini/image` — Görsel üretim

### Müşteri Auth
- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`
- `POST /auth/forgot-password`, `POST /auth/reset-password`
- `GET /auth/me`

### Partner Auth
- `POST /partner-auth/login`, `GET /partner-auth/me`

### Tarama Leadları (Drip)
- `POST /scan-leads` — E-posta yakaları (alan adı tarama sonrası)
- `GET /scan-leads/unsubscribe/:token` — Abonelik iptali

### TPRM
- `POST /tprm/questionnaire` — Tedarikçi anketi oluştur/gönder
- `GET /tprm/questionnaire/:token` — Anket yanıtla
- `POST /tprm/questionnaire/:token/submit` — Anketi gönder

### Araçlar (API Backend'i)
- `POST /breach-simulator`
- `POST /finansal-kayip`
- `POST /marka-koruma`
- `POST /tedarik-zinciri`

### Admin Panel (`/admin-panel/*`)
- Auth: `/admin-panel/auth/login`, `/logout`, `/me`, `/2fa/*`, `/password-reset`
- Genel Ayarlar: `/admin-panel/settings` (GET/PUT)
- API Anahtarları: `/admin-panel/settings/apikeys` (GET/PUT)
- Fiyatlandırma: `/admin-panel/pricing` (GET/POST/PUT/DELETE)
- Analitik: `/admin-panel/analytics/*` (dashboard istatistikler, müşteri funnel)
- Değerlendirmeler: `/admin-panel/assessments` (listele, onayla, reddet)
- Müşteriler: `/admin-panel/customers` (listele, plan güncelle, not ekle)
- Alan Taramaları: `/admin-panel/domain-scans` (listele, sil, yeniden tara)
- Ödemeler: `/admin-panel/payments` (listele, durum güncelle)
- Blog: `/admin-panel/blog/*` (CRUD, AI ile yazı üret, sosyal medya planla)
- E-posta Şablonları: `/admin-panel/email-templates/*` (CRUD, önizleme, test gönder)
- ISR: `/admin-panel/isr/*` (müşteri, vendor, distributor, deal, RFQ, teklifler)
- Rozet Avantajları: `/admin-panel/badge-advantages` (CRUD)
- İş Ortakları / Partnerlar: `/admin-panel/partners` ve iş paketleri
- Sosyal Medya: `/admin-panel/social-media`
- Özel Gün Mesajları: `/admin-panel/special-day-messages`
- Danışmanlık Hizmetleri: `/admin-panel/consulting`
- Kiracı (Tenant) Yönetimi: `/admin-panel/tenants`
- White-label: `/admin-panel/whitelabel`
- ISR E-posta Gelen Kutusu: `/admin-panel/isr/inbox` (IMAP entegrasyonu)

---

## 4. VERİTABANI TABLOLARI (PostgreSQL + Drizzle ORM)

| Tablo | İçerik |
|---|---|
| `assessments` | Değerlendirmeler (mini/tam, skor, riskLevel, AI rapor, PDF, sertifika) |
| `assessment_answers` | Soru bazında cevaplar (evet/kısmen/bilmiyorum/hayır) |
| `questions` | Soru bankası (domain, weight, isRedAlarm, type) |
| `reports` | AI raporları (verifiedAt, certificationTier: standard/gold/platinum) |
| `domain_scans` | Alan taramaları (SPF/DMARC/SSL/HIBP/blacklist vb. tüm modüller) |
| `scan_leads` | Alan taramasından yakalanan leadler + drip durumu |
| `customers` | Kayıtlı müşteriler |
| `pricing_plans` | Fiyat planları (slug, name, price, features, isActive, updatedAt) |
| `payments` | Iyzico ödeme kayıtları |
| `admin_users` | Admin kullanıcıları (TOTP 2FA destekli) |
| `site_settings` | Anahtar-değer yapılandırma (API anahtarları dahil) |
| `tenants` + `tenant_users` | White-label kiracılar |
| `blog_posts` | Blog yazıları (AI üretim destekli, SEO meta) |
| `newsletter_subscribers` | Bülten aboneleri |
| `email_templates` + `email_sends` | E-posta şablon sistemi |
| `special_day_messages` | Özel gün e-posta kampanyaları |
| `social_media_links` | Sosyal medya bağlantıları |
| `partners` + `work_packages` | Partner ve iş paketi yönetimi |
| `consulting_services` | Danışmanlık hizmetleri kataloğu |
| `tech_partners` | Teknoloji partner kataloğu |
| `white_label_partners` | White-label partner profilleri |
| `badge_advantages` | Güven rozeti avantajları (partnerlardan sağlanan indirimler) |
| `conversations` + `messages` | AI sohbet geçmişi |
| `tprm_questionnaire_links` + `_responses` | Tedarik zinciri risk anketi |
| `isr_customers` | ISR müşteri CRM |
| `isr_vendors` + `isr_distributors` | Satıcı ve distribütör yönetimi |
| `isr_deals` | Fırsat/deal takibi |
| `isr_rfqs` + `isr_rfq_responses` | RFQ (teklif talebi) yönetimi |
| `isr_quotes` + `isr_quote_lines` | Teklif ve teklif kalemleri |
| `isr_margin_rules` | Marj kuralları motoru |
| `isr_email_inbox` | ISR için IMAP ile çekilen gelen kutusu |

---

## 5. FİYATLANDIRMA (KDV HARİÇ, TL)

### Tek Seferlik Değerlendirme Planları
| Plan | Slug | Fiyat | İçerik |
|---|---|---|---|
| Mini Değerlendirme | `mini` | **Ücretsiz** | 20 soru, 5 alan, Gemini AI rapor, domain tarama (SPF/DMARC/HIBP), risk skoru |
| Tam Değerlendirme | `full` | **5.990 TL** | 55 soru, 10 alan, Claude AI detaylı rapor, PDF indirme, sektörel karşılaştırma, 1 saat uzman danışmanlık |
| Premium Danışmanlık | `premium` | **17.990 TL** | Tam değerlendirme + birebir danışmanlık + saha incelemesi + 6 ay takip desteği |

### Aylık Abonelik Planları (SaaS)
| Plan | Slug | Fiyat/Ay | Hedef Kitle | İçerik |
|---|---|---|---|---|
| Başlangıç | `starter` | **690 TL/ay** | 1-10 çalışan | Otomatik domain tarama, mini değerlendirme, sızıntı izleyici bildirimleri, Claude AI temel rapor |
| Büyüme | `growth` | **1.990 TL/ay** | 11-200 çalışan | Yılda 2 tam değerlendirme, tüm domain modüller, KVKK uyum haritası, sektörel kıyaslama |
| Kurumsal | `enterprise` | **5.990 TL/ay** | 200+ çalışan | Sınırsız değerlendirme, aylık danışman görüşmesi, ISR tehdit istihbaratı, TPRM, white-label raporlama |

**Fiyat güncelleme politikası:** Her 6 ayda bir TÜFE oranında artış önerilir. Admin panelinde otomatik hatırlatıcı banner ve her Pazartesi admin e-postasına hatırlatma gönderilir.

---

## 6. YAPAY ZEKA ENTEGRASYONLARİ

| Bağlam | Model | Kullanım |
|---|---|---|
| Ücretsiz (mini) değerlendirme raporları | **Gemini 2.5 Flash** | Maliyet etkin, hızlı |
| Ücretli (full/premium) değerlendirme raporları | **Claude Sonnet** | Daha derin analiz |
| Abonelik planları (starter, pro) | **Claude Sonnet** | Sürekli izleme raporları |
| Sohbet asistanı | **Gemini** (SSE stream) | Anlık siber güvenlik soruları |
| Blog yazısı üretimi | **Gemini** | Admin panelden tek tıkla |
| Görsel üretim | **Gemini** | Blog görselleri |

**Not:** Tüm AI entegrasyonları Replit AI Integrations proxy üzerinden; kendi API anahtarı gerekmez.

---

## 7. HARICI API ENTEGRASYONLARİ

| API | Amaç | Ücretsiz mi? |
|---|---|---|
| Have I Been Pwned (HIBP) | E-posta sızıntı kontrolü | Evet (publik) |
| URLHaus | Zararlı URL/alan tespiti | Evet |
| USOM (TR Siber Güvenlik) | Türkiye zararlı alan kara listesi | Evet |
| Feodo Tracker | Botnet C2 IP listesi | Evet |
| crt.sh | Alt alan şeffaflık kaydı | Evet |
| NIST NVD | CVE güvenlik açığı veritabanı | Evet |
| VirusTotal | Domain reputation taraması | API anahtarı gerekli (admin panelden yapılandırılabilir) |
| AbuseIPDB | IP kötüye kullanım geçmişi | API anahtarı gerekli |
| Shodan | İnternet maruziyet taraması | API anahtarı gerekli |
| Google Safe Browsing | Zararlı site kontrolü | API anahtarı gerekli |
| WhoisXML | Domain WHOIS verisi | API anahtarı gerekli |
| OTX (AlienVault) | Tehdit istihbaratı | API anahtarı gerekli |
| GreyNoise | IP davranış analizi | API anahtarı gerekli |
| **Iyzico** | Ödeme altyapısı | Entegre, API key gerekli |
| **SMTP/IMAP** (Gmail) | E-posta gönderim + ISR gelen kutusu | Env vars: SMTP_USER, SMTP_PASS |

---

## 8. ZAMANLANMIŞ GÖREVLER (CRON)

| Görev | Zamanlama | Açıklama |
|---|---|---|
| 30 Günlük Hatırlatıcı | Her gün 09:00 | Raporu 30 gün önce tamamlayan ve hatırlatma almamış müşterilere e-posta |
| Domain Yeniden Tarama | Her gün 09:30 | Son 30 gündeki tamamlanmış taramaları yeniden tara, değişim varsa bildirim gönder |
| Haftalık Delta Raporu | Her Pazartesi 08:00 | Tarama skorlarındaki haftalık değişimi karşılaştır; yeni açıklar/kapanan açıklar |
| ISR IMAP Sync | Her 5 dakika | Vendor e-postalarını çek, ISR gelen kutusuna işle |
| ISR Hatırlatıcılar | Her saat | Satış takip hatırlatıcılarını işle |
| Scan Lead Drip | Her saat | 4 aşamalı e-posta dizisi (gün 0/2/4/7) |
| USOM Kara Liste Yenileme | Her gün 03:00 | Türkiye ulusal zararlı alan listesini güncelle |
| **Enflasyon Hatırlatıcısı** | Her Pazartesi 09:00 | Fiyatlar 6+ aydır güncellenmemişse admin'e e-posta ile önerilen fiyatlar tablosu gönder |

---

## 9. E-POSTA SİSTEMİ

**Altyapı:** nodemailer + Gmail SMTP

**Gönderilen e-posta türleri:**
1. **Admin Bildirim** — Yeni değerlendirme tamamlandığında (detaylı, riskli sorular dahil)
2. **Müşteri Onay** — Değerlendirme/rapor teslim onayı
3. **Rapor Teslimatı** — AI raporu hazır olduğunda müşteriye
4. **30 Günlük Hatırlatıcı** — "Tekrar değerlendirin" daveti
5. **Domain Yeniden Tarama Bildirimi** — Skor değişince otomatik
6. **Haftalık Delta** — Yeni açıklar/kapananlar özeti
7. **Scan Lead Drip (4 aşama)** — Alan taramasından yakalanan leade 0/2/4/7. günlerde
8. **Özel Gün Kampanyası** — Admin panelden planlanan tarihli toplu e-posta
9. **Bülten** — Newsletter abonelerine
10. **ISR Deal Follow-up** — Satış fırsatı takip e-postası
11. **Şifre Sıfırlama** — Müşteri portalı
12. **Enflasyon Hatırlatıcısı** — Admin'e 6-aylık fiyat güncelleme önerisi (yeni)

**E-posta Şablon Sistemi:** Admin panelinden CRUD; HTML önizleme; test gönderimi; şablondan güzel HTML e-posta üretimi (Gemini destekli)

---

## 10. ADMİN PANELİ YETENEKLERİ

**Güvenlik:** TOTP 2FA, bcrypt şifreli oturum yönetimi, şifre sıfırlama

### Bölümler
| Bölüm | Yetenekler |
|---|---|
| **Dashboard** | Toplam değerlendirme, risk dağılımı, ortalama skor, alan bazında kırılım, son 30 gün trendi |
| **Değerlendirmeler** | Listele, filtrele, onayla/reddet, detay gör, PDF indir, AI raporu yeniden üret |
| **Müşteriler** | Tüm müşteriler, plan bilgisi, notlar, iletişim geçmişi, segment güncelleme |
| **Domain Taramaları** | Tüm taramalar, re-scan tetikle, sonuçları sil, detay görüntüle |
| **Ödemeler** | Iyzico ödeme kayıtları, durum güncelleme |
| **Fiyatlandırma** | Plan CRUD (oluştur/düzenle/sil), enflasyon hatırlatıcı banner, "Enflasyon uygula" butonu |
| **Blog** | Yazı CRUD, AI ile yazı üret, yayın/taslak kontrolü, kategori/etiket, SEO meta |
| **E-posta Şablonları** | Şablon CRUD, HTML önizleme, test gönder, Gemini ile şablon üret, gönderim geçmişi |
| **Bildirimler / Özel Gün** | Tarihli toplu e-posta kampanyaları |
| **Analitik** | Sayfa görüntülenmeleri, dönüşüm hunisi, lead kaynakları |
| **Sorular** | Soru bankası yönetimi (domain, weight, isRedAlarm) |
| **ISR** | Müşteri CRM, vendor/distributor yönetimi, deal takibi, RFQ akışı, teklif üretimi, marj kuralları, e-posta gelen kutusu |
| **İş Ortakları / Partnerlar** | Partner profilleri, iş paketleri, referral takibi |
| **Danışmanlık Hizmetleri** | Hizmet kataloğu CRUD |
| **Teknoloji Partnerları** | Partner logo, satış temsilcisi, ek iletişim |
| **White-label** | Tenant yönetimi, özel logo/renk/domain |
| **Rozet Avantajları** | Partner indirim ve avantaj CRUD (sertifika sahiplerine özel) |
| **Sosyal Medya** | Bağlantı yönetimi |
| **Site Ayarları** | Genel konfigürasyon, API anahtarları panelden yapılandırma |
| **Güvenlik (2FA)** | TOTP kurulum/sıfırlama |

---

## 11. SERTİFİKA & ROZET SİSTEMİ

### Doğrulama Rozetleri (Zaman Sınırlı)
- **Standart** — 1 yıl geçerli
- **Altın** — 2 yıl geçerli, haftalık domain izleme dahil
- **Platin** — 2 yıl geçerli, öncelikli destek + özel avantajlar

Admin panelinden tier atanır, `/verify/:token` sayfasında müşteriler/üçüncü taraflar rozetin geçerliliğini ve tier'ını görebilir.

### Güven Rozeti (Live Badge)
- Herhangi bir alan adı için `/guven-rozeti` sayfasından SVG rozet üretilir
- `<img src="https://cyberstep.io/api/guven-rozeti/example.com/badge.svg">` olarak web sitesine gömülür
- Her ziyarette gerçek zamanlı skor çeker

### Rozet Avantajları
- Sertifika sahibi şirketlere partner firmalardan özel indirimler
- Admin panelden avantaj eklenir, landing page ve rapor sayfasında gösterilir

---

## 12. ISR — İÇ SATIŞ TEMSİLCİSİ SİSTEMİ

Platformun dahili b2b satış yönetim modülü:

- **IMAP Entegrasyonu** — Vendor/distribütör e-postaları her 5 dakikada IMAP ile çekilir, gelen kutusu admin panelde görüntülenir
- **CRM** — Müşteri, vendor, distribütör kayıtları
- **Deal Pipeline** — Fırsat takibi, aşama yönetimi
- **RFQ Akışı** — Teklif talebi gönder → vendor yanıt al → teklif oluştur
- **Marj Motoru** — Ürün/vendor bazında marj kuralları; tekliflerde otomatik marj hesabı
- **Teklif Üretimi** — Quote lines, PDF benzeri teklif çıktısı

---

## 13. WHITE-LABEL & TPRM

### White-label (Bayilik)
- Partnerlar kendi tenant slug'larıyla (`/w/partner-adi`) özelleştirilmiş arayüz sunar
- Özel logo, primary color, contact email
- Müşterilere white-label rapor teslimi

### TPRM (Tedarik Zinciri Risk Yönetimi)
- Admin veya müşteri → tedarikçiye özel token'lı anket linki gönderir
- Tedarikçi `/tprm/anket/:token` sayfasında anketi doldurur
- Yanıtlar merkezi raporlanır

---

## 14. TEKNİK YIĞIN

- **Frontend:** React 18 + Vite + Wouter + TanStack Query + shadcn/ui + Recharts + Tailwind CSS
- **Backend:** Node.js 24 + Express 5 + TypeScript 5.9
- **Veritabanı:** PostgreSQL + Drizzle ORM
- **Validasyon:** Zod
- **API Tasarımı:** Contract-first OpenAPI → Orval codegen (React Query hooks + Zod şemaları)
- **E-posta:** nodemailer + Gmail SMTP
- **Zamanlama:** node-cron (8 cron job)
- **AI:** Gemini 2.5 Flash + Claude Sonnet (Replit AI Integrations proxy)
- **Ödeme:** Iyzico
- **Build:** esbuild (CJS bundle)
- **Monorepo:** pnpm workspaces

---

## 15. ŞU AN ÜCRETSİZ (BAŞLATILMIŞ) ÖZELLİKLER

✅ Mini Değerlendirme (20 soru, Gemini AI rapor)
✅ Alan Adı Taraması (12 kontrol modülü — Shodan, VirusTotal, AbuseIPDB hariç)
✅ ROI Hesaplayıcı
✅ Güven Rozeti (SVG, canlı veri)
✅ Sızıntı İzleyici (HIBP tabanlı)
✅ KVKK DPA Oluşturucu
✅ Siber Panik Rehberi
✅ KVKK VERBİS Rehberi
✅ M365 Denetim
✅ Siber Sigorta Yönlendirme
✅ Sektörel Kıyaslama
✅ KVKK Ceza Simülatörü
✅ Phishing Simülasyonu (bilgi sayfası)
✅ Saldırı Simülasyonu
✅ TPRM Anketi
✅ Müşteri Portalı (kayıt/giriş/raporlarım)
✅ Partner Portalı
✅ Blog (AI destekli içerik üretimi)
✅ Bülten sistemi

---

## 16. ÜCRETLI / AKTİFLEŞTİRİLECEK ÖZELLİKLER

💰 **Tam Değerlendirme** (5.990 TL) — Ödeme altyapısı (Iyzico) entegre ama API key eksik; ödeme akışı tamamlandığında devreye alınacak
💰 **Premium Danışmanlık** (17.990 TL) — İletişim formu + manuel koordinasyon aşamasında
💰 **Abonelik Planları** (690/1.990/5.990 TL/ay) — Altyapı hazır, Iyzico recurring ödeme entegrasyonu bekliyor
💰 **VirusTotal / AbuseIPDB / Shodan** modülleri — API key gerektirir; admin panelden yapılandırılabilir

---

## 17. REKABET ORTAMI (TÜRKIYE)

- **Lokal rakipler:** Büyük ölçüde danışmanlık firmaları; otomatize self-service SaaS yok
- **Global rakipler:** SecurityScorecard, UpGuard, BitSight (İngilizce, KOBİ için erişilemez fiyat)
- **CyberStep farkı:** Türkçe, KOBİ ölçeğinde, self-service, AI destekli, uygun fiyatlı, KVKK entegre

---

## SORULARIM CLAUDE'A

Yukarıdaki envanteri inceledikten sonra lütfen şunları değerlendir:

### A) Ürün Bütünlüğü
- Bu özellik seti için "sızdırıyor" bir yer var mı? Önemli bir açık var mı?
- Hangi özellikler "iyi fikir ama henüz erken" kategorisinde? (ISR, TPRM, white-label gibi)
- Araç fazlalığı var mı? Odak dağılıyor mu?

### B) Fiyatlandırma
- 5.990 TL tek seferlik Tam Değerlendirme: Türk KOBİ için doğru fiyat mı?
- 690/1.990/5.990 TL/ay abonelik: piyasaya uygun mu, değer önerisiyle eşleşiyor mu?
- Freemium → ücretli geçiş için en kritik engel nerede? Nasıl aşılır?
- Fiyatları enflasyona karşı 6 ayda bir TÜFE oranında artırma politikası mantıklı mı?

### C) Go-to-Market & Büyüme
- İlk 100 müşteri için en kısa yol nedir?
- Alan Adı Taraması → Lead yakaları → Drip e-posta dizisi: bu lead funnel'ı etkili mi?
- Güven Rozeti viral mekanik olarak işe yarar mı? Nasıl güçlendirilir?
- Partner / ISR modeli mi yoksa doğrudan satış mı önce?

### D) Kritik Eksikler
- Şu anda ne eksik ve eklenmesi en yüksek değeri yaratır?
- Ödeme sürtüşmesini azaltmak için ne yapılmalı?
- Müşteri başarı (customer success) tarafında ne kurulmalı?

### E) 90 Günlük Öncelik
Elimde sınırlı kaynak var (1-2 geliştirici). 90 günde maksimum gelir için **3 aksiyonu** listele ve gerekçele.
