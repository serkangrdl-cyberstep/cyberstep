# CyberStep.io — Certstream Gerçek Zamanlı Lead Akışı
## Mevcut crt.sh + Shodan sistemine EK — Yeni prompt

---

## BAĞLAM

Bu prompt mevcut lead discovery sisteminin üzerine inşa eder.
`lead_candidates`, `lead_discovery_runs`, `subdomain_scoring_rules`
tabloları ve `analyzeSubdomain()`, `runFullPipeline()` fonksiyonları
zaten mevcut. Bunlara dokunma.

Eklenecek 3 şey:
1. Certstream WebSocket listener (7/24 sürekli çalışır)
2. İşleme kuyruğu (gelen domainleri buffer'lar)
3. Shodan cron'u haftalık'a al, crt.sh tek seferlik yap

---

## ADIM 1: PAKET KURULUMU

```bash
pnpm add certstream-js ws
```

---

## ADIM 2: VERİTABANI EKLEMESİ

```sql
-- Certstream event buffer — gelen domainler burada birikir
-- Pipeline cron her gece işler
CREATE TABLE IF NOT EXISTS certstream_queue (
  id bigserial PRIMARY KEY,
  root_domain varchar(255) NOT NULL,
  trigger_subdomain varchar(500),
  subdomain_type varchar(50),
  corporate_score integer,
  cert_org varchar(500),
  -- Sertifikadaki organizasyon adı (altın değer)
  cert_issuer varchar(255),
  raw_domains text[],
  received_at timestamp DEFAULT now(),
  processed boolean DEFAULT false,
  skipped_reason varchar(50),
  -- 'already_exists' | 'low_score' | 'excluded'
  UNIQUE(root_domain)
  -- Aynı domain tekrar gelirse güncelle, ekleme
);

-- Certstream bağlantı durumu izleme
CREATE TABLE IF NOT EXISTS certstream_status (
  id serial PRIMARY KEY,
  status varchar(20) DEFAULT 'stopped',
  -- 'running' | 'stopped' | 'error'
  started_at timestamp,
  last_cert_at timestamp,
  total_received bigint DEFAULT 0,
  total_tr_found integer DEFAULT 0,
  total_qualified integer DEFAULT 0,
  error_message text,
  updated_at timestamp DEFAULT now()
);

INSERT INTO certstream_status (status) VALUES ('stopped')
ON CONFLICT DO NOTHING;
```

---

## ADIM 3: CERTSTREAM LISTENER

```typescript
// src/leadDiscovery/certstreamListener.ts
// Yeni dosya oluştur

import WebSocket from 'ws';

const CERTSTREAM_URL = 'wss://certstream.calidog.io/full-stream';
const RECONNECT_DELAY_MS = 5000;
const BATCH_INSERT_SIZE = 50;

// Bellek buffer — toplu insert için
let pendingDomains: CertstreamEntry[] = [];
let insertTimer: NodeJS.Timeout | null = null;

export class CertstreamListener {
  private ws: WebSocket | null = null;
  private running = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private statusId: number = 1;

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    await db.update(certstreamStatus).set({
      status: 'running',
      startedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(certstreamStatus.id, this.statusId));

    logger.info('Certstream listener başlatıldı');
    this.connect();
  }

  stop(): void {
    this.running = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) this.ws.close();
    this.ws = null;
    logger.info('Certstream listener durduruldu');
  }

  private connect(): void {
    this.ws = new WebSocket(CERTSTREAM_URL, {
      handshakeTimeout: 10000,
      headers: {
        'User-Agent': 'CyberStep-ThreatIntel/1.0',
      },
    });

    this.ws.on('open', () => {
      logger.info('Certstream WebSocket bağlandı');
    });

    this.ws.on('message', async (raw: Buffer) => {
      try {
        await this.processMessage(raw.toString());
      } catch (e) {
        // Tek mesaj hatası tüm listener'ı durdurmasın
      }
    });

    this.ws.on('error', (err) => {
      logger.warn('Certstream error:', err.message);
    });

    this.ws.on('close', () => {
      if (!this.running) return;
      logger.info(`Certstream koptu, ${RECONNECT_DELAY_MS / 1000}s sonra yeniden bağlanıyor...`);
      this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
    });
  }

  private async processMessage(raw: string): Promise<void> {
    const data = JSON.parse(raw);
    if (data.message_type !== 'certificate_update') return;

    const cert = data.data?.leaf_cert;
    if (!cert) return;

    const allDomains: string[] = cert.all_domains || [];
    const certOrg = cert.subject?.O || '';
    const certIssuer = cert.issuer?.O || '';

    // Cert org Türkiye ipucu mu?
    // Türkçe karakterler veya .TR DNS kayıtları
    const hasTROrg = /türk|türkiye|istanbul|ankara|izmir/i.test(certOrg);

    let foundTR = false;

    for (const domain of allDomains) {
      // Wildcard atla
      if (domain.startsWith('*')) continue;

      // Türk domain mi?
      if (!domain.endsWith('.tr') && !hasTROrg) continue;

      const cleanDomain = domain.toLowerCase().trim();
      const analysis = analyzeSubdomain(cleanDomain);

      if (!analysis.rootDomain) continue;
      if (analysis.corporateScore < 60) continue;

      // Bellek buffer'a ekle
      pendingDomains.push({
        rootDomain: analysis.rootDomain,
        triggerSubdomain: cleanDomain,
        subdomainType: analysis.subdomainType,
        corporateScore: analysis.corporateScore,
        certOrg: certOrg.slice(0, 500),
        certIssuer: certIssuer.slice(0, 255),
        rawDomains: allDomains.slice(0, 10),
      });

      foundTR = true;
    }

    // Her 50 domain'de veya 30 saniyede bir toplu insert
    if (pendingDomains.length >= BATCH_INSERT_SIZE) {
      await this.flushBuffer();
    } else if (!insertTimer) {
      insertTimer = setTimeout(() => this.flushBuffer(), 30000);
    }

    // İstatistik güncelle (her 1000 certte bir)
    if (Math.random() < 0.001) {
      await db.update(certstreamStatus).set({
        lastCertAt: new Date(),
        totalReceived: sql`total_received + 1000`,
        totalTrFound: sql`total_tr_found + ${foundTR ? 1 : 0}`,
        updatedAt: new Date(),
      }).where(eq(certstreamStatus.id, this.statusId));
    }
  }

  private async flushBuffer(): Promise<void> {
    if (insertTimer) {
      clearTimeout(insertTimer);
      insertTimer = null;
    }

    if (pendingDomains.length === 0) return;

    const toInsert = [...pendingDomains];
    pendingDomains = [];

    try {
      await db.insert(certstreamQueue)
        .values(toInsert.map(d => ({
          rootDomain: d.rootDomain,
          triggerSubdomain: d.triggerSubdomain,
          subdomainType: d.subdomainType,
          corporateScore: d.corporateScore,
          certOrg: d.certOrg,
          certIssuer: d.certIssuer,
          rawDomains: d.rawDomains,
        })))
        .onConflictDoNothing();
        // UNIQUE(root_domain) — aynı domain tekrar gelirse atla

      logger.debug(`Certstream: ${toInsert.length} domain queue'ya eklendi`);
    } catch (e) {
      logger.error('Certstream flush hatası', e);
    }
  }
}

// Singleton instance
export const certstreamListener = new CertstreamListener();
```

---

## ADIM 4: QUEUE İŞLEYİCİSİ

```typescript
// src/leadDiscovery/certstreamProcessor.ts
// Queue'daki domainleri lead_candidates'a taşır

export async function processCertstreamQueue(
  batchSize: number = 100
): Promise<ProcessResult> {

  // Queue'daki işlenmemiş domainleri al
  const queued = await db.select()
    .from(certstreamQueue)
    .where(eq(certstreamQueue.processed, false))
    .orderBy(
      desc(certstreamQueue.corporateScore), // Yüksek skorlular önce
      asc(certstreamQueue.receivedAt)
    )
    .limit(batchSize);

  if (queued.length === 0) return { processed: 0, added: 0, skipped: 0 };

  let added = 0;
  let skipped = 0;

  for (const item of queued) {
    // Zaten lead_candidates'ta var mı?
    const existing = await db.select({ id: leadCandidates.id })
      .from(leadCandidates)
      .where(eq(leadCandidates.domain, item.rootDomain))
      .limit(1);

    if (existing.length > 0) {
      // Zaten var — sadece certOrg bilgisini güncelle
      if (item.certOrg) {
        await db.update(leadCandidates).set({
          companyName: sql`COALESCE(lead_candidates.company_name, ${item.certOrg})`,
        }).where(eq(leadCandidates.domain, item.rootDomain));
      }

      await db.update(certstreamQueue).set({
        processed: true,
        skippedReason: 'already_exists',
      }).where(eq(certstreamQueue.id, item.id));

      skipped++;
      continue;
    }

    // Yeni lead adayı ekle
    const inserted = await db.insert(leadCandidates).values({
      domain: item.rootDomain,
      companyName: item.certOrg || null,
      // SSL sertifikasındaki org adı genelde şirket adı
      source: 'certstream_realtime',
      sourceData: {
        triggerSubdomain: item.triggerSubdomain,
        subdomainType: item.subdomainType,
        corporateScore: item.corporateScore,
        certOrg: item.certOrg,
        certIssuer: item.certIssuer,
        receivedAt: item.receivedAt,
      },
      scanStatus: 'pending',
    }).onConflictDoNothing().returning();

    if (inserted.length > 0) {
      added++;
      await db.update(certstreamStatus).set({
        totalQualified: sql`total_qualified + 1`,
      }).where(eq(certstreamStatus.id, 1));
    }

    await db.update(certstreamQueue).set({
      processed: true,
    }).where(eq(certstreamQueue.id, item.id));
  }

  return { processed: queued.length, added, skipped };
}
```

---

## ADIM 5: SERVER BAŞLANGICINA EKLE

```typescript
// src/server.ts veya src/app.ts'e ekle
// Mevcut server başlatma kodunun sonuna:

import { certstreamListener } from './leadDiscovery/certstreamListener';

// Server hazır olunca Certstream'i başlat
app.on('ready', async () => {
  if (process.env.CERTSTREAM_ENABLED === 'true') {
    await certstreamListener.start();
    logger.info('Certstream listener aktif');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  certstreamListener.stop();
});
process.on('SIGINT', () => {
  certstreamListener.stop();
});
```

---

## ADIM 6: CRON GÜNCELLEME

```typescript
// Mevcut cron job'lara DOKUNMA.
// Sadece aşağıdakileri EKLE veya GÜNCELLE:

// ─── YENİ: Her saat — certstream queue işle ───────────────
cron.schedule('0 * * * *', async () => {
  const result = await processCertstreamQueue(100);
  if (result.added > 0) {
    logger.info(`Certstream queue: ${result.added} yeni lead eklendi`);
  }
});

// ─── DEĞİŞTİR: crt.sh cron'u kaldır (artık gerek yok) ────
// Mevcut crt.sh haftalık cron'u comment out et veya sil.
// crt.sh sadece ilk yükleme içindi — certstream devralıyor.

// ─── DEĞİŞTİR: Shodan'ı haftalık yap ─────────────────────
// Mevcut Shodan cron varsa frekansını güncelle:
// Her Pazartesi 03:00 — Haftada bir yeterli
cron.schedule('0 3 * * 1', async () => {
  if (!process.env.SHODAN_API_KEY) return;

  // Haftanın numarasına göre farklı sorgu (kredi yönetimi)
  const weekNum = Math.floor(Date.now() / (7 * 24 * 3600 * 1000));
  const queryIdx = weekNum % 8; // 8 Shodan sorgusu var
  await scanShodanFree(queryIdx, 100);
});

// ─── MEVCUT: Geceleri pipeline çalışmaya devam eder ───────
// Her gece 04:00 — lead_candidates'taki pending'leri işle
// Bu cron değişmiyor, olduğu gibi kalır.
```

---

## ADIM 7: ADMİN PANELİ EKLEMESİ

```typescript
// Mevcut /admin-panel/lead-discovery sayfasına
// şu widget'ı EKLE:

// GET /api/admin/leads/certstream/status
router.get('/certstream/status', requireAdmin, async (req, res) => {
  const status = await db.select()
    .from(certstreamStatus).limit(1);

  const queueCount = await db.select({ count: count() })
    .from(certstreamQueue)
    .where(eq(certstreamQueue.processed, false));

  const last24h = await db.select({ count: count() })
    .from(certstreamQueue)
    .where(gte(certstreamQueue.receivedAt,
      new Date(Date.now() - 24 * 3600 * 1000)));

  res.json({
    ...status[0],
    queuePending: queueCount[0]?.count || 0,
    last24hReceived: last24h[0]?.count || 0,
  });
});

// POST /api/admin/leads/certstream/start
router.post('/certstream/start', requireAdmin, async (req, res) => {
  await certstreamListener.start();
  res.json({ success: true, message: 'Certstream başlatıldı' });
});

// POST /api/admin/leads/certstream/stop
router.post('/certstream/stop', requireAdmin, async (req, res) => {
  certstreamListener.stop();
  res.json({ success: true, message: 'Certstream durduruldu' });
});
```

**Admin panelde gösterilecek widget:**
```
─── Certstream Gerçek Zamanlı ───────────────────────────────
Durum:              🟢 Aktif  (son 3.2 sn önce cert geldi)
Bugün alınan cert:  14.847
Türk domain:        234
Queue'da bekleyen:  67
Lead'e eklenen:     156 (bu hafta)

[Durdur]  [Queue İşle (şimdi)]
```

---

## ADIM 8: ENVIRONMENT VARIABLE EKLE

```bash
# .env'e ekle (sadece bu yeni satır):
CERTSTREAM_ENABLED=true
```

---

## ÖZETİ

```
Mevcut sistem (değişmez):
  crt.sh → ilk bulk yükleme (zaten yapıldı)
  Shodan → haftalık (Pazartesi)
  Gece pipeline → tarama + kalifikasyon

Yeni eklenen:
  Certstream → 7/24 WebSocket listener
  certstreamQueue → buffer tablosu
  Her saat cron → queue → lead_candidates

Net sonuç:
  Yeni Türk şirket SSL sertifikası kesince
  dakikalar içinde sistemde görünür.
  Geceleri kalifikasyon kuyruğuna girer.
  Sabah teaser hazır olur.
```

---

*CyberStep.io — Certstream Ek Prompt — 2026*
