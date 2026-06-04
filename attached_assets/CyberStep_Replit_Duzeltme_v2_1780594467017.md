# CyberStep.io — Replit Düzeltme Promptu v2
## Kalan Sorunlar — Kod Analizine Dayalı

---

## BAĞLAM

Önceki 10 düzeltmenin büyük çoğunluğu
uygulanmış. Bu prompt kalan 3 kritik ve
3 yeni tespit edilen sorunu kapsar.

---

## DÜZELTİM 1 — SSL SCORING 30 GÜN EŞİĞİ

**Dosya:** `src/routes/domain-scan/index.ts`

Şu satırı bul:
```typescript
pass: daysUntilExpiry > 30,
```

Bu satır SSL'in "pass" mı "fail" mi sayılacağını
belirliyor. Sorun: 31 gün = +25 puan, 29 gün = 0 puan.
1 günlük fark 25 puanlık skor uçurumu yaratıyor.

**calcScore fonksiyonunu bul:**
```typescript
function calcScore(spf, dmarc, dkim, mx, ssl, portDeduction)
```

**ssl parametresini kaldır, yerine sslDays ekle:**

```typescript
function calcScore(
  spf: boolean,
  dmarc: boolean,
  dmarcPolicy: string | null,
  dkim: boolean,
  mx: boolean,
  sslDaysLeft: number,
  portDeduction = 0
): number {

  // SSL — kademeli puan
  const sslScore =
    sslDaysLeft <= 0   ? 0  :  // Süresi dolmuş → kritik
    sslDaysLeft <= 7   ? 0  :  // 7 gün → kritik
    sslDaysLeft <= 14  ? 15 :  // 14 gün → yüksek risk
    sslDaysLeft <= 30  ? 20 :  // 30 gün → orta uyarı
    25;                         // Normal → tam puan

  // DMARC — kademeli puan (p=none = -10, yok = -25)
  const dmarcScore =
    dmarcPolicy === "reject"     ? 25 :
    dmarcPolicy === "quarantine" ? 20 :
    dmarcPolicy === "none"       ? 15 : // İzleme modu
    0;                                   // DMARC yok

  const base = (spf ? 20 : 0) + dmarcScore +
               (dkim ? 20 : 0) + (mx ? 10 : 0) + sslScore;

  return Math.max(0, base - portDeduction);
}
```

**calcScore çağrılarını güncelle:**
Dosyada `calcScore(spf.pass, dmarc.pass, ...)` şeklinde
çağrılan yerleri bul. Şu şekilde değiştir:

```typescript
// ESKİ:
const overallScore = calcScore(
  spf.pass, dmarc.pass, dkim.pass, mx.pass, ssl.pass,
  shodan?.portRiskSummary?.scoreDeduction ?? 0
);

// YENİ:
const overallScore = calcScore(
  spf.pass,
  dmarc.pass,
  dmarc.policy ?? null,    // p=none, p=quarantine vs.
  dkim.pass,
  mx.pass,
  ssl.daysUntilExpiry ?? 999,
  shodan?.portRiskSummary?.scoreDeduction ?? 0
);
```

checkDMARC fonksiyonunun `policy` alanını döndürdüğünü
doğrula. Döndürmüyorsa ekle:
```typescript
return { pass, record: joined, policy };
// policy = "none" | "quarantine" | "reject" | null
```

---

## DÜZELTİM 2 — DB BACKUP SUPABASE STORAGE'A

**Dosya:** `src/services/dbBackup.ts`

Şu satırı bul:
```typescript
const BACKUP_DIR = path.resolve(process.cwd(), "backups");
```

**Sorun:** Replit file system kalıcı değil.
Sunucu yeniden başlayınca `./backups/` silinebilir.

**Mevcut local backup'ı koru, Supabase'e de yükle:**

```typescript
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["SUPABASE_URL"] ?? "";
const SUPABASE_SERVICE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";

// runDbBackup fonksiyonunun sonuna ekle:
// (local dosyalar yazıldıktan sonra)

async function uploadToSupabase(
  dateStr: string,
  tableName: string,
  json: string
): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const fileName = `${dateStr}/${tableName}.json`;

    const { error } = await supabase.storage
      .from("db-backups")
      .upload(fileName, Buffer.from(json), {
        contentType: "application/json",
        upsert: true,
      });

    if (error) {
      logger.warn({ err: error, tableName }, "Supabase backup upload failed");
    } else {
      logger.info({ tableName, fileName }, "Supabase backup uploaded");
    }
  } catch (err) {
    logger.warn({ err, tableName }, "Supabase backup error");
  }
}

// Her tablo backup'ından sonra çağır:
// await uploadToSupabase(dateStr, tableName, json);
```

**Supabase Storage bucket oluştur:**
Supabase dashboard → Storage → New Bucket
Bucket adı: `db-backups`
Access: Private

---

## DÜZELTİM 3 — CRON ÇAKIŞMA DÜZENLEMESİ

**Dosya:** `src/index.ts`

02:00'de başlayan 3 cron var:
```
cron.schedule("0 2 * * 0")  — AI araç politika
cron.schedule("0 2 * * *")  — Health score
cron.schedule("0 2 * * *")  — Attack path analysis
```

**Saatleri kaydır:**

```typescript
// ESKİ:
cron.schedule("0 2 * * *", /* health score */);
cron.schedule("0 2 * * *", /* attack path */);

// YENİ:
cron.schedule("0 2 * * *",  /* health score */ , { timezone: "Europe/Istanbul" });
cron.schedule("30 2 * * *", /* attack path  */ , { timezone: "Europe/Istanbul" });
```

**3 × her 15 dakika cron kontrolü:**
MS365, ServiceNow, NOC triage her 15 dakikada
çalışıyor. Bunlar çakışıyor mu kontrol et.
wrapCron'un overlap'i önlediğini doğrula.

---

## DÜZELTİM 4 — SOC_ADMIN_EMAIL KONTROL

**Dosya:** SOC eskalasyon yapan dosyayı bul.
`src/services/soc/` klasörüne bak.

SOC_ADMIN_EMAIL kullanılan yerde şu kontrolü ekle:

```typescript
const adminEmail = process.env["SOC_ADMIN_EMAIL"];

if (!adminEmail) {
  logger.error(
    { caseId },
    "SOC_ADMIN_EMAIL not configured — eskalasyon emaili GİTMEDİ. " +
    "Replit Secrets'a SOC_ADMIN_EMAIL ekleyin."
  );
  // Telegram varsa bildir
  const tgToken = process.env["ADMIN_TELEGRAM_BOT_TOKEN"];
  const tgChat = process.env["ADMIN_TELEGRAM_CHAT_ID"];
  if (tgToken && tgChat) {
    void fetch(
      `https://api.telegram.org/bot${tgToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: tgChat,
          text: `🚨 SOC_ADMIN_EMAIL tanımlı değil!\nCase ${caseId} eskalasyonu gönderilmedi.`,
        }),
      }
    );
  }
  return;
}
```

**Replit Secrets'ta kontrol et:**
```
SOC_ADMIN_EMAIL = [senin email adresin]
```

---

## DÜZELTİM 5 — DISCOVERY PİPELİNE ISR LİSTESİ

**Dosya:** `src/services/dailyDashboard.ts`

Bu dosyayı oku. ISR günlük listesi oluşturuluyor mu?

Eğer dailyDashboard sadece dashboard email üretiyorsa
ve ISR listesi oluşturmuyorsa:

Sabah 07:45 cron'u kontrol et:
```typescript
// ISR görevlerini daily_isr_tasks tablosuna yazıyor mu?
// Yoksa ekle:

const readyLeads = await db.select()
  .from(leadCandidatesTable)
  .where(
    and(
      eq(leadCandidatesTable.teaserEmailStatus, "draft"),
      isNotNull(leadCandidatesTable.contactEmail),
    )
  )
  .orderBy(desc(leadCandidatesTable.overallScore))
  .limit(50);

// daily_isr_tasks tablosu var mı kontrol et
// Varsa insert, yoksa oluştur
```

---

## DÜZELTİM 6 — SCHEMA.TS — YENİ TABLOLAR

**Kontrol et:** Yeni servislerle eklenen tablolar
Drizzle şemasında var mı?

```typescript
// Kontrol edilecekler:
// lib/db/src/schema/ klasörüne bak

// Olması gerekenler:
// remediationTicketsTable — var mı?
// remediationCommentsTable — var mı?
// attackPathsTable — var mı?
// platformOutageLogTable — var mı?
// marketWatchItemsTable — var mı?

// Yoksa:
// db.execute(sql`ALTER TABLE IF NOT EXISTS...`) ile
// mi yoksa Drizzle migration ile mi eklendi?
// index.ts'te CREATE TABLE IF NOT EXISTS var mı?
```

Drizzle şeması ile DB arasındaki farkı tespit et:
```bash
# Bu komutu çalıştır ve output'u göster:
pnpm drizzle-kit push --dry-run 2>&1 | head -50
```

---

## ENVIRONMENT VARIABLES KONTROL

```bash
# Replit Secrets'ta şunlar SET olmalı:

# ZORUNLU — satıştan önce:
IYZICO_API_KEY=          # production (sandbox- ile başlamayan)
IYZICO_SECRET_KEY=
SOC_ADMIN_EMAIL=         # eskalasyon emaili

# E-FATURA — bu hafta:
PARASUT_API_KEY=
PARASUT_CLIENT_ID=
PARASUT_CLIENT_SECRET=
PARASUT_COMPANY_ID=

# TARAMA KALİTESİ — ücretsiz:
ABUSEIPDB_API_KEY=       # abuseipdb.com/register
GOOGLE_SAFE_BROWSING_API_KEY=  # console.cloud.google.com

# TARAMA KALİTESİ — ücretli:
HIBP_API_KEY=            # haveibeenpwned.com/API/Key ($3.50/ay)

# DB BACKUP:
SUPABASE_SERVICE_ROLE_KEY=  # Supabase dashboard → Settings → API

# MONITORING:
ADMIN_TELEGRAM_BOT_TOKEN=
ADMIN_TELEGRAM_CHAT_ID=
```

---

## TEST SENARYOLARI

```
1. SSL scoring testi:
   31 gün kalan SSL → skor = X
   29 gün kalan SSL → skor = X - 5 (eskiden X - 25)
   → Fark 5 puan olmalı, 25 değil

2. DMARC scoring testi:
   p=none domain tara
   → eskiden: -25 puan (pass=false)
   → şimdi: -10 puan (kademeli)

3. DB backup Supabase testi:
   Manuel tetikle: POST /api/admin/trigger/db-backup
   → Supabase Storage'da db-backups/ bucket'ta dosya var mı?

4. SOC_ADMIN_EMAIL testi:
   env var'ı geçici kaldır
   SOC eskalasyonu tetikle
   → Log'da "SOC_ADMIN_EMAIL not configured" var mı?
   → Telegram'a bildirim geldi mi?

5. Cron overlap testi:
   02:00 gelince log'ları izle
   → Health score ve attack path aynı anda mı başlıyor?
   → wrapCron overlap'i yakalıyor mu?
```

---

*CyberStep.io — Replit Düzeltme Promptu v2 — Haziran 2026*
*Kalan 6 düzeltme — Kod Analizine Dayalı*
