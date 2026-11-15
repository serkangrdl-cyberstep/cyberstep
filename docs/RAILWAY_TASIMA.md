# CyberStep — Replit'ten Railway'e Taşıma Planı

**Neden:** Replit bu uygulama tipinde (çok-artifact, `router="application"`) yalnızca
Autoscale'e izin veriyor. Autoscale trafik yokken uyuyor → gece cron'ları
(crt.sh, Shodan, haber toplama, bülten, blog) çalışmıyor; ayrıca
birden çok makine açılınca cron'lar çift çalışabiliyor. Railway'de uygulama
**tek, sürekli açık bir konteyner** olarak çalışır.

Geçiş sırasında Replit yayını **kapatılmaz**; Railway doğrulanana kadar canlı site
Replit'te kalır. DNS en son adımda değişir, geri dönüş 5 dakikadır.

---

## 1. Repo'da hazır olanlar

| Dosya | Görevi |
|---|---|
| `Dockerfile` | API + ana site (`/`) + pazarlama paneli (`/digest/`) tek imajda derlenir |
| `.dockerignore` | node_modules, dist, yedekler, csv/zip dışarıda |
| `artifacts/api-server/src/staticSite.ts` | `SERVE_STATIC=true` iken Express statik siteleri ve SPA yönlendirmesini sunar (Replit'te kapalı, davranış değişmez) |
| `lib/integrations-*-ai` | Replit AI proxy yoksa doğrudan `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` kullanılır |

Yerelde üretim modunda doğrulandı: `/`, `/hakkimizda`, `/fiyatlar`, `/digest/`,
`/sitemap.xml`, `/robots.txt`, `/api/*` → 200; bilinmeyen `/api/...` → 404;
site CSP'si ayrı, API CSP'si sıkı; asset'ler `immutable` önbellekli.

---

## 2. Senin yapacakların (sırayla)

### Adım 1 — Hesaplar ve anahtarlar (≈20 dk)
1. **railway.com** → GitHub ile giriş → **Pro planı** ($20/ay, kullanım kredisi dahil).
   Hobby ($5) de çalışır ama tek servis 8 GB RAM sınırı ve destek yok.
2. **Anthropic anahtarı:** console.anthropic.com → API Keys → yeni anahtar →
   Billing'e kredi kartı + harcama limiti (ör. $50/ay).
3. **Gemini anahtarı:** aistudio.google.com → Get API key.
   (Replit'te bunlar "AI Integrations" ile Replit faturasına gidiyordu; Railway'de kendi anahtarların gerekir.)

### Adım 2 — Veritabanı kararı
**Seçenek A (önerilen): Railway Postgres'e taşı**
1. Railway projesinde **+ New → Database → PostgreSQL**.
2. Replit'te Shell'den üretim veritabanının yedeğini al:
   ```bash
   pg_dump "$DATABASE_URL" --no-owner --no-acl -Fc -f cyberstep.dump
   ```
   (Replit üretim DB URL'si: Database aracı → Production → Connection string.)
3. Dosyayı indir, bilgisayarından Railway'e yükle:
   ```bash
   pg_restore --no-owner --no-acl -d "<RAILWAY_DATABASE_PUBLIC_URL>" cyberstep.dump
   ```
4. Satır sayılarını karşılaştır: `SELECT count(*) FROM domain_scans;` (≈280K domain, tarama sayısı daha fazla).

**Seçenek B: Replit/Neon veritabanını yerinde bırak**
Railway'de `DATABASE_URL` olarak Replit üretim bağlantı dizesini ver. En hızlı yol,
ama veri Replit'e bağlı kalır ve ileride ikinci taşıma gerekir.

> Geçiş günü: dump'ı aldıktan sonra Replit'teki cron'lar yazmaya devam eder.
> DNS'i çevirdikten hemen sonra ikinci bir küçük dump alınabilir; pratikte
> kaybolan sadece birkaç saatlik tarama olur, bir sonraki cron turunda yeniden toplanır.

### Adım 3 — Uygulama servisi (≈10 dk)
1. **+ New → GitHub Repo → serkangrdl-cyberstep/cyberstep**, branch `main`.
2. Railway `Dockerfile`'ı otomatik bulur. Settings:
   - **Replicas: 1** (cron'ların çift çalışmaması için şart)
   - **Healthcheck path:** `/api/healthz`
   - **Restart policy:** On failure
   - Region: **Europe West (Amsterdam)**: Türkiye'ye en yakın.
3. **Variables** sekmesine aşağıdaki listeyi gir (Bölüm 3).
4. Deploy → loglarda `Statik site sunumu etkin` ve `server listening` satırlarını gör.
5. Railway'in verdiği `*.up.railway.app` adresinden siteyi, `/digest/` paneli ve
   `/panel` girişini test et.

### Adım 4 — Doğrulama (1–2 gün paralel)
- Admin panel → Platform Sağlığı: AI, SMTP, Shodan yeşil mi?
- Ertesi sabah: `cron_job_runs` tablosunda gece işleri `ok` mu? (crt.sh, shodan, digest_rss_collect)
- Domain sayısı artıyor mu? (`SELECT count(DISTINCT domain) FROM domain_scans;`)
- Bir test e-postası (şifre sıfırlama) gelen linkler `https://cyberstep.io/...` mu?

> Paralel çalışma süresince **Replit'te cron'lar da çalışır** → aynı DB'yi
> paylaşıyorsan (Seçenek B) Replit yayınını doğrulamadan hemen sonra kapat.
> Seçenek A'da iki ayrı DB olduğu için sorun yok.

### Adım 5 — Alan adı geçişi (≈15 dk + DNS yayılımı)
1. Railway servis → Settings → **Networking → Custom Domain** → `cyberstep.io` ve `www.cyberstep.io`.
2. Railway'in verdiği CNAME/ALIAS kayıtlarını alan adı sağlayıcında gir
   (kök alan için ALIAS/ANAME ya da Cloudflare CNAME flattening).
3. Önceden TTL'yi 300 sn'ye düşür → geri dönüş hızlı olur.
4. SSL otomatik gelir (Let's Encrypt).

### Adım 6 — Replit'i kapat
Railway'de 3–7 gün sorunsuz çalıştıktan sonra Replit Deployments → Shut down.
Replit Core aboneliğini isteğe bağlı iptal et (repo GitHub'da, kod kaybı yok).

---

## 3. Ortam değişkenleri

Replit → **Secrets** (kilit simgesi) ekranındaki değerleri birebir kopyala.
Aşağıda kodun okuduğu tüm değişkenler var; Replit'te tanımlı olmayanları atla.

**Zorunlu**
```
NODE_ENV=production
SERVE_STATIC=true
PORT=8080
DATABASE_URL=${{Postgres.DATABASE_URL}}     # Railway referansı (Seçenek A)
SESSION_SECRET=<Replit'teki ile aynı → oturumlar düşmez>
ENCRYPTION_KEY=<Replit'teki ile AYNI olmak zorunda: şifreli alanlar çözülemez>
ANTHROPIC_API_KEY=<yeni>
GEMINI_API_KEY=<yeni>
REPLIT_DOMAINS=cyberstep.io                  # e-posta/link üretimi bu değişkeni okuyor
SITE_BASE_URL=https://cyberstep.io
BASE_URL=https://cyberstep.io
ADMIN_URL=https://cyberstep.io/panel
```

**E-posta**
```
SMTP_HOST  SMTP_PORT  SMTP_SECURE  SMTP_USER=info@cyberstep.com  SMTP_PASS
ADMIN_EMAIL  SOC_ADMIN_EMAIL
ISR_IMAP_HOST=imap.mail.yahoo.com  ISR_IMAP_USER  ISR_IMAP_PASS
ISR_SMTP_HOST=smtp.mail.yahoo.com  ISR_SMTP_PORT=587  ISR_SMTP_USER
ISR_SERKAN_EMAIL  ISR_TEAM_EMAIL
```
(`ISR_*`, `SMTP_USER`, `DISABLE_APOLLO_HUNTER=true` şu an `.replit` dosyasında; Railway'e elle girilmeli.)

**Keşif ve tehdit istihbaratı** (280K domain büyümesi bunlara bağlı)
```
SHODAN_API_KEY
VIRUSTOTAL_API_KEY  GOOGLE_SAFE_BROWSING_API_KEY  ABUSEIPDB_API_KEY  OTX_API_KEY
GREYNOISE_API_KEY  URLSCAN_API_KEY  NVD_API_KEY  VULNCHECK_API_KEY  HIBP_API_KEY
DEHASHED_API_KEY  DEHASHED_EMAIL  NETCRAFT_API_KEY  MXTOOLBOX_API_KEY  HIVE_API_KEY
```

**Ödeme, fatura, entegrasyon** (kullanılıyorsa)
```
IYZICO_API_KEY  IYZICO_SECRET_KEY  IYZICO_IDENTITY_NUMBER  BANK_IBAN
PARASUT_CLIENT_ID  PARASUT_CLIENT_SECRET  PARASUT_COMPANY_ID  PARASUT_API_KEY
MICROSOFT_CLIENT_ID  MICROSOFT_CLIENT_SECRET  AZURE_WEBHOOK_SECRET
SLACK_CLIENT_ID  SLACK_CLIENT_SECRET  SLACK_REDIRECT_URI=https://cyberstep.io/...
ADMIN_TELEGRAM_BOT_TOKEN  ADMIN_TELEGRAM_CHAT_ID
POSTHOG_API_KEY  POSTHOG_HOST  TCMB_EVDS_API_KEY  APOLLO_API_KEY  HUNTER_API_KEY
DIGEST_WEBHOOK_URL  UPTIME_WEBHOOK_SECRET  BRIDGE_SECRET  GITHUB_TOKEN
TPRM_FREE_VENDOR_LIMIT  CLAUDE_DAILY_COST_THRESHOLD  DATA_RETENTION_ENABLED
```

> OAuth kullanan entegrasyonlarda (Microsoft, Slack) yönlendirme adresi
> sağlayıcı panelinde zaten `cyberstep.io` ise değişiklik gerekmez.

---

## 4. Maliyet tahmini (aylık)

| Kalem | Railway | Replit (bugün) |
|---|---|---|
| Platform | Pro $20 (kredi dahil) | Core $20 |
| Uygulama (≈0,5 vCPU ort., 1 GB RAM) | ≈$10–20 | Autoscale kullanım |
| Postgres (≈5–10 GB) | ≈$5–10 | dahil/kullanım |
| AI (Anthropic + Gemini) | kendi faturan, kullanım kadar | Replit kredisi |
| **Toplam altyapı** | **≈$30–50** | — |

Railway → Usage sekmesinde harcama limiti (ör. $60) koy.

---

## 5. Geri dönüş planı
- DNS kayıtlarını eski Replit değerlerine çevir (TTL 300 sn ise 5 dk).
- Replit yayını kapatılmadıysa hiçbir şey kaybolmaz.
- Seçenek A'da Railway'de oluşan yeni taramalar geri dönüşte Replit DB'ye taşınmaz;
  cron'lar bir turda tekrar toplar.

## 6. Taşıma sonrası temizlik (opsiyonel, ayrı PR)
- `REPLIT_DOMAINS` kullanan 66 yeri tek bir `getPublicBaseUrl()` yardımcısına toplamak.
- `cronCatchup` yedek mekanizma olarak kalabilir; sürekli açık sunucuda zararsız.
