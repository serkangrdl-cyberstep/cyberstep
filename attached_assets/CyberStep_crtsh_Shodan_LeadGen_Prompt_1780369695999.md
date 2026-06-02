# CyberStep.io — crt.sh + Shodan Ücretsiz Lead Keşfi
## Replit Agent Promptu — API Key Olmadan İlk 50 Müşteri

---

## MANTIK

```
crt.sh (Sertifika Şeffaflığı Logları)        Shodan Ücretsiz
  ↓                                              ↓
Türkiye SSL sertifikalarını çek           TR şirket sunucularını bul
  ↓                                              ↓
login., portal., erp. filtrele            SSL cert + org verisi çıkar
  ↓                                              ↓
            Root domain çıkar + deduplikasyon
                        ↓
                 CyberStep domain tarama
                        ↓
               Kalifikasyon (min 1 kritik)
                        ↓
              Hunter.io ile iletişim bul
                        ↓
             Claude teaser e-posta üret
                        ↓
              Admin onay → gönder
```

**Neden crt.sh güçlü:**
SSL sertifikası olan her şirket burada kayıtlı.
login.acme.com.tr varsa → Kurumsal sistemi var, 50+ çalışan.
erp.acme.com.tr varsa → IT bütçesi var.
vpn.acme.com.tr varsa → Uzak çalışma altyapısı → güvenlik ihtiyacı var.
Ücretsiz, API key gerektirmez, saniyede yüzlerce domain.

**Neden Shodan ücretsiz değerli:**
Şirketin web sunucusu hakkında SSL sertifika organizasyonu,
şehir gibi ek veri sağlıyor.
Ücretsiz API key: 100 sonuç/arama.
account.shodan.io → Register → Free tier → API key al (2 dakika).

---

## BÖLÜM 1: VERİTABANI

```sql
CREATE TABLE IF NOT EXISTS crtsh_discovery_runs (
  id serial PRIMARY KEY,
  query varchar(255) NOT NULL,
  status varchar(20) DEFAULT 'running',
  certs_fetched integer DEFAULT 0,
  domains_extracted integer DEFAULT 0,
  domains_filtered integer DEFAULT 0,
  started_at timestamp DEFAULT now(),
  completed_at timestamp
);

CREATE TABLE IF NOT EXISTS crtsh_certificates (
  id bigserial PRIMARY KEY,
  discovery_run_id integer REFERENCES crtsh_discovery_runs(id),
  cert_id bigint,
  common_name varchar(500),
  name_value text,
  issuer_name varchar(500),
  not_before timestamp,
  not_after timestamp,
  entry_timestamp timestamp,
  root_domain varchar(255),
  subdomain_type varchar(50),
  -- 'enterprise' | 'mail' | 'vpn' | 'api' | 'generic'
  corporate_score integer DEFAULT 0,
  processed boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shodan_raw_results (
  id serial PRIMARY KEY,
  discovery_run_id integer REFERENCES lead_discovery_runs(id),
  ip_str varchar(50),
  hostnames text[],
  domains text[],
  org varchar(255),
  isp varchar(255),
  city varchar(100),
  region_code varchar(10),
  port integer,
  ssl_cert_cn varchar(500),
  ssl_cert_org varchar(500),
  ssl_cert_not_after timestamp,
  http_title varchar(500),
  http_status integer,
  extracted_domain varchar(255),
  raw_data jsonb,
  processed boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);

-- Subdomain kurumsal skor kuralları
CREATE TABLE IF NOT EXISTS subdomain_scoring_rules (
  id serial PRIMARY KEY,
  pattern varchar(100) UNIQUE NOT NULL,
  corporate_score integer NOT NULL,
  subdomain_type varchar(50),
  description varchar(255),
  is_active boolean DEFAULT true
);

INSERT INTO subdomain_scoring_rules
  (pattern, corporate_score, subdomain_type, description)
VALUES
  ('erp',       95, 'enterprise', 'SAP/Oracle ERP sistemi'),
  ('crm',       90, 'enterprise', 'CRM platformu'),
  ('sap',       95, 'enterprise', 'SAP sistemi'),
  ('portal',    85, 'enterprise', 'Kurumsal portal'),
  ('intranet',  85, 'enterprise', 'İç ağ portalı'),
  ('login',     80, 'enterprise', 'Kimlik doğrulama sistemi'),
  ('sso',       85, 'enterprise', 'Single Sign-On'),
  ('vpn',       80, 'security',   'VPN altyapısı'),
  ('remote',    75, 'security',   'Uzak erişim'),
  ('firewall',  85, 'security',   'Güvenlik duvarı'),
  ('mail',      60, 'mail',       'Kurumsal e-posta'),
  ('webmail',   60, 'mail',       'Web posta'),
  ('exchange',  70, 'mail',       'Microsoft Exchange'),
  ('api',       65, 'api',        'API gateway'),
  ('gateway',   65, 'api',        'Ödeme gateway'),
  ('monitor',   70, 'infra',      'İzleme sistemi'),
  ('backup',    65, 'infra',      'Yedekleme sistemi'),
  ('pos',       80, 'commerce',   'POS sistemi'),
  ('payment',   85, 'commerce',   'Ödeme sistemi'),
  ('www',       10, 'generic',    'Ana web sitesi')
ON CONFLICT (pattern) DO NOTHING;
```

---

## BÖLÜM 2: crt.sh TARAYICI

```typescript
// src/leadDiscovery/crtshScanner.ts

const CRTSH_BASE = 'https://crt.sh';

const EXCLUDED_DOMAINS = new Set([
  'cloudflare.com', 'amazonaws.com', 'azure.com',
  'google.com', 'microsoft.com', 'github.io',
  'netlify.app', 'vercel.app', 'letsencrypt.org',
  'fastly.net', 'akamai.net',
]);

export async function scanCRTSH(
  query: string = '%.com.tr',
  options: {
    daysBack?: number;
    minCorporateScore?: number;
    limit?: number;
  } = {}
): Promise<CRTSHScanResult> {

  const {
    daysBack = 30,
    minCorporateScore = 60,
    limit = 500,
  } = options;

  const [run] = await db.insert(crtshDiscoveryRuns).values({
    query, status: 'running',
  }).returning();

  try {
    // crt.sh public API — key gereksiz
    const response = await axios.get(`${CRTSH_BASE}/`, {
      params: { q: query, output: 'json' },
      timeout: 30000,
      headers: { 'User-Agent': 'CyberStep-SecurityResearch/1.0' },
    });

    const certs: any[] = response.data || [];
    const cutoff = new Date(Date.now() - daysBack * 86400000);
    const qualifiedDomains = new Map<string, any>();

    for (const cert of certs) {
      if (new Date(cert.entry_timestamp) < cutoff) continue;
      if (qualifiedDomains.size >= limit) break;

      const domains = extractDomainsFromCert(cert);

      for (const domain of domains) {
        if (isExcluded(domain)) continue;
        if (!isTurkishDomain(domain)) continue;

        const analysis = analyzeSubdomain(domain);
        if (!analysis.rootDomain) continue;
        if (analysis.corporateScore < minCorporateScore) continue;

        const existing = qualifiedDomains.get(analysis.rootDomain);
        if (!existing || analysis.corporateScore > existing.score) {
          qualifiedDomains.set(analysis.rootDomain, {
            rootDomain: analysis.rootDomain,
            triggerSubdomain: domain,
            subdomainType: analysis.subdomainType,
            score: analysis.corporateScore,
            certIssuer: cert.issuer_name,
            entryDate: new Date(cert.entry_timestamp),
          });
        }
      }
    }

    // lead_candidates tablosuna ekle
    let added = 0;
    for (const [domain, data] of qualifiedDomains) {
      const inserted = await db.insert(leadCandidates).values({
        domain,
        source: 'crtsh',
        sourceData: {
          triggerSubdomain: data.triggerSubdomain,
          subdomainType: data.subdomainType,
          corporateScore: data.score,
          certIssuer: data.certIssuer,
          entryDate: data.entryDate,
        },
        scanStatus: 'pending',
      }).onConflictDoNothing().returning();

      if (inserted.length > 0) added++;
    }

    await db.update(crtshDiscoveryRuns).set({
      status: 'completed',
      certsFound: certs.length,
      domainsExtracted: qualifiedDomains.size,
      completedAt: new Date(),
    }).where(eq(crtshDiscoveryRuns.id, run.id));

    return { runId: run.id, certsScanned: certs.length,
             domainsFound: qualifiedDomains.size, addedToLeads: added };

  } catch (error) {
    await db.update(crtshDiscoveryRuns).set({ status: 'failed' })
      .where(eq(crtshDiscoveryRuns.id, run.id));
    throw error;
  }
}

function extractDomainsFromCert(cert: any): string[] {
  const domains = new Set<string>();
  if (cert.common_name) domains.add(cert.common_name.toLowerCase());
  if (cert.name_value) {
    cert.name_value.split('\n')
      .map((d: string) => d.trim().toLowerCase())
      .filter((d: string) => d && !d.startsWith('*'))
      .forEach((d: string) => domains.add(d));
  }
  return Array.from(domains);
}

function analyzeSubdomain(domain: string) {
  const clean = domain.replace(/^\*\./, '').toLowerCase();
  const parts = clean.split('.');

  // Root domain
  let rootDomain: string;
  if (parts[parts.length - 1] === 'tr' && parts.length >= 3) {
    rootDomain = parts.slice(-3).join('.');
  } else {
    rootDomain = parts.slice(-2).join('.');
  }

  // Prefix (subdomain kısmı)
  const isTR = parts[parts.length - 1] === 'tr';
  const prefixParts = isTR ? parts.slice(0, -3) : parts.slice(0, -2);

  if (prefixParts.length === 0) {
    return { rootDomain, corporateScore: 10, subdomainType: 'generic' };
  }

  // Scoring rules tablosundan kontrol
  // (Uygulama başlarken DB'den cache'e yükle)
  let maxScore = 0;
  let matchedType = 'generic';

  for (const part of prefixParts) {
    const rule = SUBDOMAIN_RULES_CACHE[part];
    if (rule && rule.corporate_score > maxScore) {
      maxScore = rule.corporate_score;
      matchedType = rule.subdomain_type;
    }
  }

  return {
    rootDomain,
    corporateScore: maxScore || 10,
    subdomainType: matchedType,
    triggerSubdomain: clean,
  };
}

function isTurkishDomain(d: string): boolean {
  return d.endsWith('.tr');
}

function isExcluded(domain: string): boolean {
  for (const ex of EXCLUDED_DOMAINS) {
    if (domain.includes(ex)) return true;
  }
  return false;
}

function extractRootDomain(hostname: string): string {
  const parts = hostname.split('.');
  if (parts[parts.length - 1] === 'tr') return parts.slice(-3).join('.');
  return parts.slice(-2).join('.');
}
```

---

## BÖLÜM 3: SHODAN ÜCRETSİZ TARAYICI

```typescript
// src/leadDiscovery/shodanFreeScanner.ts
// Ücretsiz API key: account.shodan.io → Register → API Key (2 dakika)
// Free tier: 100 sonuç/arama, sınırsız arama hakkı

const SHODAN_FREE_QUERIES = [
  {
    q: 'ssl.cert.subject.cn:*.com.tr country:TR',
    label: 'TR .com.tr SSL Sertifikaları',
    priority: 1,
  },
  {
    q: 'ssl.cert.subject.cn:*.net.tr country:TR',
    label: 'TR .net.tr SSL Sertifikaları',
    priority: 2,
  },
  {
    q: 'country:TR "ERP" http.title port:443',
    label: 'TR ERP Sistemleri (Yüksek değer)',
    priority: 1,
  },
  {
    q: 'country:TR "Outlook Web" http.title',
    label: 'TR Microsoft Exchange',
    priority: 2,
  },
  {
    q: 'country:TR "Fortinet" OR "FortiGate" port:443',
    label: 'TR Fortinet Cihazları',
    priority: 1,
  },
  {
    q: 'country:TR product:"VMware vSphere"',
    label: 'TR VMware Altyapısı',
    priority: 2,
  },
  {
    q: 'country:TR http.title:"Giriş" port:443 ssl',
    label: 'TR Giriş Sayfaları (Kurumsal)',
    priority: 3,
  },
  {
    q: 'ssl.cert.subject.o:* country:TR port:443',
    label: 'TR Kurumsal SSL (Organizasyonlu)',
    priority: 2,
  },
];

export async function scanShodanFree(
  queryIndex: number = 0,
  maxResults: number = 100
): Promise<ShodanFreeResult> {

  if (!process.env.SHODAN_API_KEY) {
    throw new Error([
      'Shodan API key gerekli.',
      '1. account.shodan.io adresine git',
      '2. Ücretsiz kayıt ol',
      '3. My Account → API Key kopyala',
      '4. Replit Secrets → SHODAN_API_KEY ekle',
      'Süre: 2 dakika. Ücretsiz.',
    ].join('\n'));
  }

  const qConfig = SHODAN_FREE_QUERIES[queryIndex];
  if (!qConfig) throw new Error(`Query ${queryIndex} bulunamadı`);

  const [run] = await db.insert(leadDiscoveryRuns).values({
    source: 'shodan_free',
    status: 'running',
    runParams: { query: qConfig.q, label: qConfig.label },
  }).returning();

  try {
    const response = await axios.get(
      'https://api.shodan.io/shodan/host/search',
      {
        params: { key: process.env.SHODAN_API_KEY, query: qConfig.q },
        timeout: 20000,
      }
    );

    const matches = (response.data.matches || []).slice(0, maxResults);
    let added = 0;

    for (const match of matches) {
      const domain = extractDomainFromShodan(match);
      if (!domain) continue;

      const companyName = match.ssl?.cert?.subject?.o ||
        match.org ||
        extractCompanyFromDomain(domain);

      const sector = inferSector(match);
      const isFortigate = (
        (match.product || '') + (match.http?.title || '')
      ).toLowerCase().includes('forti');

      await db.insert(leadCandidates).values({
        domain,
        companyName: cleanCompanyName(companyName),
        sector,
        city: match.location?.city,
        source: 'shodan_free',
        sourceData: {
          ip: match.ip_str,
          org: match.org,
          port: match.port,
          product: match.product,
          httpTitle: match.http?.title,
          shodanQuery: qConfig.label,
        },
        hasFortigate: isFortigate,
        scanStatus: 'pending',
      }).onConflictDoUpdate({
        target: leadCandidates.domain,
        set: {
          // Shodan verisiyle eksik bilgileri tamamla
          companyName: sql`COALESCE(lead_candidates.company_name, excluded.company_name)`,
          city: sql`COALESCE(lead_candidates.city, excluded.city)`,
          hasFortigate: sql`lead_candidates.has_fortigate OR excluded.has_fortigate`,
        },
      }).returning().then(r => { if (r.length > 0) added++; });
    }

    await db.update(leadDiscoveryRuns).set({
      status: 'completed',
      totalFound: added,
      completedAt: new Date(),
    }).where(eq(leadDiscoveryRuns.id, run.id));

    return {
      runId: run.id,
      label: qConfig.label,
      totalOnShodan: response.data.total,
      processed: matches.length,
      addedToLeads: added,
    };

  } catch (e) {
    await db.update(leadDiscoveryRuns).set({ status: 'failed' })
      .where(eq(leadDiscoveryRuns.id, run.id));
    throw e;
  }
}

function extractDomainFromShodan(match: any): string | null {
  // 1. SSL CN
  const cn = match.ssl?.cert?.subject?.cn;
  if (cn && cn.endsWith('.tr')) return extractRootDomain(cn.replace(/^\*\./, ''));

  // 2. Hostnames
  for (const h of match.hostnames || []) {
    if (h.endsWith('.tr')) return extractRootDomain(h);
  }

  // 3. Domains
  for (const d of match.domains || []) {
    if (d.endsWith('.tr')) return d;
  }
  return null;
}

function inferSector(match: any): string {
  const text = [
    match.http?.title, match.product, match.org,
    (match.tags || []).join(' ')
  ].join(' ').toLowerCase();

  if (text.includes('bank') || text.includes('finans') || text.includes('ödeme')) return 'finans';
  if (text.includes('hastane') || text.includes('saglik') || text.includes('klinik')) return 'saglik';
  if (text.includes('fabrika') || text.includes('üretim') || text.includes('scada')) return 'uretim';
  if (text.includes('lojistik') || text.includes('kargo')) return 'lojistik';
  if (text.includes('shop') || text.includes('mağaza')) return 'eticaret';
  return 'teknoloji';
}
```

---

## BÖLÜM 4: TOPLU PIPELINE

```typescript
// src/leadDiscovery/discoveryPipeline.ts

// Tüm süreci başlat: Keşif → Tarama → Kalifikasyon → Teaser
export async function runFullDiscoveryAndQualify(config: {
  useCrtsh?: boolean;       // crt.sh kullan (varsayılan: true)
  useShodan?: boolean;      // Shodan kullan (varsayılan: true)
  crtshQueries?: string[];  // Hangi TLD'ler
  shodanQueryIndexes?: number[]; // Hangi Shodan sorguları
  autoQualify?: boolean;    // Otomatik kalifikasyon (varsayılan: true)
  maxDomains?: number;      // Toplam maksimum domain
} = {}): Promise<void> {

  const {
    useCrtsh = true,
    useShodan = true,
    crtshQueries = ['%.com.tr', '%.net.tr'],
    shodanQueryIndexes = [0, 2, 4], // .com.tr SSL, ERP, Fortinet
    autoQualify = true,
    maxDomains = 200,
  } = config;

  logger.info('=== Tam Keşif Pipeline Başladı ===');

  // 1. crt.sh taramaları
  if (useCrtsh) {
    for (const query of crtshQueries) {
      logger.info(`crt.sh: ${query}`);
      await scanCRTSH(query, {
        daysBack: 30,
        minCorporateScore: 60,
        limit: Math.floor(maxDomains / 2),
      });
      await sleep(2000);
    }
  }

  // 2. Shodan taramaları
  if (useShodan && process.env.SHODAN_API_KEY) {
    for (const idx of shodanQueryIndexes) {
      logger.info(`Shodan query ${idx}: ${SHODAN_FREE_QUERIES[idx]?.label}`);
      await scanShodanFree(idx, 100);
      await sleep(3000);
    }
  }

  // 3. Otomatik kalifikasyon
  if (autoQualify) {
    logger.info('Kalifikasyon başlıyor...');

    const pending = await db.select()
      .from(leadCandidates)
      .where(eq(leadCandidates.scanStatus, 'pending'))
      .orderBy(
        desc(leadCandidates.hasFortigate),
        desc(sql`(source_data->>'corporate_score')::int`),
        asc(leadCandidates.createdAt)
      )
      .limit(50);

    logger.info(`${pending.length} aday işlenecek`);

    for (const candidate of pending) {
      try {
        // Domain tara
        const scanResult = await runDomainScan(candidate.domain, {
          mode: 'lead_qualification',
          timeout: 45000,
        });

        const criticals = scanResult.findings.filter(f => f.severity === 'critical');
        const isQualified = criticals.length >= 1 && scanResult.overallScore >= 40;

        await db.update(leadCandidates).set({
          scanStatus: 'scanned',
          scanId: scanResult.id,
          riskScore: scanResult.overallScore,
          criticalFindings: criticals.length,
          findingHighlights: criticals.slice(0, 3).map(f => f.title),
          isQualified,
          updatedAt: new Date(),
        }).where(eq(leadCandidates.id, candidate.id));

        if (!isQualified) {
          logger.info(`Reddedildi: ${candidate.domain} (risk: ${scanResult.overallScore})`);
          await sleep(1000);
          continue;
        }

        // İletişim bul
        if (!candidate.contactEmail) {
          const contact = await findContacts(candidate.domain);
          if (contact) {
            await db.update(leadCandidates).set({
              contactName: contact.name,
              contactTitle: contact.title,
              contactEmail: contact.email,
              contactEmailConfidence: contact.emailConfidence,
              contactSource: contact.source,
            }).where(eq(leadCandidates.id, candidate.id));
          }
          await sleep(500);
        }

        // Teaser üret
        const updated = await getLeadCandidate(candidate.id);
        if (updated.contactEmail) {
          await generateTeaserEmail(candidate.id, scanResult);
        }

        // ISR'a ekle
        await convertToISRLead(candidate.id, scanResult);

        logger.info(`✅ Kalifikasyon: ${candidate.domain} (${criticals.length} kritik, skor: ${scanResult.overallScore})`);

      } catch (e) {
        logger.error(`Hata: ${candidate.domain}`, e.message);
        await db.update(leadCandidates).set({
          scanStatus: 'failed',
        }).where(eq(leadCandidates.id, candidate.id));
      }

      await sleep(3000); // Domain başına bekleme
    }
  }

  logger.info('=== Pipeline Tamamlandı ===');
}
```

---

## BÖLÜM 5: ADMİN DASHBOARD

```
/admin-panel/lead-discovery

Sekmeler:
[ crt.sh | Shodan | Pipeline | Sonuçlar ]

─── crt.sh ──────────────────────────────────────────────────
Ücretsiz, API key gerekmez. SSL sertifika logları.

TLD seçimi:
  [✓] .com.tr  [✓] .net.tr  [ ] .org.tr  [ ] .edu.tr

Son kaç gün: [30 ▾]
Min kurumsal skor: [60 ▾]  (login/portal=80, ERP=95)
Maksimum domain: [200 ▾]

Subdomain filtreleri:
  [✓] ERP/CRM (95)   [✓] Portal/Intranet (85)
  [✓] Login/SSO (80) [✓] VPN/Remote (75)
  [✓] Mail (60)      [ ] Generic www (10)

[crt.sh Taramasını Başlat →]

Son sonuç: 234 domain bulundu, 198 lead listesine eklendi

─── SHODAN ──────────────────────────────────────────────────
Ücretsiz API key: account.shodan.io (2 dakika)
Kalan kredi: 89/100

Hazır sorgular:
  [✓] TR .com.tr SSL Sertifikaları  (100 sonuç)
  [✓] TR ERP Sistemleri              (100 sonuç)
  [✓] TR Fortinet Cihazları          (100 sonuç)
  [ ] TR Microsoft Exchange          (100 sonuç)
  [ ] TR VMware Altyapısı            (100 sonuç)
  [ ] TR Kurumsal SSL (Org'lu)       (100 sonuç)

[Shodan Taramasını Başlat →]

─── PİPELİNE ────────────────────────────────────────────────
Bekleyen aday:      247
Taranan:            0
Kuyruktaki:         247

[Tam Pipeline Başlat →]
(crt.sh + Shodan + Tarama + Kalifikasyon + Teaser)
Tahmini süre: 2-3 saat

─── SONUÇLAR ────────────────────────────────────────────────
Toplam aday:          247
Tarandı:              189  (%77)
Kalifikasyon geçti:    89  (%47)
İletişim bulundu:      67  (%75)
Teaser hazır:          62
Gönderildi:            20
Açıldı:                 8  (%40)
Tıklandı:               3  (%15)
ISR dönüşümü:           3

En yüksek riskli 5 aday:
  acme.com.tr       Skor:94  Kritik:4  FortiGate:✓  [Teaser Gönder]
  beta.net.tr       Skor:88  Kritik:3  FortiGate:✗  [Teaser Gönder]
  gamma.com.tr      Skor:81  Kritik:2  FortiGate:✓  [Teaser Gönder]
```

---

## BÖLÜM 6: CRON JOB'LAR

```typescript
// Her Pazartesi 03:00 — haftalık crt.sh
cron.schedule('0 3 * * 1', async () => {
  await scanCRTSH('%.com.tr', { daysBack: 7, minCorporateScore: 70, limit: 300 });
  await sleep(5000);
  await scanCRTSH('%.net.tr', { daysBack: 7, minCorporateScore: 70, limit: 100 });
});

// Her Salı 03:00 — haftalık Shodan (farklı sorgu)
cron.schedule('0 3 * * 2', async () => {
  const weekNum = getISOWeek(new Date());
  const queryIdx = weekNum % SHODAN_FREE_QUERIES.length;
  if (process.env.SHODAN_API_KEY) {
    await scanShodanFree(queryIdx, 100);
  }
});

// Her gece 04:00 — bekleyen adayları kalifikasyon
cron.schedule('0 4 * * *', async () => {
  const pending = await db.select()
    .from(leadCandidates)
    .where(eq(leadCandidates.scanStatus, 'pending'))
    .limit(20);

  if (pending.length > 0) {
    await runFullDiscoveryAndQualify({
      useCrtsh: false,
      useShodan: false,
      autoQualify: true,
    });
  }
});
```

---

## BÖLÜM 7: API ROTALAR

```
POST /api/admin/leads/discover/crtsh
  Body: { query, daysBack, minCorporateScore, limit }
  → crt.sh taraması başlat

GET  /api/admin/leads/discover/shodan/queries
  → Hazır Shodan sorgu listesi

POST /api/admin/leads/discover/shodan
  Body: { queryIndex, maxResults }
  → Shodan taraması başlat

POST /api/admin/leads/discover/full
  Body: { useCrtsh, useShodan, autoQualify, maxDomains }
  → Tam pipeline başlat

GET  /api/admin/leads/discovery/stats
  → Kaynak bazlı istatistikler

GET  /api/admin/leads/discovery/runs
  → Son tarama geçmişi (crt.sh + Shodan runs)

GET  /api/admin/leads/qualified
  → Kalifikasyon geçen liste (skor sırası)
  Query: ?minScore=60&hasContact=true&notSent=true

GET  /api/admin/leads/ready-to-send
  → Teaser hazır, onay bekleyenler
```

---

## BÖLÜM 8: İLK ÇALIŞTIRMA — 4 ADIM

```
ADIM 1 — Shodan key al (2 dakika, ücretsiz):
  account.shodan.io → Register → My Account → API Key
  Replit Secrets → SHODAN_API_KEY = [key]

ADIM 2 — crt.sh taraması (API key gereksiz):
  Admin → Lead Discovery → crt.sh
  Sorgu: %.com.tr | Son 30 gün | Min skor: 60
  [Başlat] → 5-10 dakika bekle
  Beklenti: 100-300 domain bulunur

ADIM 3 — Shodan taraması:
  Admin → Shodan
  "TR ERP Sistemleri" + "TR Fortinet Cihazları" seç
  [Başlat] → 2 dakika
  Beklenti: 100-200 sonuç, 30-50 Türk domain

ADIM 4 — Pipeline çalıştır:
  Admin → Pipeline → [Tam Pipeline Başlat]
  Otomatik: tara → kalifikasyon → teaser üret → ISR ekle
  ~2-3 saat (50 domain için)

  Sonuç:
    250 domain → %40 kalifikasyon → ~100 sıcak lead
    %75 iletişim bulunur → ~75 teaser hazır
    Admin onayla → 20/gün gönder → ilk müşteri
```

---

## ENVIRONMENT VARIABLES

```bash
# Shodan (2 dakikada ücretsiz alınır)
SHODAN_API_KEY=           # account.shodan.io

# İletişim bulma (opsiyonel ama önerilen)
HUNTER_API_KEY=           # hunter.io — 25 arama/ay ücretsiz
APOLLO_API_KEY=           # apollo.io — 50 kişi/ay ücretsiz

# E-posta gönderim
DAILY_EMAIL_LIMIT=20      # Günlük maksimum teaser
EMAIL_DELAY_SECONDS=120   # E-postalar arası bekleme (spam önleme)
```

---

*CyberStep.io — crt.sh + Shodan Lead Keşfi — 2026*
