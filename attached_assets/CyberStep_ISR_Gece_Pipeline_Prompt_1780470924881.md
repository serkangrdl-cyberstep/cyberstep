# CyberStep.io — Gece Lead Fabrikası
## Replit Agent Promptu — En Düşük Maliyet / En Yüksek Kalite Lead Sistemi

---

## VİZYON

Her sabah 08:00'de ISR'ın masasına hazır bir iş listesi düşer.

Gece boyunca sistem otomatik çalışır:
- crt.sh ve Certstream'den yeni Türk domainleri toplar
- CyberStep taraması yapar
- Claude Haiku ile filtreler (ucuz, hızlı)
- Hunter.io ile kontak arar
- Kişiselleştirilmiş e-posta taslağı hazırlar
- Sabah: "Gönder" butonuna bas, gün başlar

**Hedef:** Günlük 200-500 aday → 50-100 kaliteli lead → %1-2 satış

**Maliyet hedefi:** Lead başına <$0.10

---

## MALİYET ANALİZİ

```
Kaynak          Plan            Maliyet/Ay    Ne Sağlıyor
──────────────────────────────────────────────────────────
crt.sh          Ücretsiz        $0            Sınırsız TR domain
Certstream      Ücretsiz        $0            7/24 gerçek zamanlı
Shodan          Freelancer $69  $69           100 query/ay, tüm filtreler
                                              FortiGate + port + ERP tespiti
Claude Haiku    Kullanım bazlı  ~$4           Kalifikasyon + email
Hunter.io       Starter $34     $34           500 lookup/ay (domain search)
Apollo.io       Free tier       $0            50 kişi/ay — Hunter fallback
Postmark        Starter         ~$10          Email gönderim
Server (Replit) -               ~$20          Compute
──────────────────────────────────────────────────────────
TOPLAM                          ~$137/ay

Günlük 200 tarama × 30 gün = 6.000 tarama/ay
Kalifikasyon %20 = 1.200 lead/ay
Email gidilebilir = 800 lead/ay (günlük 27 limit)
%1 dönüşüm = 8 müşteri/ay
%2 dönüşüm = 16 müşteri/ay

1 SOC Standart müşteri = 8.500 TL/ay
8 müşteri × 8.500 TL = 68.000 TL/ay gelir
ROI = 68.000 TL / ~4.200 TL (~$137) = 16x — muhafazakar
```

### Shodan $69 Freelancer Plan — Neden Zorunlu

```
Ücretsiz plan:
  ssl.cert.subject.cn filtresi ÇALIŞMAZ
  .tr sorgular doğru çalışmaz
  API erişimi yok
  → Türkiye hedefli sorgu imkansız

$69 Freelancer:
  100 query credit/ay
  ssl.cert.subject.cn:*.com.tr → ÇALIŞIR
  FortiGate tespiti → ÇALIŞIR
  HTTP title filtresi → ÇALIŞIR
  CVE/vulnerability data dahil
  Her query = 100 sonuç
  → 100 × 100 = 10.000 Shodan sonucu/ay
```

### Shodan 100 Credit Dağılımı

```
HAFTALIK BATCH (4 hafta × 4 sorgu = 16 credit/ay):
  Pazartesi:
    ssl.cert.subject.cn:*.com.tr country:TR    → 4 credit
    ssl.cert.subject.cn:*.net.tr country:TR    → 4 credit

  Perşembe:
    "FortiGate" country:TR port:443            → 4 credit
    country:TR http.title:"ERP" port:443       → 4 credit

AYLIK ÖZEL SORGULAR (1 kez = 18 credit/ay):
  country:TR "RDP" port:3389                   → 2 credit ← ACİL LEAD
  country:TR "MongoDB" port:27017              → 2 credit ← ACİL LEAD
  country:TR "Outlook Web" http.title          → 2 credit ← M365 müşteri
  country:TR "Fortinet" ssl.cert              → 2 credit
  country:TR product:"FortiGate"              → 2 credit
  country:TR http.title:"SAP" port:443        → 2 credit ← Enterprise
  country:TR "VMware vSphere" http.title      → 2 credit ← Altyapı
  country:TR "Cisco ASA" port:443             → 2 credit ← Güvenlik bilinçli

TAMPON (kalan ~66 credit):
  CVE çıkınca acil tarama için
  Yeni sorgu denemeleri için
  Ay sonu fazla kalan: sonraki aya devretmez — harca
```

### Sorgu Öncelik Mantığı

```
Öncelik 1 — Açık Port Sorguları (En Hızlı Satış):
  RDP 3389 açık = Ransomware giriş noktası
  MongoDB 27017 açık = Veri sızıntısı riski
  → Bu şirketler e-posta açar çünkü somut, acil risk

Öncelik 2 — FortiGate Sorgular (En Yüksek LTV):
  FortiGate = SOC+NOC Fabric entegrasyon satışı
  = Aylık 12.900 TL SOC+NOC Standart paket
  = 1 müşteri $69'ı 4 günde geri kazandırır

Öncelik 3 — ERP/M365 Sorgular (Kurumsal Bütçe):
  ERP = IT bütçesi yüksek şirket
  Outlook Web = Microsoft ekosistemi = Azure Monitor upsell
```

---

## BÖLÜM 1: VERİTABANI EKLEMELERİ

```sql
-- Gece pipeline durumu (her çalışma bir kayıt)
CREATE TABLE IF NOT EXISTS nightly_pipeline_runs (
  id serial PRIMARY KEY,
  run_date date UNIQUE NOT NULL,
  started_at timestamp,
  completed_at timestamp,
  status varchar(20) DEFAULT 'running',

  -- Kaynak sayıları
  certstream_queue_size integer DEFAULT 0,
  crtsh_new_domains integer DEFAULT 0,
  shodan_new_domains integer DEFAULT 0,

  -- İşleme
  domains_scanned integer DEFAULT 0,
  domains_qualified integer DEFAULT 0,
  contacts_found integer DEFAULT 0,
  emails_generated integer DEFAULT 0,

  -- Sabah listesi
  daily_list_size integer DEFAULT 0,
  emails_sent integer DEFAULT 0,
  emails_opened integer DEFAULT 0,

  -- Maliyet
  claude_calls integer DEFAULT 0,
  claude_cost_usd decimal(8,4) DEFAULT 0,
  hunter_calls integer DEFAULT 0,
  hunter_cost_usd decimal(8,4) DEFAULT 0,
  total_cost_usd decimal(8,4) DEFAULT 0,

  error_log text
);

-- Günlük ISR iş listesi
CREATE TABLE IF NOT EXISTS daily_isr_tasks (
  id serial PRIMARY KEY,
  run_date date NOT NULL,
  lead_candidate_id integer REFERENCES lead_candidates(id),

  -- Öncelik skoru (sabah listesinde sıralama için)
  priority_score integer,
  -- risk_score × company_size_weight × sector_weight
  -- + fortinet_bonus + fresh_cert_bonus

  -- Kontak durumu
  contact_status varchar(30) DEFAULT 'pending',
  -- 'ready'          → email var, gönderilebilir
  -- 'needs_linkedin' → email yok, LinkedIn'e bak
  -- 'sent'           → gönderildi
  -- 'skipped'        → ISR geçti
  -- 'bounced'        → email hatalı

  -- İletişim
  contact_name varchar(255),
  contact_title varchar(100),
  contact_email varchar(255),
  contact_email_confidence integer,
  contact_linkedin_url varchar(500),

  -- Email taslağı
  email_subject varchar(255),
  email_body text,
  email_approved boolean DEFAULT false,
  email_edited boolean DEFAULT false,

  -- Gönderim
  sent_at timestamp,
  opened_at timestamp,
  clicked_at timestamp,
  replied_at timestamp,

  -- ISR notu
  isr_note text,

  created_at timestamp DEFAULT now()
);

CREATE INDEX idx_daily_tasks_date
  ON daily_isr_tasks(run_date, contact_status, priority_score DESC);

-- Tarama geçmişi (tekrar taramayı önlemek için)
ALTER TABLE lead_candidates
  ADD COLUMN IF NOT EXISTS last_scanned_at timestamp,
  ADD COLUMN IF NOT EXISTS scan_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_scan_due_at timestamp,
  ADD COLUMN IF NOT EXISTS pipeline_run_id integer;
```

---

## BÖLÜM 2: ANA PIPELINE ORKESTRATÖRü

```typescript
// src/pipeline/nightlyOrchestrator.ts

export async function runNightlyPipeline(): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  // Zaten çalıştı mı?
  const existing = await db.select()
    .from(nightlyPipelineRuns)
    .where(eq(nightlyPipelineRuns.runDate, today))
    .limit(1);
  if (existing[0]?.status === 'completed') {
    logger.info('Bu gece pipeline zaten çalıştı');
    return;
  }

  const [run] = await db.insert(nightlyPipelineRuns).values({
    runDate: today,
    startedAt: new Date(),
    status: 'running',
  }).returning();

  logger.info(`=== Gece Pipeline Başladı: ${today} ===`);
  const startTime = Date.now();

  try {
    // ADIM 1: Kaynaklardan domain topla
    const domains = await collectDomains(run.id);
    logger.info(`Toplanan domain: ${domains.length}`);

    // ADIM 2: Önceliklendir ve filtrele
    const prioritized = await prioritizeDomains(domains);
    logger.info(`İşlenecek domain: ${prioritized.length}`);

    // ADIM 3: Paralel tarama (5'li gruplar)
    const scanned = await scanInBatches(prioritized, run.id);
    logger.info(`Taranan: ${scanned.length}`);

    // ADIM 4: Claude Haiku ile kalifikasyon
    const qualified = await qualifyWithHaiku(scanned, run.id);
    logger.info(`Kalifikasyon geçen: ${qualified.length}`);

    // ADIM 5: Kontak araştırması
    const withContacts = await findContacts(qualified, run.id);
    logger.info(`Kontak bulunan: ${withContacts.length}`);

    // ADIM 6: Email taslağı üret
    const withEmails = await generateEmails(withContacts, run.id);
    logger.info(`Email hazır: ${withEmails.length}`);

    // ADIM 7: Günlük ISR listesini oluştur
    const listSize = await buildDailyList(withEmails, today);
    logger.info(`Sabah listesi: ${listSize} lead`);

    // ADIM 8: Maliyet özeti hesapla
    const costs = await calculateRunCosts(run.id);

    // Pipeline tamamlandı
    await db.update(nightlyPipelineRuns).set({
      status: 'completed',
      completedAt: new Date(),
      domainsScanned: scanned.length,
      domainsQualified: qualified.length,
      contactsFound: withContacts.length,
      emailsGenerated: withEmails.length,
      dailyListSize: listSize,
      claudeCallsCount: costs.claudeCalls,
      claudeCostUsd: costs.claudeCost,
      hunterCallsCount: costs.hunterCalls,
      hunterCostUsd: costs.hunterCost,
      totalCostUsd: costs.totalCost,
    }).where(eq(nightlyPipelineRuns.id, run.id));

    const duration = Math.round((Date.now() - startTime) / 60000);
    logger.info(`=== Pipeline Tamamlandı: ${duration} dk, $${costs.totalCost} ===`);

    // Admin sabah bildirimi
    await sendMorningBriefing(today, listSize, costs);

  } catch (error) {
    await db.update(nightlyPipelineRuns).set({
      status: 'failed',
      errorLog: error.message,
    }).where(eq(nightlyPipelineRuns.id, run.id));
    logger.error('Pipeline hatası', error);
    throw error;
  }
}
```

---

## BÖLÜM 3: DOMAIN TOPLAMA

```typescript
// src/pipeline/domainCollector.ts

export async function collectDomains(
  runId: number
): Promise<string[]> {

  const allDomains = new Set<string>();

  // ─── KAYNAK 1: Certstream kuyruğu (en taze) ─────────────
  const certstreamQueue = await db.select({
    rootDomain: certstreamQueue.rootDomain,
    corporateScore: certstreamQueue.corporateScore,
    certOrg: certstreamQueue.certOrg,
  })
  .from(certstreamQueue)
  .where(
    and(
      eq(certstreamQueue.processed, false),
      gte(certstreamQueue.corporateScore, 60),
      // Son 24 saatte gelen
      gte(certstreamQueue.receivedAt,
          new Date(Date.now() - 24 * 3600 * 1000))
    )
  )
  .orderBy(desc(certstreamQueue.corporateScore))
  .limit(300);

  certstreamQueue.forEach(c => allDomains.add(c.rootDomain));
  logger.info(`Certstream kuyruğu: ${certstreamQueue.length}`);

  // Certstream queue'yu işlendi olarak işaretle
  if (certstreamQueue.length > 0) {
    await db.update(certstreamQueue).set({ processed: true })
      .where(
        inArray(certstreamQueue.id,
          certstreamQueue.map(c => c.id))
      );
  }

  // ─── KAYNAK 2: crt.sh (dün akşam çalıştıysa skip) ──────
  const lastCrtsh = await getLastCrtshRun();
  const crtshStale = !lastCrtsh ||
    Date.now() - lastCrtsh.getTime() > 22 * 3600 * 1000;

  if (crtshStale) {
    const crtshDomains = await scanCRTSH('%.com.tr', {
      daysBack: 1, // Sadece dün
      minCorporateScore: 65,
      limit: 200,
    });
    crtshDomains.results.forEach(r => allDomains.add(r.rootDomain));
    logger.info(`crt.sh yeni: ${crtshDomains.addedToLeads}`);
  }

  // ─── KAYNAK 3: Shodan DB'sinden işlenmemişler ───────────
  // Shodan cron'u (Pazartesi + Perşembe) çalışınca
  // shodan_raw_results tablosuna kayıt düşer.
  // Pipeline bu kayıtları lead_candidates'a taşır.
  const shodanPending = await db.select({
    extractedDomain: shodanRawResults.extractedDomain,
    org: shodanRawResults.org,
    city: shodanRawResults.city,
    httpTitle: shodanRawResults.httpTitle,
    sslCertCn: shodanRawResults.sslCertCn,
    rawData: shodanRawResults.rawData,
  })
  .from(shodanRawResults)
  .where(
    and(
      eq(shodanRawResults.processed, false),
      isNotNull(shodanRawResults.extractedDomain)
    )
  )
  .limit(150);

  for (const sr of shodanPending) {
    if (!sr.extractedDomain) continue;
    allDomains.add(sr.extractedDomain);

    // Shodan'dan gelen şirket adı ve şehri önceden kaydet
    await db.insert(leadCandidates).values({
      domain: sr.extractedDomain,
      companyName: sr.org || extractCompanyFromDomain(sr.extractedDomain),
      city: sr.city,
      source: 'shodan_paid',
      sourceData: {
        org: sr.org,
        httpTitle: sr.httpTitle,
        sslCertCn: sr.sslCertCn,
        rawData: sr.rawData,
      },
      // Shodan'dan gelen FortiGate tespiti
      hasFortigate: (
        (sr.httpTitle || '') + JSON.stringify(sr.rawData || {})
      ).toLowerCase().includes('forti'),
      scanStatus: 'pending',
    }).onConflictDoUpdate({
      target: leadCandidates.domain,
      set: {
        companyName: sql`COALESCE(lead_candidates.company_name, excluded.company_name)`,
        city: sql`COALESCE(lead_candidates.city, excluded.city)`,
        hasFortigate: sql`lead_candidates.has_fortigate OR excluded.has_fortigate`,
      },
    });

    // Shodan kaydını işlendi olarak işaretle
    await db.update(shodanRawResults).set({ processed: true })
      .where(eq(shodanRawResults.extractedDomain, sr.extractedDomain));
  }

  logger.info(`Shodan DB'den: ${shodanPending.length}`);

  // ─── KAYNAK 4: Yeniden tarama gereken eskiler ───────────
  // 14+ gün önce taranan ama değişmiş olabilecek domainler
  const staleLeads = await db.select({ domain: leadCandidates.domain })
    .from(leadCandidates)
    .where(
      and(
        eq(leadCandidates.isQualified, true),
        isNull(leadCandidates.teaserSentAt),
        lte(leadCandidates.lastScannedAt,
          new Date(Date.now() - 14 * 86400 * 1000))
      )
    )
    .limit(50);

  staleLeads.forEach(l => allDomains.add(l.domain));
  logger.info(`Yeniden tarama: ${staleLeads.length}`);

  await db.update(nightlyPipelineRuns).set({
    certstreamQueueSize: certstreamQueue.length,
    crtshNewDomains: crtshStale ? 200 : 0,
    shodanNewDomains: shodanPending.length,
  }).where(eq(nightlyPipelineRuns.id, runId));

  return Array.from(allDomains);
}

// Önceliklendirme — hangileri önce işlensin
async function prioritizeDomains(domains: string[]): Promise<string[]> {

  // Zaten müşteri olanları çıkar
  const existingCustomers = await db.select({ domain: customers.domain })
    .from(customers);
  const customerDomains = new Set(existingCustomers.map(c => c.domain));

  // Zaten bu hafta taranmış ve email gönderilmiş olanları çıkar
  const recentlySent = await db.select({ domain: leadCandidates.domain })
    .from(leadCandidates)
    .where(
      and(
        isNotNull(leadCandidates.teaserSentAt),
        gte(leadCandidates.teaserSentAt,
          new Date(Date.now() - 7 * 86400 * 1000))
      )
    );
  const sentDomains = new Set(recentlySent.map(r => r.domain));

  const filtered = domains.filter(d =>
    !customerDomains.has(d) && !sentDomains.has(d)
  );

  // Günlük limit — 200 domain (maliyet kontrolü)
  const DAILY_SCAN_LIMIT = parseInt(
    process.env.DAILY_SCAN_LIMIT || '200'
  );

  return filtered.slice(0, DAILY_SCAN_LIMIT);
}
```

---

## BÖLÜM 4: PARALEL TARAMA

```typescript
// src/pipeline/parallelScanner.ts

const BATCH_SIZE = 5;         // Aynı anda 5 domain
const BATCH_DELAY_MS = 2000;  // Batchler arası 2 sn
const SCAN_TIMEOUT_MS = 45000;

export async function scanInBatches(
  domains: string[],
  runId: number
): Promise<ScanResult[]> {

  const results: ScanResult[] = [];
  const batches = chunk(domains, BATCH_SIZE);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    // 5 taramayı paralel çalıştır
    const batchResults = await Promise.allSettled(
      batch.map(domain => scanWithTimeout(domain, SCAN_TIMEOUT_MS))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);

        // lead_candidates güncelle
        await db.update(leadCandidates).set({
          lastScannedAt: new Date(),
          scanCount: sql`scan_count + 1`,
          nextScanDueAt: new Date(Date.now() + 14 * 86400 * 1000),
          riskScore: result.value.overallScore,
          criticalFindings: result.value.criticalCount,
          findingHighlights: result.value.topFindings,
          pipelineRunId: runId,
        }).where(eq(leadCandidates.domain, result.value.domain));
      }
    }

    // İlerleme logu
    const progress = Math.round(((i + 1) / batches.length) * 100);
    logger.info(`Tarama: %${progress} (${results.length}/${domains.length})`);

    // Rate limit — batchler arası bekle
    if (i < batches.length - 1) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  await db.update(nightlyPipelineRuns).set({
    domainsScanned: results.length,
  }).where(eq(nightlyPipelineRuns.id, runId));

  return results;
}

async function scanWithTimeout(
  domain: string,
  timeoutMs: number
): Promise<ScanResult | null> {
  try {
    return await Promise.race([
      runDomainScan(domain, { mode: 'lead_qualification' }),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      ),
    ]);
  } catch (e) {
    logger.warn(`Tarama timeout: ${domain}`);
    return null;
  }
}
```

---

## BÖLÜM 5: CLAUDE HAİKU KALİFİKASYON

```typescript
// src/pipeline/haikuQualifier.ts
// Tüm AI işlemleri Haiku ile — maliyet: ~$0.0001/karar

const QUALIFICATION_PROMPT = `
Domain güvenlik tarama sonucu. 
Satış değeri var mı?

Domain: {DOMAIN}
Risk Skoru: {SCORE}/100
Kritik Bulgular: {CRITICAL}
Öne Çıkan: {FINDINGS}
Sektör: {SECTOR}
FortiGate: {FORTINET}
WAF: {WAF}
Mail: {MAIL_PROVIDER}
SSL Otorite: {SSL_CA}

JSON yanıt:
{
  "qualified": true/false,
  "score": 0-100,
  "reason": "tek cümle",
  "best_finding": "satış mesajı için en güçlü bulgu",
  "company_size": "small/medium/large",
  "urgency": "high/medium/low"
}

Kural: Minimum 1 kritik bulgu VE risk skoru 40+ ise qualify et.
FortiGate varsa +20 puan. Finans/sağlık sektörü +10 puan.
`;

export async function qualifyWithHaiku(
  scans: ScanResult[],
  runId: number
): Promise<QualifiedLead[]> {

  const qualified: QualifiedLead[] = [];
  let claudeCalls = 0;
  let claudeCost = 0;

  // Önce kural motoru — Haiku'ya gitmeden elenecekler
  const preFiltered = scans.filter(scan => {
    // Kesin red: 1'den az kritik bulgu
    if (scan.criticalCount < 1) return false;
    // Kesin red: Risk skoru 35 altı
    if (scan.overallScore < 35) return false;
    return true;
  });

  logger.info(`Kural motoru filtresi: ${scans.length} → ${preFiltered.length}`);

  // GreyNoise + OTX ön zenginleştirme (batch, ücretsiz)
  // Entegrasyon raporu: GreyNoise community free 1.000/gün
  //                    AlienVault OTX tamamen ücretsiz
  // Bu sinyaller Haiku'nun kalifikasyon kararını güçlendirir
  if (process.env.GREYNOISE_API_KEY || process.env.OTX_API_KEY) {
    for (const scan of preFiltered.slice(0, 50)) {
      // Günlük ilk 50 domain için ek sinyal — limit yönetimi
      try {
        const ip = await resolveToIP(scan.domain);
        if (!ip) continue;

        // GreyNoise: Bu IP internette aktif taranıyor mu?
        if (process.env.GREYNOISE_API_KEY) {
          const gnResp = await axios.get(
            `https://api.greynoise.io/v3/community/${ip}`,
            {
              headers: { key: process.env.GREYNOISE_API_KEY },
              timeout: 4000,
            }
          );
          // classification: 'malicious' | 'benign' | 'unknown'
          // noise: true = internette aktif taranıyor
          if (gnResp.data?.noise === true) {
            scan.greynoiseNoise = true;
            // Aktif taranıyor = daha acil
            scan.urgencyBoost = (scan.urgencyBoost || 0) + 10;
          }
          if (gnResp.data?.classification === 'malicious') {
            scan.greynoiseMailicious = true;
            scan.urgencyBoost = (scan.urgencyBoost || 0) + 25;
          }
        }

        // AlienVault OTX: Tehdit kampanyasında görüldü mü?
        if (process.env.OTX_API_KEY) {
          const otxResp = await axios.get(
            `https://otx.alienvault.com/api/v1/indicators/domain/${scan.domain}/general`,
            {
              headers: { 'X-OTX-API-KEY': process.env.OTX_API_KEY },
              timeout: 4000,
            }
          );
          const pulseCount = otxResp.data?.pulse_info?.count || 0;
          if (pulseCount > 0) {
            scan.otxPulseCount = pulseCount;
            scan.urgencyBoost = (scan.urgencyBoost || 0) +
              Math.min(pulseCount * 5, 20);
            // Max 20 puan boost (çok fazla pulse = zaten bilinen hedef)
          }
        }
      } catch { /* Sinyal servisi başarısız — devam */ }
      await sleep(150); // Rate limit
    }
  }

  // Kalan domainler için Haiku çağrısı
  // Batch processing — API limiti yönetimi
  const HAIKU_BATCH = 20;
  const batches = chunk(preFiltered, HAIKU_BATCH);

  for (const batch of batches) {
    const promises = batch.map(async scan => {
      const prompt = QUALIFICATION_PROMPT
        .replace('{DOMAIN}', scan.domain)
        .replace('{SCORE}', scan.overallScore.toString())
        .replace('{CRITICAL}', scan.criticalCount.toString())
        .replace('{FINDINGS}', scan.topFindings.join(', '))
        .replace('{SECTOR}', scan.sector || 'bilinmiyor')
        .replace('{FORTINET}', scan.hasFortigate ? 'Evet' : 'Hayır')
        .replace('{WAF}', scan.wafProvider || 'Yok')
        .replace('{MAIL_PROVIDER}', scan.mailProvider || 'bilinmiyor')
        .replace('{SSL_CA}', scan.sslCA || 'bilinmiyor');

      try {
        const response = await callClaudeWithCost(prompt, {
          model: 'claude-haiku-4-5',
          maxTokens: 150,
          system: 'Sadece JSON yanıt ver.',
        });

        claudeCalls++;
        claudeCost += response.cost;

        const result = JSON.parse(response.text);
        if (!result.qualified) return null;

        return {
          ...scan,
          qualificationScore: result.score,
          qualificationReason: result.reason,
          bestFinding: result.best_finding,
          companySize: result.company_size,
          urgency: result.urgency,
        };
      } catch {
        // Haiku başarısız → kural motoru karar versin
        return scan.criticalCount >= 2 ? { ...scan, qualificationScore: 60 } : null;
      }
    });

    const results = await Promise.all(promises);
    results.filter(Boolean).forEach(r => qualified.push(r!));
    await sleep(500);
  }

  // Claude maliyet güncelle
  await db.update(nightlyPipelineRuns).set({
    claudeCalls,
    claudeCostUsd: claudeCost,
    domainsQualified: qualified.length,
  }).where(eq(nightlyPipelineRuns.id, runId));

  logger.info(`Haiku kalifikasyon: ${preFiltered.length} → ${qualified.length} (${claudeCalls} çağrı, $${claudeCost.toFixed(4)})`);

  return qualified;
}
```

---

## BÖLÜM 6: KONTAK BULMA (OPTİMİZE)

```typescript
// src/pipeline/contactFinder.ts

// Öncelik sırası — maliyete göre optimum
// 1. DB cache (ücretsiz)
// 2. Hunter.io (ücretli, kaliteli)
// 3. Domain pattern tahmin (ücretsiz, %40 isabet)

export async function findContacts(
  leads: QualifiedLead[],
  runId: number
): Promise<LeadWithContact[]> {

  const DAILY_HUNTER_LIMIT = parseInt(
    process.env.DAILY_HUNTER_LIMIT || '100'
  );
  let hunterUsed = 0;
  const results: LeadWithContact[] = [];

  for (const lead of leads) {
    let contact: ContactInfo | null = null;

    // ─── 1. DB CACHE ───────────────────────────────────────
    const cached = await db.select()
      .from(leadCandidates)
      .where(
        and(
          eq(leadCandidates.domain, lead.domain),
          isNotNull(leadCandidates.contactEmail)
        )
      ).limit(1);

    if (cached[0]?.contactEmail) {
      contact = {
        name: cached[0].contactName,
        title: cached[0].contactTitle,
        email: cached[0].contactEmail,
        confidence: cached[0].contactEmailConfidence || 70,
        source: 'cache',
      };
    }

    // ─── 2. HUNTER.IO (limit dahilinde) ───────────────────
    if (!contact && hunterUsed < DAILY_HUNTER_LIMIT
        && process.env.HUNTER_API_KEY
        && lead.qualificationScore >= 65) {
      // Sadece yüksek kalite leadsler için Hunter harca

      try {
        const hunterResult = await hunterDomainSearch(lead.domain);
        if (hunterResult) {
          contact = hunterResult;
          hunterUsed++;

          // Cache'e kaydet
          await db.update(leadCandidates).set({
            contactName: hunterResult.name,
            contactTitle: hunterResult.title,
            contactEmail: hunterResult.email,
            contactEmailConfidence: hunterResult.confidence,
            contactSource: 'hunter',
          }).where(eq(leadCandidates.domain, lead.domain));
        }
      } catch { /* Hunter başarısız — devam */ }
    }

    // ─── 3. APOLLO.IO FALLBACK (ücretsiz 50/ay) ───────────
    // Hunter bulamadıysa Apollo dene
    // Entegrasyon raporu: apollo.io kod hazır, key yeterli
    if (!contact && process.env.APOLLO_API_KEY) {
      try {
        const apolloResp = await axios.post(
          'https://api.apollo.io/v1/mixed_people/search',
          {
            q_organization_domains: lead.domain,
            person_titles: [
              'IT Director', 'CTO', 'IT Manager',
              'BT Direktörü', 'Bilgi Sistemleri',
              'Information Security', 'Siber Güvenlik',
            ],
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Api-Key': process.env.APOLLO_API_KEY,
            },
            timeout: 8000,
          }
        );

        const person = apolloResp.data?.people?.[0];
        if (person?.email) {
          contact = {
            name: person.name,
            title: person.title,
            email: person.email,
            confidence: 75,
            source: 'apollo',
            linkedinUrl: person.linkedin_url,
          };

          await db.update(leadCandidates).set({
            contactName: person.name,
            contactTitle: person.title,
            contactEmail: person.email,
            contactEmailConfidence: 75,
            contactLinkedinUrl: person.linkedin_url,
            contactSource: 'apollo',
          }).where(eq(leadCandidates.domain, lead.domain));
        }
      } catch { /* Apollo başarısız — devam */ }
    }

    // ─── 4. PATTERN TAHMİN (ücretsiz fallback) ────────────
    if (!contact) {
      // info@ veya iletisim@ gibi genel adresler
      // Düşük güven ama sıfır maliyet
      contact = {
        name: '',
        title: 'BT Sorumlusu',
        email: `info@${lead.domain}`,
        confidence: 25,
        source: 'pattern_guess',
      };
    }

    results.push({ ...lead, contact });
  }

  // Kontak istatistiklerini güncelle
  await db.update(nightlyPipelineRuns).set({
    contactsFound: results.filter(r =>
      r.contact.confidence >= 50).length,
    hunterCalls: hunterUsed,
    hunterCostUsd: hunterUsed * 0.034,
    // $34/ay ÷ 1000 lookup = $0.034/lookup
  }).where(eq(nightlyPipelineRuns.id, runId));

  return results;
}

async function hunterDomainSearch(
  domain: string
): Promise<ContactInfo | null> {
  const response = await axios.get(
    'https://api.hunter.io/v2/domain-search',
    {
      params: {
        domain,
        api_key: process.env.HUNTER_API_KEY,
        limit: 5,
        type: 'personal',
      },
      timeout: 8000,
    }
  );

  const emails = response.data.data?.emails || [];
  if (emails.length === 0) return null;

  // IT/güvenlik unvanlı kişiyi öncelikle bul
  const priorityTitles = [
    'it', 'bilgi', 'güvenlik', 'security', 'cto',
    'technology', 'teknik', 'sistem', 'network',
  ];

  const best = emails.find(e => {
    const title = (e.position || '').toLowerCase();
    return priorityTitles.some(t => title.includes(t));
  }) || emails[0];

  return {
    name: `${best.first_name} ${best.last_name}`.trim(),
    title: best.position || '',
    email: best.value,
    confidence: best.confidence,
    source: 'hunter',
  };
}
```

---

## BÖLÜM 7: CLAUDE HAİKU EMAIL ÜRETME

```typescript
// src/pipeline/emailGenerator.ts
// Haiku ile kısa, kişisel, veri destekli email

const EMAIL_PROMPT = `
Türk şirketine kısa güvenlik bildirimi e-postası.
SATIŞÇI DEĞİL, analist bakışı.
Maksimum 120 kelime.

Şirket: {COMPANY}
Domain: {DOMAIN}
Kişi: {CONTACT_NAME} ({CONTACT_TITLE})
En güçlü bulgu: {BEST_FINDING}
Risk skoru: {SCORE}/100
Sektör: {SECTOR}
FortiGate var mı: {FORTINET}
WAF: {WAF}
Aciliyet: {URGENCY}

Çıktı formatı:
KONU: [50 karakter konu]
---
[E-posta gövdesi]

Kurallar:
- İsimle hitap et (varsa)
- 1 spesifik teknik bulgu belirt
- Sektöre özel 1 cümle risk bağlamı
- "Ücretsiz tam rapor" CTA
- Imza: [İmza ile biten]
- ASLA "satın alın", "fiyatımız" yazma
`;

export async function generateEmails(
  leads: LeadWithContact[],
  runId: number
): Promise<LeadWithEmail[]> {

  const results: LeadWithEmail[] = [];
  let emailsGenerated = 0;

  for (const lead of leads) {
    try {
      const companyName = lead.companyName ||
        extractCompanyFromDomain(lead.domain);

      const prompt = EMAIL_PROMPT
        .replace('{COMPANY}', companyName)
        .replace('{DOMAIN}', lead.domain)
        .replace('{CONTACT_NAME}',
          lead.contact.name?.split(' ')[0] || 'Merhaba')
        .replace('{CONTACT_TITLE}', lead.contact.title || '')
        .replace('{BEST_FINDING}', lead.bestFinding || '')
        .replace('{SCORE}', lead.riskScore.toString())
        .replace('{SECTOR}', lead.sector || 'teknoloji')
        .replace('{FORTINET}', lead.hasFortigate ? 'Evet' : 'Hayır')
        .replace('{WAF}', lead.wafProvider || 'Yok')
        .replace('{URGENCY}', lead.urgency || 'medium');

      const response = await callClaude(prompt, {
        model: 'claude-haiku-4-5',
        maxTokens: 300,
        system: 'Türkçe güvenlik bildirimi yaz.',
      });

      // Konu ve gövdeyi ayır
      const lines = response.split('\n');
      const subjectLine = lines.find(l => l.startsWith('KONU:'));
      const subject = subjectLine?.replace('KONU:', '').trim() || '';
      const body = lines.slice(
        lines.indexOf('---') + 1
      ).join('\n').trim();

      // Email preview token oluştur
      const teaserToken = generateSecureToken(32);

      // DB'ye kaydet
      await db.update(leadCandidates).set({
        teaserEmailSubject: subject,
        teaserEmailBody: body,
        teaserToken,
      }).where(eq(leadCandidates.domain, lead.domain));

      results.push({ ...lead, emailSubject: subject, emailBody: body, teaserToken });
      emailsGenerated++;

    } catch (e) {
      logger.warn(`Email üretme hatası: ${lead.domain}`);
    }

    await sleep(100); // Haiku rate limit
  }

  await db.update(nightlyPipelineRuns).set({
    emailsGenerated,
  }).where(eq(nightlyPipelineRuns.id, runId));

  return results;
}
```

---

## BÖLÜM 8: GÜNLÜK ISR LİSTESİ

```typescript
// src/pipeline/dailyListBuilder.ts

export async function buildDailyList(
  leads: LeadWithEmail[],
  date: string
): Promise<number> {

  // Öncelik skoru hesapla
  const scored = leads.map(lead => {
    let score = lead.riskScore || 50;

    // Ağırlıklar
    if (lead.hasFortigate) score += 20;
    if (lead.urgency === 'high') score += 15;
    if (lead.urgency === 'medium') score += 5;
    if (['finans', 'saglik'].includes(lead.sector || '')) score += 10;
    if (lead.qualificationScore > 80) score += 10;
    if (lead.contact.confidence >= 70) score += 10;
    // Hunter.io bulunan kontak daha değerli
    if (lead.contact.source === 'hunter') score += 15;
    if (lead.contact.source === 'cache') score += 10;

    return { ...lead, priorityScore: score };
  });

  // Skora göre sırala
  scored.sort((a, b) => b.priorityScore - a.priorityScore);

  // Günlük listeye ekle
  const tasks = scored.map(lead => ({
    runDate: date,
    leadCandidateId: lead.leadCandidateId,
    priorityScore: lead.priorityScore,

    // Kontak bilgisi
    contactStatus: lead.contact.confidence >= 50
      ? 'ready'      // Email var, gönderilmeye hazır
      : 'needs_linkedin', // Email yok, LinkedIn'e bak

    contactName: lead.contact.name,
    contactTitle: lead.contact.title,
    contactEmail: lead.contact.confidence >= 50
      ? lead.contact.email : null,
    contactEmailConfidence: lead.contact.confidence,

    // Email taslağı
    emailSubject: lead.emailSubject,
    emailBody: lead.emailBody,
  }));

  await db.insert(dailyIsrTasks)
    .values(tasks)
    .onConflictDoNothing();

  return tasks.length;
}
```

---

## BÖLÜM 9: SABAH BRİFİNGİ

```typescript
// src/pipeline/morningBriefing.ts

export async function sendMorningBriefing(
  date: string,
  listSize: number,
  costs: CostSummary
): Promise<void> {

  const tasks = await db.select()
    .from(dailyIsrTasks)
    .where(eq(dailyIsrTasks.runDate, date));

  const ready = tasks.filter(t => t.contactStatus === 'ready').length;
  const needsLinkedin = tasks.filter(
    t => t.contactStatus === 'needs_linkedin').length;

  // Sektör dağılımı
  const sectors = tasks.reduce((acc, t) => {
    // sector bilgisini lead'den al
    return acc;
  }, {} as Record<string, number>);

  const briefingHtml = `
    <h2>🌅 CyberStep Sabah Brifing — ${date}</h2>

    <h3>📋 Günlük Liste</h3>
    <table>
      <tr><td>Toplam Lead</td><td><b>${listSize}</b></td></tr>
      <tr><td>Email Hazır → Gönder</td>
          <td><b style="color:green">${ready}</b></td></tr>
      <tr><td>LinkedIn Gerekiyor</td>
          <td><b style="color:orange">${needsLinkedin}</b></td></tr>
    </table>

    <h3>💰 Gece Maliyeti</h3>
    <table>
      <tr><td>Claude Haiku</td>
          <td>${costs.claudeCalls} çağrı —
          $${costs.claudeCost.toFixed(3)}</td></tr>
      <tr><td>Hunter.io</td>
          <td>${costs.hunterCalls} lookup —
          $${costs.hunterCost.toFixed(2)}</td></tr>
      <tr><td><b>Toplam</b></td>
          <td><b>$${costs.totalCost.toFixed(2)}</b></td></tr>
    </table>

    <p>
      <a href="${process.env.BASE_URL}/admin-panel/isr/daily">
        → Günlük Listeyi Aç
      </a>
    </p>
  `;

  await sendEmail({
    to: process.env.ISR_TEAM_EMAIL!,
    subject: `🌅 ${date} — ${ready} email hazır, ${needsLinkedin} LinkedIn bekliyor`,
    html: briefingHtml,
    from: 'pipeline@cyberstep.io',
  });
}
```

---

## BÖLÜM 10: ISR DASHBOARD

```
/admin-panel/isr/daily

─── BUGÜNÜN LİSTESİ ─────────────────────────────────────────
3 Haziran 2026 | 47 lead hazır | 18 LinkedIn bekliyor

Filtreler: [Tümü] [Email Hazır] [LinkedIn Gerek] [Gönderildi]
Sektör: [Tümü ▾]  Skor: [60+ ▾]  Fortinet: [Tümü ▾]

─── LİSTE ───────────────────────────────────────────────────
Skor  Domain           Şirket        Kontak          Durum
────────────────────────────────────────────────────────────
 94   acme.com.tr      Acme A.Ş.     Ahmet Y. / CTO  ✅ Hazır
                       Risk:82 🔴     hunter.io %89

  [Email Önizle ▾]  [Düzenle]  [GÖNDER →]  [Atla]

  ┌─────────────────────────────────────────────┐
  │ Konu: acme.com.tr — Kritik güvenlik bulgusu │
  │                                             │
  │ Merhaba Ahmet Bey,                          │
  │                                             │
  │ acme.com.tr'yi rutin taramalarımızda        │
  │ inceledik. FortiGate'inizin arkasında iki   │
  │ kritik bulgu tespit ettik...                │
  │                                             │
  │ [Devamını Gör]                              │
  └─────────────────────────────────────────────┘

 87   beta.net.tr       Beta Ltd.     Bulunamadı      ⚠️ LinkedIn
                        Risk:74 🟡    needs_linkedin

  [LinkedIn'de Ara →]  [Kontak Gir]  [Atla]

  LinkedIn araması için:
  "BT Direktörü Beta" veya "IT Manager beta.net.tr"

─── TOPLU AKSİYONLAR ────────────────────────────────────────
[Tüm Hazır Olanları Gönder (47)]  ← Onay sonrası gönderir
Günlük limit: 50 email | Bugün gönderilen: 0/50
```

---

## BÖLÜM 11: TEK TIKLA EMAIL GÖNDERME

```typescript
// POST /api/admin/isr/send/:taskId
router.post('/send/:taskId', requireAdmin, async (req, res) => {

  const task = await getDailyTask(req.params.taskId);

  if (task.contactStatus !== 'ready' || !task.contactEmail) {
    return res.status(400).json({ error: 'Kontak bilgisi eksik' });
  }

  // Günlük limit kontrolü
  const todaySent = await getTodaySentCount();
  const dailyLimit = parseInt(process.env.DAILY_EMAIL_LIMIT || '50');

  if (todaySent >= dailyLimit) {
    return res.status(429).json({
      error: `Günlük limit (${dailyLimit}) doldu. Yarın devam.`
    });
  }

  // Email HTML oluştur
  const htmlBody = buildProspectEmailHTML({
    body: task.emailBody,
    domain: task.leadCandidate.domain,
    previewUrl: `${BASE_URL}/preview/${task.leadCandidate.teaserToken}`,
    riskScore: task.leadCandidate.riskScore,
    criticalCount: task.leadCandidate.criticalFindings,
  });

  // Gönder
  await sendEmail({
    to: task.contactEmail,
    subject: task.emailSubject,
    html: htmlBody,
    from: 'security@cyberstep.io',
    fromName: 'CyberStep Güvenlik',
    replyTo: process.env.ISR_REPLY_EMAIL,
    trackOpen: true,
    trackClick: true,
  });

  // Durum güncelle
  await db.update(dailyIsrTasks).set({
    contactStatus: 'sent',
    sentAt: new Date(),
  }).where(eq(dailyIsrTasks.id, task.id));

  // ISR pipeline log
  await logISRActivity(task.leadCandidateId, {
    type: 'email_sent',
    description: `${task.contactEmail} → ${task.emailSubject}`,
    performedBy: req.user.userId,
  });

  res.json({ success: true, sentTo: task.contactEmail });
});
```

---

## BÖLÜM 12: CRON JOB'LAR

```typescript
// ─── GECE PİPELİNE ───────────────────────────────────────
// Her gece 02:00 — Ana pipeline
// crt.sh + Certstream + Shodan DB → tara → qualify → email
cron.schedule('0 2 * * *', async () => {
  logger.info('Gece pipeline başlıyor...');
  await runNightlyPipeline();
});

// ─── SHODAN HAFTALIK BATCH ($69 PLAN — 100 CREDIT/AY) ────
// Pazartesi 01:00 — SSL sertifika sorguları
// Bu sorgu: .com.tr + .net.tr → yeni kurumsal domainler
cron.schedule('0 1 * * 1', async () => {
  if (!process.env.SHODAN_API_KEY) return;
  logger.info('Shodan Pazartesi batch başlıyor...');

  // Query 1: .com.tr SSL sertifikaları (1 credit = 100 sonuç)
  await scanShodanQuery(
    'ssl.cert.subject.cn:*.com.tr country:TR',
    'tr_comtr_ssl', 100
  );
  await sleep(3000);

  // Query 2: .net.tr SSL sertifikaları
  await scanShodanQuery(
    'ssl.cert.subject.cn:*.net.tr country:TR',
    'tr_nettr_ssl', 100
  );

  logger.info('Shodan Pazartesi batch tamamlandı (2 credit harcandı)');
});

// Perşembe 01:00 — Kurumsal ürün sorguları
// Bu sorgu: FortiGate + ERP → yüksek değer leadler
cron.schedule('0 1 * * 4', async () => {
  if (!process.env.SHODAN_API_KEY) return;
  logger.info('Shodan Perşembe batch başlıyor...');

  // Query 3: FortiGate — En değerli lead kaynağı
  // 1 FortiGate lead → SOC+NOC Standart → 12.900 TL/ay
  await scanShodanQuery(
    '"FortiGate" country:TR port:443',
    'tr_fortigate', 100
  );
  await sleep(3000);

  // Query 4: ERP sistemleri — Kurumsal bütçe göstergesi
  await scanShodanQuery(
    'country:TR http.title:"ERP" port:443',
    'tr_erp', 100
  );

  logger.info('Shodan Perşembe batch tamamlandı (2 credit harcandı)');
});

// ─── SHODAN AYLIK ÖZEL SORGULAR (ayın 1'i 01:30) ─────────
// Acil risk ve kurumsal hedefler — 18 credit/ay
cron.schedule('30 1 1 * *', async () => {
  if (!process.env.SHODAN_API_KEY) return;
  logger.info('Shodan aylık özel sorgular başlıyor...');

  const monthlyQueries = [
    // ACİL LEADLER — Kritik açık port → En hızlı satış
    {
      query: 'country:TR port:3389',
      label: 'tr_rdp_open',
      note: 'RDP açık = Ransomware riski = acil lead',
      urgency: 'critical',
    },
    {
      query: 'country:TR port:27017',
      label: 'tr_mongodb_open',
      note: 'MongoDB açık = Veri sızıntısı riski',
      urgency: 'critical',
    },
    // KURUMSAL HEDEFLER — Yüksek bütçe göstergesi
    {
      query: 'country:TR "Outlook Web" http.title',
      label: 'tr_outlook_web',
      note: 'Microsoft 365 kullanıcısı = M365 SOC upsell',
      urgency: 'high',
    },
    {
      query: 'country:TR product:"FortiGate"',
      label: 'tr_fortigate_product',
      note: 'FortiGate product field = daha kesin tespit',
      urgency: 'high',
    },
    {
      query: 'country:TR "Fortinet" ssl.cert.subject.o:*',
      label: 'tr_fortinet_cert',
      note: 'SSL sertifikasında Fortinet = doğrudan müşteri',
      urgency: 'high',
    },
    {
      query: 'country:TR http.title:"SAP" port:443',
      label: 'tr_sap',
      note: 'SAP = büyük kurumsal bütçe = SOC Pro hedef',
      urgency: 'medium',
    },
    {
      query: 'country:TR "VMware vSphere" http.title',
      label: 'tr_vmware',
      note: 'VMware = geniş altyapı = NOC satışı',
      urgency: 'medium',
    },
    {
      query: 'country:TR "Cisco ASA" port:443',
      label: 'tr_cisco_asa',
      note: 'Cisco firewall = güvenlik bilinçli şirket',
      urgency: 'medium',
    },
  ];

  for (const q of monthlyQueries) {
    await scanShodanQuery(q.query, q.label, 100, q.urgency);
    await sleep(2000);
    logger.info(`Shodan sorgu tamamlandı: ${q.label}`);
  }

  // Ay sonu credit raporu
  const creditsUsed = await getShodanCreditUsage();
  logger.info(`Shodan ay sonu: ${creditsUsed}/100 credit kullanıldı`);

  if (creditsUsed < 70) {
    logger.info('70 altı credit kaldı — tampon sorguları çalıştır');
    // Kalan creditler için ek sorgular
    await scanShodanQuery(
      'country:TR port:3306',  // MySQL açık
      'tr_mysql_open', 100, 'critical'
    );
    await scanShodanQuery(
      'country:TR port:6379',  // Redis açık
      'tr_redis_open', 100, 'critical'
    );
  }

  logger.info('Shodan aylık özel sorgular tamamlandı');
});

// ─── ACİL CVE SHODAN TARAMASI ─────────────────────────────
// CVE sistemi tetikler — etkilenen ürünler Shodan'da aranır
// Bu fonksiyon cveOrchestrator.ts'den çağrılır, cron değil
export async function shodanCVEScan(
  affectedProduct: string,
  cveId: string
): Promise<void> {
  if (!process.env.SHODAN_API_KEY) return;

  // Credit kontrolü — ayda 10'dan fazla CVE taraması yapma
  const cveScansThisMonth = await getCVEScanCount();
  if (cveScansThisMonth >= 10) {
    logger.warn('CVE Shodan tarama limiti doldu (10/ay)');
    return;
  }

  const query = `country:TR "${affectedProduct}"`;
  await scanShodanQuery(query, `cve_${cveId}`, 100, 'critical');
  logger.info(`CVE Shodan taraması: ${cveId} — ${affectedProduct}`);
}

// ─── SHODAN KREDİ YÖNETİCİSİ ─────────────────────────────
async function scanShodanQuery(
  query: string,
  label: string,
  maxResults: number = 100,
  urgency: string = 'medium'
): Promise<void> {

  // Credit takip tablosuna kaydet
  await db.insert(shodanCreditLog).values({
    query,
    label,
    creditsUsed: 1,
    urgency,
    runAt: new Date(),
  });

  // Mevcut scanShodanFree fonksiyonunu çağır
  // (query string ile — index yerine)
  await scanShodanByQuery(query, label, maxResults);

  // Açık port sorgularına acil flag ekle
  if (['tr_rdp_open', 'tr_mongodb_open',
       'tr_mysql_open', 'tr_redis_open'].includes(label)) {
    await flagOpenPortLeadsAsUrgent(label);
  }
}

// Shodan credit log tablosu (DB migration'a ekle):
// CREATE TABLE IF NOT EXISTS shodan_credit_log (
//   id serial PRIMARY KEY,
//   query varchar(500),
//   label varchar(100),
//   credits_used integer DEFAULT 1,
//   results_count integer,
//   urgency varchar(20),
//   run_at timestamp DEFAULT now()
// );

// ─── DİĞER CRONLAR ───────────────────────────────────────
// Her gece 04:30 — Certstream kuyruğunu temizle
cron.schedule('30 4 * * *', async () => {
  await cleanupCertstreamQueue();
});

// Her ayın 1'i 06:00 — Aylık istihbarat raporu
cron.schedule('0 6 1 * *', async () => {
  await generateMonthlyReport('TR',
    new Date().getFullYear(),
    new Date().getMonth() + 1
  );
});
```

---

## BÖLÜM 13: 1 AYLIK VERİ → OTORİTE DUYURUSU

```typescript
// Her ayın 5'i — LinkedIn + bülten içeriği hazırla
cron.schedule('0 9 5 * *', async () => {

  // 1 ay yeterli veri var mı?
  const totalScans = await getTotalScanCount();
  if (totalScans < 500) {
    logger.info('Henüz yeterli veri yok (min 500 domain)');
    return;
  }

  // Veriyi özetle
  const insights = await generateMonthlyInsights();

  // LinkedIn paylaşım taslağı
  const linkedinPost = await generateLinkedInPost(insights);

  // Bülten taslağı
  const bulletin = await generateWeeklyBulletin();

  // Admin'e bildir
  await sendAdminNotification(
    '📊 Aylık Veri Hazır — Paylaşıma Hazır',
    `${totalScans} domain verisi birikte.\n
     LinkedIn post taslağı hazır.\n
     Onay için: /admin-panel/intelligence`
  );
});
```

---

## BÖLÜM 14: ENVIRONMENT VARIABLES

```bash
# Pipeline limitleri
DAILY_SCAN_LIMIT=200         # Günlük max domain tarama
DAILY_EMAIL_LIMIT=50         # Günlük max email gönderimi
DAILY_HUNTER_LIMIT=100       # Günlük max Hunter.io lookup
MIN_QUALIFICATION_SCORE=60   # Min kalifikasyon skoru

# Kontak bulma (öncelik sırası: Hunter → Apollo → Pattern)
HUNTER_API_KEY=              # hunter.io Starter $34/ay (500 lookup)
APOLLO_API_KEY=              # apollo.io Free tier — 50 kişi/ay
                             # Hunter bulamazsa otomatik devreye girer

# Shodan
SHODAN_API_KEY=              # Freelancer $69/ay — ZORUNLU
                             # Ücretsiz plan .tr sorgularını desteklemez
SHODAN_MONTHLY_CREDIT_LIMIT=100
SHODAN_CVE_SCAN_LIMIT=10

# Kalifikasyon sinyalleri (ücretsiz, mevcut sistemde kod hazır)
GREYNOISE_API_KEY=           # Community free 1.000/gün
                             # Aktif taranıyor / malicious IP tespiti
                             # Olmadan da çalışır — urgency boost kaynağı
OTX_API_KEY=                 # AlienVault OTX — tamamen ücretsiz
                             # Tehdit kampanyası bağlantısı
                             # account.alienvault.com → API key al

# Email gönderim
ISR_TEAM_EMAIL=              # Sabah brifing gidecek adres
ISR_REPLY_EMAIL=             # Prospekt yanıt verecek adres
POSTMARK_API_KEY=            # Email gönderim

# ISR IMAP (mevcut sistemde aktif)
# Gece pipeline'ından gönderilen teaserlara gelen yanıtlar
# ISR IMAP tarafından 5 dakikada bir okunuyor
# Gemini AI otomatik yanıt üretiyor
# Pipeline'ın bunu bilmesi gerekiyor — yanıt gelirse
# daily_isr_tasks'ta contactStatus = 'replied' olarak işaretle
ISR_IMAP_HOST=               # Zaten ayarlanmış
ISR_IMAP_USER=               # Zaten ayarlanmış

# LinkedIn Sales Navigator (Manuel - API yok)
# ISR "needs_linkedin" durumunu görünce
# LinkedIn'de manuel arama yapıyor
# Bulduğu kişiyi sisteme giriyor
```

---

## MALİYET OPTİMİZASYON ÖZETİ

```
Model seçimi:
  Tüm AI işlemleri → claude-haiku-4-5
  Qualification: 150 token output → $0.0001/çağrı
  Email üretim: 300 token output  → $0.0003/çağrı
  Günlük ~400 çağrı              → $0.10/gün = $3/ay

Hunter.io plan seçimi:
  Starter $49/ay → 500 lookup/ay → yeterli başlangıç
  27 lookup/gün (günlük limit olarak ayarla)

Shodan credit dağılımı (100/ay):
  Haftalık batch (Pzt+Per):  4 × 2 = 16 credit
  Aylık özel sorgular:       8 credit
  CVE acil taramalar:        max 10 credit
  Tampon:                    ~66 credit
  → 1 credit = 100 sonuç = 100 potansiyel lead
  → En değerli credit: FortiGate + RDP açık sorguları

Email gönderim ramping:
  Hafta 1: 20/gün  (domain reputation kur)
  Hafta 2: 35/gün
  Hafta 3+: 50/gün
  Ay 2+:  100/gün

Toplam aylık maliyet:
  Shodan Freelancer: $69
  Hunter.io Starter: $34
  Claude Haiku:       $4
  Postmark:          $10
  Server (Replit):   $20
  ──────────────────────
  TOPLAM:           $152/ay ≈ 4.600 TL/ay

ROI hesabı (muhafazakar):
  Aylık email: ~800 (günlük 27)
  %1 dönüşüm → 8 satış
  Ortalama: Tam Değerlendirme 5.990 TL
  Gelir: 8 × 5.990 = 47.920 TL/ay
  ROI: 47.920 / 4.600 = 10.4x

  1 SOC Standart satışı (8.500 TL/ay × 12 ay):
  = 102.000 TL LTV / 4.600 TL aylık maliyet = 22x
```

---

## TEST SENARYOSU

```
1. Shodan API bağlantı testi:
   POST /api/admin/shodan/test
   → {"status": "ok", "plan": "freelancer",
      "credits_remaining": 94}

2. Manuel Shodan sorgusu tetikle:
   POST /api/admin/shodan/run-query
   Body: { query: "FortiGate" country:TR port:443",
           label: "test_fortigate" }
   → shodan_raw_results tablosuna kayıt düştü mü?
   → lead_candidates tablosuna eklendi mi?

3. Açık port testi (acil lead):
   POST /api/admin/shodan/run-query
   Body: { query: "country:TR port:3389",
           label: "test_rdp" }
   → has_fortinet: false ama urgency: critical
   → Sabah listesinde en üste çıkıyor mu?

4. Ana pipeline manuel tetikle:
   POST /api/admin/pipeline/run-now
   10 dakika bekle, kontrol et:
   → domains_scanned: 10-50
   → shodan_new_domains: >0 (Shodan DB'de kayıt varsa)
   → domains_qualified: 3-15
   → contacts_found: 2-10
   → emails_generated: 2-10

5. ISR dashboard kontrol:
   /admin-panel/isr/daily
   → FortiGate olanlar en üstte mi?
   → RDP açık olanlar "🔴 ACİL" işaretli mi?
   → Email önizlemesi açılıyor mu?
   → GÖNDER butonu çalışıyor mu?

6. Shodan credit takibi:
   GET /api/admin/shodan/credit-usage
   → Bu ay kullanılan: X/100
   → Sorgu geçmişi listesi
   → Kalan tahmini ömür: X gün

7. Sabah brifing e-postası:
   → ISR_TEAM_EMAIL'e geldi mi?
   → Shodan kaynağından gelen lead sayısı var mı?
   → FortiGate lead'leri ayrıca vurgulanıyor mu?
```

---

*CyberStep.io — Gece Lead Fabrikası — 2026*
