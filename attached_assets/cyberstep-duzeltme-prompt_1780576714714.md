# CyberStep.io — Kapsamlı Düzeltme Prompt'u (Replit Agent)

Aşağıdaki düzeltmeleri sırayla ve eksiksiz uygula. Her düzeltmeden sonra TypeScript derleme hatası olmadığını kontrol et. Dosya yolları `artifacts/api-server/src/` ile başlar, aksi belirtilmedikçe.

---

## DÜZELTME 1 — Lead Qualification Rate Limiter Bypass

**Sorun:** `services/discoveryPipeline.ts` içindeki `runDomainScanInternal()` fonksiyonu kendi API'sine HTTP çağrısı yapıyor. Bu çağrı `domainScanLimiter` rate limiter'a takılıyor (saatte 10 istek). Gece 20 domain kalifikasyonu bu limiti aşar ve scan'lar 429 alır.

**Düzeltme:**

`services/discoveryPipeline.ts` dosyasında `runDomainScanInternal` fonksiyonunu bul. Bu fonksiyon şu an `fetch('http://localhost:${apiPort}/api/domain-scan', ...)` yapıyor.

Aşağıdaki değişiklikleri yap:

1. Fonksiyonun başına şu import'u ekle:
```typescript
import { performDomainScan } from "../routes/domain-scan/index";
```

2. `runDomainScanInternal` fonksiyonunu tamamen şununla değiştir:
```typescript
async function runDomainScanInternal(domain: string): Promise<{
  id: number;
  overallScore: number;
  findings: Array<{ severity: string; title: string }>;
} | null> {
  try {
    const result = await performDomainScan(domain);
    if (!result) return null;
    return {
      id: result.id ?? 0,
      overallScore: result.overallScore ?? 0,
      findings: result.findings ?? [],
    };
  } catch (err) {
    logger.warn({ err, domain }, "Discovery pipeline: direct domain scan failed");
    return null;
  }
}
```

3. `routes/domain-scan/index.ts` dosyasını aç. Mevcut domain scan ana logic'ini (checkSPF, checkDMARC, vb. çağıran kısım) `performDomainScan(domain: string)` adında export edilen bir fonksiyona çıkar. Bu fonksiyon aynı sonucu döndürmeli: `{ id, overallScore, findings }`.

**Not:** `performDomainScan` export'u `routes/domain-scan/index.ts`'te zaten checkSPF, checkDMARC vb. export'ları olan dosyada yapılacak. Mevcut export'ları bozmama dikkat et.

---

## DÜZELTME 2 — Merkezi AI Maliyet Takibi

**Sorun:** Claude/Gemini maliyeti platformda birden fazla yerde takip ediliyor (`soc_ai_costs`, `social_media_posts.generation_cost_usd`, `content_calendar.generation_cost_usd`) ama çoğu yerde `0` yazılıyor. `checkPlatformCosts()` yalnızca `soc_ai_costs` okuyor; sosyal medya ve blog maliyetleri kör nokta.

**Düzeltme:**

### 2a. Merkezi maliyet log tablosu

`services/aiCostTracker.ts` adında yeni dosya oluştur:

```typescript
/**
 * Merkezi AI Maliyet Takip Servisi
 * Tüm Claude ve Gemini çağrılarının maliyetini tek tabloda toplar.
 */
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

// Claude Sonnet 4.6 fiyatları (USD per 1M token)
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6":        { input: 3.0,   output: 15.0  },
  "claude-haiku-4-5":         { input: 0.25,  output: 1.25  },
  "claude-opus-4-6":          { input: 15.0,  output: 75.0  },
  "gemini-2.0-flash":         { input: 0.075, output: 0.30  },
  "gemini-1.5-pro":           { input: 1.25,  output: 5.0   },
};

export function calcCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model] ?? { input: 3.0, output: 15.0 };
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

export async function logAiCost(params: {
  service: string;       // "blog_autopilot" | "social_media" | "noc_triage" | "ciso_weekly" | vb.
  model: string;
  inputTokens: number;
  outputTokens: number;
  customerId?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const costUsd = calcCost(params.model, params.inputTokens, params.outputTokens);
  try {
    await pool.query(
      `INSERT INTO ai_cost_log
         (service, model, input_tokens, output_tokens, cost_usd, customer_id, metadata, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        params.service,
        params.model,
        params.inputTokens,
        params.outputTokens,
        costUsd,
        params.customerId ?? null,
        params.metadata ? JSON.stringify(params.metadata) : null,
      ],
    );
  } catch (err) {
    logger.warn({ err, params }, "AI cost log: insert failed (non-critical)");
  }
}

export async function getDailyCost(date?: string): Promise<number> {
  const d = date ?? new Date().toISOString().slice(0, 10);
  try {
    const { rows } = await pool.query<{ total: string }>(
      `SELECT COALESCE(SUM(cost_usd), 0) AS total FROM ai_cost_log WHERE recorded_at::date = $1`,
      [d],
    );
    return Number(rows[0]?.total ?? 0);
  } catch {
    return 0;
  }
}

export async function getMonthlyCostByService(year: number, month: number): Promise<Array<{
  service: string;
  total_cost: number;
  total_calls: number;
  avg_cost: number;
}>> {
  try {
    const { rows } = await pool.query(
      `SELECT service,
              ROUND(SUM(cost_usd)::numeric, 4) AS total_cost,
              COUNT(*) AS total_calls,
              ROUND(AVG(cost_usd)::numeric, 6) AS avg_cost
       FROM ai_cost_log
       WHERE EXTRACT(YEAR FROM recorded_at) = $1
         AND EXTRACT(MONTH FROM recorded_at) = $2
       GROUP BY service
       ORDER BY total_cost DESC`,
      [year, month],
    );
    return rows as Array<{ service: string; total_cost: number; total_calls: number; avg_cost: number }>;
  } catch {
    return [];
  }
}
```

### 2b. Tablo migration'ı

`index.ts` içindeki `startup()` fonksiyonuna şu çağrıyı ekle (en üste, diğer ensure'lardan önce):

```typescript
await ensureAiCostLogTable();
```

`index.ts` içinde bu fonksiyonu tanımla:

```typescript
async function ensureAiCostLogTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_cost_log (
      id           SERIAL PRIMARY KEY,
      service      VARCHAR(100) NOT NULL,
      model        VARCHAR(100) NOT NULL,
      input_tokens  INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd      NUMERIC(10, 6) NOT NULL DEFAULT 0,
      customer_id   INTEGER,
      metadata      JSONB,
      recorded_at   TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS ai_cost_log_service_date_idx
    ON ai_cost_log (service, recorded_at DESC)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS ai_cost_log_date_idx
    ON ai_cost_log (recorded_at DESC)
  `);
}
```

### 2c. Blog autopilot maliyet logu

`services/blog-autopilot.ts` içinde `generateBlogPostContent` fonksiyonunda `anthropic.messages.create(...)` çağrısının hemen altına ekle:

```typescript
import { logAiCost } from "./aiCostTracker";

// anthropic.messages.create'den dönen message objesini kullan:
await logAiCost({
  service: "blog_autopilot",
  model: "claude-sonnet-4-6",
  inputTokens: message.usage.input_tokens,
  outputTokens: message.usage.output_tokens,
  metadata: { topicIndex: currentIndex, title: topic.title },
}).catch(() => {}); // fire-and-forget
```

### 2d. Sosyal medya maliyet logu

`routes/social-media/contentGenerator.ts` içinde `callHaiku` fonksiyonunu şöyle güncelle:

```typescript
import { logAiCost, calcCost } from "../../services/aiCostTracker";

async function callHaiku(systemPrompt: string, userPrompt: string): Promise<{ text: string; costUsd: number }> {
  const msg = await anthropic.messages.create({
    model: HAIKU,
    max_tokens: 600,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const costUsd = calcCost(HAIKU, msg.usage.input_tokens, msg.usage.output_tokens);
  await logAiCost({
    service: "social_media",
    model: HAIKU,
    inputTokens: msg.usage.input_tokens,
    outputTokens: msg.usage.output_tokens,
  }).catch(() => {});
  const block = msg.content[0];
  return { text: block?.type === "text" ? block.text : "", costUsd };
}
```

`callHaiku` kullanılan yerlerde `costUsd`'yi toplayarak `socialMediaPostsTable.generationCostUsd` alanına yaz.

### 2e. `checkPlatformCosts()` güncellemesi

`services/platformMonitor.ts` içindeki `checkPlatformCosts` fonksiyonundaki "Claude günlük maliyet" bloğunu şöyle değiştir:

```typescript
// Mevcut soc_ai_costs yerine merkezi ai_cost_log kullan
const threshold = parseFloat(process.env["CLAUDE_DAILY_COST_THRESHOLD"] ?? "5");
try {
  const { getDailyCost } = await import("./aiCostTracker");
  const cost = await getDailyCost();
  if (cost > threshold) {
    alerts.push(`AI günlük maliyet: $${cost.toFixed(4)} (limit: $${threshold})`);
  }
} catch {
  // ai_cost_log erişilemez
}
```

---

## DÜZELTME 3 — Blog SEO Alanları Doldurulmuyor

**Sorun:** `blog-autopilot.ts`'te `generateBlogPostContent` SEO alanlarını (seoTitle, metaDescription, focusKeyword, seoTags) üretiyor ama **veritabanına yazılırken eksik**. `generateAndPublishBlogPost` ve `generateAndSaveDraft` fonksiyonlarındaki `db.insert` çağrısında bu alanlar mevcut.

**Kontrol ve Düzeltme:**

`services/blog-autopilot.ts` dosyasını aç. `generateAndPublishBlogPost` ve `generateAndSaveDraft` fonksiyonlarındaki `db.insert(blogPostsTable).values({...})` bloklarında şu alanların kesinlikle bulunduğundan emin ol:

```typescript
seoTitle: generated.seoTitle,
seoTitleEn: generated.seoTitle,          // EN versiyonu TR'den fallback
metaDescription: generated.metaDescription,
metaDescriptionEn: generated.metaDescription,
focusKeyword: generated.focusKeyword,
focusKeywordEn: generated.focusKeyword,
seoTags: generated.seoTags,
seoTagsEn: generated.seoTags,
linkedinPostTr: generated.linkedinPostTr,
instagramCaptionTr: generated.instagramCaptionTr,
instagramCarouselTr: generated.instagramCarouselTr,
visualPromptsTr: generated.visualPromptsTr,
refsJson: [],
```

Eksik olan alanları ekle. `generated` objesinde bu alanlar `generateBlogPostContent` tarafından zaten dönüyor — sadece insert'e eklenmesi yeterli.

---

## DÜZELTME 4 — Slug'dan Timestamp Suffix Kaldır

**Sorun:** `services/blog-autopilot.ts` içindeki `toSlug()` fonksiyonu her slug'a `Date.now().toString(36)` timestamp ekliyor. Bu `kobi-guvenlik-rehberi-1x2k3m` gibi SEO için kötü URL'ler üretiyor.

**Düzeltme:**

`toSlug` fonksiyonunu şununla değiştir:

```typescript
async function toSlugUnique(title: string): Promise<string> {
  const base = title
    .toLowerCase()
    .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
    .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim().replace(/\s+/g, "-").slice(0, 80);

  // Benzersizlik kontrolü — çakışırsa -2, -3 suffix ekle
  let candidate = base;
  let suffix = 2;
  while (true) {
    const [existing] = await db
      .select({ id: blogPostsTable.id })
      .from(blogPostsTable)
      .where(eq(blogPostsTable.slug, candidate))
      .limit(1);
    if (!existing) return candidate;
    candidate = `${base}-${suffix}`;
    suffix++;
    if (suffix > 99) return `${base}-${Date.now().toString(36)}`; // son çare
  }
}
```

`toSlug` çağrılarını `await toSlugUnique(...)` ile değiştir. `toSlugUnique` async olduğu için çağrıldığı yerlerde `await` ekle.

`lib/db` import'u olan `blogPostsTable` ve `eq` zaten dosyada mevcut — yeni import gerekmez.

---

## DÜZELTME 5 — 03:00 Cron Çakışmalarını Stagger Et

**Sorun:** `index.ts` içinde gece 03:00'da aynı anda çalışan çok sayıda cron var:
- `refreshUsomList` → 03:00
- `collectRSSFeeds` → 03:00 Istanbul
- `Cloud CSPM` → 03:00 Istanbul
- `scanShodan` → 03:00 (wrapCron "shodan")

Bu eş zamanlı çalışma DB bağlantı havuzunu ve harici API limitlerini zorluyor.

**Düzeltme:**

`index.ts` içinde bu cron schedule'larını bul ve şu yeni saatlerle değiştir:

| Cron | Eski | Yeni |
|------|------|------|
| `refreshUsomList` günlük | `0 3 * * *` | `0 3 * * *` — değiştirme (zaten ilk) |
| `collectRSSFeeds` | `0 3 * * *` Istanbul | `30 3 * * *` Istanbul |
| Cloud CSPM | `0 3 * * *` Istanbul | `45 3 * * *` Istanbul |
| Shodan (wrapCron) | `0 3 * * *` | `0 4 * * *` |
| Lead kalifikasyon | `0 4 * * *` | `30 4 * * *` |

**Önemli:** `wrapCron("shodan", "0 3 * * *", ...)` çağrısında hem `cron.schedule`'daki expression hem de `wrapCron`'a geçilen expression string'i güncelle — ikisi eşleşmeli.

---

## DÜZELTME 6 — Duplicate AI Client Kütüphanesi Temizliği

**Sorun:** `lib/integrations-anthropic-ai/` ve `lib/integrations/anthropic_ai_integrations/` — aynı batch logic iki farklı yerde kopyalanmış. Hangisinin canonical olduğu belirsiz.

**Düzeltme:**

1. `pnpm-workspace.yaml` dosyasını aç ve hangi package'ların workspace'e dahil olduğunu gör.

2. `lib/integrations/` klasörü altındaki `anthropic_ai_integrations` ve `gemini_ai_integrations` klasörlerinin başka bir package tarafından import edilip edilmediğini kontrol et:
   ```bash
   grep -r "integrations/anthropic_ai_integrations" . --include="*.ts" --exclude-dir=node_modules
   grep -r "integrations/gemini_ai_integrations" . --include="*.ts" --exclude-dir=node_modules
   ```

3. Eğer `lib/integrations/` altındaki dosyalar hiçbir yerde import edilmiyorsa:
   - `lib/integrations/` klasörünü komple sil
   - `pnpm-workspace.yaml`'dan varsa referansını kaldır

4. Eğer import ediliyorsa, o import'ları `@workspace/integrations-anthropic-ai` veya `@workspace/integrations-gemini-ai`'ye yönlendir ve `lib/integrations/` klasörünü sil.

---

## DÜZELTME 7 — `index.ts` Startup Fonksiyonlarını Ayrı Dosyalara Taşı

**Sorun:** `index.ts` 2400+ satır. Startup schema migration'ları, seed fonksiyonları, ve cron başlatıcıları tek dosyada karışık durumda.

**Düzeltme:**

Aşağıdaki üç yeni dosyayı oluştur ve ilgili fonksiyonları taşı:

### `services/startup/schemaMigrations.ts`
Şu fonksiyonları `index.ts`'ten bu dosyaya taşı (hepsi `export async function` olacak):
- `ensureQuestionsTable`
- `ensureTenantsTable`
- `ensureIsrTables`
- `ensureEmailTables`
- `ensureAssessmentsColumns`
- `ensureBlogContentColumns`
- `ensureDomainScanEnrichmentColumns`
- `ensureReportEnrichmentColumns`
- `ensureSecurityAdvisoriesTable`
- `ensurePartnerEcosystemTables`
- `ensurePasswordResetColumns`
- `ensureReferralCodeColumn`
- `ensureBreachMonitorTable`
- `ensureVerificationColumns`
- `ensureDomainScanLimitColumn`
- `ensureBadgeAdvantagesTable`
- `ensureDomainScanPurchasesTable`
- `ensureDnsTables`
- `ensureOnboardingEmailColumns`
- `ensureSocialMediaTables`
- `ensureAdminPermissions`
- `ensureIocTables`
- `ensureAiCostLogTable` (Düzeltme 2'de eklendi)

Gerekli import'ları (`db`, `sql`, `logger` vb.) bu dosyaya da ekle.

### `services/startup/seedData.ts`
Şu fonksiyonları taşı:
- `maybeSeedPricingPlans`
- `maybeSeedQuestions`
- `updatePricingPlanFeatures`
- `seedBlogPosts`
- `maybeResetAdminPassword`

### `services/startup/cronJobs.ts`
Şu fonksiyonları taşı:
- `startReminderCron`
- `startScanLeadDripCron`
- `startIsrImapCron`
- `startInflationReminderCron`
- `startBlogAutopilotCron`
- `startSocialMediaWeeklyCron`
- `startDigestCron`
- `startAiToolMonitorCron`
- `startQuarterlyPolicyUpdateCron`
- `startGrowthEngineCrons`

`index.ts`'te bu dosyalardan import et:
```typescript
import { ensureQuestionsTable, ensureTenantsTable, /* ... */ } from "./services/startup/schemaMigrations";
import { maybeSeedPricingPlans, /* ... */ } from "./services/startup/seedData";
import { startReminderCron, /* ... */ } from "./services/startup/cronJobs";
```

`startup()` fonksiyonu ve sunucu başlatma (`app.listen`) `index.ts`'te kalacak.

---

## DÜZELTME 8 — IMAP/SMTP Şifrelerini Şifreli Sakla

**Sorun:** `tenants` tablosunda `imap_pass TEXT` ve `smtp_pass TEXT` kolonları var. Şifreler plaintext saklanıyor.

**Düzeltme:**

`services/encryption.ts` adında yeni dosya oluştur:

```typescript
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALG = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env["ENCRYPTION_SECRET"];
  if (!secret || secret.length < 32) {
    throw new Error("ENCRYPTION_SECRET env var must be at least 32 characters");
  }
  return scryptSync(secret, "cyberstep-salt-v1", 32) as Buffer;
}

export function encrypt(plaintext: string): string {
  if (!plaintext) return "";
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv(12):tag(16):ciphertext — base64 encoded
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decrypt(ciphertext: string): string {
  if (!ciphertext) return "";
  try {
    const key = getKey();
    const buf = Buffer.from(ciphertext, "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = createDecipheriv(ALG, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final("utf8");
  } catch {
    return ""; // bozuk veya eski format
  }
}

/** Değer zaten şifreli mi? (base64 + minimum uzunluk) */
export function isEncrypted(value: string): boolean {
  if (!value || value.length < 40) return false;
  try { Buffer.from(value, "base64"); return true; } catch { return false; }
}
```

**ISR IMAP servisinde kullan:**
`services/isr-imap.ts` dosyasında tenant IMAP şifresi okunduğu yerde:
```typescript
import { decrypt } from "./encryption";
const password = decrypt(tenant.imapPass ?? "");
```

**Tenant ayarları kaydedilirken şifrele:**
`routes/admin-panel/` altında tenant IMAP/SMTP ayarlarını kaydeden endpoint'lerde (varsa):
```typescript
import { encrypt } from "../../services/encryption";
const imapPassEncrypted = formData.imapPass ? encrypt(formData.imapPass) : undefined;
```

**`.env`'e eklenecek yeni değişken:**
```
ENCRYPTION_SECRET=en-az-32-karakter-rastgele-string
```

Replit Secrets'a bu değişkeni ekle.

---

## DÜZELTME 9 — Sosyal Medya X Thread Üretimi

**Sorun:** `routes/social-media/contentGenerator.ts` içinde X platformu için `threadTweets` JSONB alanı schema'da var ama `generatePostText` fonksiyonu tek tweet yazıyor, thread üretmiyor.

**Düzeltme:**

`generatePostText` fonksiyonunda `platform === "x"` olan branch'i şöyle güncelle:

```typescript
if (platform === "x") {
  userPrompt = `Platform: X (Twitter)
İçerik tipi: ${postType === "data_insight" ? "Haftalık veri insight" : "Güvenlik ipucu"}
${postType === "data_insight" ? `\nBu hafta CyberStep verisi:\n${formatStats(stats)}` : ""}

5 tweet'lik thread yaz. Her tweet max 280 karakter.
- Tweet 1 (Hook): Bağımsız değer taşımalı, "🧵" ile bitmeli
- Tweet 2: Problemi somutlaştır, Türkiye verisi kullan
- Tweet 3: En şaşırtıcı istatistik veya gerçek
- Tweet 4: Pratik, hemen uygulanabilir öneri
- Tweet 5: cyberstep.io ücretsiz tarama linki + 3-4 hashtag

Tweet'leri "---" ile ayır. Sadece tweet metinlerini yaz, numara veya etiket ekleme.`;
}
```

`generateWeeklyContent` fonksiyonunda X gönderisi oluşturulurken dönen metni `"---"` ile split edip `threadTweets` alanına JSON array olarak kaydet:

```typescript
if (platform === "x" && postData.caption) {
  const tweets = postData.caption.split("---").map(t => t.trim()).filter(Boolean);
  postValues.threadTweets = tweets;
  postValues.caption = tweets[0] ?? postData.caption; // ilk tweet ana caption
}
```

---

## DÜZELTME 10 — `checkPlatformCosts` Cron Pipeline Kontrolü Genişlet

**Sorun:** `services/platformMonitor.ts` içindeki `checkPlatformCosts()` sadece `lead_qualify` cron'unu kontrol ediyor. Kritik diğer cron'lar (blog_autopilot, crtsh, shodan) izlenmiyor.

**Düzeltme:**

`checkPlatformCosts` içindeki cron sağlık kontrolü bloğunu şöyle genişlet:

```typescript
// Kritik cron pipeline sağlık kontrolü
const criticalCrons = [
  { name: "lead_qual",     expectedHour: 4,  label: "Lead kalifikasyon" },
  { name: "crtsh",         expectedHour: 3,  label: "crt.sh taraması",  weekly: true },
  { name: "shodan",        expectedHour: 4,  label: "Shodan taraması"   },
  { name: "daily_summary", expectedHour: 8,  label: "Günlük özet"       },
];

const now = new Date();
const todayStr = now.toISOString().slice(0, 10);
const currentHour = now.getHours();

for (const cronDef of criticalCrons) {
  if (cronDef.weekly) {
    // Sadece Pazartesi kontrol et
    if (now.getDay() !== 1) continue;
  }
  if (currentHour < cronDef.expectedHour + 2) continue; // henüz çalışmamış olabilir

  try {
    const result = await pool.query<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM cron_job_runs
       WHERE job_name = $1
         AND started_at::date = $2
         AND status = 'ok'`,
      [cronDef.name, todayStr],
    );
    const ran = Number(result.rows[0]?.cnt ?? 0);
    if (ran === 0) {
      alerts.push(`Cron ÇALIŞMADI: ${cronDef.label} (${cronDef.name}) — ${todayStr}`);
    }
  } catch {
    // cron_job_runs erişilemez
  }
}
```

---

## DÜZELTME 11 — `.agents/memory/` Dosyalarını Build'den Hariç Tut

**Sorun:** `.agents/memory/` klasörü Replit Agent'ın memory dosyalarını içeriyor. Bunlar production build'e, git history'e ve docker image'e dahil olmamalı.

**Düzeltme:**

1. `.gitignore` dosyasına ekle:
```
.agents/
```

2. `.replitignore` dosyasına ekle (varsa):
```
.agents/
```

3. `artifacts/api-server/build.mjs` dosyasında esbuild config'ine bak. `external` veya `exclude` listesinde `.agents/` zaten yoksa eklemeye gerek yok — bu klasör TypeScript import'u değil, sadece dosya sistemi. `.gitignore` yeterli.

---

## DÜZELTME 12 — Sitemap ve Robots.txt Endpoint

**Sorun:** `routes/` altında sitemap ve robots.txt endpoint'i yok. Bu SEO için kritik.

**Düzeltme:**

`routes/public/seo.ts` adında yeni dosya oluştur:

```typescript
import { Router } from "express";
import { db } from "@workspace/db";
import { blogPostsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "../../lib/logger";

const router = Router();

const BASE_URL = process.env["SITE_BASE_URL"] ?? "https://cyberstep.io";

// ─── robots.txt ───────────────────────────────────────────────────────────────
router.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send(
    `User-agent: *
Allow: /
Disallow: /admin
Disallow: /panel
Disallow: /api/

Sitemap: ${BASE_URL}/sitemap.xml`
  );
});

// ─── sitemap.xml ──────────────────────────────────────────────────────────────
router.get("/sitemap.xml", async (_req, res) => {
  try {
    const posts = await db
      .select({ slug: blogPostsTable.slug, publishedAt: blogPostsTable.publishedAt })
      .from(blogPostsTable)
      .where(eq(blogPostsTable.status, "published"))
      .orderBy(desc(blogPostsTable.publishedAt))
      .limit(200);

    const staticPages = [
      { url: "/",              priority: "1.0", changefreq: "weekly"  },
      { url: "/tarama",        priority: "0.9", changefreq: "weekly"  },
      { url: "/degerlendirme", priority: "0.9", changefreq: "monthly" },
      { url: "/fiyatlandirma", priority: "0.8", changefreq: "monthly" },
      { url: "/hakkimizda",    priority: "0.6", changefreq: "monthly" },
      { url: "/blog",          priority: "0.8", changefreq: "daily"   },
      { url: "/iletisim",      priority: "0.5", changefreq: "yearly"  },
    ];

    const blogUrls = posts.map(p => ({
      url: `/blog/${p.slug}`,
      priority: "0.7",
      changefreq: "monthly",
      lastmod: p.publishedAt ? new Date(p.publishedAt).toISOString().slice(0, 10) : undefined,
    }));

    const allUrls = [...staticPages, ...blogUrls];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(u => `  <url>
    <loc>${BASE_URL}${u.url}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join("\n")}
</urlset>`;

    res.type("application/xml").send(xml);
  } catch (err) {
    logger.error({ err }, "Sitemap generation failed");
    res.status(500).send("Sitemap üretilemedi");
  }
});

export default router;
```

`app.ts` dosyasında bu router'ı import et ve **`/api` prefix'i olmadan** mount et (robots.txt ve sitemap.xml root'ta olmalı):

```typescript
import seoRouter from "./routes/public/seo";
// ...
// Diğer app.use('/api', ...) satırlarından ÖNCE:
app.use(seoRouter);
```

`.env`'e ekle:
```
SITE_BASE_URL=https://cyberstep.io
```

---

## SON KONTROL

Tüm düzeltmeler tamamlandıktan sonra:

1. TypeScript derleme hatası kontrol et:
   ```bash
   cd artifacts/api-server && pnpm typecheck
   ```

2. Sunucuyu başlat ve startup loglarında hata olmadığını doğrula:
   ```bash
   pnpm dev
   ```

3. Şu endpoint'lerin çalıştığını test et:
   - `GET /robots.txt` → metin dönmeli
   - `GET /sitemap.xml` → XML dönmeli
   - `GET /api/admin-panel/cron-ayarlari` (varsa) → cron listesi dönmeli

4. Replit Secrets'a şu yeni değişkeni ekle:
   - `ENCRYPTION_SECRET` = en az 32 karakter rastgele string
   - `SITE_BASE_URL` = `https://cyberstep.io`
