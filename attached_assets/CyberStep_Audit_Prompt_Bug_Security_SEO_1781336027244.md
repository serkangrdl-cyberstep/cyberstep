# CyberStep — Kapsamlı Kod Denetimi: Bug, Security, SEO

Bu, CyberStep monorepo'sunda (Express.js + TypeScript + Drizzle ORM + PostgreSQL, Next.js frontend) üç ayrı denetim alanını kapsayan tek seferlik, kapsamlı bir audit + fix görevidir. Sıfır sessiz hata toleransı — her bulgu raporlanmalı, her düzeltme test edilmeli.

Çalışma şekli: önce TARAMA yap ve bulguları özetle (kod değiştirme), sonra önceliklendirilmiş DÜZELTME yap. Her düzeltmeden sonra ilgili dosyayı/endpoint'i smoke-test et. Mevcut çalışan davranışı (özellikle 83 cron job, ödeme akışı, auth) BOZMA — düzeltmeler ek/iyileştirme şeklinde olmalı, yeniden yazım değil.

---

## BÖLÜM 1 — BUG TARAMASI (Genel Kod Kalitesi)

### 1.1 TypeScript ve Derleme Hataları
- `tsc --noEmit` çalıştır, tüm hataları/uyarıları listele
- `any` tipi kullanımlarını tara (`grep -rn ": any" --include="*.ts"`) — kritik veri akışlarında (ödeme, kullanıcı kimliği, scan sonuçları) `any` varsa daraltılmış tip öner
- Kullanılmayan import/değişkenleri tespit et (ESLint `no-unused-vars` veya `tsc` ile)

### 1.2 Hata Yönetimi ve Sessiz Başarısızlıklar
- Tüm `try/catch` bloklarını tara — boş `catch {}` veya sadece `console.log` ile geçen catch'leri listele (bunlar "sessiz hata" riski)
- `await` eksik Promise çağrılarını bul (`grep -rn "\.then\|async function" --include="*.ts"` ile başlayıp, unhandled promise rejection riski olan yerleri işaretle)
- API route handler'larında hata durumunda HTTP status kodu dönmeyen (yanıt vermeden devam eden) yerleri tespit et

### 1.3 Veritabanı Sorguları ve Migration Tutarlılığı
- Drizzle schema dosyaları ile gerçek veritabanı tabloları arasında uyumsuzluk var mı kontrol et (`drizzle-kit check` veya eşdeğeri)
- Migration dosyalarının sırasını ve rollback script'lerinin (mevcut 5 rollback script) güncelliğini doğrula
- N+1 query pattern'leri tara — döngü içinde `await db.query(...)` çağrıları (özellikle lead pipeline, scan sonuç işleme, cron job'larda)

### 1.4 Cron Job Bütünlüğü (83 job, 9 kategori)
- `index.ts` ve tüm cron dosyalarında `cron.schedule` ile doğrudan tanımlanmış (henüz `wrapCron`'a geçmemiş) job kalıp kalmadığını kontrol et
- Çakışan zamanlamaları tespit et (aynı dakikada başlayan ağır job'lar — özellikle 03:00 civarı)
- `cron_job_runs` tablosundaki son 7 günün verisini sorgula: `status='error'` veya `status='timeout'` olan job'ları listele, kök neden analizi yap
- Hiç çalışmamış veya son 48 saatte hiç log üretmemiş aktif cron'ları tespit et (sessiz duran job riski)

### 1.5 Duplicate / Dead Code
- Birden fazla yerde tanımlanmış benzer AI client kütüphaneleri, OSINT enrichment fonksiyonları, scoring fonksiyonları var mı tara
- Kullanılmayan route'lar, eski/devre dışı feature flag'lerle korunan ölü kod bloklarını listele

---

## BÖLÜM 2 — SECURITY DENETİMİ

### 2.1 Kimlik Doğrulama ve Yetkilendirme
- Tüm `/admin/*` route'larının `requireAdmin` (veya eşdeğer middleware) ile korunduğunu doğrula — eksik olanları listele
- Tüm müşteri-spesifik endpoint'lerin (raporlar, faturalar, scan sonuçları) doğru kullanıcı/tenant izolasyonu yaptığını kontrol et — bir kullanıcının ID'sini değiştirerek başka kullanıcının verisine erişim (IDOR) riski tara
- Session/JWT token süre dolumu ve yenileme mantığını kontrol et

### 2.2 Sır Yönetimi (Secrets)
- Kod içinde hardcoded API key, şifre, TC kimlik no, gerçek IP adresi gibi değerleri tara (`grep -rn` ile yaygın pattern'ler: `sk-`, `Bearer `, IP regex, 11 haneli sayı dizileri)
- IMAP/SMTP veya benzer üçüncü taraf kimlik bilgilerinin plaintext saklandığı yerleri tespit et — şifrelenmiş saklama (örn. `crypto` modülü ile encrypt-at-rest) öner
- `.env` dosyasının `.gitignore`'da olduğunu, ve repo geçmişinde yanlışlıkla commit edilmiş secret olup olmadığını kontrol et (`git log -p | grep` ile temel tarama)

### 2.3 Ödeme Akışı (Iyzico)
- Iyzico entegrasyonunda hardcoded test/identity bilgisi kalıp kalmadığını doğrula (önceki P0 fix'in kapsamını genişlet)
- Webhook doğrulama (signature/HMAC kontrolü) yapılıyor mu kontrol et — yapılmıyorsa ekle
- Tutar/para birimi manipülasyonuna açık client-side hesaplama var mı tara (fiyat sunucu tarafında yeniden doğrulanmalı)

### 2.4 Input Validation ve Injection
- Tüm kullanıcı girdisi alan endpoint'lerde (domain tarama formu, lead formu, admin paneli) input validation (zod/joi vb.) var mı kontrol et
- SQL injection riski için raw query kullanımlarını tara (`db.execute(sql\`...\`)` gibi string interpolation içeren sorguları özellikle işaretle)
- Domain/URL girişlerinde SSRF riski — kullanıcı girdisi doğrudan `fetch`/`axios` ile dış isteğe gidiyorsa, internal IP aralıklarına (127.0.0.1, 169.254.x.x, 10.x.x.x, 192.168.x.x) istek engelleniyor mu kontrol et (özellikle WAF/OSINT tarama modüllerinde)

### 2.5 Rate Limiting ve Bot Koruması
- Lead qualification ve ücretsiz tarama endpoint'lerinde rate limiter'ın gerçekten devrede olduğunu ve bypass edilemediğini doğrula (önceki bilinen bypass sorununu tekrar test et)
- Aynı IP'den/aynı domain'den kısa sürede tekrarlı tarama isteklerini engelleyen mekanizma var mı kontrol et

### 2.6 IOC / Threat Intel Adapter Güvenliği
- `iocQueryAdapters.ts` içindeki dış API çağrılarında (VirusTotal, AbuseIPDB, USOM, HIBP, Shodan, crt.sh, Wayback, Censys, RIPE) timeout ve retry mantığının (axiosWithRetry) tüm adapter'larda tutarlı uygulandığını doğrula
- API key'lerin response loglarına/error mesajlarına sızıp sızmadığını kontrol et

### 2.7 CORS ve HTTP Güvenlik Başlıkları
- CORS yapılandırmasının `*` (tüm origin'ler) yerine spesifik domain listesi kullandığını doğrula
- `helmet` veya eşdeğeri ile güvenlik header'larının (CSP, X-Frame-Options, HSTS) ayarlı olduğunu kontrol et

---

## BÖLÜM 3 — SEO DENETİMİ VE DÜZELTME

### 3.1 Teknik SEO Altyapısı
- `sitemap.xml` endpoint'inin var olduğunu, tüm public sayfaları (blog yazıları, micro-tool'lar, ana sayfalar) içerdiğini ve güncel `lastmod` tarihleri taşıdığını doğrula
- `robots.txt` dosyasının doğru yapılandırıldığını kontrol et — admin/API route'larının disallow edildiğini, public sayfaların allow edildiğini doğrula
- Google Search Console'da indexleme durumu sıfırsa, bunun nedenini araştır: `noindex` meta tag'i yanlışlıkla eklenmiş mi, sitemap submit edilmiş mi

### 3.2 Sayfa Bazlı Meta Veri
- Tüm blog yazılarında `title`, `meta description`, `og:title`, `og:description`, `og:image` alanlarının dolu ve sayfa içeriğiyle tutarlı olduğunu kontrol et — eksik olanları listele
- Title etiketlerinin 50-60 karakter, description'ların 150-160 karakter aralığında olduğunu doğrula
- Her sayfada tek bir `<h1>` etiketi olduğunu, başlık hiyerarşisinin (h1→h2→h3) mantıklı olduğunu kontrol et

### 3.3 URL ve Slug Yapısı
- Blog/micro-tool slug'larında timestamp veya rastgele ID suffix'i olan URL'leri tespit et (örn. `/blog/makale-basligi-1718294`) — bunlar SEO-unfriendly, temiz slug'a (`/blog/makale-basligi`) geçiş için migration planı öner (eski URL'lerden 301 redirect ile)
- Trailing slash, büyük/küçük harf, çift slash gibi URL normalizasyon sorunlarını tara

### 3.4 Yapılandırılmış Veri (Structured Data)
- Blog yazılarında `Article` veya `BlogPosting` schema.org JSON-LD işaretlemesi var mı kontrol et, yoksa ekle
- Ana sayfada `Organization`/`SoftwareApplication` schema'sı var mı kontrol et
- Micro-tool sayfalarında `FAQPage` veya `HowTo` schema fırsatı varsa belirt

### 3.5 Performans (Core Web Vitals'a Etki Eden Kod Sorunları)
- Görsellerin `next/image` (veya eşdeğer optimize edilmiş bileşen) ile sunulduğunu, `width`/`height`/`alt` attribute'larının dolu olduğunu kontrol et
- Render-blocking script/CSS var mı tara (özellikle üçüncü taraf widget'lar, analytics script'leri — `async`/`defer` kullanılıyor mu)
- Lazy-loading uygulanmamış, sayfa altında kalan ağır bileşenler (örn. uzun blog içerik blokları, footer widget'ları) var mı belirt

### 3.6 İç Bağlantı (Internal Linking)
- Blog yazıları arasında ve blog → micro-tool / ana hizmet sayfaları arasında iç bağlantı yoğunluğunu değerlendir — izole (hiçbir sayfadan link almayan) blog yazılarını listele
- Breadcrumb yapısı var mı, yoksa SEO ve kullanıcı navigasyonu için ekle

### 3.7 Türkçe Dil ve Yerelleştirme SEO
- `<html lang="tr">` ve sayfa bazlı `lang` attribute'larının doğru ayarlandığını kontrol et
- `hreflang` gerektiren bir çoklu dil yapısı varsa (şu an yoksa atla) doğrula

---

## ÇIKTI FORMATI

Tarama tamamlandığında şu formatta bir özet rapor üret (kod değişikliği yapmadan önce):

```
## Bug Bulguları
| # | Dosya/Konum | Sorun | Önem (P0-P3) | Önerilen Düzeltme |

## Security Bulguları
| # | Dosya/Konum | Sorun | Önem (P0-P3) | Önerilen Düzeltme |

## SEO Bulguları
| # | Sayfa/Konum | Sorun | Önem (P0-P3) | Önerilen Düzeltme |
```

Önem seviyeleri:
- **P0**: Veri sızıntısı, ödeme manipülasyonu, auth bypass, production'ı kıran hata — hemen düzelt
- **P1**: Güvenlik açığı (düşük olasılık) veya kullanıcıyı etkileyen bug — bu oturumda düzelt
- **P2**: SEO/performans sorunu, kod kalitesi — bu oturumda düzelt, zaman kalırsa
- **P3**: İyileştirme önerisi — sadece raporla, düzeltme bu oturumda yapılmasın

Rapor onaylandıktan sonra P0 → P1 → P2 sırasıyla düzelt. Her düzeltme grubundan sonra:
1. İlgili dosyanın derlendiğini doğrula (`tsc --noEmit` ilgili dosya için)
2. Etkilenen endpoint'i/job'ı manuel olarak bir kez çalıştırıp hatasız tamamlandığını doğrula
3. Değişiklik özetini tek satırlık commit mesajı formatında not et (commit işlemini ben yapacağım)

## SINIRLAR — DOKUNMA
- Demo/test kullanıcı hesapları (bilinçli olarak production öncesi kaldırılacak, bu audit'in kapsamı dışında)
- 83 cron job'ın iş mantığı/zamanlaması (sadece hata/çakışma/wrapCron geçişi kontrolü — iş mantığını değiştirme)
- Mevcut ödeme akışının genel yapısı (sadece güvenlik açıkları, akış değişmesin)
- `.agents/memory/` dizini (zaten gitignore'da, dokunma)
