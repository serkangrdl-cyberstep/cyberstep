# CyberStep — Sektör & Şehir Enrichment Cron
## Claude Haiku ile Toplu Domain Zenginleştirme
### Replit Agent Prompt

---

## BAĞLAM

`lead_candidates` tablosunda ~32.000 domain'in sektör ve şehir bilgisi boş (`sector IS NULL` veya `enrichment_status = 'pending'`). Bu domain'lerin büyük çoğunluğu Certstream Bridge ve crt.sh kaynaklıdır — sadece domain adı mevcuttur, şirket bilgisi yoktur.

Hedef: **Claude Haiku** kullanarak domain adından sektör ve şehir tahmini yapan bir gece cron'u oluşturmak.

---

## BÖLÜM 1 — VERİTABANI HAZIRLIĞI

### 1.1 Yeni Kolonlar

Önce mevcut `lead_candidates` tablosunu kontrol et. Aşağıdaki kolonlar yoksa ekle:

```sql
ALTER TABLE lead_candidates
ADD COLUMN IF NOT EXISTS enrichment_status VARCHAR(20) DEFAULT 'pending',
-- 'pending' | 'enriched' | 'no_match' | 'failed'

ADD COLUMN IF NOT EXISTS enrichment_method VARCHAR(50),
-- 'haiku_inference' | 'tld_pattern' | 'whois' | 'manual' | 'import'

ADD COLUMN IF NOT EXISTS enrichment_confidence VARCHAR(10),
-- 'high' | 'medium' | 'low'

ADD COLUMN IF NOT EXISTS enrichment_attempted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS enrichment_completed_at TIMESTAMPTZ;
```

Drizzle schema'ya da ekle.

### 1.2 Mevcut Verinin Durumu

Migration sonrası mevcut kayıtları güncelle:

```sql
-- Sektörü dolu olanları 'enriched' say
UPDATE lead_candidates 
SET enrichment_status = 'enriched',
    enrichment_method = 'import'
WHERE sector IS NOT NULL 
  AND enrichment_status = 'pending';

-- Geri kalanlar 'pending' kalır
```

---

## BÖLÜM 2 — HAIKU ENRİCHMENT SERVİSİ

### 2.1 Servis Dosyası

Yeni dosya: `src/services/enrichment/haiku-enrichment.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../../db';
import { leadCandidates } from '../../db/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { logger } from '../../utils/logger';

const client = new Anthropic();

// Türkiye sektör listesi — tutarlılık için sabit liste
const SECTOR_LIST = [
  'Teknoloji & Yazılım',
  'E-ticaret & Perakende',
  'Finans & Bankacılık',
  'Sağlık & Klinik',
  'Eğitim & Üniversite',
  'İnşaat & Gayrimenkul',
  'Üretim & Sanayi',
  'Lojistik & Taşımacılık',
  'Turizm & Otelcilik',
  'Medya & Yayıncılık',
  'Hukuk & Danışmanlık',
  'Kamu & Belediye',
  'Enerji & Madencilik',
  'Tekstil & Moda',
  'Gıda & Restoran',
  'Otomotiv',
  'Tarım',
  'Diğer',
];

const TURKEY_CITIES = [
  'İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya',
  'Adana', 'Konya', 'Gaziantep', 'Kayseri', 'Mersin',
  'Eskişehir', 'Diyarbakır', 'Samsun', 'Trabzon', 'Kocaeli',
];

interface EnrichmentResult {
  sector: string | null;
  city: string | null;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export async function enrichDomain(
  domain: string,
  companyName?: string | null
): Promise<EnrichmentResult> {
  const prompt = `Sen bir Türkiye iş dünyası uzmanısın. Aşağıdaki domain adına bakarak şirketi analiz et.

Domain: ${domain}
${companyName ? `Şirket Adı: ${companyName}` : ''}

Görev:
1. Bu şirketin sektörünü belirle (aşağıdaki listeden seç)
2. Şirketin Türkiye'deki muhtemel şehrini belirle
3. Güven seviyeni belirt

Sektör Listesi:
${SECTOR_LIST.join('\n')}

Kurallar:
- Domain adındaki ipuçlarını kullan (hastane→Sağlık, yazılım→Teknoloji vb.)
- .edu.tr → Eğitim, .gov.tr → Kamu, .bel.tr → Kamu (kesin)
- Şehir belirleyemiyorsan null döndür
- Türkiye dışı bir şirketse null döndür

SADECE JSON döndür, başka hiçbir şey yazma:
{
  "sector": "Teknoloji & Yazılım",
  "city": "İstanbul",
  "confidence": "medium",
  "reasoning": "domain adında 'yazilim' geçiyor"
}`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const clean = text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean) as EnrichmentResult;

  // Sektör listede değilse 'Diğer' yap
  if (parsed.sector && !SECTOR_LIST.includes(parsed.sector)) {
    parsed.sector = 'Diğer';
  }

  // Şehir listede değilse null yap
  if (parsed.city && !TURKEY_CITIES.includes(parsed.city)) {
    parsed.city = null;
  }

  return parsed;
}
```

### 2.2 Batch İşlemci

Yeni dosya: `src/services/enrichment/batch-enrichment.ts`

```typescript
import { db } from '../../db';
import { leadCandidates } from '../../db/schema';
import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import { enrichDomain } from './haiku-enrichment';
import { logger } from '../../utils/logger';

// Bir cron çalışmasında max işlenecek domain
const BATCH_SIZE = 500;

// Rate limiting: Haiku'ya saniyede max istek
const REQUESTS_PER_SECOND = 5;
const DELAY_MS = 1000 / REQUESTS_PER_SECOND; // 200ms

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function runEnrichmentBatch(): Promise<{
  processed: number;
  enriched: number;
  no_match: number;
  failed: number;
  cost_estimate_usd: number;
}> {
  const stats = { processed: 0, enriched: 0, no_match: 0, failed: 0 };

  logger.info('Enrichment batch başladı');

  // Öncelik sırası: crt.sh ve certstream önce, daha sonra diğerleri
  // enrichment_attempted_at null olanları önce al (hiç denenmemiş)
  const candidates = await db
    .select({
      id: leadCandidates.id,
      domain: leadCandidates.domain,
      company_name: leadCandidates.companyName, // varsa
      source_list: leadCandidates.sourceList,
    })
    .from(leadCandidates)
    .where(
      and(
        eq(leadCandidates.enrichmentStatus, 'pending'),
        isNull(leadCandidates.sector)
      )
    )
    .orderBy(
      // crt.sh ve certstream önce
      sql`CASE 
        WHEN source_list = 'certstream' THEN 1
        WHEN source_list = 'crt.sh' THEN 2
        ELSE 3
      END`
    )
    .limit(BATCH_SIZE);

  logger.info({ count: candidates.length }, 'İşlenecek domain sayısı');

  for (const candidate of candidates) {
    try {
      // attempted_at güncelle
      await db
        .update(leadCandidates)
        .set({ enrichmentAttemptedAt: new Date() })
        .where(eq(leadCandidates.id, candidate.id));

      const result = await enrichDomain(candidate.domain, candidate.company_name);

      // Sonucu kaydet
      await db
        .update(leadCandidates)
        .set({
          sector: result.sector,
          city: result.city ?? undefined,
          enrichmentStatus: result.sector ? 'enriched' : 'no_match',
          enrichmentMethod: 'haiku_inference',
          enrichmentConfidence: result.confidence,
          enrichmentCompletedAt: new Date(),
        })
        .where(eq(leadCandidates.id, candidate.id));

      if (result.sector) {
        stats.enriched++;
      } else {
        stats.no_match++;
      }

      stats.processed++;

      // Rate limiting
      await sleep(DELAY_MS);

    } catch (err) {
      logger.warn({ domain: candidate.domain, err }, 'Enrichment hatası');

      await db
        .update(leadCandidates)
        .set({
          enrichmentStatus: 'failed',
          enrichmentAttemptedAt: new Date(),
        })
        .where(eq(leadCandidates.id, candidate.id));

      stats.failed++;
      stats.processed++;
    }
  }

  // Maliyet tahmini: Haiku ~$0.00025 per 1K input tokens
  // Her domain için ortalama ~150 token → $0.0000375 per domain
  const cost_estimate_usd = stats.processed * 0.0000375;

  logger.info({ ...stats, cost_estimate_usd }, 'Enrichment batch tamamlandı');

  return { ...stats, cost_estimate_usd };
}
```

---

## BÖLÜM 3 — CRON JOB

### 3.1 index.ts'e Cron Ekle

`src/index.ts` dosyasında mevcut cron job'ların yanına ekle:

```typescript
import { runEnrichmentBatch } from './services/enrichment/batch-enrichment';

// Her gece 02:30'da çalış (scan cron'larıyla çakışmasın)
cron.schedule('30 2 * * *', wrapCron('enrichment_batch', async () => {
  const result = await runEnrichmentBatch();
  logger.info({ result }, 'Gece enrichment cron tamamlandı');
}), { timezone: 'Europe/Istanbul' });
```

### 3.2 Manuel Tetikleme Endpoint'i

Admin panelden manuel çalıştırabilmek için:

```
POST /api/admin-panel/enrichment/run
Response: { queued: true, message: "Batch başlatıldı, 500 domain işlenecek" }
```

Bu endpoint arka planda `runEnrichmentBatch()` çağırır, sonucu beklemez (async fire-and-forget). Progress admin panel'den takip edilir.

### 3.3 Progress Endpoint'i

```
GET /api/admin-panel/enrichment/status
Response: {
  total: 32131,
  pending: 31500,
  enriched: 580,
  no_match: 42,
  failed: 9,
  completion_pct: 1.9,
  estimated_remaining_batches: 63,
  estimated_cost_usd: 1.20
}
```

---

## BÖLÜM 4 — ADMIN PANEL UI

### 4.1 Mevcut Zenginleştirme Sayfası

Ekran görüntüsünde zaten bir "Sektör & Şehir Zenginleştirme — Kaynak Bazlı" sayfası var. Bu sayfaya aşağıdaki bölümü ekle:

**Yeni kart: "Otomatik Zenginleştirme"**

```
┌─────────────────────────────────────────────────┐
│  🤖 Haiku AI Zenginleştirme                      │
│                                                   │
│  Bekleyen: 32.131 domain                         │
│  Tamamlanan: 580 (%1.8)                          │
│  Tahmini maliyet: ~$1.20                         │
│  Sonraki cron: Bu gece 02:30                     │
│                                                   │
│  [▶ Şimdi Çalıştır]  [⏸ Cron Durdur]           │
└─────────────────────────────────────────────────┘
```

"Şimdi Çalıştır" butonu `POST /api/admin-panel/enrichment/run` çağırır.
Çalışırken progress bar göster (polling: her 5 saniyede GET /status).

---

## BÖLÜM 5 — KALİTE KONTROL

### 5.1 Confidence Bazlı Filtreleme

Admin rapor ekranlarında düşük güvenilirlikli tahminleri ayrı göster:

- `high` confidence → doğrudan kullan
- `medium` confidence → kullan ama etiketle ("AI tahmini")
- `low` confidence → raporda gösterme, "Belirsiz" yaz

### 5.2 Hatalı Enrichment Düzeltme

`enrichment_status = 'failed'` olan domain'leri yeniden denemek için:

```
POST /api/admin-panel/enrichment/retry-failed
```

Bu endpoint sadece `failed` kayıtları `pending`'e çeker, bir sonraki cron'da tekrar dener.

### 5.3 Shodan Verisi Doğrulama

Ekran görüntüsünde Shodan'ın %96.2 sektör doluluk oranı şüpheli görünüyordu. Şunu kontrol et:

```sql
SELECT sector, COUNT(*) 
FROM lead_candidates 
WHERE source_list = 'shodan'
  AND sector IS NOT NULL
GROUP BY sector
ORDER BY COUNT(*) DESC
LIMIT 10;
```

Eğer tek bir sektör değeri hakimse (örn. hepsinde "Teknoloji") bu default atama hatası — o kayıtları `enrichment_status = 'pending'` yapıp yeniden enrichment'a sok.

---

## BÖLÜM 6 — MALİYET TAHMİNİ

```
Toplam pending: ~32.000 domain
Batch başına: 500 domain
Toplam batch: 64 gece (~2 ay, her gece çalışırsa)

Haiku maliyeti: $0.0000375 per domain
Toplam tahmini: 32.000 × $0.0000375 = ~$1.20

Hızlandırmak istersen:
- BATCH_SIZE = 1000 → 32 gece (~1 ay)
- BATCH_SIZE = 2000 → 16 gece (~2.5 hafta)
- Rate limit: REQUESTS_PER_SECOND = 10 ile dene
```

$1.20 ile 32.000 domain zenginleştirmek son derece uygun maliyet.

---

## BÖLÜM 7 — DEPLOYMENT KONTROL LİSTESİ

```
[ ] lead_candidates tablosuna 5 yeni kolon eklendi
[ ] Mevcut enriched kayıtlar 'enriched' statüsüne güncellendi
[ ] src/services/enrichment/ klasörü oluşturuldu
[ ] haiku-enrichment.ts çalışıyor (tek domain test et)
[ ] batch-enrichment.ts çalışıyor (10 domain ile test et)
[ ] Cron 02:30'a eklendi (Europe/Istanbul)
[ ] Manuel tetikleme endpoint'i çalışıyor
[ ] Status endpoint'i doğru rakam dönüyor
[ ] Admin panel'de progress kartı görünüyor
[ ] Shodan verisi sample kontrolü yapıldı
[ ] wrapCron pattern ile log'lara eklendi
```

---

## ÖNEMLİ NOTLAR

1. **wrapCron pattern'ı kullan** — projede mevcut olan 83 cron job'la aynı pattern. İndex.ts'deki diğer cron'lara bak, aynı şekilde wrap et.

2. **ANTHROPIC_API_KEY** zaten mevcut (mevcut Claude/Haiku kullanımları var). Yeni key gerekmez.

3. **Drizzle ORM field isimleri** — `companyName`, `sourceList`, `enrichmentStatus` gibi camelCase kullan. Mevcut schema'ya bak, tutarlı ol.

4. **Türkçe karakter** — domain'lerde Türkçe karakter olmaz ama şirket adlarında olabilir. JSON parse'da sorun çıkarsa `try/catch` zaten var.

5. **Batch size dikkat** — Replit free tier'da memory kısıtı olabilir. 500 ile başla, sorun yoksa artır.

6. **`sub_sector` kolonu** — Daha önce eklenmişti. Haiku prompt'una ikinci geçişte alt sektör de tahmin ettirilebilir. Şimdilik sadece `sector` ve `city` hedefleyelim.

---

*CyberStep Enrichment Cron — Haziran 2026*
