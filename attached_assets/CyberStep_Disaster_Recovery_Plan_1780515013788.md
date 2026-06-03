# CyberStep.io — Disaster Recovery ve Yedekleme Planı
## GitHub Kurulumu + Acil Durum Prosedürü

**Tarih:** Haziran 2026
**Durum:** Uygulanacak — Bu hafta

---

## RİSK DEĞERLENDİRMESİ

```
Veri riski:       DÜŞÜK
  Supabase ayrı çalışıyor
  Tüm müşteri ve tarama verisi orada
  Replit erişilemez olsa bile veri güvende

Kod riski:        YÜKSEK (şu an)
  GitHub bağlantısı yok
  Replit çöküşünde kod kaybolabilir
  → Bu hafta çözülecek

Uptime riski:     ORTA
  Replit geçici kesintiler yaşayabiliyor
  Cron job'lar uyku modunda durabiliyor
  → UptimeRobot ile izleniyor olacak

Config riski:     YÜKSEK (şu an)
  Environment variables sadece Replit'te
  Başka yerde kaydı yok
  → Bu hafta çözülecek
```

---

## ADIM 1 — GitHub Hesabı Aç (5 dakika)

```
1. github.com adresine git
2. "Sign up" butonuna tıkla
3. Bilgileri gir:
     Email:    iş emailin
     Username: cyberstep veya serkancyber
               (sonradan değiştirilebilir)
     Password: güçlü şifre
4. Free plan seç — yeterli
5. Email doğrulama linkine tıkla
```

---

## ADIM 2 — Replit'i GitHub'a Bağla (5 dakika)

```
1. Replit'te projeyi aç
2. Sol menüden "Version Control" ikonuna tıkla
   (dal/branch ikonu)
3. "Connect to GitHub" butonuna tıkla
4. GitHub hesabınla giriş yap
5. Replit'e şu izinleri ver:
   ✅ Read/write repository erişimi
6. Onay ver
```

---

## ADIM 3 — Private Repository Oluştur (2 dakika)

```
Replit Version Control panelinde:

Repository adı:  cyberstep-platform
Visibility:      🔒 Private (ZORUNLU)
                 Kod gizli kalmalı

→ "Create repository" tıkla
```

**Neden Private:**
API key'ler, business logic, müşteri verisi
yapısı — bunlar rakiplerin görmemesi gereken bilgiler.
Public repo kesinlikle olmaz.

---

## ADIM 4 — İlk Push (2 dakika)

```
Replit Version Control panelinde:

1. "Stage all changes" tıkla
2. Commit mesajı yaz:
   "Initial commit — CyberStep platform"
3. "Commit & Push" tıkla

Kontrol:
   github.com/[kullanıcı]/cyberstep-platform
   → Dosyalar görünüyor mu? ✓
```

---

## ADIM 5 — Environment Variables Yedeği (15 dakika)

**En kritik adım.**

Replit Secrets'taki tüm key'leri
şifreli bir uygulamaya kaydet.

**Önerilen araç: Bitwarden (ücretsiz)**
```
1. bitwarden.com → ücretsiz hesap aç
2. "New Item" → "Secure Note" seç
3. Başlık: "CyberStep — Environment Variables"
4. Tüm key'leri kopyala:

   SUPABASE_URL=
   SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_KEY=
   DATABASE_URL=

   SHODAN_API_KEY=
   HUNTER_API_KEY=
   APOLLO_API_KEY=
   NVD_API_KEY=

   IYZICO_API_KEY=
   IYZICO_SECRET_KEY=

   CLAUDE_API_KEY=
   POSTMARK_API_KEY=
   NETGSM_API_KEY=

   LINKEDIN_CLIENT_ID=
   LINKEDIN_CLIENT_SECRET=
   LINKEDIN_ORG_ID=

   X_API_KEY=
   X_API_SECRET=
   X_ACCESS_TOKEN=
   X_ACCESS_TOKEN_SECRET=

   INSTAGRAM_ACCESS_TOKEN=
   INSTAGRAM_ACCOUNT_ID=

   PARASUT_API_KEY=
   PARASUT_COMPANY_ID=

   GREYNOISE_API_KEY=
   OTX_API_KEY=

   POSTHOG_API_KEY=

   ADMIN_TELEGRAM_ID=
   ADMIN_PHONE=
   ISR_TEAM_EMAIL=
   ISR_REPLY_EMAIL=

   BASE_URL=https://cyberstep.io
   ENCRYPTION_KEY=

5. Kaydet + master şifreyi güvenli yere yaz
```

**Alternatif: 1Password ($3/ay)**
Daha gelişmiş, aile/takım paylaşımı mümkün.

**KESİNLİKLE YAPILMAYACAK:**
- GitHub'a .env dosyası push etme
- Email'e yapıştırma
- Notes uygulamasına düz metin kaydetme

---

## ADIM 6 — Otomatik Push Ayarla

Her önemli değişiklikten sonra GitHub'a push alışkanlığı:

```
Replit → Tools → Git
→ Her çalışmadan sonra manuel:
  1. Version Control paneli aç
  2. Changed files görünüyor
  3. "Stage all" → Commit mesajı → Push

Commit mesajı örnekleri:
  "Pipeline: Apollo fallback eklendi"
  "Scoring: DMARC none seviyesi düzeltildi"
  "Dashboard: Churn tetikleyici eklendi"
```

**Hedef:** Haftada en az 2-3 push.
Her büyük özellik sonrası mutlaka.

---

## ACİL DURUM PROSEDÜRÜ

### Senaryo A — Replit Geçici Kesinti (1-4 saat)

```
Belirti:
  UptimeRobot/Telegram bildirimi geldi
  cyberstep.io erişilemiyor

Aksiyon:
  1. status.replit.com kontrol et
     → Genel kesinti mi, sadece bizim mi?
  2. 1-2 saat bekle
  3. Düzelmezse → Replit destek: replit.com/support
  4. Müşteriye bildirim GEREKMİYOR
     (kısa kesintilerde sessiz kal)

Süre: 1-4 saat
Veri kaybı: Sıfır
```

### Senaryo B — Replit Projesi Erişilemiyor (ciddi)

```
Belirti:
  Proje açılmıyor, 24 saat geçti
  Replit support yanıt vermiyor

Aksiyon:
  1. GitHub'daki son kodu indir
     github.com/[kullanıcı]/cyberstep-platform
     → "Code" → "Download ZIP"

  2. Yeni Replit hesabı/projesi aç
     → "Import from GitHub" seç
     → Repository'yi seç

  3. Environment variables'ı gir
     (Bitwarden'dan kopyala — Adım 5)

  4. Test et:
     → DB bağlantısı çalışıyor mu?
     → Bir domain taraması yap
     → Cron job'lar ayarlandı mı?

  5. DNS güncelle (varsa custom domain)

Süre: 30-45 dakika
Veri kaybı: Son push'tan bu yana olan
            kod değişiklikleri
            (veri kaybı: sıfır)
```

### Senaryo C — Supabase Sorunu

```
Belirti:
  DB bağlantısı başarısız
  Tüm sorgular hata veriyor

Aksiyon:
  1. status.supabase.com kontrol et
  2. Supabase dashboard'a gir
     → Proje aktif mi?
     → Ücret limiti aşıldı mı?
  3. Geçici yükseltme gerekirse:
     Supabase Pro plan: $25/ay

Süre: 15-30 dakika
Veri kaybı: Supabase kendi yedeğini alıyor
```

---

## HAFTALIK DB YEDEĞİ (Otomatik)

Pipeline'a eklenecek — Her Pazar 04:00:

```typescript
// Her Pazar sabahı kritik tabloları yedekle
cron.schedule('0 4 * * 0', async () => {

  const tables = [
    'customers',
    'subscriptions',
    'domain_scans',
    'lead_candidates',
    'ioc_entries',
  ];

  for (const table of tables) {
    const data = await db.select().from(table);
    const json = JSON.stringify(data, null, 2);
    const filename = `backup_${table}_${formatDate(new Date())}.json`;

    // Google Drive'a yükle (Drive MCP bağlı)
    await uploadToGoogleDrive(filename, json, 'CyberStep Backups');
  }

  logger.info('Haftalık yedek tamamlandı');
  await sendTelegram(ADMIN_ID, '✅ Haftalık DB yedeği alındı');
});
```

---

## KONTROL LİSTESİ

```
Bu hafta tamamlanacak:

□ GitHub hesabı açıldı
□ Replit → GitHub bağlandı
□ cyberstep-platform (Private) repo oluşturuldu
□ İlk push yapıldı — dosyalar GitHub'da görünüyor
□ Bitwarden/1Password hesabı açıldı
□ Tüm environment variables kaydedildi
□ Haftalık otomatik push alışkanlığı başladı
□ Haftalık DB yedeği pipeline'a eklendi

Tamamlandıktan sonra:
  Disaster recovery süresi: 30-45 dk
  Veri kaybı riski: Sıfır
  Kod kaybı riski: Son push'tan bu yana
                   (haftada 2-3 push = max 3-4 gün)
```

---

## GITHUB ↔ REPLİT SENKRONIZASYON

```
Replit → GitHub:  ✅ Otomatik (push sonrası)
GitHub → Replit:  ✅ Manuel (pull gerekir)
Claude → Replit:  ✅ Dolaylı

Pratik akış — kod düzeltme:
  1. "Şu fonksiyonda bug var" dersin
  2. Claude GitHub'da okur
  3. Claude düzeltilmiş kodu verir
  4. Replit'te ilgili dosyaya yapıştırırsın
  5. Replit'ten GitHub'a push edersin

İleride (Claude Code ile):
  1. Terminal'de claude komutu açılır
  2. Claude direkt dosyayı düzenler
  3. Sen commit + push yaparsın
```

---

## ŞİFRE YÖNETİMİ — 3 KATMAN

### Katman 1 — API Key'ler (Bitwarden)

```
bitwarden.com → ücretsiz hesap aç
Browser extension + mobil app indir

Kaydedilecekler:
  "CyberStep — Environment Variables"
  Tüm Replit Secrets buraya kopyalanır
  (Adım 5'teki liste)
```

### Katman 2 — Platform Şifreleri (Bitwarden)

```
Her platform için ayrı kayıt:
  GitHub şifresi
  Replit şifresi
  Supabase şifresi
  Iyzico şifresi
  Supabase şifresi
  Postmark şifresi
  Shodan şifresi
  Hunter.io şifresi

Bitwarden güçlü şifre üretir — kullan.
Her platform farklı şifre.
```

### Katman 3 — Master Şifre

```
Bitwarden master şifresi:
  Ezberle (tercih)
  VEYA fiziksel kağıda yaz → kasada sakla
  Dijital hiçbir yere yazma
  Kaybolursa Bitwarden erişimi tamamen kapanır
```

---

## MFA (GOOGLE AUTHENTICATOR) — GÜVENLİK KONTROL

### Backup Kodları

```
MFA kurulumunda 8 backup kod üretildi.
Bunlar telefon kaybolunca kullanılır.

Kayıt yeri:
  Bitwarden → New Item → Secure Note
  Başlık: "CyberStep Portal MFA — Backup Codes"
  Tüm 8 kodu buraya yapıştır

Henüz kaydetmediysen:
  Portal → Güvenlik → MFA → Backup kodları göster
  → Bitwarden'a kopyala
```

### Teknik Kontrol Listesi

```
TOTP secret key DB'de nasıl tutuluyor?

□ Şifreli (ENCRYPTION_KEY ile) → ✅ Doğru
□ Düz metin → ❌ Güvenlik açığı

Eğer düz metin saklanıyorsa:
  totp_secret kolonunu şifrele:
  encrypt(secret, process.env.ENCRYPTION_KEY)
  DB'de şifreli, işlemde çözülür

ENCRYPTION_KEY:
  → Bitwarden'da kayıtlı mı? ✅
  → Replit Secrets'ta tanımlı mı? ✅
```

### MFA Kullanıcı Deneyimi

```
Şu an önerilen akış:
  Kayıt → portal erişimi
  Banner: "Hesabınızı koruyun — MFA aktif edin"
  MFA zorunlu değil, teşvik edilir

Health score:
  MFA aktif eden müşteri → +10 puan
  (customer_health_scores tablosuna ekle)

İleride (50+ müşteride):
  SOC Pro müşterileri için MFA zorunlu
```

---

*Güncelleme: Haziran 2026*

50+ müşteride Replit'ten çıkış planlanıyor.

```
Hedef altyapı:
  Hetzner Cloud (Almanya/Helsinki)
  VPS: CX31 — €9/ay (4 vCPU, 8GB RAM)
  DB: Supabase kalır (veya Hetzner'a taşınır)

Migration süresi: 1 gün
  GitHub'daki kod → Hetzner'a deploy
  Environment variables → aynı
  DNS değişikliği → cyberstep.io

Bu geçişi GitHub olmadan yapmak imkansız.
GitHub kurulumu bu geçişin de temelini atıyor.
```

---

*CyberStep.io — Disaster Recovery Planı — Haziran 2026*
*"Veri kaybolmaz. Sistem 45 dakikada ayağa kalkar."*
